// 字段级规则可视化配置的核心逻辑。
//
// 后端规则契约（对齐 ObjectAnalyzer.Core 的 AnalysisRules / FieldRule / FieldTransform / PiiRule）：
//   {
//     "runtime": { "flatten": true, "selectedFields": [...], "filter": "..." },
//     "fields": {
//       "<字段名>": {
//         "primaryType": "String",
//         "defaultValue": "...",
//         "enumValues": ["a", "b"],
//         "transform": { "type": "jwt", "parse": "json" },
//         "pii": { "label": "...", "highSeverity": true, "mask": { "maskAll": true } },
//         "redact": true,
//         "minValue": 0, "maxValue": 120,
//         "required": true, "pattern": "\\S+@\\S+", "unique": true,
//         "nullRateMax": 0.2, "maxOutlierRatio": 0.05
//       }
//     },
//     "valueParsers": [...],
//     "expectations": { "minRowCount": 3 }
//   }
//
// 设计要点：
// - 只把"用户改过的字段"写回，未触碰的字段规则保持原样，避免覆盖后端默认语义。
// - 合并后重新序列化为干净 JSON（会丢失手写注释）——与现有"应用规则/导入文件"行为一致，属已知取舍。

import { parseJsonc } from './utils.js';

// transform.type 合法值（FieldTransformProcessor 仅认这 6 种，传 json 会被后端判不支持；
// "json" 是 transform.parse 的取值，两者不是一回事）
export const TRANSFORM_TYPES = ['jwt', 'base64', 'url', 'aes', 'sm4', 'sm2'];
export const PARSE_TYPES = ['json'];
// 需要对称密钥的转换类型（key / iv / mode cbc|ecb / padding）；sm2 用单独的公私钥字段
export const SYM_CRYPTO_TRANSFORM_TYPES = ['aes', 'sm4'];
export const CRYPTO_TRANSFORM_TYPES = ['aes', 'sm4', 'sm2'];
export const REDACT_OPTIONS = [
  { value: '', label: '自动（命中启发式才打码）' },
  { value: 'true', label: '强制打码' },
  { value: 'false', label: '不打码（白名单）' },
];
// pii.mask 模式：后端 PiiMaskConfig 支持 maskAll / keepPrefix+keepSuffix / maskChar
export const PII_MASK_OPTIONS = [
  { value: '', label: '未配置（用后端默认格式）' },
  { value: 'maskAll', label: '全量打码（maskAll）' },
  { value: 'custom', label: '自定义保留前后缀' },
];

/** 把规则文本解析为对象；非法 JSONC 时抛错（调用方负责捕获并提示）。 */
export function parseRulesText(text) {
  if (!text || !text.trim()) return { fields: {} };
  const obj = parseJsonc(text);
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('规则顶层必须是对象');
  }
  return obj;
}

/** 从规则对象取出字段规则映射（确保 fields 存在）。 */
export function getFieldsMap(rulesObj) {
  const f = rulesObj && rulesObj.fields;
  return f && typeof f === 'object' && !Array.isArray(f) ? f : {};
}

/**
 * 合并「数据字段」与「规则文本里已配置的字段」，得到弹窗左侧要展示的完整列表。
 *
 * 为什么需要：弹窗原先只列数据字段（预检样本 / 分析结果），
 * 规则框里手写的字段规则如果字段名不在数据里（用错规则文件、字段拼错、还没分析），
 * 就完全不显示 —— 用户看到的是"规则里明明配了，弹窗里却没有"。
 * 这里把两边并起来：数据字段在前（保留原顺序、带 stat），规则里独有的追加在后并标记。
 *
 * @param {Array<{name: string, stat?: object}>} dataFields 数据侧字段
 * @param {Record<string, object>} fieldsMap 规则里的 fields 映射
 * @returns {Array<{name: string, stat?: object, fromRules?: boolean, inRules: boolean}>}
 */
