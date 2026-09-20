/** Analyze API form fields (beyond rulesJson / features). */
export const ANALYZE_OPTION_DEFS = [
  {
    key: 'allowUnknownRules',
    label: '允许未知规则键',
    type: 'bool',
    hint: '后端遇到未识别的字段规则名时不报错（调试用）',
  },
  {
    key: 'maxValues',
    label: '取值采样上限',
    type: 'number',
    hint: '每个字段保留的取值样本数（默认由后端决定）',
    min: 1,
    placeholder: '例如 50',
  },
  {
    key: 'fields',
    label: '仅分析字段',
    type: 'string',
    hint: '逗号分隔字段名；留空表示全部',
    placeholder: 'id,name,email',
  },
  {
    key: 'filter',
    label: '行过滤表达式',
    type: 'string',
    hint: '后端支持的过滤表达式（若有）',
    placeholder: '可选',
  },
  {
    key: 'rootPath',
    label: '根路径 rootPath',
    type: 'string',
    hint: '从 JSON 的某个路径开始解析',
    placeholder: 'data',
  },
  {
    key: 'recordPath',
    label: '记录路径 recordPath',
    type: 'string',
    hint: '数组记录所在路径（如 items / data.rows）',
    placeholder: 'items',
  },
  {
    key: 'sampleReservoir',
    label: '蓄水池采样大小',
    type: 'number',
    hint: '大文件均匀采样上限',
    min: 1,
    placeholder: '例如 10000',
  },
  {
    key: 'sampleStep',
    label: '采样步长',
    type: 'number',
    hint: '每隔 N 条取 1 条',
    min: 1,
    placeholder: '例如 10',
  },
  {
    key: 'maxParallel',
    label: '最大并行度',
    type: 'number',
    hint: '后端并行分析上限',
    min: 1,
    placeholder: '例如 4',
  },
];

export const DEFAULT_ANALYZE_OPTIONS = {
  allowUnknownRules: false,
  maxValues: '',
  fields: '',
  filter: '',
  rootPath: '',
  recordPath: '',
  sampleReservoir: '',
  sampleStep: '',
  maxParallel: '',
};

const STORAGE_KEY = 'oaAnalyzeOptions';

export function loadAnalyzeOptions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ANALYZE_OPTIONS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ANALYZE_OPTIONS, ...parsed };
  } catch {
    return { ...DEFAULT_ANALYZE_OPTIONS };
  }
}

export function saveAnalyzeOptions(opts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {
    /* ignore */
  }
}

/** Map UI state → options passed to analyzeFile / analyzeFileAsync */
export function toAnalyzeRequestOptions(opts = {}) {
  const out = {};
  if (opts.allowUnknownRules) out.allowUnknownRules = true;
  for (const key of [
    'maxValues',
    'fields',
    'filter',
    'rootPath',
    'recordPath',
    'sampleReservoir',
    'sampleStep',
    'maxParallel',
  ]) {
    const v = opts[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      if (['maxValues', 'sampleReservoir', 'sampleStep', 'maxParallel'].includes(key)) {
        const n = Number(v);
        if (!Number.isNaN(n)) out[key] = n;
      } else {
        out[key] = String(v).trim();
      }
    }
  }
  return out;
}
