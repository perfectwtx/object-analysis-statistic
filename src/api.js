// ObjectAnalyzer Mini API 客户端
//
// 默认走 Vite 开发服务器代理（/api → http://localhost:5200），前端无需感知端口与 CORS。
// 若要直连后端（例如生产部署），设置环境变量 VITE_API_BASE=http://host:port/api
// 可在项目根目录建 .env.local：
//   VITE_API_BASE=http://localhost:5200/api

export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

/** 文件体积达到该阈值时，默认走异步分析 */
export const ASYNC_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2 MB

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
 * 把与 analyzeFile 相同的 options 填进 FormData。
 * 同步 / 异步共用，避免两处字段漂移。
 */
export function appendAnalyzeOptions(form, options = {}) {
  if (options.rulesJson) form.append('rulesJson', options.rulesJson);
  else if (options.rules) form.append('rules', options.rules);

  const num = (v) => (v === undefined || v === null || v === '' ? null : String(v));
  const append = (k, v) => {
    if (v !== null && v !== undefined && v !== '') form.append(k, String(v));
  };

  if (options.flatten !== undefined) form.append('flatten', String(options.flatten));
  // CSV 数值推断：后端默认 true，这里显式传，保证 UI 上的开关和后端行为严格一致
  if (options.csvInferNumbers !== undefined) form.append('csvInferNumbers', String(options.csvInferNumbers));
  if (options.allowUnknownRules !== undefined) form.append('allowUnknownRules', String(options.allowUnknownRules));
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
}

/**
 * 分析上传的数据文件（同步）。
 */
export function analyzeFile(file, options = {}) {
  const form = new FormData();
  form.append('file', file);
  appendAnalyzeOptions(form, options);
  // multipart 必须让浏览器自己设置 Content-Type（带 boundary）
  return request('/analyze', { method: 'POST', body: form, ...options.request });
}

/**
 * 提交异步分析（multipart）。只等待作业创建，不阻塞到分析结束。
 */
export function analyzeFileAsync(file, options = {}) {
  const form = new FormData();
  form.append('file', file);
  appendAnalyzeOptions(form, options);
  return request('/analyze/async', {
    method: 'POST',
    body: form,
    timeout: 60_000,
    ...options.request,
  });
}

/** 查询异步作业快照（状态 / 进度 / 结果 / 错误） */
export function getAnalyzeJob(jobId, opts = {}) {
  return request(`/analyze/async/${encodeURIComponent(jobId)}`, {
    timeout: 15_000,
    ...opts,
  });
}

/** 取消异步作业 */
export function cancelAnalyzeJob(jobId, opts = {}) {
  return request(`/analyze/async/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
    timeout: 10_000,
    ...opts,
  });
}

/**
 * 订阅 SSE 进度。
 * @returns {{ close: () => void }}
 */
export function subscribeAnalyzeEvents(jobId, { onProgress, onComplete, onGone, onError } = {}) {
  const url = `${getBaseUrl()}/analyze/async/${encodeURIComponent(jobId)}/events`;
  const es = new EventSource(url);
  let closed = false;

  const safeParse = (data) => {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  };

  es.addEventListener('progress', (e) => {
    onProgress?.(safeParse(e.data));
  });

  es.addEventListener('complete', (e) => {
    const payload = safeParse(e.data);
    onProgress?.(payload);
    onComplete?.(payload);
    close();
  });

  es.addEventListener('gone', (e) => {
    onGone?.(safeParse(e.data));
    close();
  });

  es.onerror = () => {
    if (closed) return;
    onError?.(new Error('SSE 连接中断'));
    close();
  };

  function close() {
    if (closed) return;
    closed = true;
    try {
      es.close();
    } catch {
      /* ignore */
    }
  }

  return { close };
}

/**
 * 轮询兜底（SSE 不可用时）。
 * @returns {{ stop: () => void }}
 */
export function pollAnalyzeJob(jobId, { intervalMs = 1000, onUpdate, onTerminal, onError } = {}) {
  let stopped = false;
  let timer = null;

  const tick = async () => {
    if (stopped) return;
    try {
      const snap = await getAnalyzeJob(jobId);
      onUpdate?.(snap);
      const status = String(snap?.status || '');
      const terminal = !/^running$/i.test(status);
      if (terminal) {
        onTerminal?.(snap);
        stop();
        return;
      }
    } catch (e) {
      onError?.(e);
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };

  timer = setTimeout(tick, 0);

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { stop };
}

/**
 * 分析请求体数据文本。
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
    const offline = /无法连接后端/.test(e.message);
    return { ok: false, error: e.message, offline };
  }
}

/** 拉取全量规则参考模板 */
export function fetchRulesReference(opts) {
  return request('/rules/reference', { timeout: 10_000, ...opts });
}

/**
 * 分析前预检。
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
  return r?.preflight ?? r;
}
