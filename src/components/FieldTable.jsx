import { useMemo, useState } from 'react';
import Sparkline from './Sparkline.jsx';

const PAGE_SIZE = 10;

function TypeBadge({ t }) {
  return <span className={`badge type-${t.toLowerCase()}`}>{t}</span>;
}

const RULE_KEY_LABELS = {
  enumValues: '枚举', minValue: '范围', maxValue: '范围', required: '必填',
  pattern: '正则', unique: '唯一', nullRateMax: 'Null率',
};

const fmt = (v) => (v === null || v === undefined ? '-' : +v.toFixed(2));

// 异常值边界：本地引擎给 [lower, upper]，后端给字符串 "[45, 55]"，这里统一成展示文本
function fmtBounds(b) {
  if (Array.isArray(b)) {
    return b.map((x) => (typeof x === 'number' ? x.toFixed(2) : String(x))).join(', ');
  }
  if (typeof b === 'string') return b.replace(/^\[|\]$/g, '');
  return '-';
}

export default function FieldTable({ fields, rules, bare }) {
  const fieldRules = rules?.fields || {};
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('count');
  const [sortDir, setSortDir] = useState(-1);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    const list = kw ? fields.filter((f) => f.fieldName.toLowerCase().includes(kw)) : fields;
    return [...list].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (typeof va === 'string') return va.localeCompare(vb) * sortDir;
      return ((va ?? 0) - (vb ?? 0)) * sortDir;
    });
  }, [fields, search, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages - 1);
  const rows = filtered.slice(cur * PAGE_SIZE, (cur + 1) * PAGE_SIZE);

  const th = (label, key) => (
    <th
      className={sortKey === key ? 'sorted' : ''}
      onClick={() => {
        if (sortKey === key) setSortDir(-sortDir);
        else { setSortKey(key); setSortDir(key === 'fieldName' ? 1 : -1); }
        setPage(0);
      }}
    >
      {label} {sortKey === key ? (sortDir > 0 ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className={bare ? '' : 'panel'}>
      <div className="panel-header">
        <h3>字段统计明细</h3>
        <input
          className="search"
          placeholder="搜索字段名…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {th('字段名', 'fieldName')}
              <th>语义类型</th>
              {th('覆盖率', 'coverage')}
              <th>主导类型</th>
              {th('唯一值', 'distinctCount')}
              {th('出现次数', 'count')}
              <th>默认值</th>
              <th>分布</th>
              <th>规则</th>
              <th>Top 值</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.fieldName}>
                <td className="mono">
                  {f.fieldName}
                  {f.outlierCount > 0 && (
                    <span className="badge violation outlier-badge"
                          title={`${f.outlierMethod || 'IQR'} 异常值 ${f.outlierCount} 个（${f.outlierRatio != null ? (f.outlierRatio * 100).toFixed(1) : '-'}%），边界 [${fmtBounds(f.outlierBounds)}]`}>
                      异常×{f.outlierCount}
                    </span>
                  )}
                </td>
                <td>{f.semanticType ? <span className="badge semantic">{f.semanticType}</span> : '-'}</td>
                <td>
                  <div className="coverage-cell">
                    <div className="coverage-bar">
                      <div style={{ width: `${f.coverage * 100}%` }} />
                    </div>
                    {(f.coverage * 100).toFixed(1)}%
                  </div>
                </td>
                <td><TypeBadge t={f.primaryType} /></td>
                <td>{f.distinctCount}</td>
                <td>{f.count}</td>
                <td className="mono">{f.defaultValue ?? '-'}</td>
                <td title={f.median !== undefined ? `P50=${fmt(f.median)} P90=${fmt(f.p90)} P95=${fmt(f.p95)} P99=${fmt(f.p99)}` : ''}>
                  {f.histogram
                    ? <Sparkline data={f.histogram} />
                    : f.dateHistogram
                      ? <Sparkline data={f.dateHistogram} />
                      : <span className="dim">-</span>}
                </td>
                <td>
                  {fieldRules[f.fieldName]
                    ? [...new Set(Object.keys(fieldRules[f.fieldName]).map((k) => RULE_KEY_LABELS[k]).filter(Boolean))]
                        .map((l) => <span className="badge rule" key={l}>{l}</span>)
                    : '-'}
                </td>
                <td className="top-values">
                  {Object.entries(f.valueCounts).slice(0, 3).map(([v, c]) => (
                    <span className="chip" key={v} title={`${v} × ${c}`}>
                      {v.length > 12 ? v.slice(0, 12) + '…' : v} ×{c}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="empty">无匹配字段</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button disabled={cur === 0} onClick={() => setPage(cur - 1)}>上一页</button>
        <span>{cur + 1} / {pages}（共 {filtered.length} 个字段）</span>
        <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>下一页</button>
      </div>
    </div>
  );
}
