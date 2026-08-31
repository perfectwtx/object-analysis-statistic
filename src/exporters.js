// 报告导出：JSON / CSV / Markdown / HTML / JSON Schema
import { CHECK_LABELS } from './utils.js';

const TYPE_TO_SCHEMA = {
  String: 'string', Number: 'number', Boolean: 'boolean',
  Null: 'null', Array: 'array', Object: 'object',
};

export function download(content, fileName, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- JSON ----------
export function toJson(result) {
  return JSON.stringify(result, null, 2);
}

// ---------- CSV ----------
function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(result) {
  const header = ['字段名', '覆盖率', '主导类型', '类型分布', '唯一值', '出现次数', '默认值', '语义类型'];
  const rows = result.fieldStatistics.map((f) => [
    f.fieldName,
    (f.coverage * 100).toFixed(1) + '%',
    f.primaryType,
    Object.entries(f.typeCounts).map(([t, c]) => `${t}:${c}`).join(' '),
    f.distinctCount,
    f.count,
    f.defaultValue ?? '',
    f.semanticType ?? '',
  ]);
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(','));
  return '﻿' + lines.join('\n'); // BOM 便于 Excel 识别 UTF-8
}

// ---------- Markdown ----------
export function toMarkdown(result, fileName) {
  const L = [];
  L.push('# 对象分析报告', '');
  L.push(`- 数据源：${fileName}`);
  L.push(`- 生成时间：${new Date().toLocaleString()}`);
  L.push(`- 对象总数：${result.totalObjects}（唯一 ${result.totalUniqueObjects}，重复组 ${result.totalDuplicateGroups}）`);
  L.push(`- 字段数：${result.fieldStatistics.length}`, '');
  L.push('## 字段统计', '');
  L.push('| 字段 | 覆盖率 | 主导类型 | 唯一值 | 次数 | 默认值 | 语义类型 |');
  L.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const f of result.fieldStatistics) {
    L.push(`| ${f.fieldName} | ${(f.coverage * 100).toFixed(1)}% | ${f.primaryType} | ${f.distinctCount} | ${f.count} | ${f.defaultValue ?? '-'} | ${f.semanticType ?? '-'} |`);
  }
  if (result.qualityViolations) {
    L.push('', '## 质量校验', '');
    if (result.qualityViolations.length === 0) {
      L.push('✓ 所有规则校验通过');
    } else {
      L.push('| 字段 | 检查项 | 违规数 | 说明 |');
      L.push('| --- | --- | --- | --- |');
      for (const v of result.qualityViolations) {
        L.push(`| ${v.field || '（数据集）'} | ${CHECK_LABELS[v.check] || v.check} | ${v.count} | ${v.message} |`);
      }
    }
  }
  return L.join('\n');
}

// ---------- HTML ----------
export function toHtml(result, fileName) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fieldRows = result.fieldStatistics.map((f) => `
    <tr>
      <td class="mono">${esc(f.fieldName)}</td>
      <td><div class="cov"><div style="width:${f.coverage * 100}%"></div></div> ${(f.coverage * 100).toFixed(1)}%</td>
      <td><span class="badge">${esc(f.primaryType)}</span></td>
      <td>${f.distinctCount}</td><td>${f.count}</td>
      <td class="mono">${esc(f.defaultValue ?? '-')}</td>
      <td>${esc(f.semanticType ?? '-')}</td>
    </tr>`).join('');
  const violations = result.qualityViolations;
  const violHtml = violations
    ? violations.length === 0
      ? '<p class="pass">✓ 所有规则校验通过</p>'
      : `<h2>质量校验 <span class="fail">FAIL（${violations.length} 项违规）</span></h2>
         <table><thead><tr><th>字段</th><th>检查项</th><th>违规数</th><th>说明</th></tr></thead><tbody>
         ${violations.map((v) => `<tr><td class="mono">${esc(v.field || '（数据集）')}</td><td>${esc(CHECK_LABELS[v.check] || v.check)}</td><td>${v.count}</td><td>${esc(v.message)}</td></tr>`).join('')}
         </tbody></table>`
    : '';
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>对象分析报告 - ${esc(fileName)}</title>
<style>
/* 导出的报告是独立文件，拿不到界面的主题状态，只能跟随阅读者的系统偏好 */
:root{
  --bg:#0b0f1a; --text:#e6e9f2; --dim:#8b93a7;
  --card:rgba(255,255,255,.05); --border:rgba(255,255,255,.08);
  --row:rgba(255,255,255,.06); --table:rgba(255,255,255,.03);
  --accent:#22d3ee; --badge-bg:rgba(99,102,241,.18); --badge-fg:#a5b4fc;
  --track:rgba(255,255,255,.08); --bar-from:#6366f1; --bar-to:#22d3ee;
  --pass:#6ee7b7; --fail:#fca5a5; color-scheme:dark;
}
@media (prefers-color-scheme:light){
  :root{
    --bg:#ffffff; --text:#0f172a; --dim:#64748b;
    --card:#f8fafc; --border:#e2e8f0;
    --row:#e2e8f0; --table:#ffffff;
    --accent:#0891b2; --badge-bg:rgba(79,70,229,.10); --badge-fg:#4338ca;
    --track:#e2e8f0; --bar-from:#4f46e5; --bar-to:#0891b2;
    --pass:#047857; --fail:#b91c1c; color-scheme:light;
  }
}
body{font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;background:var(--bg);color:var(--text);max-width:1100px;margin:0 auto;padding:32px 24px}
h1{font-size:22px} h2{font-size:16px;margin-top:28px}
.meta{color:var(--dim);font-size:13px;margin-bottom:24px}
.cards{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 20px;text-align:center}
.card b{display:block;font-size:22px;color:var(--accent)}
.card span{font-size:12px;color:var(--dim)}
table{width:100%;border-collapse:collapse;font-size:13px;background:var(--table);border:1px solid var(--border);border-radius:10px;overflow:hidden}
th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--row)}
th{color:var(--dim);font-size:12px}
.mono{font-family:Consolas,monospace;font-size:12px}
.badge{background:var(--badge-bg);color:var(--badge-fg);padding:2px 9px;border-radius:99px;font-size:11px}
.cov{display:inline-block;width:70px;height:6px;background:var(--track);border-radius:3px;vertical-align:middle;margin-right:6px}
.cov div{height:100%;background:linear-gradient(90deg,var(--bar-from),var(--bar-to));border-radius:3px}
.pass{color:var(--pass)}.fail{color:var(--fail);font-size:13px}
</style></head><body>
<h1>对象分析报告</h1>
<div class="meta">数据源：${esc(fileName)} · 生成时间：${new Date().toLocaleString()}</div>
<div class="cards">
  <div class="card"><b>${result.totalObjects}</b><span>对象总数</span></div>
  <div class="card"><b>${result.totalUniqueObjects}</b><span>唯一对象</span></div>
  <div class="card"><b>${result.totalDuplicateGroups}</b><span>重复组</span></div>
  <div class="card"><b>${result.fieldStatistics.length}</b><span>字段数</span></div>
