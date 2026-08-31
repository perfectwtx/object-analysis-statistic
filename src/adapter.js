// 把 ObjectAnalyzer.Api 的 camelCase 响应适配为前端组件已有的内部数据结构。
//
// 后端字段（C#）→ 前端字段（JS）对照：
//   defaultValueRepresentation → defaultValue
//   minNumber/maxNumber/avgNumber/sumNumber/stdDevNumber → min/max/avg/sum/stdDev
//   medianNumber/p90Number/p95Number/p99Number          → median/p90/p95/p99
//   correlationMatrix（矩阵）                            → correlations.pairs（列表）
//   unicodeHygiene.*.*Count                              → hygiene.*（简写计数）
//   fuzzyDuplicates.groups[].examples.length             → groups[].variants

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

function adaptField(f) {
  const valueCounts = f.valueCounts || {};
  return {
    fieldName: f.fieldName,
    count: f.count ?? 0,
    coverage: f.coverage ?? 0,
    typeCounts: f.typeCounts || {},
    valueCounts,
    valueCountsTruncated: !!f.valueCountsTruncated,
    // 本地引擎用 valueCountsFull 算模式/卫生；API 的 valueCounts 可能已被裁剪
    valueCountsFull: valueCounts,

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

// ---------- 结果级 ----------

/**
 * 适配整个分析结果。
 * @param {object} payload /api/analyze 或 /api/analyze/raw 的响应
 * @returns 前端内部 result 结构（含 _api 元信息与 deep 深度分析）
 */
export function adaptAnalysisResponse(payload) {
  const r = payload?.result ?? payload; // 兼容直接传 result 的情况
  if (!r) throw new Error('后端返回数据为空');

  const fieldStatistics = (r.fieldStatistics || []).map(adaptField);

  const deep = {
    correlations: adaptCorrelations(r.correlationMatrix),
    patterns: adaptStringPatterns(r.stringPatterns),
    hygiene: adaptHygiene(r.unicodeHygiene),
    fuzzy: adaptFuzzy(r.fuzzyDuplicates),
  };
  const hasDeep = Object.values(deep).some((v) => v !== null);

  return {
    totalObjects: r.totalObjects ?? 0,
    totalUniqueObjects: r.totalUniqueObjects ?? 0,
    totalDuplicateGroups: r.totalDuplicateGroups ?? 0,
    duplicateObjects: r.duplicateObjects || [],
    fieldStatistics,
    // FieldViolation { field, check, count, message, approximate, samples } 与前端一致，直接透传
    qualityViolations: r.qualityViolations || [],

    // 后端专有、前端本地引擎没有的信息
    apiExtras: {
      filterExpression: r.filterExpression ?? null,
      schemaDiff: r.schemaDiff ?? null,
      timeSeriesAnalyses: r.timeSeriesAnalyses ?? null,
      distributionDiff: r.distributionDiff ?? null,
      samplingConfidence: r.samplingConfidence ?? null,
    },

    deep: hasDeep ? deep : null,

    _api: {
      fileName: payload.fileName ?? null,
      format: payload.format ?? null,
      rulesSource: payload.rulesSource ?? null,
    },
  };
}
