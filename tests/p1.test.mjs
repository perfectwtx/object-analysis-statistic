import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createAnalyzeSession } from '../src/lib/analyze-session.js';

let server, loadPlatformOverview, usePlatform, api, Workbench, ScoreRing;
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k),
};
const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true }, appType: 'custom' });
  ({ loadPlatformOverview } = await server.ssrLoadModule('/src/lib/load-platform.js'));
  ({ usePlatform } = await server.ssrLoadModule('/src/lib/store.js'));
  api = await server.ssrLoadModule('/src/api/index.js');
  ({ default: Workbench } = await server.ssrLoadModule('/src/workbench/WorkbenchShell.jsx'));
  ({ ScoreRing } = await server.ssrLoadModule('/src/components/ScoreRing.jsx'));
});
after(async () => {
  globalThis.fetch = originalFetch;
  globalThis.EventSource = originalEventSource;
  await server?.close();
});
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = () => new Promise((r) => setImmediate(r));

function emptyApi(overrides = {}) {
  const empty = async () => ({ data: [], unavailable: false });
  return { checkHealth: async () => ({ ok: true }), listJobs: empty, listIssues: empty,
    listQualitySnapshots: empty, getQualityTrend: empty, getQualityDashboard: empty,
    listBaselines: empty, listAlertRules: empty, ...overrides };
}

test('真实空响应保留空列表、空维度和空分数', async () => {
  const data = await loadPlatformOverview({ demo: false, api: emptyApi() });
  for (const key of ['jobs', 'issues', 'fields', 'trend', 'baselines', 'alerts']) assert.deepEqual(data[key], []);
  assert.equal(data.source, 'api'); assert.equal(data.score, null);
  assert.ok(Object.values(data.dims).every((v) => v === null));
});

test('模块失败或未启用不混入样例，也不丢弃成功模块', async () => {
  const data = await loadPlatformOverview({ demo: false, api: emptyApi({
    listJobs: async () => ({ data: [{ id: 'real', score: 91 }], unavailable: false }),
    getQualityTrend: async () => { throw new Error('trend failed'); },
    listAlertRules: async () => ({ unavailable: true, data: null }),
  }) });
  assert.equal(data.jobs.length, 1); assert.equal(data.jobs[0].id, 'real');
  assert.deepEqual(data.trend, []); assert.deepEqual(data.alerts, []);
  assert.equal(data.modules.trend.source, 'error');
  assert.equal(data.modules.alerts.source, 'unavailable');
  assert.match(data.error, /trend failed/);
});

test('全部离线时仍保持真实模式；显式演示无需请求后端', async () => {
  const unavailable = async () => { throw new Error('offline'); };
  const offline = Object.fromEntries(Object.keys(emptyApi()).map((k) => [k, unavailable]));
  const data = await loadPlatformOverview({ demo: false, api: offline });
  assert.equal(data.source, 'api'); assert.equal(data.backendOk, false); assert.deepEqual(data.jobs, []);
  const demo = await loadPlatformOverview({ demo: true, api: offline });
  assert.equal(demo.source, 'demo'); assert.ok(demo.jobs.length > 0);
});

test('缺失分数展示未知，不显示 0 分或不健康结论', () => {
  const html = renderToStaticMarkup(React.createElement(ScoreRing, { score: null }));
  assert.match(html, /—/); assert.match(html, /暂无数据/);
  assert.doesNotMatch(html, />0\.0</); assert.doesNotMatch(html, /需要处理/);
});

// 运行真实组件事件与 hook，轻量 dispatcher 仅提供状态容器，不模拟业务函数。
function componentHarness(Component) {
  const values = []; let cursor = 0;
  const dispatcher = {
    useState(initial) {
      const i = cursor++;
      if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
      return [values[i], (v) => { values[i] = typeof v === 'function' ? v(values[i]) : v; }];
    },
    useRef(initial) { const i = cursor++; return values[i] ||= { current: initial }; },
    useCallback(fn) { return fn; }, useMemo(fn) { return fn(); }, useEffect() {},
    useSyncExternalStore(subscribe, getSnapshot) { return getSnapshot(); }, useDebugValue() {},
  };
  return () => {
    cursor = 0;
    const ref = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
    const previous = ref.current; ref.current = dispatcher;
    try { return Component().props; } finally { ref.current = previous; }
  };
}

