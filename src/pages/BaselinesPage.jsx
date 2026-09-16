import { useEffect, useState } from 'react';
import { listBaselines, createBaseline, deleteBaseline } from '../api/index.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import LoadingBlock from '../components/ui/LoadingBlock.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import ApiUnavailable from '../components/ui/ApiUnavailable.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

const EMPTY = { sourceName: '', minOverall: 80, minCompleteness: 70, minValidity: 80, minUniqueness: 50, minConsistency: 70, minAnomalyControl: 70 };

export default function BaselinesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const r = await listBaselines();
      if (r.unavailable) { setUnavailable(true); setItems([]); }
      else { setUnavailable(false); setItems(Array.isArray(r.data) ? r.data : r.data?.items || []); }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!form.sourceName.trim()) return;
    setSaving(true); setError('');
    try { await createBaseline(form); setForm(EMPTY); await load(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="page">
      <PageHeader title="Baselines" subtitle="按数据源设定五维质量阈值" />
      <ErrorBanner message={error} onRetry={load} />
      {loading && <LoadingBlock />}
      {!loading && unavailable && <ApiUnavailable feature="质量基线" endpoint="GET/POST /api/quality-baselines" />}
      {!loading && !unavailable && (
        <>
          <form className="panel form-grid" onSubmit={onCreate}>
            <h2 className="panel-title">新建基线</h2>
            <label>数据源名<input value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} required /></label>
            {['minOverall','minCompleteness','minValidity','minUniqueness','minConsistency','minAnomalyControl'].map((k) => (
              <label key={k}>{k}<input type="number" min={0} max={100} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} /></label>
            ))}
            <button className="btn primary" type="submit" disabled={saving}>{saving ? '保存中…' : '创建'}</button>
          </form>
          {!items.length ? <EmptyState title="暂无基线" /> : (
            <div className="panel">
              <table className="data-table">
                <thead><tr><th>数据源</th><th>综合</th><th>完整</th><th>有效</th><th>唯一</th><th></th></tr></thead>
                <tbody>
                  {items.map((b) => (
                    <tr key={b.id || b.Id}>
                      <td className="mono">{b.sourceName || b.SourceName}</td>
                      <td>{b.minOverall ?? b.MinOverall ?? '—'}</td>
                      <td>{b.minCompleteness ?? '—'}</td>
                      <td>{b.minValidity ?? '—'}</td>
                      <td>{b.minUniqueness ?? '—'}</td>
                      <td><button type="button" className="btn-link danger" onClick={async () => { await deleteBaseline(b.id || b.Id); load(); }}>删除</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
