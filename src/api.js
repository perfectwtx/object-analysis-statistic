// ObjectAnalyzer API v2 客户端
//
// v2 契约（后端 W8 重构）：
//   同步  POST /analyze（multipart）、/analyze/config（JSON body）、/analyze/raw（请求体即数据）
//         → AnalyzeViewResponse：{ fileName, format, rulesSource, overview, preview,
//                                  fields, deepAnalysis, quality, result }
//   异步  POST /analyze/async（multipart）、/analyze/async/config（JSON body）→ { jobId, status, … }
//         GET  /analyze/async/{jobId}            → 作业快照（终态时 result + preview）
//         GET  /analyze/async/{jobId}/events     → SSE 进度流（progress / complete / gone）
//         POST /analyze/async/{jobId}/cancel     → 真实中止后台分析
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

// ---------- 请求选项序列化 ----------
//
// 选项名必须与后端 AnalyzeRequestOptions 的属性名（camelCase）严格一致。
// 早期版本用的 maxValues / maxParallel 后端根本没有对应属性，会被静默忽略，
// 这里统一改为 maxValuesToShow / maxDegreeOfParallelism。
function appendOptions(form, options = {}) {
  const num = (v) => (v === undefined || v === null || v === '' ? null : String(v));
  const append = (k, v) => { if (v !== null && v !== undefined && v !== '') form.append(k, String(v)); };
  if (options.flatten !== undefined) form.append('flatten', String(options.flatten));
  // CSV 数值推断：后端默认 true，这里显式传，保证 UI 上的开关和后端行为严格一致
  if (options.csvInferNumbers !== undefined) form.append('csvInferNumbers', String(options.csvInferNumbers));
  append('maxValuesToShow', num(options.maxValuesToShow ?? options.maxValues));
  append('maxDegreeOfParallelism', num(options.maxDegreeOfParallelism ?? options.maxParallel));
  append('fields', options.fields);
  append('filter', options.filter);
  append('rootPath', options.rootPath);
  append('recordPath', options.recordPath);
  append('sampleReservoir', num(options.sampleReservoir));
  append('sampleStep', num(options.sampleStep));

  // 深度分析开关：显式传 true/false，全 false 时后端走快速路径（不产生额外开销）
  for (const [k, v] of Object.entries(options.features || {})) {
    if (v !== undefined && v !== null) form.append(k, String(v));
  }
  return form;
}

/** 把分析选项写进查询串（/analyze/raw 用） */
function putOptions(qs, options = {}) {
  const put = (k, v) => { if (v !== undefined && v !== null && v !== '') qs.set(k, String(v)); };
  put('flatten', options.flatten);
  put('csvInferNumbers', options.csvInferNumbers);
  put('maxValuesToShow', options.maxValuesToShow ?? options.maxValues);
  put('maxDegreeOfParallelism', options.maxDegreeOfParallelism ?? options.maxParallel);
  put('fields', options.fields);
  put('filter', options.filter);
  put('rootPath', options.rootPath);
  put('recordPath', options.recordPath);
  put('sampleReservoir', options.sampleReservoir);
  put('sampleStep', options.sampleStep);
  for (const [k, v] of Object.entries(options.features || {})) {
    if (v !== undefined && v !== null) put(k, v);
  }
  return qs;
}

/**
 * 分析上传的数据文件（同步，一次性拿到结果）。
 * @param {File} file 数据文件（json/jsonl/csv/xlsx/xml/yaml，支持 gz/zip）
 * @param {object} options
 *   rules      {File}   规则文件（与 rulesJson 二选一）
 *   rulesJson  {string} 内联规则 JSON 文本（优先）
 *   flatten, csvInferNumbers, maxValuesToShow, maxDegreeOfParallelism,
 *   fields, filter, rootPath, recordPath, sampleReservoir, sampleStep
 *   features：深度分析开关 { enableCorrelation, enableStringPatterns,
 *             enableUnicodeHygiene, enableTimeSeries, enableDistributionSnapshot }
 */
export function analyzeFile(file, options = {}) {
  const form = new FormData();
  form.append('file', file);
  if (options.rulesJson) form.append('rulesJson', options.rulesJson);
  else if (options.rules) form.append('rules', options.rules);
  if (options.allowUnknownRules !== undefined) form.append('allowUnknownRules', String(options.allowUnknownRules));
  appendOptions(form, options);

  // multipart 必须让浏览器自己设置 Content-Type（带 boundary）
  return request('/analyze', { method: 'POST', body: form, ...options.request });
}