test('真实工作台应用规则后清空，下一次请求不携带旧规则', async () => {
  const forms = [];
  globalThis.fetch = async (url, opts) => {
    if (url.endsWith('/rules/validate')) return reply({ valid: true, fields: 1 });
    if (url.endsWith('/preflight')) return reply({ sampleFields: ['age'], hasWarning: false });
    if (url.endsWith('/analyze')) { forms.push(opts.body); return reply({ totalObjects: 1, fieldStatistics: [] }); }
    return reply([]);
  };
  const render = componentHarness(Workbench);
  await render().onFile({ target: { files: [new File(['[{"age":10}]'], 'data.json')], value: 'x' } });
  render().setRulesText('{"fields":{"age":{"required":true}}}');
  await render().applyRules();
  assert.ok(forms.at(-1).get('rulesJson')?.includes('age'));
  render().clearRules(); await flush();
  assert.equal(forms.at(-1).get('rulesJson'), null);
});

test('预检与分析表单共享过滤、路径、规则和运行选项', async () => {
  const forms = [];
  globalThis.fetch = async (url, opts) => { forms.push(opts.body); return reply({}); };
  const file = new File(['[]'], 'data.json');
  const options = { rulesJson: '{"fields":{}}', fields: 'age', filter: 'age>0', rootPath: 'data', recordPath: 'rows', sampleStep: 2, maxParallel: 3, flatten: false, csvInferNumbers: false, features: { enableCorrelation: true } };
  await api.preflight(file, options); await api.analyzeFile(file, options);
  const entries = (form) => [...form].filter(([key]) => key !== 'file');
  assert.deepEqual(entries(forms[0]), entries(forms[1]));
});

function sessionHarness(overrides = {}) {
  let state = {}; let events, poll; const cancelled = []; let closed = 0, stopped = 0;
  const deps = {
    ASYNC_THRESHOLD_BYTES: 2, analyzeFile: async () => ({}),
    analyzeFileAsync: async () => ({ jobId: 'job' }), cancelAnalyzeJob: async (id) => { cancelled.push(id); },
    saveLastJobId() {}, getAnalyzeJob: async () => ({ status: 'Completed', result: {} }),
    subscribeAnalyzeEvents(id, callbacks) { events = callbacks; return { close() { closed++; } }; },
    pollAnalyzeJob(id, callbacks) { poll = callbacks; return { stop() { stopped++; } }; }, ...overrides,
  };
  const session = createAnalyzeSession(deps, (p) => ({ ...p }), (p) => { state = { ...state, ...p }; });
  return { session, cancelled, get state() { return state; }, get events() { return events; }, get poll() { return poll; }, get closed() { return closed; }, get stopped() { return stopped; } };
}
const file = { size: 10 };

test('取消尚未返回的异步提交，延迟 jobId 会补发取消', async () => {
  const submission = deferred();
  const h = sessionHarness({ analyzeFileAsync: () => submission.promise });
  const pending = h.session.start(file); await h.session.cancel();
  submission.resolve({ jobId: 'late' }); await pending;
  assert.deepEqual(h.cancelled, ['late']); assert.equal(h.state.phase, 'cancelled');
  assert.equal(h.events, undefined); assert.equal(h.poll, undefined);
});

test('取消失败明确提示后端可能仍运行', async () => {
  const h = sessionHarness({ cancelAnalyzeJob: async () => { throw new Error('offline'); } });
  await h.session.start(file); await h.session.cancel();
  assert.match(h.state.error, /后端任务可能仍在运行/);
});

