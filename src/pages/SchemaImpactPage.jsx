import PlaceholderPage from './PlaceholderPage.jsx';
export default function SchemaImpactPage() {
  return (
    <PlaceholderPage
      title="Schema Impact"
      subtitle="Schema Diff 与下游影响"
      feature="Schema Impact"
      endpoint="GET /api/analysis/jobs/{jobId}/impact · result.schemaDiff"
    />
  );
}
