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
//         "transform": { "type": "json", "parse": "json" },
//         "pii": { "label": "...", "mask": { "maskAll": true } },
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

export const TRANSFORM_TYPES = ['json', 'jwt', 'base64', 'url', 'aes', 'sm4', 'sm2'];
export const PARSE_TYPES = ['json'];
export const REDACT_OPTIONS = [
  { value: '', label: '自动（命中启发式才打码）' },
  { value: 'true', label: '强制打码' },
  { value: 'false', label: '不打码（白名单）' },
];
export const PII_MASK_OPTIONS = [
  { value: 'maskAll', label: '全量打码' },
  { value: 'keep', label: '保留前后各 2 位' },
];
// 这些转换类型需要密钥类参数
export const CRYPTO_TRANSFORM_TYPES = ['aes', 'sm4', 'sm2'];

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
    piiMask: pii.mask?.maskAll ? 'maskAll' : (pii.mask?.keepPrefix != null ? 'keep' : ''),
    transformType: t.type ?? 'none',
    transformParse: t.parse ?? 'none',
    transformClaim: t.claim ?? '',
    transformKey: t.key ?? '',
    transformIv: t.iv ?? '',
    transformMode: t.mode ?? '',
    transformPadding: t.padding ?? '',
    transformFormat: t.format ?? '',
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
  if (d.piiLabel || d.piiMask) {
    const piiOut = {};
    if (d.piiLabel) piiOut.label = d.piiLabel;
    if (d.piiMask === 'maskAll') piiOut.mask = { maskAll: true };
    else if (d.piiMask === 'keep') piiOut.mask = { keepPrefix: 2, keepSuffix: 2 };
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
// 表单能管理的字段键。合并时对"被编辑过的字段"先清掉这些键再写入新值，
// 既能正确反映用户的清空/修改，又能保留后端返回、但表单不认识的其它键（避免原配置被静默抹掉）。
const MANAGED_KEYS = [
  'primaryType', 'defaultValue', 'required', 'unique', 'pattern', 'enumValues',
  'minValue', 'maxValue', 'nullRateMax', 'maxOutlierRatio', 'redact', 'pii', 'transform',
];

export function mergeDraftsIntoRulesText(rulesText, entries, vpOverride) {
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
