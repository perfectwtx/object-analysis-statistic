import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createThemeController } from '../src/lib/theme-controller.js';

function environment(mode) {
  const values = new Map(mode ? [['themeMode', mode]] : []);
  const events = new Map(), classes = new Set();
  const query = { matches: false, addEventListener(k, fn) { events.set('system', fn); }, removeEventListener() { events.delete('system'); } };
  const env = {
    storage: { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v) },
    matchMedia: () => query, document: { documentElement: { dataset: {}, style: {}, classList: {
      toggle(k, on) { if (on) classes.add(k); else classes.delete(k); }, add(k) { classes.add(k); },
    } } }, addEventListener(k, fn) { events.set(k, fn); }, removeEventListener(k) { events.delete(k); },
  };
  return { env, values, query, events, classes };
}
test('主题模式、系统解析、跨页同步共用同一状态与监听器', () => {
  const h = environment('system'), controller = createThemeController(h.env);
  const off = controller.subscribe(() => {}); const off2 = controller.subscribe(() => {});
  assert.equal(h.events.size, 2); assert.equal(controller.getSnapshot().theme, 'light');
  h.query.matches = true; h.events.get('system')(); assert.equal(controller.getSnapshot().theme, 'dark');
  controller.setMode('eyecare'); h.query.matches = false; h.events.get('system')();
  assert.equal(controller.getSnapshot().mode, 'eyecare'); assert.deepEqual([...h.classes], ['eyecare']);
  h.values.set('themeMode', 'light'); h.events.get('storage')({ key: 'themeMode' });
  assert.equal(controller.getSnapshot().theme, 'light');
  off(); assert.equal(h.events.size, 2); off2(); assert.equal(h.events.size, 0);
});
test('首屏预置与运行时对所有模式遵守相同规则', () => {
  const bootstrap = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const mode of [undefined, 'system', 'light', 'dark', 'eyecare', 'invalid']) {
    const h = environment(mode), runtime = createThemeController(h.env); runtime.apply();
    const first = environment(mode);
    vm.runInNewContext(bootstrap, { localStorage: first.env.storage, window: first.env, document: first.env.document });
    assert.equal(h.env.document.documentElement.dataset.theme, first.env.document.documentElement.dataset.theme);
  }
});
