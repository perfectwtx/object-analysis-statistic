// 把 ObjectAnalyzer.Api 的响应适配为前端组件已有的内部数据结构。
//
// 后端 v2 契约（W8 重构）一次返回五块页面视图，前端优先消费分节视图，
// 缺失时回落到兼容保留的 result（异步作业快照只有 result + preview）：
//   overview     { totalObjects, totalUniqueObjects, totalDuplicateGroups,
//                  fieldCount, violationCount, filterExpression }
//   preview      { columns, rows, truncated }   ← 流经管线的样本记录（默认 20 条）
//   fields       FieldStatistic[]               ← 与 result.fieldStatistics 同源
//   deepAnalysis { correlationMatrix, stringPatterns, unicodeHygiene, timeSeriesAnalyses,
//                  fuzzyDuplicates, distributionDiff, samplingConfidence, schemaDiff } | null
//   quality      { violations, countsByCheck, hasViolations }
//   result       AnalysisResult（完整原始结果，兼容保留）
//
// 后端字段（C#）→ 前端字段（JS）对照：
//   defaultValueRepresentation → defaultValue
//   minNumber/maxNumber/avgNumber/sumNumber/stdDevNumber → min/max/avg/sum/stdDev
//   medianNumber/p90Number/p95Number/p99Number          → median/p90/p95/p99
//   correlationMatrix（矩阵）                            → correlations.pairs（列表）
//   unicodeHygiene.*.*Count                              → hygiene.*（简写计数）
//   fuzzyDuplicates.groups[].examples.length             → groups[].variants
//   nullCount + coverage                                 → presentCount / nullRate（展示只叠加有效值率与值为 null 率）

// ---------- 字段级 ----------

// 后端 OutlierBounds 是字符串 "[45, 55]"，解析成 [45, 55]；解析不了就原样返回（展示层有兜底）
function normalizeBounds(b) {
  if (Array.isArray(b)) return b;
  if (typeof b === 'string') {
    const nums = b.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g);
    if (nums && nums.length >= 2) return [Number(nums[0]), Number(nums[1])];
    return b;
  }
  return null;
}

/**
 * 适配单个 FieldStatistic，并推导出覆盖率两段组成。
 *
 * 后端 W8 起给出 nullCount（值为显式 null 的记录数，是 count 的子集）：
 *   有效值  = count - nullCount      （绿色段，真正参与统计）
 *   值为 null = nullCount            （红色段）
 * 两者相加 = 覆盖率（count / totalObjects）。「字段不存在」(totalObjects - count) 不再
 * 单独成段，仅作为进度条未填充的空白部分呈现，避免与覆盖率概念混淆。
 */
function adaptField(f, totalObjects) {
  const valueCounts = f.valueCounts || {};
  const count = f.count ?? 0;
  const nullCount = f.nullCount ?? 0;
  const missingCount = Math.max(0, (totalObjects || 0) - count);

  return {
    fieldName: f.fieldName,
    count,
    coverage: f.coverage ?? 0,
    typeCounts: f.typeCounts || {},
    valueCounts,
    valueCountsTruncated: !!f.valueCountsTruncated,
    // 本地引擎用 valueCountsFull 算模式/卫生；API 的 valueCounts 可能已被裁剪
    valueCountsFull: valueCounts,

    // ── 覆盖率拆分（W8）──
    nullCount,
    missingCount,
    presentCount: Math.max(0, count - nullCount),

    distinctCount: f.distinctCount ?? Object.keys(valueCounts).length,
    distinctApproximate: !!f.distinctApproximate,
    semanticType: f.semanticType ?? null,
    primaryType: f.primaryType || 'Unknown',
    nullAppeared: !!f.nullAppeared,
    defaultValue: f.defaultValueRepresentation ?? null,

    // 数值剖析
    min: f.minNumber ?? null,
    max: f.maxNumber ?? null,
    avg: f.avgNumber ?? null,
    sum: f.sumNumber ?? null,
    stdDev: f.stdDevNumber ?? null,
    median: f.medianNumber ?? null,
    p90: f.p90Number ?? null,
    p95: f.p95Number ?? null,
    p99: f.p99Number ?? null,
    histogram: f.histogram || null,

    // 日期剖析
    dateTimeCount: f.dateTimeCount ?? null,
    minDateTime: f.minDateTime ?? null,
    maxDateTime: f.maxDateTime ?? null,
    dateHistogram: f.dateHistogram || null,

    // 异常值
    outlierMethod: f.outlierMethod ?? null,
    outlierCount: f.outlierCount ?? null,
    outlierRatio: f.outlierRatio ?? null,
    // C# 的 OutlierBounds 是 string（如 "[45, 55]"），本地引擎用的是 [lower, upper]，这里统一成数组
    outlierBounds: normalizeBounds(f.outlierBounds),

    // 文本长度
    minLength: f.minLength ?? null,
    maxLength: f.maxLength ?? null,
    avgLength: f.avgLength ?? null,

    // 规则与转换（后端专有信息）
    appliedRule: f.appliedRule ?? null,
    transformType: f.transformType ?? null,
    transformFailureCount: f.transformFailureCount ?? 0,
    rangeViolationCount: f.rangeViolationCount ?? 0,
  };
}

