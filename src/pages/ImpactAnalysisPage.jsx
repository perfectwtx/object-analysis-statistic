import { getImpactAnalysis } from '../api/index.js';
import JobDependentPage from './JobDependentPage.jsx';
import { Card } from '../components/ui/card.jsx';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';
import { asList } from '../lib/normalize.js';
import { useT } from '../lib/i18n.js';

function ImpactView({ data }) {
  if (!data) return null;
  if (data.available === false) {
    return (
      <Card className="py-8 text-center text-sm text-muted-foreground">
        不可用：{data.reason || '该作业未生成影响分析'}
      </Card>
    );
  }
  const items = asList(
    data.items || data.Items || data.changes || data.Changes || data.impacts || data.Impacts || data,
  );
  return (
    <div className="space-y-4">
      <TableShell>
        <Table dense>
          <THead sticky>
            <tr>
              <TH>对象 / 字段</TH>
              <TH>类型</TH>
              <TH>说明</TH>
              <TH className="w-[6rem]">严重度</TH>
            </tr>
          </THead>
          <TBody>
            {items.map((it, i) => (
              <TR key={i}>
                <TD mono className="font-medium">{it.field || it.Field || it.name || it.Name || it.path || '—'}</TD>
                <TD muted>{it.type || it.Type || it.kind || it.Kind || '—'}</TD>
                <TD className="max-w-md truncate" title={it.message || it.Message || it.description}>{it.message || it.Message || it.description || '—'}</TD>
                <TD>{it.severity || it.Severity || it.level || '—'}</TD>
              </TR>
            ))}
            {!items.length ? <EmptyRow colSpan={4}>暂无影响项</EmptyRow> : null}
          </TBody>
        </Table>
      </TableShell>
      {!items.length ? (
        <pre className="max-h-80 overflow-auto rounded-xl border border-border bg-muted/30 p-3 font-mono text-[11px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export default function ImpactAnalysisPage() {
  const { t } = useT();
  return (
    <JobDependentPage
      title={t('impactTitle') || '影响分析'}
      subtitle={t('impactSubtitle') || 'Schema / 变更影响'}
      endpointTemplate="/api/analysis/jobs/{jobId}/impact"
      fetchByJobId={getImpactAnalysis}
      renderData={(data) => <ImpactView data={data} />}
    />
  );
}