export function mergeFieldList(dataFields, fieldsMap) {
  const map = (fieldsMap && typeof fieldsMap === 'object') ? fieldsMap : {};
  const has = (n) => Object.prototype.hasOwnProperty.call(map, n);
  const list = [];
  const seen = new Set();
  for (const f of dataFields || []) {
    if (!f || !f.name || seen.has(f.name)) continue;
    seen.add(f.name);
    list.push({ ...f, inRules: has(f.name) });
  }
  for (const name of Object.keys(map)) {
    if (seen.has(name)) continue;
    seen.add(name);
    list.push({ name, fromRules: true, inRules: true });
  }
  return list;
}

/** 单个后端 FieldRule → 可编辑草稿（空值归一成"未设置"，便于判断用户是否改动）。 */
export function ruleToDraft(rule) {
  rule = rule || {};
  const t = rule.transform || {};
  const pii = rule.pii || {};
  return {
    primaryType: rule.primaryType ?? '',
    defaultValue: rule.defaultValue ?? '',
    required: rule.required === true,
    unique: rule.unique === true,
    pattern: rule.pattern ?? '',
    enumText: Array.isArray(rule.enumValues) ? rule.enumValues.map(String).join('\n') : '',
    minValue: rule.minValue ?? '',
    maxValue: rule.maxValue ?? '',
    nullRateMax: rule.nullRateMax ?? '',
    maxOutlierRatio: rule.maxOutlierRatio ?? '',
    redact: rule.redact === true ? 'true' : rule.redact === false ? 'false' : '',
    piiLabel: pii.label ?? '',
    // highSeverity 后端默认 true；'' 表示未显式配置
    piiHigh: pii.highSeverity === true ? 'true' : pii.highSeverity === false ? 'false' : '',
    // mask：maskAll 优先；否则只要有 mask 对象就按自定义保留前后缀处理
    piiMask: pii.mask?.maskAll ? 'maskAll' : (pii.mask ? 'custom' : ''),
    piiKeepPrefix: pii.mask?.keepPrefix ?? '',
    piiKeepSuffix: pii.mask?.keepSuffix ?? '',
    piiMaskChar: pii.mask?.maskChar ?? '',
    transformType: t.type ?? 'none',
    transformParse: t.parse ?? 'none',
    transformClaim: t.claim ?? '',
    transformKey: t.key ?? '',
    transformIv: t.iv ?? '',
    transformMode: t.mode ?? '',
    transformPadding: t.padding ?? '',
    transformFormat: t.format ?? '',
    // sm2 专用（decrypt 用 privateKey；verify 用 publicKey + signature）
    transformPrivateKey: t.privateKey ?? '',
    transformPublicKey: t.publicKey ?? '',
    transformSignature: t.signature ?? '',
  };
}

