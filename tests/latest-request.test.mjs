import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestRequest } from '../src/lib/latest-request.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('从 A 切换到 B，取消 A 并阻止其迟到结果和 finally 覆盖 B', async () => {
  const request = createLatestRequest(); const a = deferred(); const b = deferred();
  let signal, value, finished = 0;
  const first = request.run((s) => { signal = s; return a.promise; }, { onSuccess: (v) => value = v, onFinally: () => finished++ });
  const second = request.run(() => b.promise, { onSuccess: (v) => value = v, onFinally: () => finished++ });
  assert.equal(signal.aborted, true); b.resolve('B'); await second;
  a.resolve('A'); await first; assert.equal(value, 'B'); assert.equal(finished, 1);
});

test('卸载/清空后忽略异常，当前异常仅处理一次', async () => {
  const request = createLatestRequest(); let errors = 0;
  const a = deferred(); const first = request.run(() => a.promise, { onError: () => errors++ });
  request.cancel(); a.reject(new Error('old')); await first; assert.equal(errors, 0);
  await request.run(() => Promise.reject(new Error('new')), { onError: () => errors++ });
  assert.equal(errors, 1);
});
