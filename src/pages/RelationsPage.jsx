import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { buttonVariants } from '../components/ui/button.jsx';
import { Card, CardHint, CardTitle } from '../components/ui/card.jsx';
import { cn } from '../lib/cn.js';
import { useT } from '../lib/i18n.js';

export default function RelationsPage() {
  const { t } = useT();
  return (
    <div>
      <PageHeader
        title={t('relationsTitle')}
        subtitle={t('relationsSubtitle')}
        actions={
          <Link to="/analyze" className={cn(buttonVariants({ size: 'sm' }), 'no-underline')}>
            {t('goAnalyze')}
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>{t('fieldRelations')}</CardTitle>
          <CardHint>{t('fieldRelationsHint')}</CardHint>
          <p className="mt-4 text-sm text-muted-foreground">{t('fieldRelationsBody')}</p>
        </Card>
        <Card>
          <CardTitle>{t('objectRelations')}</CardTitle>
          <CardHint>{t('objectRelationsHint')}</CardHint>
          <p className="mt-4 text-sm text-muted-foreground">{t('objectRelationsBody')}</p>
        </Card>
      </div>
    </div>
  );
}