/** 草稿 → 后端 FieldRule（只输出用户设置过的键）。 */
export function draftToRule(d) {
  const r = {};
  if (d.primaryType) r.primaryType = d.primaryType;
  if (d.defaultValue !== '' && d.defaultValue != null) r.defaultValue = d.defaultValue;
  if (d.required) r.required = true;
  if (d.unique) r.unique = true;
  if (d.pattern) r.pattern = d.pattern;
  const enumArr = (d.enumText || '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (enumArr.length) r.enumValues = enumArr;
  if (d.minValue !== '' && d.minValue != null) r.minValue = Number(d.minValue);
  if (d.maxValue !== '' && d.maxValue != null) r.maxValue = Number(d.maxValue);
  if (d.nullRateMax !== '' && d.nullRateMax != null) r.nullRateMax = Number(d.nullRateMax);
  if (d.maxOutlierRatio !== '' && d.maxOutlierRatio != null) r.maxOutlierRatio = Number(d.maxOutlierRatio);
  if (d.redact === 'true') r.redact = true;
  else if (d.redact === 'false') r.redact = false;
  if (d.piiLabel || d.piiHigh || d.piiMask) {
    const piiOut = {};
    if (d.piiLabel) piiOut.label = d.piiLabel;
    if (d.piiHigh === 'true') piiOut.highSeverity = true;
    else if (d.piiHigh === 'false') piiOut.highSeverity = false;
    if (d.piiMask === 'maskAll') piiOut.mask = { maskAll: true };
    else if (d.piiMask === 'custom') {
      const mask = {};
      if (d.piiKeepPrefix !== '' && d.piiKeepPrefix != null) mask.keepPrefix = Number(d.piiKeepPrefix);
      if (d.piiKeepSuffix !== '' && d.piiKeepSuffix != null) mask.keepSuffix = Number(d.piiKeepSuffix);
      if (d.piiMaskChar) mask.maskChar = d.piiMaskChar;
      if (Object.keys(mask).length) piiOut.mask = mask;
    }
    r.pii = piiOut;
  }
  const t = {};
  if (d.transformType && d.transformType !== 'none') t.type = d.transformType;
  if (d.transformParse && d.transformParse !== 'none') t.parse = d.transformParse;
  if (d.transformClaim) t.claim = d.transformClaim;
  if (d.transformKey) t.key = d.transformKey;
  if (d.transformIv) t.iv = d.transformIv;
  if (d.transformMode) t.mode = d.transformMode;
  if (d.transformPadding) t.padding = d.transformPadding;
  if (d.transformFormat) t.format = d.transformFormat;
  // sm2 专用键（key/iv/padding 对 sm2 无意义，不写出）
  if (d.transformPrivateKey) t.privateKey = d.transformPrivateKey;
  if (d.transformPublicKey) t.publicKey = d.transformPublicKey;
  if (d.transformSignature) t.signature = d.transformSignature;
  if (Object.keys(t).length) r.transform = t;
  return r;
}

/**
 * 后端 ValueParserConfig → 可编辑草稿。
 * parseType 默认 "auto"；flatten / header 用空串表示"沿用全局 / 默认"，避免凭空输出。
 */
export function valueParserToDraft(vp) {
  vp = vp || {};
  let flatten = '';
  if (vp.flatten === true) flatten = 'true';
  else if (vp.flatten === false) flatten = 'false';
  let header = '';
  if (vp.header === 1) header = 1;
  else if (vp.header === 0) header = 0;
  return {
    source: vp.source ?? '',
    parseType: vp.parseType ?? 'auto',
    flatten,
    header,
  };
}

/** 草稿 → 后端 ValueParserConfig（只输出用户设置过的键）。 */
export function draftToValueParser(d) {
  const vp = {};
  if (d.source) vp.source = d.source;
  if (d.parseType && d.parseType !== 'auto') vp.parseType = d.parseType;
  if (d.flatten === 'true') vp.flatten = true;
  else if (d.flatten === 'false') vp.flatten = false;
  if (d.header === 1) vp.header = 1;
  else if (d.header === 0) vp.header = 0;
  return vp;
}

/**
 * 把若干字段草稿合并回现有规则文本，返回新文本（JSON，2 空格缩进）。
 * @param {string} rulesText 现有规则文本（JSONC）
 * @param {Array<[string, {draft?: object, remove?: boolean}]>} entries 字段名 → 草稿或"删除"标记
 * @param {{valueParsers?: object[]}} [vpOverride] 可选：覆盖顶层 valueParsers（传空数组会删除该项）
 */
// ───────────────────────────────────────────────────────────────────────────
// 全局配置：后端顶层 runtime（12 个子组 ~30 个键）+ expectations（2 个键）
// FieldRulesModal 的左侧列表会提供一个「⚙️ 全局配置」入口，把原先只能手写进
// JSON 文本框的规则全部可视化出来。
//
// 每个 group 的 section 对应 runtime 下的子对象名（'top' 表示直接挂在 runtime 下）；
// 字段 type：tribool（未设置/true/false，三态）、number、text、csv（逗号分隔，序列化时转数组）。
// 标记 cliOnly 的 group 仅对命令行生效（Web 端分析不生成文件），在 UI 中折叠呈现。
export const RUNTIME_GROUPS = [
  {
    section: 'top', title: '解析行为',
    fields: [
      { k: 'flatten', label: '扁平化 flatten', type: 'tribool', help: '嵌套对象是否展平为点分隔字段；缺省 true' },
      { k: 'csvInferNumbers', label: 'CSV 数值推断 csvInferNumbers', type: 'tribool', help: 'CSV 列是否按内容推断为 Number；缺省 true' },
      { k: 'maxValuesToShow', label: '取值 Top N maxValuesToShow', type: 'number', help: '取值分布展示的最大取值数；缺省 5' },
      { k: 'maxTrackedValues', label: '唯一值跟踪上限 maxTrackedValues', type: 'number', help: '每字段实际跟踪的唯一值上限，超出归入 [Other values]；缺省 1000' },
      { k: 'maxParallelism', label: '最大并行度 maxParallelism', type: 'number', help: '并行解析线程数；缺省 -1（自动）' },
      { k: 'allowUnknownRules', label: '允许未知规则 allowUnknownRules', type: 'tribool', help: '忽略规则里的未知键而不报错；缺省 false' },
      { k: 'selectedFields', label: '仅分析字段 selectedFields', type: 'csv', help: '逗号分隔的字段名白名单' },
      { k: 'filter', label: '行级过滤表达式 filter', type: 'text', help: '如 Age > 18 && Status == "active"' },
    ],
  },
  {
    section: 'sampling', title: '采样 Sampling',
    fields: [
      { k: 'reservoir', label: '蓄水池大小 reservoir', type: 'number', help: '随机抽样保留条数；0 = 不抽样' },
      { k: 'step', label: '步进 step', type: 'number', help: '每隔 step 条取 1 条；0 = 全量' },
    ],
  },
  {
    section: 'jsonPath', title: 'JSONPath',
    fields: [
      { k: 'root', label: '根路径 root', type: 'text', help: '从指定 JSONPath 作为根容器' },
      { k: 'record', label: '记录路径 record', type: 'text', help: '从指定 JSONPath 逐条抽取记录' },
    ],
  },
  {
    section: 'gates', title: '门禁 Gates',
    fields: [
      { k: 'failOnViolations', label: '违规即失败 failOnViolations', type: 'tribool', help: '任一期望/质量违规即视为失败；缺省 false' },
      { k: 'failOnOutlierRatio', label: '异常值占比门禁 failOnOutlierRatio', type: 'number', help: '超过该比例（0~1）判失败' },
    ],
  },
  {
    section: 'pii', title: 'PII / 合规',
    fields: [
      { k: 'off', label: '关闭 PII 打码 pii.off', type: 'tribool', help: '完全关闭自动 PII 识别；缺省 false' },
      { k: 'report', label: 'PII 报告路径 pii.report', type: 'text', help: '合规报告输出位置' },
      { k: 'failOnLevel', label: 'PII 门禁等级 pii.failOnLevel', type: 'text', help: '合规等级 A / B / C，达到该等级即门禁失败；缺省不门禁' },
    ],
  },
  {
    section: 'deepAnalysis', title: '深度分析 Deep Analysis',
    fields: [
      { k: 'correlation', label: '相关性 correlation', type: 'tribool' },
      { k: 'stringPatterns', label: '字符串模式 stringPatterns', type: 'tribool' },
      { k: 'unicodeHygiene', label: 'Unicode 卫生 unicodeHygiene', type: 'tribool' },
      { k: 'timeSeries', label: '时间序列 timeSeries', type: 'tribool' },
      { k: 'distributionSnapshot', label: '分布快照 distributionSnapshot', type: 'tribool' },
      { k: 'fuzzyDedupField', label: '模糊去重字段 fuzzyDedupField', type: 'text', help: '在此字段上做模糊去重' },
    ],
  },
  {
    section: 'memory', title: '内存预算 Memory',
    fields: [
      { k: 'maxMB', label: '最大内存 MB maxMB', type: 'number', help: '0 = 不监控' },
      { k: 'mode', label: '模式 mode', type: 'text', help: 'soft（超限警告并自动降级采样）/ hard（超限立即失败）' },
    ],
  },
  {
    section: 'schema', title: 'Schema 演进（CLI）', cliOnly: true,
    fields: [
      { k: 'snapshot', label: 'snapshot', type: 'text' },
      { k: 'diffBaseline', label: 'diffBaseline', type: 'text' },
      { k: 'diffReport', label: 'diffReport', type: 'text' },
      { k: 'allowBreakingChanges', label: 'allowBreakingChanges', type: 'tribool', help: '缺省 true' },
    ],
  },
  {
    section: 'distribution', title: '分布漂移（CLI）', cliOnly: true,
    fields: [
      { k: 'snapshot', label: 'snapshot', type: 'text' },
      { k: 'diffBaseline', label: 'diffBaseline', type: 'text' },
      { k: 'diffReport', label: 'diffReport', type: 'text' },
      { k: 'lowConfidenceWidth', label: 'lowConfidenceWidth', type: 'number' },
    ],
  },
  {
    section: 'checkpoint', title: '检查点 / 基线（CLI）', cliOnly: true,
    fields: [
      { k: 'path', label: 'path', type: 'text' },
      { k: 'resumeFrom', label: 'resumeFrom', type: 'text' },
      { k: 'baseline', label: 'baseline', type: 'text' },
    ],
  },
  {
    section: 'audit', title: '审计（CLI）', cliOnly: true,
    fields: [
      { k: 'log', label: 'log', type: 'text' },
      { k: 'operator', label: 'operator', type: 'text' },
    ],
  },
  {
    section: 'outputs', title: '输出（CLI）', cliOnly: true,
    fields: [
      { k: 'primary', label: 'primary', type: 'text' },
      { k: 'violations', label: 'violations', type: 'text' },
      { k: 'quality', label: 'quality', type: 'text' },
      { k: 'schemaCode', label: 'schemaCode', type: 'text' },
    ],
  },
  {
    section: 'progress', title: '进度（CLI）', cliOnly: true,
    fields: [
      { k: 'enabled', label: 'enabled', type: 'tribool', help: '缺省 true' },
    ],
  },
];

// 数据集级期望（独立顶层键 expectations）
export const EXPECTATIONS_FIELDS = [
  { k: 'minRowCount', label: '最少行数 minRowCount', type: 'number' },
  { k: 'maxDuplicateRate', label: '最大重复率 maxDuplicateRate（0~1）', type: 'number' },
];

/** 从规则对象取出全局草稿：runtime 嵌套对象 + expectations 两个数值。 */
export function initGlobal(rulesObj) {
  const rtRaw = rulesObj.runtime && typeof rulesObj.runtime === 'object' ? rulesObj.runtime : {};
  const runtimeDraft = {};
  for (const [k, v] of Object.entries(rtRaw)) {
    runtimeDraft[k] = k === 'selectedFields'
      ? (Array.isArray(v) ? v.join(', ') : (v ?? ''))
      : v;
  }
  const e = rulesObj.expectations && typeof rulesObj.expectations === 'object' ? rulesObj.expectations : {};
  const expectationsDraft = {
    minRowCount: e.minRowCount ?? '',
    maxDuplicateRate: e.maxDuplicateRate ?? '',
  };
  return { runtimeDraft, expectationsDraft };
}

/** 递归清理：空串/空数组/空对象 → undefined（不写出）；保留 0 与 false。 */
function cleanRuntime(obj) {
  if (obj == null) return undefined;
  if (Array.isArray(obj)) return obj.length ? obj : undefined;
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const cv = cleanRuntime(v);
      if (cv !== undefined) out[k] = cv;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof obj === 'string') return obj.length ? obj : undefined;
  return obj; // number / boolean 原样保留（含 0 与 false）
}

