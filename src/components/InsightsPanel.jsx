import { useRef, useState } from 'react';
import { toSchemaSnapshot, diffSnapshots } from '../schemaDiff.js';
import { download } from '../exporters.js';
import { parseJsonc } from '../utils.js';
import Sparkline from './Sparkline.jsx';

/**
 * @param title   卡片标题
 * @param enabled 对应后端开关是否开启；false 时整卡显示 hint
 * @param hint    未开启/不可用时显示的说明
 * @param empty   已开启但无内容时的说明（优先于 children）
 */
function InsightCard({ title, enabled = true, hint, empty, children }) {
  const body = !enabled ? (
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{hint}</p>
  ) : empty ? (
    <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
  ) : (
    children
  );

  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 shadow-[var(--elev)] ${
        enabled ? '' : 'opacity-70'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium tracking-tight">{title}</h3>
        {enabled ? (
          <span
            className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary"
            title="由 ObjectAnalyzer.Api（.NET）计算"
          >
            后端
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            未开启
          </span>
        )}
      </div>
      <div className="mt-3">{body}</div>
    </div>
  );
}

function Chip({ children, warn }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] ${
        warn
          ? 'bg-warn/15 text-warn'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {children}
    </span>
  );
}

const TREND_LABEL = {
  increasing: '上升',
  decreasing: '下降',
  stable: '平稳',
  volatile: '波动',
};

const TREND_CLASS = {
  increasing: 'bg-ok/15 text-ok',
  decreasing: 'bg-danger/15 text-danger',
  stable: 'bg-muted text-muted-foreground',
  volatile: 'bg-warn/15 text-warn',
};

const fmtDay = (s) => (s ? String(s).slice(0, 10) : '?');