/**
 * 分析请求体数据文本（同步）。
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
  putOptions(qs, options);
  qs.set('rulesJson', options.rulesJson ?? '');
  if (options.allowUnknownRules !== undefined) qs.set('allowUnknownRules', String(options.allowUnknownRules));

  return request(`/analyze/raw?${qs}`, {
    method: 'POST',
    body: text,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    ...options.request,
  });
}

/**
 * 强类型 JSON body 同步分析（数据文本内嵌 + 强类型 rules 对象）。
 * 规则是对象而非文本，省去前端自己序列化，后端也能给出逐字段的校验错误。
 */
export function analyzeConfig({ dataText, format, rules, ...options }) {
  const body = { dataText, format };
  if (rules) body.rules = rules;
  for (const [k, v] of Object.entries(options)) {
    if (k === 'features') Object.assign(body, v);
    else if (!['request', 'rulesJson', 'rules', 'allowUnknownRules'].includes(k)) body[k] = v;
  }
  if (options.rulesJson) body.rules = JSON.parse(options.rulesJson);

  return request('/analyze/config', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    ...options.request,
  });
}

// ---------- 异步分析 ----------
//
// 大文件分析可能跑很久，同步请求会因为代理/网关超时被掐断，也拿不到进度。
// v2 提供作业式接口：提交立即返回 jobId → SSE 推送进度 → 终态后拉结果。
// 另外 /cancel 能真正中止后台分析（同步接口 abort 只是断开连接，后端还在算）。

/** 提交异步分析作业（multipart）。返回 { jobId, status, fileName, format, rulesSource, submittedAt } */
export function submitAsyncJob(file, options = {}) {
  const form = new FormData();
  form.append('file', file);
  if (options.rulesJson) form.append('rulesJson', options.rulesJson);
  else if (options.rules) form.append('rules', options.rules);
  if (options.allowUnknownRules !== undefined) form.append('allowUnknownRules', String(options.allowUnknownRules));
  appendOptions(form, options);

  return request('/analyze/async', { method: 'POST', body: form, ...options.request });
}

/** 提交异步分析作业（JSON body，数据文本内嵌）。 */
export function submitAsyncConfigJob({ dataText, format, rules, ...options }) {
  const body = { dataText, format };
  if (rules) body.rules = rules;
  if (options.rulesJson) body.rules = JSON.parse(options.rulesJson);
  for (const [k, v] of Object.entries(options)) {
    if (k === 'features') Object.assign(body, v);
    else if (!['request', 'rulesJson', 'rules', 'allowUnknownRules'].includes(k)) body[k] = v;
  }

  return request('/analyze/async/config', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    ...options.request,
  });
}

/**
 * 查询作业快照。
 * 终态（Completed）时含 result（完整 AnalysisResult）与 preview（样本行数组）；
 * Failed 时含 error（"TypeName: message"）。
 */
export const getJob = (jobId, opts) => request(`/analyze/async/${encodeURIComponent(jobId)}`, { timeout: 30_000, ...opts });

/** 取消作业。返回 { jobId, cancelled }；作业已终态时 cancelled=false。 */
export const cancelJob = (jobId, opts) =>
  request(`/analyze/async/${encodeURIComponent(jobId)}/cancel`, { method: 'POST', timeout: 10_000, ...opts });

/**
 * 订阅作业事件流（SSE）。
 * @param {string} jobId
 * @param {{onProgress?, onComplete?, onGone?, onError?}} handlers
 *   事件负载：{ processedObjects, status, error? }
 * @returns {EventSource} 调用方负责 close()
 */
export function openJobEvents(jobId, { onProgress, onComplete, onGone, onError } = {}) {
  const url = `${getBaseUrl()}/analyze/async/${encodeURIComponent(jobId)}/events`;
  const es = new EventSource(url);

  const parse = (e) => {
    try { return JSON.parse(e.data); } catch { return null; }
  };
  if (onProgress) es.addEventListener('progress', (e) => onProgress(parse(e)));
  if (onComplete) es.addEventListener('complete', (e) => onComplete(parse(e)));
  if (onGone) es.addEventListener('gone', (e) => onGone(parse(e)));
  // EventSource 在流正常结束（服务端 return）时也会触发 error，由调用方判断是否已终态
  if (onError) es.addEventListener('error', () => onError());
  return es;
}

const TERMINAL = ['Completed', 'Failed', 'Cancelled'];

/**
 * 等待作业进入终态：优先 SSE，断流则降级为轮询。
 * 终态为 Failed / Cancelled 时抛出对应错误。
 */
