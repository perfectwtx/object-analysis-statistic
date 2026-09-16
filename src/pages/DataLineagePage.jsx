import { getDataLineage } from '../api/index.js';
import JobDependentPage from './JobDependentPage.jsx';

export default function DataLineagePage() {
  return (
    <JobDependentPage
      title="Data Lineage"
      subtitle="对象关系推导的数据血缘（需持久化 Job）"
      endpointTemplate="GET /api/analysis/jobs/{jobId}/lineage"
      fetchByJobId={getDataLineage}
      renderData={(data) => (
        <div className="panel">
          <h2 className="panel-title">血缘结构</h2>
          <pre className="json-block mono">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    />
  );
}
