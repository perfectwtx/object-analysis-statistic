import { useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { toSchemaSnapshot, diffSnapshots } from '../schemaDiff.js';
import { download } from '../exporters.js';
import { parseJsonc } from '../utils.js';
import { useTheme, chartColors } from '../theme.js';

/**
 * @param title   卡片标题
 * @param enabled 对应后端开关是否开启；false 时整卡显示 hint
 * @param hint    未开启/不可用时显示的说明
 * @param empty   已开启但无内容时的说明（优先于 children）
 */
function InsightCard({ title, enabled = true, hint, empty, children }) {
  const body = !enabled
    ? <div className="insight-empty off-hint">{hint}</div>
    : empty
      ? <div className="insight-empty">{empty}</div>
      : children;
  return (
    <div className={`insight-card ${enabled ? '' : 'card-off'}`}>
      <div className="insight-title">
        {title}
        {enabled && (
          <span className="src-badge api" title="由 ObjectAnalyzer.Api（.NET）计算">后端</span>
        )}
        {!enabled && <span className="src-badge off">未开启</span>}
      </div>
      {body}
    </div>
  );
}

// ---------- 时间分布 / 时间序列 ----------

const TREND_LABEL = {
  increasing: '上升',
  decreasing: '下降',
  stable: '平稳',
  volatile: '波动',
};

const fmtDay = (s) => (s ? String(s).slice(0, 10) : '?');

// 桶标签：取 from 的日期部分（年-月-日）；完整区间放在 tooltip
const bucketLabel = (b) => (b && b.from ? String(b.from).slice(0, 10) : '');

// 单字段时间序列面积图（recharts）。SVG 呈现属性不认 CSS 变量，颜色按主题从 CHART_COLORS 取。
function TimeSeriesChart({ series, gradId }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  if (!series || series.length === 0) return null;
  const data = series.map((b) => ({
    label: bucketLabel(b),
    full: `${bucketLabel(b)} ~ ${b.to ? String(b.to).slice(0, 10) : '?'}`,
    count: b.count ?? 0,
    empty: (b.count ?? 0) === 0,
  }));
  const height = Math.max(170, 130 + Math.min(series.length, 24) * 4);
  return (
    <div className="ts-chart">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 14, bottom: 30, left: -6 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.barFrom} stopOpacity={0.55} />
              <stop offset="100%" stopColor={c.barTo} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: c.axis }}
            interval="preserveStartEnd"
            angle={-30}
            textAnchor="end"
            fontSize={10}
            minTickGap={18}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={28} />
          <Tooltip
            cursor={{ fill: c.cursor }}
            formatter={(v, _n, p) => [`${v} 条${p?.payload?.empty ? '（空桶）' : ''}`, '计数']}
            labelFormatter={(l, p) => p?.payload?.full || l}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={c.barTo}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={{ r: 2, fill: c.barTo }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TimeSeriesCard({ fields, timeSeries, trendEnabled }) {
  if (fields.length === 0) {
    return (
      <InsightCard
        title="时间分布与趋势"
        enabled={false}
        hint="数据中未识别到日期时间字段，无法生成时间分布。"
      />
    );
  }
  const hasTrend = !!timeSeries && Object.keys(timeSeries).length > 0;

  return (
    <InsightCard
      title={`时间分布与趋势（${fields.length} 个时间字段）`}
      enabled
      hint={null}
    >
      {!trendEnabled && (
        <div className="strong-hint">
          当前展示字段级日期分布直方图。勾选左侧「深度分析（P4）」的「时间序列」可叠加趋势、突发度、空档等统计。
        </div>
      )}
      {trendEnabled && !hasTrend && (
        <div className="strong-hint">已开启「时间序列」，但本数据未产生时间序列趋势结果。</div>
      )}
      {fields.map((f, idx) => {
        const t = timeSeries?.[f.fieldName] || null;
        const series = t?.series?.length ? t.series : f.dateHistogram || [];
        const peak = series.reduce((m, b) => Math.max(m, (b.count ?? 0)), 0);
        return (
          <div className="ts-row" key={f.fieldName}>
            <div className="ts-head">
              <span className="mono pattern-field">{f.fieldName}</span>
              {t?.trend && (
                <span className={`trend-badge ${t.trend}`}>
                  {TREND_LABEL[t.trend] ?? t.trend}
                </span>
              )}
              <span className="dim ts-range">
                {fmtDay(t?.start ?? f.minDateTime)} → {fmtDay(t?.end ?? f.maxDateTime)}
              </span>
            </div>
            <TimeSeriesChart series={series} gradId={`ts-grad-${idx}`} />
            <div className="ts-meta">
              <span className="chip">{series.length} 桶</span>
              <span className="chip">峰值 {peak}</span>
              <span className="chip">n={t?.totalSamples ?? f.count}</span>
              {t && (
                <>
                  <span className="chip">斜率 {Number(t.trendSlope).toFixed(3)}</span>
                  <span className="chip">R² {Number(t.trendRSquared).toFixed(2)}</span>
                  <span className="chip">突发度 {Number(t.burstiness).toFixed(2)}</span>
                  {t.longestGapBuckets > 0 && (
                    <span className="chip warn-chip">空档 {t.longestGapBuckets} 桶</span>
                  )}
                  {t.emptyRatio > 0 && (
                    <span className="chip warn-chip">空桶 {(t.emptyRatio * 100).toFixed(0)}%</span>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </InsightCard>
  );
}

// 深度分析项 → 后端开关与中文名（用于「未开启」提示）
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
      'application/json'
    );
  };

  const onBaselineUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        // 快照可能被人手加过注释，按 JSONC 解析
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
  const topPairs = [...correlations.pairs].sort((a, b) => Math.abs(b.pearson) - Math.abs(a.pearson)).slice(0, 8);
  const patternEntries = Object.entries(patterns);
  const hygieneEntries = Object.entries(hygiene).sort((a, b) => a[1].hygieneScore - b[1].hygieneScore);
  // 字段级日期直方图由后端随统计一起返回；timeSeries 需额外开启时间序列
  const dateFields = (result?.fieldStatistics || []).filter((f) => f.dateHistogram?.length);

  // 未开启某开关时，卡片显示引导文案
  const hintOf = (flag, label) =>
    `在左侧「深度分析（P4）」中勾选「${label}」后重新分析。`;
  const flagOf = (key) => INSIGHT_FEATURES.find((f) => f.key === key);
  const enabledOf = (key) => {
    const f = flagOf(key);
    return f ? !!features[f.flag] : true;
  };

  return (
    <div className="insights">
      {/* ---------- 相关性 ---------- */}
      <InsightCard
        title={`字段相关性（${correlations.fields.length} 个数值字段）`}
        enabled={enabledOf('correlations')}
        hint={hintOf('enableCorrelation', '字段相关性')}
        empty={topPairs.length === 0 ? '数值字段不足（需 ≥2 个数值字段且每字段样本 ≥3），无法计算相关性' : null}
      >
        {correlations.strongPairs.length > 0 && (
          <div className="strong-hint">强相关（|r|≥0.7 且 n≥30）：{correlations.strongPairs.length} 对</div>
        )}
        {topPairs.length > 0 && (
          <table>
            <thead><tr><th>字段 A</th><th>字段 B</th><th>Pearson</th><th>Spearman</th><th>样本</th></tr></thead>
            <tbody>
              {topPairs.map((p) => (
                <tr key={p.fieldA + p.fieldB}>
                  <td className="mono">{p.fieldA}</td>
                  <td className="mono">{p.fieldB}</td>
                  <td className={Math.abs(p.pearson) >= 0.7 ? 'corr-strong' : ''}>{p.pearson.toFixed(3)}</td>
                  <td>{p.spearman.toFixed(3)}</td>
                  <td>{p.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </InsightCard>

      {/* ---------- 字符串模式 ---------- */}
      <InsightCard
        title="字符串模式"
        enabled={enabledOf('patterns')}
        hint={hintOf('enableStringPatterns', '字符串模式')}
        empty={patternEntries.length === 0 ? '无字符串字段' : null}
      >
        {patternEntries.map(([field, p]) => (
          <div className="pattern-row" key={field}>
            <span className="mono pattern-field">{field}</span>
            <code className="pattern-tpl">{p.dominantPattern.template || '(空)'}</code>
            <span className="pattern-ratio">{(p.dominantPattern.ratio * 100).toFixed(1)}%</span>
          </div>
        ))}
      </InsightCard>

      {/* ---------- Unicode 卫生 ---------- */}
      <InsightCard
        title="Unicode 卫生"
        enabled={enabledOf('hygiene')}
        hint={hintOf('enableUnicodeHygiene', 'Unicode 卫生')}
        empty={hygieneEntries.length === 0 ? '无字符串字段' : null}
      >
        {hygieneEntries.map(([field, h]) => (
          <div className="hygiene-row" key={field}>
            <span className="mono pattern-field">{field}</span>
            <div className="hygiene-bar">
              <div style={{ width: `${h.hygieneScore}%` }}
                   className={h.hygieneScore >= 90 ? 'good' : h.hygieneScore >= 70 ? 'warn' : 'bad'} />
            </div>
            <span className="hygiene-score">{h.hygieneScore}</span>
            <span className="hygiene-tags">
              {h.fullwidth > 0 && <span className="chip">全角×{h.fullwidth}</span>}
              {h.zeroWidth > 0 && <span className="chip">零宽×{h.zeroWidth}</span>}
              {h.invisible > 0 && <span className="chip">不可见×{h.invisible}</span>}
              {h.control > 0 && <span className="chip">控制符×{h.control}</span>}
              {h.bidi > 0 && <span className="chip">双向×{h.bidi}</span>}
              {h.whitespace > 0 && <span className="chip">首尾空白×{h.whitespace}</span>}
            </span>
          </div>
        ))}
      </InsightCard>

      {/* ---------- 模糊去重 ---------- */}
      {/* 后端 /analyze 目前不产出 FuzzyDuplicates（该结果只在 CLI 的 AnalysisRunner 路径生成），
          因此这里不提供开关，接口一旦返回数据即可自动显示。 */}
      <InsightCard
        title={`模糊去重（${fuzzy.totalSamples} 条 → ${fuzzy.uniqueCanonical} 个规范键）`}
        enabled={fuzzy.totalSamples > 0}
        hint="当前后端 /analyze 接口不返回模糊去重结果（该能力仅在 CLI 路径产出）。"
        empty="未发现重复或近似重复"
      >
        {fuzzy.groups.length > 0 && (
          <>
            <div className="strong-hint">{fuzzy.groupCount} 组重复，共 {fuzzy.similarDuplicates} 条冗余</div>
            {fuzzy.groups.slice(0, 10).map((g, i) => (
              <div className="fuzzy-group" key={i}>
                <span className="chip">×{g.count}</span>
                {g.variants > 1 && <span className="chip">{g.variants} 个变体</span>}
                <span className="mono fuzzy-rep">{g.representativeJson}</span>
              </div>
            ))}
          </>
        )}
      </InsightCard>

      {/* ---------- 时间分布 / 趋势 ---------- */}
      <TimeSeriesCard fields={dateFields} timeSeries={timeSeries} trendEnabled={enabledOf('timeSeries')} />

      {/* ---------- Schema 演进 ---------- */}
      <InsightCard title="Schema 演进（快照 Diff）">
        <div className="schema-actions">
          <button className="btn half" onClick={downloadSnapshot}>下载当前快照</button>
          <button className="btn half" onClick={() => snapshotInput.current?.click()}>上传基线对比</button>
          <input ref={snapshotInput} type="file" accept=".json" hidden onChange={onBaselineUpload} />
        </div>
        {diffError && <div className="error side-error">{diffError}</div>}
        {diff && (
          <div className="schema-diff">
            <div className={`diff-summary ${diff.hasBreakingChanges ? 'breaking' : 'safe'}`}>
              {diff.hasBreakingChanges ? '⚠ 存在破坏性变更' : '✓ 无破坏性变更'}
              <span className="diff-meta">
                新增 {diff.addedFields.length} · 删除 {diff.removedFields.length} · 变更 {diff.changedFields.length}
              </span>
            </div>
            {diff.removedFields.length > 0 && (
              <div className="diff-group">
                <div className="diff-group-title removed">删除的字段</div>
                {diff.removedFields.map((f) => <div className="mono diff-item" key={f.path}>- {f.path}</div>)}
              </div>
            )}
            {diff.addedFields.length > 0 && (
              <div className="diff-group">
                <div className="diff-group-title added">新增的字段</div>
                {diff.addedFields.map((f) => <div className="mono diff-item" key={f.path}>+ {f.path}</div>)}
              </div>
            )}
            {diff.changedFields.length > 0 && (
              <div className="diff-group">
                <div className="diff-group-title changed">变更的字段</div>
                {diff.changedFields.map((f) => (
                  <div className="diff-change" key={f.path}>
                    <span className="mono diff-item">
                      ~ {f.path} {f.breaking && <span className="badge violation">破坏性</span>}
                    </span>
                    {f.changes.map((c, i) => (
                      <div className="diff-change-detail" key={i}>{c.description}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </InsightCard>
    </div>
  );
}
