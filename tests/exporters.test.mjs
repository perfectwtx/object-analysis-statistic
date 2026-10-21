import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, toMarkdown, toJsonSchema } from '../src/exporters.js';
import { exportReport } from '../src/lib/report-export.js';
const result = (field) => ({ totalObjects: 1, fieldStatistics: [{ fieldName: 'name', coverage: 1, primaryType: 'String', typeCounts: { String: 1 }, distinctCount: 1, count: 1, ...field }] });

test('CSV 保护公式前缀并转义回车、换行、引号和逗号', () => {
  const csv = toCsv(result({ fieldName: ' =1+1', defaultValue: 'a\rb\n"c",d' }));
  assert.ok(csv.includes("' =1+1")); assert.ok(csv.includes('"a\rb\n""c"",d"'));
  assert.ok(toCsv(result({ defaultValue: -12 })).includes('-12'));
});
test('Markdown 表格转义分隔符、HTML、反斜杠和多行内容', () => {
  const md = toMarkdown(result({ fieldName: 'a|b', defaultValue: '<script>\r\n\\test' }), 'data');
  assert.ok(md.includes('a\\|b')); assert.ok(md.includes('&lt;script&gt;<br>\\\\test'));
});
test('特殊字段名不会污染原型，Schema 保留字段', () => {
  const schema = JSON.parse(toJsonSchema(result({ fieldName: '__proto__.polluted' })));
  assert.equal({}.polluted, undefined);
  assert.equal(schema.items.properties.__proto__.properties.polluted.type, 'string');
});
test('内容保存和 Excel 加载失败会向调用方报告，不伪装导出成功', async () => {
  await assert.rejects(exportReport(result({}), 'data', 'json', { save: () => { throw new Error('save failed'); } }), /save failed/);
  await assert.rejects(exportReport(result({}), 'data', 'xlsx', { loadExcel: async () => { throw new Error('chunk failed'); } }), /chunk failed/);
  let saved;
  await exportReport(result({}), 'data', 'csv', { save: (text, name) => saved = { text, name } });
  assert.equal(saved.name, 'report.csv'); assert.ok(saved.text.startsWith('\uFEFF'));
});
