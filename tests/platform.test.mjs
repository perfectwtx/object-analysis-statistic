import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
after(() => server.close());
const { loadPlatformOverview } = await server.ssrLoadModule('/src/lib/load-platform.js');

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
