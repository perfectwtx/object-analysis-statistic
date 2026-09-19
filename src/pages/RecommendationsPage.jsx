import { usePlatform } from '../lib/store.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Card } from '../components/ui/card.jsx';
import { useT } from '../lib/i18n.js';

export default function RecommendationsPage() {
  const { t } = useT();
  const recs = usePlatform((s) => s.recommendations) || [];
  return (
    <div>
      <PageHeader title={t('recsTitle')} subtitle={t('recsSubtitle')} />
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
          <Card className="py-10 text-center text-sm text-muted-foreground">{t('noRecs')}</Card>
        ) : null}
      </div>
    </div>
  );
}
