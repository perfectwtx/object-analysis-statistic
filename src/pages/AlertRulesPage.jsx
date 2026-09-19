import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { usePlatform } from '../lib/store.js';
import { cn } from '../lib/cn.js';
import { useT } from '../lib/i18n.js';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';

export default function AlertRulesPage() {
  const { t } = useT();
  const alerts = usePlatform((s) => s.alerts);
  const toggleAlert = usePlatform((s) => s.toggleAlert);
  const source = usePlatform((s) => s.source);
  const loading = usePlatform((s) => s.loading);
  const refresh = usePlatform((s) => s.refresh);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <div>
      <PageHeader
        title={t('alertRules')}
        subtitle={source === 'api' ? t('alertSubtitleApi') : t('alertSubtitleDemo')}
        actions={
          <>
            <BackendStatus />
            <Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              {t('refresh')}
            </Button>
          </>
        }
      />
      <TableShell>
        <Table dense>
          <THead sticky>
            <tr>
              <TH>{t('rule')}</TH>
              <TH>{t('condition')}</TH>
              <TH className="w-[5rem]">{t('status')}</TH>
              <TH className="w-[5rem]">{t('actions')}</TH>
            </tr>
          </THead>
          <TBody>
            {alerts.map((a) => (
              <TR key={a.id}>
                <TD className="font-medium">{a.name}</TD>
                <TD mono muted className="max-w-sm truncate" title={a.condition}>{a.condition || '—'}</TD>
                <TD>
                  <Badge tone={a.enabled ? 'ok' : 'neutral'}>{a.enabled ? t('enabled') : t('disabled')}</Badge>
                </TD>
                <TD>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => toggleAlert(a.id)}
                  >
                    {a.enabled ? t('off') : t('on')}
                  </button>
                </TD>
              </TR>
            ))}
            {!alerts.length ? <EmptyRow colSpan={4}>{t('noAlertRules')}</EmptyRow> : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
