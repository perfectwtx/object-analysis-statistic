// ObjectAnalyzer Mini API 客户端
//
// 默认走 Vite 开发服务器代理（/api → http://localhost:5200），前端无需感知端口与 CORS。
// 若要直连后端（例如生产部署），设置环境变量 VITE_API_BASE=http://host:port/api
// 可在项目根目录建 .env.local：
//   VITE_API_BASE=http://localhost:5200/api

export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// 允许通过页面覆盖后端地址（存 localStorage），便于临时切换环境
const BASE_KEY = 'apiBaseOverride';

export function getBaseUrl() {
  const override = localStorage.getItem(BASE_KEY);
  return override || API_BASE;
}

export function setBaseUrl(url) {
  if (url) localStorage.setItem(BASE_KEY, url.replace(/\/+$/, ''));
  else localStorage.removeItem(BASE_KEY);
}

const DEFAULT_TIMEOUT = 120_000; // 大文件分析可能较久

async function request(path, { method = 'GET', body, headers, signal, timeout = DEFAULT_TIMEOUT } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('请求超时')), timeout);
  // 外部取消时同步到内部 controller
  const onAbort = () => ctrl.abort(new Error('已取消'));
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method,
      body,
      headers,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }
    if (!res.ok) {
      const msg = payload?.error || payload?.title || (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
      throw new Error(msg);
    }
    return payload;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(e.message || '请求被取消');
    // 网络层失败（后端未启动 / 端口不通 / CORS）
    if (e instanceof TypeError) {
      throw new Error(`无法连接后端服务（${getBaseUrl()}）。请确认 ObjectAnalyzer.Api 已启动：dotnet run --project src/ObjectAnalyzer.Api`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/** 健康检查：返回 { status, version } */
export const health = (opts) => request('/health', { timeout: 5000, ...opts });

/**
 * 分析上传的数据文件。
 * @param {File} file 数据文件（json/jsonl/csv/xlsx/xml/yaml，支持 gz/zip）
 * @param {object} options
 *   rules      {File}   规则文件（与 rulesJson 二选一）
 *   rulesJson  {string} 内联规则 JSON 文本（优先）
 *   flatten, maxValues, fields, filter, rootPath, recordPath,
 *   sampleReservoir, sampleStep, maxParallel
 *   csvInferNumbers {boolean} CSV 里「看起来是数字」的字符串是否推断为数值（默认 true）。
 *     关掉则整列按 String 统计 —— 均值/标准差/分位数/相关性全部失效，只剩字符串指标。
 *     仅作用于 CSV：xlsx 单元格自带类型，JSON 的数字本来就是数字，都不需要推断。
 *   features：P4 深度分析开关 { enableCorrelation, enableStringPatterns,
 *             enableUnicodeHygiene, enableTimeSeries, enableDistributionSnapshot }
 */
export function analyzeFile(file, options = {}) {
  const form = new FormData();
  form.append('file', file);
  if (options.rulesJson) form.append('rulesJson', options.rulesJson);
  else if (options.rules) form.append('rules', options.rules);

  const num = (v) => (v === undefined || v === null || v === '' ? null : String(v));
  const append = (k, v) => { if (v !== null && v !== undefined && v !== '') form.append(k, String(v)); };
  if (options.flatten !== undefined) form.append('flatten', String(options.flatten));
  // CSV 数值推断：后端默认 true，这里显式传，保证 UI 上的开关和后端行为严格一致
  if (options.csvInferNumbers !== undefined) form.append('csvInferNumbers', String(options.csvInferNumbers));
  append('maxValues', num(options.maxValues));
  append('fields', options.fields);
  append('filter', options.filter);
  append('rootPath', options.rootPath);
  append('recordPath', options.recordPath);
  append('sampleReservoir', num(options.sampleReservoir));
  append('sampleStep', num(options.sampleStep));
  append('maxParallel', num(options.maxParallel));

  // P4 深度分析开关：显式传 true/false，全 false 时后端走 v1.x 快速路径
  for (const [k, v] of Object.entries(options.features || {})) {
    if (v !== undefined && v !== null) form.append(k, String(v));
  }

  // multipart 必须让浏览器自己设置 Content-Type（带 boundary）
  return request('/analyze', { method: 'POST', body: form, ...options.request });
}

/**
 * 分析请求体数据文本。
 * @param {string} text 数据内容
 * @param {string} format json / jsonl / csv / excel / xml / yaml
 * @param {object} [options] 与 analyzeFile 同构，另支持：
 *   rulesJson     {string} 内联规则 JSON —— 请求体被数据文本占用，规则只能走查询参数，
 *                          受请求行长度限制（Kestrel 默认 8KB）。规则较长请改用 analyzeFile
 *                          （把文本包成 File 走 multipart，前端「粘贴数据」就是这么做的）。
 *   allowUnknownRules {boolean} 规则含未知键时仍继续（默认后端直接 400 并列出 unknowns）
 */
export function analyzeRaw(text, format, options = {}) {
  const qs = new URLSearchParams();
  qs.set('format', format);
  const put = (k, v) => { if (v !== undefined && v !== null && v !== '') qs.set(k, String(v)); };
  put('flatten', options.flatten);
  if (options.csvInferNumbers !== undefined) put('csvInferNumbers', options.csvInferNumbers);
  put('rulesJson', options.rulesJson);
  put('allowUnknownRules', options.allowUnknownRules);
  put('maxValues', options.maxValues);
  put('fields', options.fields);
  put('filter', options.filter);
  put('rootPath', options.rootPath);
  put('recordPath', options.recordPath);
  put('sampleReservoir', options.sampleReservoir);
  put('sampleStep', options.sampleStep);
  put('maxParallel', options.maxParallel);
  for (const [k, v] of Object.entries(options.features || {})) {
    if (v !== undefined && v !== null) put(k, v);
  }

  return request(`/analyze/raw?${qs}`, {
    method: 'POST',
    body: text,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    ...options.request,
  });
}

/**
 * 规则校验（权威校验，走后端 /api/rules/validate）。
 *
 * 后端用 AnalysisRules 反序列化，比前端 JSON.parse 严格得多：
 * 能查出类型写错（"minValue": "abc"）、结构写错（"fields": [1,2,3]）等问题。
 * 另外会返回 unknowns —— 规则里写了但后端不认识的键（拼错或已废弃）。
 * STJ 反序列化时会静默忽略这些键，所以后端把它们判为**校验失败**（valid=false，
 * error 为中文说明，unknowns 逐项列出路径与建议写法）。要放行需显式 ?strict=false。
 *
 * @param {string} rulesText 规则文本。可以是 JSONC（注释会被后端跳过），
 *   但**不能含尾随逗号** —— 后端没开 AllowTrailingCommas，会直接 400。
 *   调用前用 toBackendRulesText() 处理。
 * @param {{strict?: boolean}} [opts] strict=false 时未知键只提示、不判失败
 * @returns {Promise<{ok: boolean, fields?: number, unknowns?: Array,
 *   error?: string, offline?: boolean}>}
 *   一律 resolve，不抛异常，便于 UI 直接渲染结果。
 *   unknowns 形如 [{ path, name, suggestion }]，path 为 '$' 表示顶层。
 */
export async function validateRules(rulesText, opts = {}) {
  const { strict, ...req } = opts;
  try {
    const r = await request(`/rules/validate${strict === false ? '?strict=false' : ''}`, {
      method: 'POST',
      body: rulesText,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15_000,
      ...req,
    });
    return {
      ok: r?.valid !== false,
      fields: r?.fields ?? 0,
      unknowns: r?.unknowns ?? [],
      error: r?.error,
    };
  } catch (e) {
    // 网络层失败 → 记为离线，调用方可降级到仅本地语法检查
    const offline = /无法连接后端/.test(e.message);
    return { ok: false, error: e.message, offline };
  }
}

/** 拉取全量规则参考模板（rules_full_reference.jsonc 原文） */
export function fetchRulesReference(opts) {
  return request('/rules/reference', { timeout: 10_000, ...opts });
}