test('同步旧响应不能覆盖新结果，reset 也会阻止旧响应', async () => {
  const first = deferred(); let calls = 0, signal;
  const h = sessionHarness({ analyzeFile: (f, o) => { if (++calls === 1) { signal = o.request.signal; return first.promise; } return Promise.resolve({ marker: 'new' }); } });
  const old = h.session.start({ size: 1 });
  await h.session.start({ size: 1 }); assert.equal(signal.aborted, true);
  first.resolve({ marker: 'old' }); await old;
  assert.equal(h.state.result.marker, 'new');
  const pending = deferred(); const r = sessionHarness({ analyzeFile: () => pending.promise });
  const run = r.session.start({ size: 1 }); r.session.reset(); pending.resolve({ marker: 'old' }); await run;
  assert.equal(r.state.phase, 'idle'); assert.equal(r.state.result, null);
});

test('新任务不会被旧异步提交启动监听，并取消旧后端任务', async () => {
  const first = deferred(); let calls = 0;
  const h = sessionHarness({ analyzeFileAsync: () => ++calls === 1 ? first.promise : Promise.resolve({ jobId: 'new' }) });
  const old = h.session.start(file); await h.session.start(file);
  first.resolve({ jobId: 'old' }); await old;
  assert.deepEqual(h.cancelled, ['old']); assert.equal(h.state.jobId, 'new'); h.session.dispose();
});

test('SSE 回退轮询、完成后清理、过期回调失效', async () => {
  globalThis.EventSource = class {};
  const h = sessionHarness(); await h.session.start(file);
  h.events.onError(); assert.ok(h.poll); assert.equal(h.closed, 1);
  h.poll.onTerminal({ status: 'Completed', result: { marker: 'done' } });
  assert.equal(h.state.phase, 'done'); assert.equal(h.stopped, 1);
  h.events.onProgress({ processedObjects: 999 });
  assert.notEqual(h.state.progress.processedObjects, 999);
});

test('无 SSE 环境直接轮询；卸载停止跟踪但不取消后端', async () => {
  delete globalThis.EventSource;
  const h = sessionHarness(); await h.session.start(file); assert.ok(h.poll);
  h.session.dispose(); assert.equal(h.stopped, 1); assert.deepEqual(h.cancelled, []);
  h.poll.onTerminal({ status: 'Completed', result: {} }); assert.equal(h.state.phase, 'running');
});

test('SSE 结果拉取中离开页面会中止请求并忽略迟到响应', async () => {
  globalThis.EventSource = class {}; const result = deferred(); let signal;
  const h = sessionHarness({ getAnalyzeJob: (id, opts) => { signal = opts.signal; return result.promise; } });
  await h.session.start(file); const complete = h.events.onComplete(); h.session.dispose();
  assert.equal(signal.aborted, true); assert.equal(h.closed, 1);
  result.resolve({ status: 'Completed', result: {} }); await complete;
  assert.equal(h.state.phase, 'running');
});

test('SSE 返回过期作业时关闭连接并展示错误', async () => {
  globalThis.EventSource = class {};
  const h = sessionHarness(); await h.session.start(file);
  h.events.onGone(); assert.equal(h.state.phase, 'error');
  assert.equal(h.closed, 1); assert.match(h.state.error, /作业已过期/);
});

test('卸载时中止同步请求，晚到异步提交保留后端任务但不更新页面', async () => {
  let signal; const sync = deferred();
  const h = sessionHarness({ analyzeFile: (f, opts) => { signal = opts.request.signal; return sync.promise; } });
  const pendingSync = h.session.start({ size: 1 }); h.session.dispose();
  assert.equal(signal.aborted, true); sync.resolve({ marker: 'late' }); await pendingSync;
  assert.equal(h.state.result, null);
  const submission = deferred(); const a = sessionHarness({ analyzeFileAsync: () => submission.promise });
  const pending = a.session.start(file); a.session.dispose(); submission.resolve({ jobId: 'background' }); await pending;
  assert.deepEqual(a.cancelled, []); assert.equal(a.state.jobId, null);
  assert.equal(a.events, undefined); assert.equal(a.poll, undefined);
});

