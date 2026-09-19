import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { buttonVariants } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { cn } from '../lib/cn.js';
import { useT } from '../lib/i18n.js';

export default function DataLineagePage() {
  const { t } = useT();
  return (
    <div>
      <PageHeader
        title={t('lineageTitle')}
        subtitle={t('lineageSubtitle')}
        actions={
          <Link to="/analyze" className={cn(buttonVariants({ size: 'sm' }), 'no-underline')}>
            {t('goAnalyze')}
          </Link>
        }
      />
      <Card className="py-12 text-center text-sm text-muted-foreground">
        <code className="text-xs">/api/jobs/&#123;id&#125;/lineage</code>
        <div className="mt-2">{t('apiReadyLater')}</div>
      </Card>
    </div>
  );
}
