import { getQualityRegression } from '../api/index.js';
import JobDependentPage from './JobDependentPage.jsx';

export default function RegressionPage() {
  return (
    <JobDependentPage
      title="Regression"
      subtitle="质量回归对比"
      endpointTemplate="GET /api/quality/regression?jobB="
      fetchByJobId={async (jobId) => getQualityRegression({ jobB: jobId })}
      renderData={(data) => (
        <div className="panel">
          <h2 className="panel-title">回归结果</h2>
          <pre className="json-block mono">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    />
  );
}