// ---------- 深度分析 ----------

// 相关性：后端给的是三角矩阵，前端组件消费 {fieldA, fieldB, pearson, spearman, samples} 列表
function adaptCorrelations(m) {
  if (!m?.fields?.length) return null;
  const fields = m.fields;
  const pearson = m.pearson || [];
  const spearman = m.spearman || [];
  const counts = m.pairwiseSampleCounts || [];
  const pairs = [];

  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      const p = pearson[i]?.[j];
      if (p === null || p === undefined) continue;
      pairs.push({
        fieldA: fields[i],
        fieldB: fields[j],
        pearson: p,
        spearman: spearman[i]?.[j] ?? p,
        samples: counts[i]?.[j] ?? m.samples ?? 0,
      });
    }
  }
  return {
    fields,
    pairs,
    strongPairs: pairs.filter((p) => Math.abs(p.pearson) >= 0.7 && p.samples >= 30),
  };
}

// 字符串模式：结构几乎一致，补齐 ratio 兜底
function adaptStringPatterns(dict) {
  if (!dict) return null;
  const out = {};
  for (const [field, p] of Object.entries(dict)) {
    const total = p.totalSamples || 0;
    const dom = p.dominantPattern || null;
    out[field] = {
      totalSamples: total,
      dominantPattern: dom
        ? {
            template: dom.template ?? '',
            count: dom.count ?? 0,
            ratio: dom.ratio ?? (total ? dom.count / total : 0),
            examples: dom.examples || [],
          }
        : { template: '', count: 0, ratio: 0, examples: [] },
      patterns: p.patterns || [],
      otherCount: p.otherCount ?? 0,
    };
  }
  return out;
}

// Unicode 卫生：*Count 后缀 → 简写字段
function adaptHygiene(dict) {
  if (!dict) return null;
  const out = {};
  for (const [field, h] of Object.entries(dict)) {
    out[field] = {
      hygieneScore: h.hygieneScore ?? 100,
      totalSamples: h.totalSamples ?? 0,
      fullwidth: h.fullwidthCount ?? 0,
      halfwidth: h.halfwidthCount ?? 0,
      zeroWidth: h.zeroWidthCount ?? 0,
      invisible: h.invisibleCount ?? 0,
      control: h.controlCharCount ?? 0,
      bidi: h.bidiControlCount ?? 0,
      whitespace: h.surroundingWhitespaceCount ?? 0,
      mixedCase: h.mixedCaseCount ?? 0,
    };
  }
  return out;
}

function adaptFuzzy(rep) {
  if (!rep) return null;
  const groups = (rep.groups || []).map((g) => ({
    representativeJson: g.representativeJson || '',
    canonicalKey: g.canonicalKey || '',
    count: g.count ?? 0,
    // 后端不给变体数，用样例去重后的条数近似
    variants: Math.max(1, new Set(g.examples || []).size),
    averageSimilarity: g.averageSimilarity ?? 1,
    examples: g.examples || [],
  }));
  return {
    groups,
    groupCount: rep.groupCount ?? groups.length,
    similarDuplicates: rep.similarDuplicates ?? 0,
    totalSamples: rep.totalSamples ?? 0,
    uniqueCanonical: groups.length,
  };
}

// ---------- 数据预览 ----------
//
// 同步 v2 响应给的是 { columns, rows, truncated }；异步作业快照只给行数组，
// 列按首次出现顺序推导（与后端 AnalyzePreviewView.From 同口径）。

const PREVIEW_LIMIT = 20; // 与后端 AnalyzePreviewView.DefaultLimit 对齐

function adaptPreview(p) {
  if (!p) return { columns: [], rows: [], truncated: false };
  if (Array.isArray(p)) {
    const columns = [];
    const seen = new Set();
    for (const row of p) {
      for (const k of Object.keys(row || {})) {
        if (!seen.has(k)) { seen.add(k); columns.push(k); }
      }
    }
    return { columns, rows: p, truncated: p.length >= PREVIEW_LIMIT };
  }
  return { columns: p.columns ?? [], rows: p.rows ?? [], truncated: !!p.truncated };
}

// ---------- 响应归一 ----------

/**
 * 三种输入形态归一：
 *  - v2 同步视图响应  { overview, preview, fields, deepAnalysis, quality, result, … }
 *  - 异步作业快照     { id, status, meta, result, preview, … }（result 是裸 AnalysisResult）
 *  - 裸 AnalysisResult（直接把 result 传进来 / 旧版 { result }）
 */
