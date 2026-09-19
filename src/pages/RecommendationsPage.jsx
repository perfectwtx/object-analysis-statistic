import { usePlatform } from '../lib/store.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Card } from '../components/ui/card.jsx';

export default function RecommendationsPage() {
  const recs = usePlatform((s) => s.recommendations) || [];
  return (
    <div>
      <PageHeader title="改进建议" subtitle="根据质量维度与问题自动生成的优先事项。" />
      <div className="space-y-3">
        {recs.map((r, i) => (
          <Card key={r.id || i} className="flex gap-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-medium text-primary">
              {i + 1}
            </div>
            <div>
              <div className="text-sm font-medium">{r.title || r.name}</div>
              <p className="mt-1 text-sm text-muted-foreground">{r.detail || r.description || r.reason}</p>
            </div>
          </Card>
        ))}
        {!recs.length ? (
          <Card className="py-10 text-center text-sm text-muted-foreground">暂无建议，完成分析后会根据问题生成。</Card>
        ) : null}
      </div>
    </div>
  );
}