function waitForJob(jobId, { onProgress, isStopped, timeout }) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    let settled = false;
    let es = null;
    let pollTimer = null;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      if (es) es.close();
      if (pollTimer) clearTimeout(pollTimer);
      if (err) reject(err); else resolve();
    };

    const handle = (data) => {
      if (!data) return;
      onProgress?.(data);
      if (!TERMINAL.includes(data.status)) return;
      if (data.status === 'Failed') finish(new Error(data.error || '分析失败'));
      else if (data.status === 'Cancelled') finish(new Error('已取消分析'));
      else finish();
    };

    const poll = async () => {
      if (settled) return;
      if (isStopped?.()) return finish();            // 用户已取消，交给外层处理
      if (Date.now() > deadline) return finish(new Error('分析超时'));
      try {
        handle(await getJob(jobId));
      } catch (e) {
        return finish(e);
      }
      if (!settled) pollTimer = setTimeout(poll, 800);
    };

    // SSE 不可用（老浏览器 / 代理掐断长连接）时静默降级为轮询，不打断分析
    try {
      es = openJobEvents(jobId, {
        onProgress: handle,
        onComplete: handle,
        onGone: () => finish(new Error('作业不存在或已被清理（超过保留窗口）')),
        onError: () => { if (es) { es.close(); es = null; } poll(); },
      });
    } catch {
      poll();
    }

    pollTimer = setTimeout(() => {
      if (!settled) finish(new Error('分析超时'));
    }, timeout);
  });
}

/**
 * 提交异步分析并等待结果（推荐入口）。
 *
 * @param {File} file 数据文件
 * @param {object} options 与 analyzeFile 同构
 * @param {{onProgress?, signal?, timeout?}} [ctrl]
 *   onProgress 收到 { processedObjects, status }
 *   signal     AbortSignal —— abort 时会调用 /cancel 真正中止后端分析
 * @returns {Promise<object>} 终态作业快照（含 result 与 preview）
 */
export async function runAsyncJob(file, options = {}, { onProgress, signal, timeout = DEFAULT_TIMEOUT } = {}) {
  const submitted = await submitAsyncJob(file, options);
  const jobId = submitted.jobId;

  let cancelled = false;
  const onCancel = () => {
    cancelled = true;
    // 同步接口 abort 只是断开连接，后端照算不误；这里显式通知后端停手
    cancelJob(jobId).catch(() => {});
  };
  if (signal) {
    if (signal.aborted) { onCancel(); throw new Error('已取消'); }
    signal.addEventListener('abort', onCancel, { once: true });
  }

  try {
    await waitForJob(jobId, { onProgress, isStopped: () => cancelled, timeout });
  } finally {
    if (signal) signal.removeEventListener('abort', onCancel);
  }

  if (cancelled) throw new Error('已取消分析');
  return getJob(jobId);
}

// ---------- 规则 ----------

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

/**
 * 分析前预检（方案 B 防御「用错规则文件」）。
 * 后端 /api/preflight 复用 Core 的 PreflightChecker，与 /api/analyze 解析路径完全一致：
 * 解析前 N 条记录，大小写不敏感 + 父路径匹配规则字段，返回 hasWarning 及字段清单。
 * 命中即由调用方弹确认框，用户确认后才真正发起分析。
 *
 * @param {File} file 数据文件（与 /api/analyze 同款）
 * @param {object} options
 *   rulesJson        {string}  内联规则 JSON 文本（优先；与 rules 二选一）
 *   rules            {File}    规则文件
 *   flatten          {boolean} JSON 嵌套展平（默认 true，由后端回填）
 *   csvInferNumbers  {boolean} CSV 数字列推断（默认 true）
 *   recordPath       {string}  记录级 JSONPath
 *   allowUnknownRules {boolean} 跳过未知键检查（默认 false）
 * @returns {Promise<{hasWarning:boolean, ruleFields:string[], matchedRuleFields:string[],
 *   unmatchedRuleFields:string[], sampleFields:string[], truncatedSampleFieldCount:number}>}
 *   成功时返回 response.preflight 对象；400 时抛错（含后端中文说明）。
 */
export async function preflight(file, options = {}) {
  const form = new FormData();
  form.append('file', file);
  if (options.rulesJson) form.append('rulesJson', options.rulesJson);
  else if (options.rules) form.append('rules', options.rules);
  if (options.flatten !== undefined) form.append('flatten', String(options.flatten));
  if (options.csvInferNumbers !== undefined) form.append('csvInferNumbers', String(options.csvInferNumbers));
  if (options.recordPath) form.append('recordPath', options.recordPath);
  if (options.allowUnknownRules !== undefined) form.append('allowUnknownRules', String(options.allowUnknownRules));

  const r = await request('/preflight', { method: 'POST', body: form, timeout: 30_000 });
  // 后端响应包了一层 { preflight: {...} }，这里透传内层，省得调用方再多解一层
  return r?.preflight ?? r;
}