function TimeSeriesCard({ fields, timeSeries, trendEnabled }) {
  if (fields.length === 0) {
    return (
      <InsightCard
        title="时间分布与趋势"
        enabled={trendEnabled}
        hint="在左侧「深度分析」中勾选「时间序列」后重新分析，可得到趋势、突发度、空档等统计。"
        empty="数据中未识别到日期时间字段"
      />
    );
  }
  const hasTrend = !!timeSeries && Object.keys(timeSeries).length > 0;

  return (
    <InsightCard
      title={`时间分布与趋势（${fields.length} 个时间字段）`}
      enabled={trendEnabled}
      hint="在左侧「深度分析」中勾选「时间序列」后重新分析，可得到趋势、突发度、空档等统计。"
    >
      {!hasTrend ? (
        <div className="mb-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          仅显示后端返回的日期分布直方图。勾选「时间序列」重新分析可得到趋势、突发度、空档等统计。
        </div>
      ) : null}
      <div className="space-y-4">
        {fields.map((f) => {
          const t = timeSeries?.[f.fieldName] || null;
          const series = t?.series?.length ? t.series : f.dateHistogram || [];
          const peak = series.reduce((m, b) => Math.max(m, b.count), 0);
          return (
            <div key={f.fieldName} className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{f.fieldName}</span>
                {t?.trend ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      TREND_CLASS[t.trend] || 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {TREND_LABEL[t.trend] ?? t.trend}
                  </span>
                ) : null}
                <span className="text-[11px] text-muted-foreground">
                  {fmtDay(t?.start ?? f.minDateTime)} → {fmtDay(t?.end ?? f.maxDateTime)}
                </span>
              </div>
              <Sparkline data={series} width={300} height={36} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip>{series.length} 桶</Chip>
                <Chip>峰值 {peak}</Chip>
                <Chip>n={t?.totalSamples ?? f.count}</Chip>
                {t ? (
                  <>
                    <Chip>斜率 {Number(t.trendSlope).toFixed(3)}</Chip>
                    <Chip>R² {Number(t.trendRSquared).toFixed(2)}</Chip>
                    <Chip>突发度 {Number(t.burstiness).toFixed(2)}</Chip>
                    {t.longestGapBuckets > 0 ? (
                      <Chip warn>空档 {t.longestGapBuckets} 桶</Chip>
                    ) : null}
                    {t.emptyRatio > 0 ? (
                      <Chip warn>空桶 {(t.emptyRatio * 100).toFixed(0)}%</Chip>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}

export const INSIGHT_FEATURES = [
  { key: 'correlations', flag: 'enableCorrelation', label: '字段相关性' },
  { key: 'patterns', flag: 'enableStringPatterns', label: '字符串模式' },
  { key: 'hygiene', flag: 'enableUnicodeHygiene', label: 'Unicode 卫生' },
  { key: 'timeSeries', flag: 'enableTimeSeries', label: '时间序列' },
];

export default function InsightsPanel({ result, insights, features = {}, fileName }) {
  const [diff, setDiff] = useState(null);
  const [diffError, setDiffError] = useState('');
  const snapshotInput = useRef(null);

  const downloadSnapshot = () => {
    download(
      JSON.stringify(toSchemaSnapshot(result, fileName), null, 2),
      'schema-snapshot.json',
      'application/json',
    );
  };

  const onBaselineUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const baseline = parseJsonc(String(reader.result));
        if (!Array.isArray(baseline.fields)) throw new Error('不是有效的 Schema 快照');
        setDiff(diffSnapshots(baseline, toSchemaSnapshot(result, fileName)));
        setDiffError('');
      } catch (err) {
        setDiffError(`快照解析失败：${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const { correlations, patterns, hygiene, fuzzy, timeSeries } = insights;
  const topPairs = [...(correlations?.pairs || [])]
    .sort((a, b) => Math.abs(b.pearson) - Math.abs(a.pearson))
    .slice(0, 8);
  const patternEntries = Object.entries(patterns || {});
  const hygieneEntries = Object.entries(hygiene || {}).sort(
    (a, b) => a[1].hygieneScore - b[1].hygieneScore,
  );
  const dateFields = (result?.fieldStatistics || []).filter((f) => f.dateHistogram?.length);

  const hintOf = (_flag, label) =>
    `在左侧「深度分析」中勾选「${label}」后重新分析。`;
  const flagOf = (key) => INSIGHT_FEATURES.find((f) => f.key === key);
  const enabledOf = (key) => {
    const f = flagOf(key);
    return f ? !!features[f.flag] : true;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* 相关性 */}
      <InsightCard
        title={`字段相关性（${correlations?.fields?.length ?? 0} 个数值字段）`}
        enabled={enabledOf('correlations')}
        hint={hintOf('enableCorrelation', '字段相关性')}
        empty={
          topPairs.length === 0
            ? '数值字段不足（需 ≥2 个数值字段且每字段样本 ≥3），无法计算相关性'
            : null
        }
      >
        {(correlations?.strongPairs?.length ?? 0) > 0 ? (
          <div className="mb-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
            强相关（|r|≥0.7 且 n≥30）：{correlations.strongPairs.length} 对
          </div>
        ) : null}
        {topPairs.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">字段 A</th>
                  <th className="px-3 py-2 font-medium">字段 B</th>
                  <th className="px-3 py-2 font-medium">Pearson</th>
                  <th className="px-3 py-2 font-medium">Spearman</th>
                  <th className="px-3 py-2 font-medium">样本</th>
                </tr>
              </thead>
              <tbody>
                {topPairs.map((p) => (
                  <tr key={p.fieldA + p.fieldB} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{p.fieldA}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.fieldB}</td>
                    <td
                      className={`px-3 py-2 tabular-nums ${
                        Math.abs(p.pearson) >= 0.7 ? 'font-medium text-primary' : ''
                      }`}
                    >
                      {p.pearson.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{p.spearman.toFixed(3)}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{p.samples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </InsightCard>

      {/* 字符串模式 */}
      <InsightCard
        title="字符串模式"
        enabled={enabledOf('patterns')}
        hint={hintOf('enableStringPatterns', '字符串模式')}
        empty={patternEntries.length === 0 ? '无字符串字段' : null}
      >
        <div className="space-y-2">
          {patternEntries.map(([field, p]) => (
            <div
              key={field}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-3 py-2"
            >
              <span className="font-mono text-xs">{field}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {p.dominantPattern?.template || '(空)'}
              </code>
              <span className="ml-auto tabular-nums text-xs text-muted-foreground">
                {((p.dominantPattern?.ratio ?? 0) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </InsightCard>

      {/* Unicode 卫生 */}
      <InsightCard
        title="Unicode 卫生"
        enabled={enabledOf('hygiene')}
        hint={hintOf('enableUnicodeHygiene', 'Unicode 卫生')}
        empty={hygieneEntries.length === 0 ? '无字符串字段' : null}
      >
        <div className="space-y-2.5">
          {hygieneEntries.map(([field, h]) => {
            const score = h.hygieneScore ?? 0;
            const barColor =
              score >= 90 ? 'bg-ok' : score >= 70 ? 'bg-warn' : 'bg-danger';
            return (
              <div key={field} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{field}</span>
                  <span className="tabular-nums text-xs font-medium">{score}</span>
                  <div className="flex flex-wrap gap-1">
                    {h.fullwidth > 0 ? <Chip>全角×{h.fullwidth}</Chip> : null}
                    {h.zeroWidth > 0 ? <Chip>零宽×{h.zeroWidth}</Chip> : null}
                    {h.invisible > 0 ? <Chip>不可见×{h.invisible}</Chip> : null}
                    {h.control > 0 ? <Chip>控制符×{h.control}</Chip> : null}
                    {h.bidi > 0 ? <Chip>双向×{h.bidi}</Chip> : null}
                    {h.whitespace > 0 ? <Chip>首尾空白×{h.whitespace}</Chip> : null}
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${Math.min(100, score)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </InsightCard>

      {/* 模糊去重 */}
      <InsightCard
        title={`模糊去重（${fuzzy?.totalSamples ?? 0} 条 → ${fuzzy?.uniqueCanonical ?? 0} 个规范键）`}
        enabled={(fuzzy?.totalSamples ?? 0) > 0}
        hint="当前后端 /analyze 接口不返回模糊去重结果（该能力仅在 CLI 路径产出）。"
        empty="未发现重复或近似重复"
      >
        {(fuzzy?.groups?.length ?? 0) > 0 ? (
          <>
            <div className="mb-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {fuzzy.groupCount} 组重复，共 {fuzzy.similarDuplicates} 条冗余
            </div>
            <div className="space-y-2">
              {fuzzy.groups.slice(0, 10).map((g, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-start gap-2 rounded-lg border border-border/60 px-3 py-2"
                >
                  <Chip>×{g.count}</Chip>
                  {g.variants > 1 ? <Chip>{g.variants} 个变体</Chip> : null}
                  <span className="min-w-0 flex-1 break-all font-mono text-[11px] text-muted-foreground">
                    {g.representativeJson}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </InsightCard>

      {/* 时间分布 — 跨两列 */}
      <div className="lg:col-span-2">
        <TimeSeriesCard
          fields={dateFields}
          timeSeries={timeSeries}
          trendEnabled={enabledOf('timeSeries')}
        />
      </div>

      {/* Schema 演进 — 跨两列 */}
      <div className="lg:col-span-2">
        <InsightCard title="Schema 演进（快照 Diff）">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)] hover:bg-muted/80"
              onClick={downloadSnapshot}
            >
              下载当前快照
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)] hover:bg-muted/80"
              onClick={() => snapshotInput.current?.click()}
            >
              上传基线对比
            </button>
            <input
              ref={snapshotInput}
              type="file"
              accept=".json"
              className="hidden"
              onChange={onBaselineUpload}
            />
          </div>
          {diffError ? (
            <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              {diffError}
            </div>
          ) : null}
          {diff ? (
            <div className="mt-4 space-y-3">
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  diff.hasBreakingChanges
                    ? 'bg-danger/10 text-danger'
                    : 'bg-ok/10 text-ok'
                }`}
              >
                {diff.hasBreakingChanges ? '⚠ 存在破坏性变更' : '✓ 无破坏性变更'}
                <span className="ml-2 text-xs opacity-80">
                  新增 {diff.addedFields.length} · 删除 {diff.removedFields.length} · 变更{' '}
                  {diff.changedFields.length}
                </span>
              </div>
              {diff.removedFields.length > 0 ? (
                <div>
                  <div className="mb-1 text-xs font-medium text-danger">删除的字段</div>
                  {diff.removedFields.map((f) => (
                    <div key={f.path} className="font-mono text-xs text-muted-foreground">
                      − {f.path}
                    </div>
                  ))}
                </div>
              ) : null}
              {diff.addedFields.length > 0 ? (
                <div>
                  <div className="mb-1 text-xs font-medium text-ok">新增的字段</div>
                  {diff.addedFields.map((f) => (
                    <div key={f.path} className="font-mono text-xs text-muted-foreground">
                      + {f.path}
                    </div>
                  ))}
                </div>
              ) : null}
              {diff.changedFields.length > 0 ? (
                <div>
                  <div className="mb-1 text-xs font-medium text-warn">变更的字段</div>
                  {diff.changedFields.map((f) => (
                    <div key={f.path} className="mb-2">
                      <div className="font-mono text-xs">
                        ~ {f.path}{' '}
                        {f.breaking ? (
                          <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[10px] text-danger">
                            破坏性
                          </span>
                        ) : null}
                      </div>
                      {(f.changes || []).map((c, i) => (
                        <div key={i} className="pl-3 text-[11px] text-muted-foreground">
                          {c.description}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </InsightCard>
      </div>
    </div>
  );
}
