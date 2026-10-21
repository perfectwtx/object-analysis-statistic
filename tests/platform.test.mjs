import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
after(() => server.close());
const { loadPlatformOverview } = await server.ssrLoadModule('/src/lib/load-platform.js');
const apiClient = await server.ssrLoadModule('/src/api/platform.js');
const { routeEnabled } = await server.ssrLoadModule('/src/lib/capabilities.js');
const { usePlatform } = await server.ssrLoadModule('/src/lib/store.js');
const originalFetch = globalThis.fetch;
globalThis.localStorage = { getItem: () => null };
after(() => { globalThis.fetch = originalFetch; });

test('重试单个模块保留其他结果，趋势与快照只请求一次', async () => {
  const calls = {};
  let fail = true;
  const api = Object.fromEntries(['listJobs', 'listIssues', 'getQualityTrend', 'getQualityDashboard', 'listBaselines', 'listAlertRules'].map((name) => [name, async () => {
    calls[name] = (calls[name] || 0) + 1;
    if (name === 'listAlertRules' && fail) throw new Error('temporary');
    return { data: name === 'listJobs' ? [{ id: 'real' }] : [], unavailable: false };
  }]));
  api.checkHealth = async () => ({ ok: true });
  const first = await loadPlatformOverview({ api, demo: false });
  assert.equal(calls.getQualityTrend, 1);
  fail = false;
  const next = await loadPlatformOverview({ api, demo: false, previous: first, only: ['alerts'] });
  assert.equal(calls.listJobs, 1); assert.equal(calls.listAlertRules, 2);
  assert.equal(next.jobs[0].id, 'real'); assert.equal(next.modules.alerts.source, 'api');
});

test('能力探测缓存成功与未实现响应，未知能力不隐藏，成功别名复用', async () => {
  apiClient.clearApiDiscovery();
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    const known = url.startsWith('/api/meta/capabilities');
    return new Response(JSON.stringify(known ? { capabilities: { alerts: false, lineage: false } } : { error: 'missing' }), { status: known ? 200 : 404 });
  };
  const first = await apiClient.getCapabilities(); await apiClient.getCapabilities();
  assert.equal(calls.length, 2); assert.equal(routeEnabled('/lineage', first.data), false);
  assert.equal(routeEnabled('/analyze', first.data), true);
  await apiClient.getCapabilities({ force: true });
  assert.equal(calls.at(-1), '/api/meta/capabilities'); assert.equal(calls.length, 3);
  apiClient.clearApiDiscovery(); calls.length = 0;
  globalThis.fetch = async (url) => { calls.push(url); return new Response('{}', { status: 404 }); };
  assert.deepEqual((await apiClient.getCapabilities()).data, {});
  await apiClient.getCapabilities(); assert.equal(calls.length, 2);
});

test('切换后端再执行模块重试，不复用上一环境数据；显式重试绕过未实现缓存', async () => {
  let base = '/first', unavailable = true, calls = 0;
  globalThis.localStorage = { getItem: (key) => key === 'apiBaseOverride' ? base : null };
  apiClient.clearApiDiscovery();
  globalThis.fetch = async (url) => {
    calls++;
    if (url.includes('/health')) return new Response('{"status":"ok"}');
    if (url.includes('/capabilities')) return new Response('{}');
    if (url.includes('/alert-rules') && unavailable) return new Response('{}', { status: 404 });
    if (url.includes('/alerts/rules') && unavailable) return new Response('{}', { status: 404 });
    if (url.includes('/analysis/jobs')) return new Response(JSON.stringify([{ id: base }]));
    return new Response('[]');
  };
  await usePlatform.getState().refresh();
  assert.equal(usePlatform.getState().jobs[0].id, '/first');
  base = '/second';
  await usePlatform.getState().refresh({ module: 'alerts' });
  assert.equal(usePlatform.getState().jobs[0].id, '/second');
  apiClient.clearApiDiscovery(); calls = 0;
  await apiClient.listAlertRules(); const initialCalls = calls;
  await apiClient.listAlertRules(); assert.equal(calls, initialCalls);
  unavailable = false;
  await apiClient.listAlertRules({ forceDiscovery: true }); assert.ok(calls > initialCalls);
  globalThis.localStorage = { getItem: () => null };
});
