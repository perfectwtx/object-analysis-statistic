import { getObjectRelationships } from '../api/index.js';
import JobDependentPage from './JobDependentPage.jsx';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';
import { asList } from '../lib/normalize.js';
import { useT } from '../lib/i18n.js';

function ObjectRelView({ data }) {
  const list = asList(data);
  return (
    <TableShell>
      <Table dense>
        <THead sticky>
          <tr>
            <TH>源</TH>
            <TH>目标</TH>
            <TH>关系</TH>
            <TH>置信度</TH>
          </tr>
        </THead>
        <TBody>
          {list.map((r, i) => (
            <TR key={i}>
              <TD mono>{r.source || r.Source || r.from || r.From || r.parentObject || '—'}</TD>
              <TD mono>{r.target || r.Target || r.to || r.To || r.childObject || '—'}</TD>
              <TD muted>{r.relation || r.Relation || r.type || r.Type || '—'}</TD>
              <TD>{r.confidence ?? r.Confidence ?? r.score ?? '—'}</TD>
            </TR>
          ))}
          {!list.length ? <EmptyRow colSpan={4}>暂无对象关系</EmptyRow> : null}
        </TBody>
      </Table>
    </TableShell>
  );
}

export default function ObjectRelationshipsPage() {
  const { t } = useT();
  return (
    <JobDependentPage
      title={t('objectRelTitle') || '对象关系'}
      subtitle={t('objectRelSubtitle') || '对象级关联'}
      endpointTemplate="/api/quality/object-relationships/{jobId}"
      fetchByJobId={getObjectRelationships}
      renderData={(data) => <ObjectRelView data={data} />}
    />
  );
}
