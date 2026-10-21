import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalysisOptions } from '../src/lib/build-analysis-options.js';

test('规则与运行参数采用明确优先级，规则元选项不会混入规则正文', () => {
  const options = buildAnalysisOptions({ rules: { flatten: false, selectedFields: ['age'], filter: 'age > 0', fields: { age: { required: true } } }, runtime: { fields: 'name', filter: 'old', rootPath: 'data', sampleStep: 2 }, features: { enableCorrelation: true }, csvInfer: false });
  assert.equal(options.fields, 'age'); assert.equal(options.filter, 'age > 0'); assert.equal(options.flatten, false);
  assert.equal(options.rootPath, 'data'); assert.equal(options.sampleStep, 2);
  assert.deepEqual(JSON.parse(options.rulesJson), { fields: { age: { required: true } } });
});
test('清空规则保持 runtime 选项，拒绝非法采样数和并行度', () => {
  const options = buildAnalysisOptions({ rules: null, runtime: { fields: 'name' } });
  assert.equal(options.rulesJson, null); assert.equal(options.fields, 'name');
  for (const value of [0, -1, 1.2, Infinity, 'bad']) {
    assert.throws(() => buildAnalysisOptions({ runtime: { sampleStep: value } }), /正整数/);
  }
});
