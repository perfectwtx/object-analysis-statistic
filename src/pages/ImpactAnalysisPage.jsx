import { getImpactAnalysis } from '../api/index.js';
import JobDependentPage from './JobDependentPage.jsx';

export default function ImpactAnalysisPage() {
  return (
    <JobDependentPage
      title="Impact Analysis"
      subtitle="Schema 变更结合血缘的影响范围"
      endpointTemplate="GET /api/analysis/jobs/{jobId}/impact"
      fetchByJobId={getImpactAnalysis}
      renderData={(data) => (
        <div className="panel">
          <h2 className="panel-title">影响分析</h2>
          <pre className="json-block mono">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    />
  );
}
