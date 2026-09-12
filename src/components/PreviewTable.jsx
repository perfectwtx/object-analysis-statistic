// 数据预览：后端 v2 随分析结果一起返回流经管线的样本记录（默认前 20 条，
// 已过 transform / filter，所以看到的就是真正参与统计的数据形态）。
// 后端只给行数据，前端不重新解析、不做统计——纯粹是"看看数据长什么样"。

const MAX_CELL = 60; // 单元格文本超过则截断，完整值在 title 里

/** 单元格渲染：null / 布尔 / 数字 / 对象 各有各的呈现，长文本截断 */
function Cell({ value }) {
  if (value === null || value === undefined) {
    return <span className="pv-null">null</span>;
  }
  if (typeof value === 'boolean') {
    return <span className={`pv-bool ${value ? 'yes' : 'no'}`}>{String(value)}</span>;
  }
  if (typeof value === 'number') {
    return <span className="pv-num mono">{value}</span>;
  }
  if (typeof value === 'object') {
    const s = JSON.stringify(value);
    const short = s.length > MAX_CELL ? `${s.slice(0, MAX_CELL - 1)}…` : s;
    return <span className="pv-json mono" title={s}>{short}</span>;
  }
  const s = String(value);
  return (
    <span className="pv-text" title={s.length > MAX_CELL ? s : undefined}>
      {s.length > MAX_CELL ? `${s.slice(0, MAX_CELL - 1)}…` : s}
    </span>
  );
}

export default function PreviewTable({ preview, bare }) {
  const columns = preview?.columns ?? [];
  const rows = preview?.rows ?? [];
  const truncated = !!preview?.truncated;

  if (rows.length === 0) {
    return (
      <div className={bare ? '' : 'panel'}>
        <div className="empty-tab">
          本次分析没有返回预览样本（数据为空，或全部被过滤条件筛掉）。
        </div>
      </div>
    );
  }

  return (
    <div className={bare ? '' : 'panel'}>
      <div className="panel-header">
        <h3>
          数据预览
          <span className="pv-count">{rows.length} 条 · {columns.length} 列</span>
        </h3>
        <span className="pv-note-inline">已过 transform / filter，即真正参与统计的数据形态</span>
      </div>

      {truncated && (
        <div className="pv-note">
          仅展示前 {rows.length} 条样本记录（后端预览上限）。统计结果基于全部数据，不受此限制。
        </div>
      )}

      <div className="table-wrap pv-wrap">
        <table className="pv-table">
          <thead>
            <tr>
              <th className="pv-idx">#</th>
              {columns.map((c) => (
                <th key={c} className="mono" title={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="pv-idx">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c} title={c}>
                    {Object.prototype.hasOwnProperty.call(row, c)
                      ? <Cell value={row[c]} />
                      : <span className="pv-absent" title="该行没有这个字段">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
