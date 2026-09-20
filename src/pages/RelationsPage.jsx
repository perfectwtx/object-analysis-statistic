import { getRelationships } from '../api/index.js';
import JobDependentPage from './JobDependentPage.jsx';
import { Card } from '../components/ui/card.jsx';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';
import { asList } from '../lib/normalize.js';
import { useT } from '../lib/i18n.js';

function RelationsView({ data }) {
  if (!data) return null;
  const fields = asList(data.fields || data.Fields);
  const pairs = asList(data.pairs || data.Pairs || data.strongPairs || data.StrongPairs || data.correlations);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4 text-sm"><div className="text-xs text-muted-foreground">字段数</div><div className="text-2xl font-medium">{fields.length || '—'}</div></Card>
        <Card className="p-4 text-sm"><div className="text-xs text-muted-foreground">相关对</div><div className="text-2xl font-medium">{pairs.length}</div></Card>
      </div>
      <TableShell>
        <Table dense>
          <THead sticky>
            <tr>
              <TH>字段 A</TH>
              <TH>字段 B</TH>
              <TH className="w-[8rem]">相关系数</TH>
            </tr>
          </THead>
          <TBody>
            {pairs.map((p, i) => (
              <TR key={i}>
                <TD mono>{p.fieldA || p.FieldA || p.a || p.left || fields[p.i] || fields[p.row] || '—'}</TD>
                <TD mono>{p.fieldB || p.FieldB || p.b || p.right || fields[p.j] || fields[p.col] || '—'}</TD>
                <TD>{p.coefficient ?? p.Coefficient ?? p.value ?? p.Value ?? p.corr ?? '—'}</TD>
              </TR>
            ))}
            {!pairs.length ? <EmptyRow colSpan={3}>暂无相关对（分析时需开启字段相关性）</EmptyRow> : null}
          </TBody>
        </Table>
      </TableShell>
      {!pairs.length && data ? (
        <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-muted/30 p-3 font-mono text-[11px]">
          {JSON.stringify(data, null, 2).slice(0, 4000)}
        </pre>
      ) : null}
    </div>
  );
}

export default function RelationsPage() {
  const { t } = useT();
  return (
    <JobDependentPage
      title={t('relationsTitle') || '字段关系'}
      subtitle={t('relationsSubtitle') || '字段相关性矩阵'}
      endpointTemplate="/api/quality/relationships/{jobId}"
      fetchByJobId={getRelationships}
      renderData={(data) => <RelationsView data={data} />}
      emptyHint="请在分析配置中开启「字段相关性」后重新分析。"
    />
  );
}
