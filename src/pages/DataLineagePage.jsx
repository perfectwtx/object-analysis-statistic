import { getDataLineage } from '../api/index.js';
import JobDependentPage from './JobDependentPage.jsx';
import { Card } from '../components/ui/card.jsx';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';
import { asList } from '../lib/normalize.js';
import { useT } from '../lib/i18n.js';

function LineageView({ data }) {
  if (!data) return null;
  if (data.available === false) {
    return (
      <Card className="py-8 text-center text-sm text-muted-foreground">
        不可用：{data.reason || '该作业未生成血缘数据'}
      </Card>
    );
  }
  const nodes = asList(data.nodes || data.Nodes || data.entities || data.Entities);
  const edges = asList(data.edges || data.Edges || data.links || data.Links);
  const rows = edges.length
    ? edges
    : nodes.map((n) => ({ from: n.id || n.name || n.Name, to: n.type || n.Type || '—', label: n.label || n.Label }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4 text-sm"><div className="text-xs text-muted-foreground">节点</div><div className="text-2xl font-medium">{nodes.length}</div></Card>
        <Card className="p-4 text-sm"><div className="text-xs text-muted-foreground">边</div><div className="text-2xl font-medium">{edges.length}</div></Card>
        <Card className="p-4 text-sm"><div className="text-xs text-muted-foreground">原始键</div><div className="truncate font-mono text-xs">{Object.keys(data).slice(0, 6).join(', ')}</div></Card>
      </div>
      <TableShell>
        <Table dense>
          <THead sticky>
            <tr>
              <TH>From</TH>
              <TH>To</TH>
              <TH>Label</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((e, i) => (
              <TR key={i}>
                <TD mono>{e.from || e.From || e.source || e.Source || e.parent || '—'}</TD>
                <TD mono>{e.to || e.To || e.target || e.Target || e.child || '—'}</TD>
                <TD muted>{e.label || e.Label || e.relation || e.Relation || e.type || '—'}</TD>
              </TR>
            ))}
            {!rows.length ? <EmptyRow colSpan={3}>暂无血缘边</EmptyRow> : null}
          </TBody>
        </Table>
      </TableShell>
      {!nodes.length && !edges.length ? (
        <pre className="max-h-80 overflow-auto rounded-xl border border-border bg-muted/30 p-3 font-mono text-[11px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export default function DataLineagePage() {
  const { t } = useT();
  return (
    <JobDependentPage
      title={t('lineageTitle') || '数据血缘'}
      subtitle={t('lineageSubtitle') || '基于分析作业的数据血缘'}
      endpointTemplate="/api/analysis/jobs/{jobId}/lineage"
      fetchByJobId={getDataLineage}
      renderData={(data) => <LineageView data={data} />}
    />
  );
}
