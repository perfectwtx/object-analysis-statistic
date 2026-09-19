import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from './ui/data-table.jsx';

export default function QualityPanel({ violations = [], bare }) {
  if (!violations.length) {
    return (
      <div className={bare ? '' : 'rounded-xl bg-card p-4 shadow-[var(--elev)]'}>
        <div className="rounded-xl bg-ok/10 px-4 py-8 text-center text-sm text-ok">
          未发现质量违规
        </div>
      </div>
    );
  }

  const body = (
    <>
      <div className="mb-3 text-sm font-medium">
        质量违规
        <span className="ml-2 rounded-full bg-danger/15 px-2 py-0.5 text-xs tabular-nums text-danger">
          {violations.length}
        </span>
      </div>
      <TableShell>
        <Table dense>
          <THead sticky>
            <tr>
              <TH>字段</TH>
              <TH>检查项</TH>
              <TH align="right">数量</TH>
              <TH>说明</TH>
            </tr>
          </THead>
          <TBody>
            {violations.map((v, i) => (
              <TR key={i}>
                <TD mono className="whitespace-nowrap">
                  {v.field || v.Field || '（数据集）'}
                </TD>
                <TD className="whitespace-nowrap">{v.check || v.Check || v.rule || '—'}</TD>
                <TD align="right">{v.count ?? v.Count ?? '—'}</TD>
                <TD muted className="max-w-md" title={v.message || v.Message || v.detail || ''}>
                  <span className="line-clamp-2">
                    {v.message || v.Message || v.detail || '—'}
                  </span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableShell>
    </>
  );

  if (bare) return <div>{body}</div>;
  return <div className="rounded-xl bg-card p-4 shadow-[var(--elev)]">{body}</div>;
}