function normalizeView(payload) {
  if (!payload) throw new Error('后端返回数据为空');

  const base = { overview: null, preview: null, fields: null, deepAnalysis: null, quality: null };

  // 异步作业快照：有 status / id，result 是 AnalysisResult
  if (payload.status && payload.result) {
    return {
      ...base,
      fileName: payload.meta?.dataFileName ?? null,
      format: payload.meta?.format ?? null,
      rulesSource: null,
      preview: payload.preview ?? null,
      result: payload.result,
      jobId: payload.id ?? null,
    };
  }

  // v2 同步视图响应
  if (payload.overview || payload.preview || payload.fields) {
    return {
      fileName: payload.fileName ?? null,
      format: payload.format ?? null,
      rulesSource: payload.rulesSource ?? null,
      overview: payload.overview ?? null,
      preview: payload.preview ?? null,
      fields: payload.fields ?? null,
      deepAnalysis: payload.deepAnalysis ?? null,
      quality: payload.quality ?? null,
      result: payload.result ?? null,
      jobId: null,
    };
  }

  // 裸 AnalysisResult
  return {
    ...base,
    fileName: null,
    format: null,
    rulesSource: null,
    result: payload.result ?? payload,
    jobId: null,
  };
}

// ---------- 结果级 ----------

/**
 * 适配整个分析结果。
 * @param {object} payload /api/analyze 的 v2 视图响应、异步作业快照，或裸 AnalysisResult
 * @returns 前端内部 result 结构（含 overview / preview / quality / deep / _api 元信息）
 */
export function adaptAnalysisResponse(payload) {
  const v = normalizeView(payload);
  const r = v.result ?? {};

  const totalObjects = v.overview?.totalObjects ?? r.totalObjects ?? 0;
  const rawFields = v.fields ?? r.fieldStatistics ?? [];
  const fieldStatistics = rawFields.map((f) => adaptField(f, totalObjects));

  // 深度分析：分节视图优先，异步路径回落到 result（两者字段同名同构）
  const deepSource = v.deepAnalysis ?? r;
  const deep = {
    correlations: adaptCorrelations(deepSource.correlationMatrix),
    patterns: adaptStringPatterns(deepSource.stringPatterns),
    hygiene: adaptHygiene(deepSource.unicodeHygiene),
    fuzzy: adaptFuzzy(deepSource.fuzzyDuplicates),
  };
  const hasDeep = Object.values(deep).some((x) => x !== null);

  const violations = v.quality?.violations ?? r.qualityViolations ?? [];
  // 按检查类型计数：v2 直接给 countsByCheck，异步路径本地算（口径与后端 GroupBy 一致）
  const countsByCheck = v.quality?.countsByCheck
    ?? violations.reduce((acc, x) => {
      acc[x.check] = (acc[x.check] ?? 0) + 1;
      return acc;
    }, {});

  return {
    totalObjects,
    totalUniqueObjects: v.overview?.totalUniqueObjects ?? r.totalUniqueObjects ?? 0,
    totalDuplicateGroups: v.overview?.totalDuplicateGroups ?? r.totalDuplicateGroups ?? 0,
    duplicateObjects: r.duplicateObjects || [],
    fieldStatistics,

    // ── v2 概览页 ──
    overview: {
      totalObjects,
      totalUniqueObjects: v.overview?.totalUniqueObjects ?? r.totalUniqueObjects ?? 0,
      totalDuplicateGroups: v.overview?.totalDuplicateGroups ?? r.totalDuplicateGroups ?? 0,
      fieldCount: v.overview?.fieldCount ?? fieldStatistics.length,
      violationCount: v.overview?.violationCount ?? violations.length,
      filterExpression: v.overview?.filterExpression ?? r.filterExpression ?? null,
    },

    // ── v2 数据预览页 ──
    preview: adaptPreview(v.preview),

    // FieldViolation { field, check, count, message, approximate, samples } 与前端一致，直接透传
    qualityViolations: violations,

    // ── v2 质量报告页 ──
    quality: {
      violations,
      countsByCheck,
      hasViolations: v.quality?.hasViolations ?? violations.length > 0,
    },

    // 后端专有、前端本地引擎没有的信息
    apiExtras: {
      filterExpression: v.overview?.filterExpression ?? r.filterExpression ?? null,
      schemaDiff: v.deepAnalysis?.schemaDiff ?? r.schemaDiff ?? null,
      timeSeriesAnalyses: v.deepAnalysis?.timeSeriesAnalyses ?? r.timeSeriesAnalyses ?? null,
      distributionDiff: v.deepAnalysis?.distributionDiff ?? r.distributionDiff ?? null,
      samplingConfidence: v.deepAnalysis?.samplingConfidence ?? r.samplingConfidence ?? null,
    },

    deep: hasDeep ? deep : null,

    _api: {
      fileName: v.fileName ?? null,
      format: v.format ?? null,
      rulesSource: v.rulesSource ?? null,
      jobId: v.jobId ?? null,
    },
  };
}