</div>
<h2>字段统计</h2>
<table><thead><tr><th>字段</th><th>覆盖率</th><th>主导类型</th><th>唯一值</th><th>次数</th><th>默认值</th><th>语义类型</th></tr></thead>
<tbody>${fieldRows}</tbody></table>
${violHtml}
</body></html>`;
}

// ---------- JSON Schema ----------
// 从字段统计重建嵌套结构：a.b.c → 嵌套 properties；tags[0] → array items
export function toJsonSchema(result) {
  const newObjNode = () => ({ type: 'object', properties: {}, required: [] });

  function ensureChild(node, key, isIndex) {
    if (isIndex) {
      node.type = 'array';
      if (!node.items) node.items = newObjNode();
      return node.items;
    }
    node.properties = node.properties || {};
    if (!node.properties[key]) node.properties[key] = {};
    return node.properties[key];
  }

  const items = newObjNode();
  for (const f of result.fieldStatistics) {
    const parts = f.fieldName.split('.').flatMap((p) => {
      // tags[0] → ['tags', '0']
      const m = p.match(/^([^\[]+)((\[\d+\])*)$/);
      if (!m) return [p];
      const indexes = (m[2].match(/\d+/g) || []);
      return [m[1], ...indexes];
    });

    let node = items;
    let parent = null;
    let parentKey = null;
    for (const part of parts) {
      const isIndex = /^\d+$/.test(part);
      parent = node;
      parentKey = isIndex ? null : part;
      node = ensureChild(node, part, isIndex);
    }

    // 叶子：类型
    const types = Object.keys(f.typeCounts).map((t) => TYPE_TO_SCHEMA[t]).filter(Boolean);
    const nonNull = types.filter((t) => t !== 'null');
    node.type = nonNull.length === 1
      ? (types.includes('null') ? [nonNull[0], 'null'] : nonNull[0])
      : [...new Set(types)];
    // 低基数字段导出枚举
    if (f.distinctCount > 0 && f.distinctCount <= 10 && f.valueCountsFull) {
      node.enum = Object.keys(f.valueCountsFull).map((v) => {
        const n = Number(v);
        if (v === 'true') return true;
        if (v === 'false') return false;
        if (v === 'null') return null;
        return !Number.isNaN(n) && v.trim() !== '' ? n : v;
      });
    }
    // 覆盖率 100% 的字段加入父级 required
    if (f.coverage >= 1 && parent && parentKey && parent.type === 'object') {
      parent.required = parent.required || [];
      if (!parent.required.includes(parentKey)) parent.required.push(parentKey);
    }
  }

  // 清理空 required
  (function clean(node) {
    if (node.required && node.required.length === 0) delete node.required;
    if (node.properties) Object.values(node.properties).forEach(clean);
    if (node.items) clean(node.items);
  })(items);

  return JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Inferred Schema',
    type: 'array',
    items,
  }, null, 2);
}
