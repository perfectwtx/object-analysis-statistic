import { getSchemaImpact } from '../api/index.js';
import JobDependentPage from './JobDependentPage.jsx';
import { Card } from '../components/ui/card.jsx';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';
import { asList } from '../lib/normalize.js';
import { useT } from '../lib/i18n.js';

function SchemaView({ data }) {
  if (!data) return null;
  const added = asList(data.added || data.Added || data.addedFields);
  const removed = asList(data.removed || data.Removed || data.removedFields);
  const changed = asList(data.changed || data.Changed || data.modified || data.typeChanges);
  const rows = [
    ...added.map((x) => ({ name: typeof x === 'string' ? x : x.name || x.field, kind: 'Added', detail: x.type || x.Type || '' })),
    ...removed.map((x) => ({ name: typeof x === 'string' ? x : x.name || x.field, kind: 'Removed', detail: '' })),
    ...changed.map((x) => ({
      name: x.name || x.field || x.Field || '—',
      kind: 'Changed',
      detail: `${x.from || x.oldType || ''} → ${x.to || x.newType || x.type || ''}`,
    })),
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4 text-sm"><div className="text-xs text-muted-foreground">新增</div><div className="text-2xl font-medium text-ok">{added.length}</div></Card>
        <Card className="p-4 text-sm"><div className="text-xs text-muted-foreground">删除</div><div className="text-2xl font-medium text-danger">{removed.length}</div></Card>
        <Card className="p-4 text-sm"><div className="text-xs text-muted-foreground">变更</div><div className="text-2xl font-medium text-warn">{changed.length}</div></Card>
      </div>
      <TableShell>
        <Table dense>
          <THead sticky>
            <tr>
              <TH>字段</TH>
              <TH className="w-[7rem]">变更</TH>
              <TH>详情</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((r, i) => (
              <TR key={i}>
                <TD mono className="font-medium">{r.name}</TD>
                <TD>{r.kind}</TD>
                <TD muted>{r.detail || '—'}</TD>
              </TR>
            ))}
            {!rows.length ? <EmptyRow colSpan={3}>无 Schema 差异</EmptyRow> : null}
          </TBody>
        </Table>
      </TableShell>
      {!rows.length ? (
        <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-muted/30 p-3 font-mono text-[11px]">
          {JSON.stringify(data, null, 2).slice(0, 4000)}
        </pre>
      ) : null}
    </div>
  );
}

export default function SchemaImpactPage() {
  const { t } = useT();
  return (
    <JobDependentPage
      title={t('schemaTitle') || 'Schema 影响'}
      subtitle={t('schemaSubtitle') || '相对历史 Schema 的差异'}
      endpointTemplate="/api/quality/schema-impact/{jobId}"
      fetchByJobId={getSchemaImpact}
      renderData={(data) => <SchemaView data={data} />}
    />
  );
}
