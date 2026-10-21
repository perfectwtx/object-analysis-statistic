import { download, toCsv, toHtml, toJson, toJsonSchema, toMarkdown } from '../exporters.js';

export async function exportReport(result, fileName, format, { save = download, loadExcel = () => import('xlsx') } = {}) {
  if (!result) throw new Error('No analysis result to export');
  const formats = {
    json: [toJson, 'report.json', 'application/json'], csv: [toCsv, 'report.csv', 'text/csv'],
    md: [toMarkdown, 'report.md', 'text/markdown'], html: [toHtml, 'report.html', 'text/html'],
    schema: [toJsonSchema, 'report.schema.json', 'application/json'],
  };
  if (format === 'xlsx') {
    const excel = await loadExcel();
    const workbook = excel.utils.book_new();
    const rows = result.fieldStatistics.map((f) => ({
      字段名: f.fieldName, 覆盖率: +(f.coverage * 100).toFixed(1), 主导类型: f.primaryType,
      唯一值: f.distinctCount, 出现次数: f.count,
    }));
    excel.utils.book_append_sheet(workbook, excel.utils.json_to_sheet(rows), '字段统计');
    await excel.writeFile(workbook, 'report.xlsx');
    return;
  }
  const spec = formats[format];
  if (!spec) throw new Error(`Unsupported export format: ${format}`);
  await save(spec[0](result, fileName), spec[1], spec[2]);
}