test('调用方 AbortSignal 在提交期间取消也会补发后端取消', async () => {
  const submission = deferred(); const ctrl = new AbortController();
  const h = sessionHarness({ analyzeFileAsync: () => submission.promise });
  const pending = h.session.start(file, { request: { signal: ctrl.signal } });
  ctrl.abort(); submission.resolve({ jobId: 'aborted' }); await pending;
  assert.deepEqual(h.cancelled, ['aborted']); assert.equal(h.state.phase, 'cancelled');
});

test('实际轮询支持排队，404 停止，临时故障重试有上限', async () => {
  delete globalThis.EventSource;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return calls === 1 ? reply({ status: 'Queued' }) : reply({ error: 'gone' }, 404); };
  await new Promise((resolve, reject) => {
    api.pollAnalyzeJob('expired', { intervalMs: 1, onTerminal: () => reject(new Error('Queued 被误判终态')),
      onError(e, info) { if (info.terminal) resolve(); } });
  });
  assert.equal(calls, 2); calls = 0;
  globalThis.fetch = async () => { calls++; return reply({ error: 'temporary' }, 503); };
  await new Promise((resolve) => api.pollAnalyzeJob('retry', { intervalMs: 1, maxErrors: 3,
    onError(e, info) { if (info.terminal) resolve(); } }));
  assert.equal(calls, 3);
});

test('停止实际轮询会中止正在进行的请求，迟到响应不再回调', async () => {
  const request = deferred(); let signal, updates = 0;
  globalThis.fetch = (url, opts) => { signal = opts.signal; return request.promise; };
  const poll = api.pollAnalyzeJob('stop', { onUpdate() { updates++; } });
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(signal); poll.stop(); assert.equal(signal.aborted, true);
  request.resolve(reply({ status: 'Completed' })); await flush();
  assert.equal(updates, 0);
});

test('告警 PUT 保留完整规则及发现的路径，刷新后状态保持', async () => {
  let saved = { id: 'a', name: 'rule', enabled: true, threshold: 70, webhookUrl: 'https://example.com/hook' };
  let put;
  globalThis.fetch = async (url, opts = {}) => {
    if (opts.method === 'PUT') { put = { url, body: JSON.parse(opts.body) }; saved = put.body; return reply(saved); }
    if (url.endsWith('/alert-rules')) return reply({ error: 'missing' }, 404);
    if (url.endsWith('/alerts/rules')) return reply([saved]);
    if (url.endsWith('/health')) return reply({ status: 'ok' });
    return reply([]);
  };
  await usePlatform.getState().refresh();
  await usePlatform.getState().toggleAlert('a');
  assert.equal(put.url, '/api/alerts/rules/a'); assert.equal(put.body.enabled, false);
  assert.equal(put.body.threshold, 70); assert.equal(put.body.webhookUrl, saved.webhookUrl);
  await usePlatform.getState().refresh();
  assert.equal(usePlatform.getState().alerts[0].enabled, false);
});

test('告警保存期间防重复、失败保持原值并可重试；演示不写后端', async () => {
  const pending = deferred(); let puts = 0;
  usePlatform.setState({ source: 'api', loading: false, modules: { alerts: { source: 'api' } },
    alerts: [{ id: 'a', enabled: true, raw: { id: 'a', enabled: true } }] });
  globalThis.fetch = () => { puts++; return pending.promise; };
  const request = usePlatform.getState().toggleAlert('a');
  assert.equal(usePlatform.getState().alertSaving.a, true);
  assert.equal(usePlatform.getState().alerts[0].enabled, true);
  await usePlatform.getState().toggleAlert('a'); assert.equal(puts, 1);
  pending.resolve(reply({ error: 'cannot save' }, 500)); await assert.rejects(request, /cannot save/);
  assert.equal(usePlatform.getState().alerts[0].enabled, true); assert.deepEqual(usePlatform.getState().alertSaving, {});
  usePlatform.setState({ source: 'demo' }); await usePlatform.getState().toggleAlert('a');
  assert.equal(puts, 1); assert.equal(usePlatform.getState().alerts[0].enabled, false);
});
