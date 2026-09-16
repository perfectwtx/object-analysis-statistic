import PlaceholderPage from './PlaceholderPage.jsx';
export default function RelationsPage() {
  return (
    <PlaceholderPage
      title="关系分析"
      subtitle="字段相关性 / 关联强度"
      feature="关系分析"
      endpoint="deepAnalysis.correlationMatrix · GET /api/jobs/{id}/result?section=deep"
    />
  );
}