/** 把全局草稿序列化为 { runtime?, expectations? }；空的子组不写出。 */
export function serializeGlobal(runtimeDraft, expectationsDraft) {
  const rt = {};
  for (const [k, v] of Object.entries(runtimeDraft || {})) {
    if (k === 'selectedFields') {
      if (typeof v === 'string' && v.trim()) {
        rt.selectedFields = v.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else {
      rt[k] = v;
    }
  }
  const runtime = cleanRuntime(rt);
  const exp = {};
  const e = expectationsDraft || {};
  if (e.minRowCount !== '' && e.minRowCount != null) exp.minRowCount = Number(e.minRowCount);
  if (e.maxDuplicateRate !== '' && e.maxDuplicateRate != null) exp.maxDuplicateRate = Number(e.maxDuplicateRate);
  const expectations = Object.keys(exp).length ? exp : undefined;
  return { runtime, expectations };
}

// 表单能管理的字段键。合并时对"被编辑过的字段"先清掉这些键再写入新值，
// 既能正确反映用户的清空/修改，又能保留后端返回、但表单不认识的其它键（避免原配置被静默抹掉）。
const MANAGED_KEYS = [
  'primaryType', 'defaultValue', 'required', 'unique', 'pattern', 'enumValues',
  'minValue', 'maxValue', 'nullRateMax', 'maxOutlierRatio', 'redact', 'pii', 'transform',
];

export function mergeDraftsIntoRulesText(rulesText, entries, vpOverride, globalOverride) {
  const rulesObj = parseRulesText(rulesText);
  const fields = getFieldsMap(rulesObj);
  for (const [name, entry] of entries) {
    if (entry.remove) {
      delete fields[name];
    } else {
      // 以"现有规则"为底，叠加表单生成的新值；被管理的键先整体清掉（含用户清空的项），
      // 其余键（如后端新增、表单暂不暴露的字段）原样保留——实现"保留原配置 + 在其上加配置"。
      const existing = (fields[name] && typeof fields[name] === 'object') ? { ...fields[name] } : {};
      const next = draftToRule(entry.draft);
      for (const k of MANAGED_KEYS) delete existing[k];
      fields[name] = { ...existing, ...next };
    }
  }
  rulesObj.fields = fields;
  if (vpOverride) {
    if (vpOverride.valueParsers && vpOverride.valueParsers.length) {
      rulesObj.valueParsers = vpOverride.valueParsers;
    } else {
      delete rulesObj.valueParsers;
    }
  }
  if (globalOverride) {
    if ('runtime' in globalOverride) {
      if (globalOverride.runtime) rulesObj.runtime = globalOverride.runtime;
      else delete rulesObj.runtime;
    }
    if ('expectations' in globalOverride) {
      if (globalOverride.expectations) rulesObj.expectations = globalOverride.expectations;
      else delete rulesObj.expectations;
    }
  }
  return JSON.stringify(rulesObj, null, 2);
}

/**
 * 分析后的字段元数据 → 建议默认值（仅作 placeholder 提示，不强制写入）。
 * 依赖 result.fieldStatistics 的字段：primaryType / minNumber / maxNumber / coverage / outlierRatio。
 */
export function suggestDefaults(stat) {
  if (!stat) return null;
  const s = {};
  if (stat.primaryType && stat.primaryType !== 'Unknown') s.primaryType = stat.primaryType;
  if (typeof stat.minNumber === 'number') s.minValue = stat.minNumber;
  if (typeof stat.maxNumber === 'number') s.maxValue = stat.maxNumber;
  if (typeof stat.coverage === 'number' && stat.coverage < 1) {
    s.nullRateMax = Math.max(0, +(1 - stat.coverage).toFixed(2));
  }
  if (typeof stat.outlierRatio === 'number') {
    s.maxOutlierRatio = Math.max(0, +stat.outlierRatio.toFixed(2));
  }
  return s;
}
