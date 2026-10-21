import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonc, toBackendRulesText } from '../src/utils.js';
import { adaptAnalysisResponse } from '../src/adapter.js';

test('JSONC 保留字符串中的网址、斜杠和逗号，校验文本保留行号', () => {
  const text = '{\n// comment\n"url":"https://example.com/a,b",\n"fields":{"age":{"required":true,},},\n}';
  const parsed = parseJsonc(text);
  assert.equal(parsed.url, 'https://example.com/a,b'); assert.equal(parsed.fields.age.required, true);
  const backend = toBackendRulesText(text);
  assert.equal(backend.split('\n').length, text.split('\n').length);
  assert.deepEqual(parseJsonc(backend), parsed);
});

test('适配保留后端零值和裁剪标记，不把零值当成缺失', () => {
  const result = adaptAnalysisResponse({ totalObjects: 0, fieldStatistics: [{ fieldName: 'age', coverage: 0, minNumber: 0, avgNumber: 0, valueCountsTruncated: true }] });
  assert.equal(result.totalObjects, 0); assert.equal(result.fieldStatistics[0].min, 0);
  assert.equal(result.fieldStatistics[0].avg, 0); assert.equal(result.fieldStatistics[0].valueCountsTruncated, true);
});
