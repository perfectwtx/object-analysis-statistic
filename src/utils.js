// 渲染 / 导出环节使用的常量。
//
// 说明：本项目已移除浏览器端 JS 分析引擎（原 src/analysis.js）与多格式解析（原 src/parsers.js），
// 所有统计均由 ObjectAnalyzer.Api（.NET）计算，前端只负责提交数据与渲染结果。

// 质量检查项 → 中文标签（键与后端 FieldViolation.Check 一致）
export const CHECK_LABELS = {
  enum: '枚举违规',
  range: '范围违规',
  pattern: '格式违规',
  required: '必填缺失',
  unique: '唯一性违规',
  nullRate: 'Null 率超标',
  rowCount: '行数不足',
  duplicateRate: '重复率超标',
  outlierRatio: '异常值占比超标',
};

// ---------- 规则字段 vs 数据字段 预检（对齐后端 ObjectAnalyzer.Web 的 PreflightChecker） ----------
//
// 复刻后端「用错规则文件」防御的核心判定（方案 B 预检 + 方案 D 结果兜底共用同一套语义）。
// 判定规则与 PreflightChecker.Build 完全一致：
//   规则字段 X 命中数据字段 Y，当且仅当 Y == X（大小写不敏感）或 Y 以 "X." 开头
//   （X 是 Y 的父路径）。后者覆盖 parse:json 把 A.body 展平为 A.body.foo 的场景——
//   原始的 A.body 在结果里已被替换为子字段，靠父路径匹配仍能认出"规则确实覆盖到了数据"。
//
// 入参都是字段名数组（顺序无所谓）。hasWarning 触发条件：规则字段非空 且 数据字段非空
// 且 一个都没匹配上（与后端 `sampleFields.Count > 0 && matched.Count == 0` 同义）。
export function computeRuleFieldWarning(ruleFieldNames, dataFieldNames) {
  // 1) 规则字段：去重（大小写不敏感）、剔除空名、保留首次出现顺序
  const ruleFields = [];
  const ruleSeen = new Set();
  for (const f of ruleFieldNames || []) {
    if (!f || !String(f).trim()) continue;
    const key = String(f);
    const lower = key.toLowerCase();
    if (ruleSeen.has(lower)) continue;
    ruleSeen.add(lower);
    ruleFields.push(key);
  }
  if (ruleFields.length === 0) {
    return { hasWarning: false, ruleFields, matched: [], unmatched: [], dataFields: [] };
  }

  // 2) 数据字段：去重（大小写不敏感）、保留首次出现顺序，并记录小写集合
  const dataFields = [];
  const dataLowerSet = new Set();
  for (const f of dataFieldNames || []) {
    if (!f || !String(f).trim()) continue;
    const key = String(f);
    const lower = key.toLowerCase();
    if (dataLowerSet.has(lower)) continue;
    dataLowerSet.add(lower);
    dataFields.push(key);
  }

  // 3) 比对：大小写不敏感 + 父路径匹配
  const matched = [];
  const unmatched = [];
  for (const f of ruleFields) {
    const lower = f.toLowerCase();
    let isMatched = dataLowerSet.has(lower);
    if (!isMatched) {
      const prefix = lower + '.';
      for (const d of dataLowerSet) {
        if (d.startsWith(prefix)) { isMatched = true; break; }
      }
    }
    if (isMatched) matched.push(f); else unmatched.push(f);
  }

  // 4) 判定：有规则字段 + 数据字段都拿到 + 一个都没匹配上 → 警告
  const hasWarning = dataFields.length > 0 && matched.length === 0;
  return { hasWarning, ruleFields, matched, unmatched, dataFields };
}

// ---------- JSONC 解析（规则配置支持注释） ----------
//
// 规则编辑器允许写 `//`、`/* */` 注释和尾随逗号（后端的 rules_full_reference.jsonc
// 就是这种格式）。System.Text.Json 默认不接受注释，所以一律在前端先清洗再提交。

/** 去掉 // 与 /* *\/ 注释，跳过字符串字面量内部 */
export function stripJsonComments(text) {
  if (typeof text !== 'string') return text;
  let out = '';
  let inString = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (inString) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i += 2; continue; }
      if (ch === '"') inString = false;
      i += 1;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; i += 1; continue; }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** 跳过空白与注释，返回下一个有效字符的下标 */
function skipBlanks(text, from) {
  let j = from;
  while (j < text.length) {
    if (/\s/.test(text[j])) { j += 1; continue; }
    if (text[j] === '/' && text[j + 1] === '/') {
      while (j < text.length && text[j] !== '\n') j += 1;
      continue;
    }
    if (text[j] === '/' && text[j + 1] === '*') {
      j += 2;
      while (j < text.length && !(text[j] === '*' && text[j + 1] === '/')) j += 1;
      j += 2;
      continue;
    }
    break;
  }
  return j;
}

/** 去掉对象 / 数组最后一项后面多余的逗号 */
function stripTrailingCommas(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\') { out += text[i + 1] ?? ''; i += 1; }
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === ',') {
      // 必须跳过注释再判断：`},  // 说明` 里的逗号同样是尾随逗号，
      // toBackendRulesText 是在保留注释的前提下调用的，漏掉就会让后端 400。
      const j = skipBlanks(text, i + 1);
      if (text[j] === '}' || text[j] === ']') continue; // 尾随逗号，丢弃
    }
    out += ch;
  }
  return out;
}

/** 解析 JSONC；失败时抛的异常带行列信息，便于定位 */
export function parseJsonc(text) {
  const cleaned = stripTrailingCommas(stripJsonComments(text));
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const m = /position (\d+)/.exec(e.message);
    if (m) {
      const pos = Number(m[1]);
      const before = cleaned.slice(0, pos);
      const line = before.split('\n').length;
      const col = pos - before.lastIndexOf('\n');
      throw new Error(`${e.message.replace(/ in JSON.*| at position.*/, '')}（第 ${line} 行第 ${col} 列附近）`);
    }
    throw e;
  }
}

/** 把 JSONC 文本压成后端能吃的紧凑 JSON；解析失败时原样返回 */
export function toJsonText(text) {
  if (!text) return null;
  try {
    return JSON.stringify(parseJsonc(text));
  } catch {
    return text;
  }
}

/**
 * 送 /api/rules/validate 的文本：只去尾随逗号，保留注释与换行。
 *
 * 两点约束决定了不能直接用 toJsonText 的紧凑结果：
 * - 后端开了 ReadCommentHandling.Skip（吃注释）但没开 AllowTrailingCommas（拒尾随逗号）
 * - 后端错误里的 LineNumber 是按提交文本算的，压成一行后定位会全部塌到第 1 行，
 *   和编辑器里看到的行号对不上
 */
export function toBackendRulesText(text) {
  if (typeof text !== 'string') return text;
  return stripTrailingCommas(text);
}

// ---------- 规则配置框「格式化 JSON」 ----------
//
// 把带注释（// 与 /* */）和尾随逗号的 JSONC 重新排版为 2 空格缩进的整洁文本，
// 且**保留注释**（编辑器本身支持注释，格式化不应把注释抹掉）。
// 解析失败（括号不配对等）时返回 null，调用方据此决定是否覆盖原文。

/** 词法切分：结构符 / 字符串 / 字面量（数字·布尔·null）/ 注释，全部保留 */
function tokenizeJsonc(src) {
  const n = src.length;
  const tokens = [];
  let i = 0;
  while (i < n) {
    const ch = src[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (ch === '/' && src[i + 1] === '/') {
      let j = i + 2;
      while (j < n && src[j] !== '\n') j += 1;
      tokens.push({ t: 'cmt', kind: 'line', text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j += 1;
      const end = Math.min(j + 2, n);
      tokens.push({ t: 'cmt', kind: 'block', text: src.slice(i, end) });
      i = end;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '"') { j += 1; break; }
        j += 1;
      }
      tokens.push({ t: 'str', text: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('{}[],:'.includes(ch)) { tokens.push({ t: ch }); i += 1; continue; }
    let j = i;
    while (j < n && !'{}[],:\n\r\t "/'.includes(src[j])) j += 1;
    tokens.push({ t: 'lit', text: src.slice(i, j) });
    i = j;
  }
  return tokens;
}

const INDENT = '  ';

/** 从 tokens[p] 处读出一个值（可能是容器，返回多行字符串），p 随之前进 */
function emitValue(tokens, p, pad) {
  const tok = tokens[p.v];
  if (!tok) return { str: '', p };
  if (tok.t === '{' || tok.t === '[') return emitContainer(tokens, p, tok.t === '{', pad);
  if (tok.t === 'str' || tok.t === 'lit') { p.v += 1; return { str: tok.text, p }; }
  p.v += 1;
  return { str: '', p };
}

/** 读出一个 {…} / […] 容器；pad 为容器内部内容的缩进前缀 */
function emitContainer(tokens, p, isObj, pad) {
  p.v += 1; // 吃掉 {
  const close = isObj ? '}' : ']';
  const childPad = pad + INDENT;
  const lines = [];
  while (p.v < tokens.length && tokens[p.v].t !== close) {
    // 成员前的独立注释（行注释 / 块注释）单独成行
    while (tokens[p.v]?.t === 'cmt') {
      lines.push(childPad + tokens[p.v].text);
      p.v += 1;
    }
    if (p.v >= tokens.length || tokens[p.v].t === close) break;

    let body;
    if (isObj) {
      const keyR = emitValue(tokens, p, childPad);
      p = keyR.p;
      if (tokens[p.v]?.t === ':') p.v += 1;
      const valR = emitValue(tokens, p, childPad);
      p = valR.p;
      body = `${keyR.str}: ${valR.str}`;
    } else {
      const valR = emitValue(tokens, p, childPad);
      p = valR.p;
      body = valR.str;
    }
    // 成员值右侧紧跟的行注释，并到同一行末尾
    if (tokens[p.v]?.t === 'cmt' && tokens[p.v].kind === 'line') {
      body += ` ${tokens[p.v].text}`;
      p.v += 1;
    }
    // 后面若还有成员（跳过注释后是值而非右括号），则补逗号
    let needComma = false;
    if (tokens[p.v]?.t === ',') {
      let r = p.v + 1;
      while (tokens[r]?.t === 'cmt') r += 1;
      if (tokens[r] && tokens[r].t !== close) needComma = true;
      p.v += 1; // 吃掉逗号
    }
    if (needComma) body += ',';
    lines.push(childPad + body);

    // 没有逗号也没有右括号 → 结构异常，避免死循环
    if (!needComma && tokens[p.v]?.t !== close) break;
  }
  if (tokens[p.v]?.t === close) p.v += 1;

  const open = isObj ? '{' : '[';
  const closeStr = isObj ? '}' : ']';
  if (lines.length === 0) return { str: open + closeStr, p };
  return { str: `${open}\n${lines.join('\n')}\n${pad}${closeStr}`, p };
}

/** 把 JSONC 文本重新排版为 2 空格缩进；解析失败时返回 null */
export function formatJsonc(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const tokens = tokenizeJsonc(text);
  if (tokens.length === 0) return null;
  const p = { v: 0 };
  const root = emitContainerRoot(tokens, p);
  const trailing = [];
  while (p.v < tokens.length) {
    const tk = tokens[p.v];
    if (tk.t === 'cmt') trailing.push(tk.text);
    p.v += 1;
  }
  let result = root;
  if (trailing.length) result += `\n${trailing.join('\n')}`;
  return result;
}

function emitContainerRoot(tokens, p) {
  const tok = tokens[p.v];
  if (!tok) return '';
  if (tok.t === '{' || tok.t === '[') return emitContainer(tokens, p, tok.t === '{', '').str;
  if (tok.t === 'str' || tok.t === 'lit') { p.v += 1; return tok.text; }
  return '';
}

// ---------- 后端规则校验错误 → 中文提示 ----------
//
// 后端返回的是 System.Text.Json 的英文异常，形如：
//   The JSON value could not be converted to System.Nullable`1[System.Double].
//   Path: $.fields.age.minValue | LineNumber: 2 | BytePositionInLine: 30.
// 直接丢给用户看不懂，这里抽出 Path / LineNumber 并给出人话。

const TYPE_HINTS = [
  [/Nullable`1\[System\.Double\]|System\.Double/, '这里应该是数字'],
  [/Nullable`1\[System\.Int32\]|System\.Int32/, '这里应该是整数'],
  [/Nullable`1\[System\.Boolean\]|System\.Boolean/, '这里应该是 true / false'],
  // 必须排在 System.String 之前：Dictionary`2[System.String, ...] 的文本里也含 System.String
  [/Dictionary`2\[System\.String,ObjectAnalyzer\.Analysis\.FieldRule\]/, '这里应该是「字段名 → 规则」的对象'],
  [/System\.String/, '这里应该是字符串'],
  [/trailing comma/, '存在尾随逗号'],
  [/invalid start of a value/, '不是合法的 JSON 值'],
  [/does not contain any JSON tokens|input does not contain any JSON/, '内容为空'],
  [/could not be converted/, '类型不正确'],
];

/** @param {string} msg 后端返回的 error 字段 */
export function formatRulesError(msg) {
  if (!msg) return '规则不合法';
  const path = /Path:\s*(\$[^|\s]*)/.exec(msg)?.[1];
  const line = /LineNumber:\s*(\d+)/.exec(msg)?.[1];

  const where = [];
  // Path 为 $ 表示错误在顶层，路径和行号都没有定位价值，一并省略
  if (path && path !== '$') {
    where.push(path.replace(/^\$\.?/, ''));
    if (line !== undefined) where.push(`第 ${Number(line) + 1} 行`); // 后端 LineNumber 从 0 起
  }
  const suffix = where.length ? `（${where.join(' · ')}）` : '';

  for (const [re, hint] of TYPE_HINTS) {
    if (re.test(msg)) return `${hint}${suffix}`;
  }
  return `${msg.replace(/\s*Path:.*$/, '').replace(/\.$/, '')}${suffix}`;
}

// ---------- 图表 X 轴标签布局 ----------
//
// 字段名旋转后向下伸出高度 ≈ 字符宽 × 字符数 × sin(角度)。固定留白要么裁掉长名字，
// 要么浪费空间，所以按最长标签动态算留白，并同步增高图表，保证绘图区不被压扁。

export const CHART_ANGLE = -35;   // 小于 -40° 更省垂直空间
export const MAX_LABEL = 28;      // 超过则截断，完整名仍在 tooltip 里
const CHAR_W = 6.2;               // 11px 字号下每字符的近似宽度

export function shortenLabel(name, max = MAX_LABEL) {
  const s = String(name ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** @returns {{ bottom: number, height: number, angle: number }} */
export function labelLayout(names) {
  const maxLabel = Math.max(1, ...names.map((n) => shortenLabel(n).length));
  const rad = (Math.abs(CHART_ANGLE) * Math.PI) / 180;
  const bottom = Math.min(Math.round(26 + maxLabel * CHAR_W * Math.sin(rad)), 150);
  const height = 300 + Math.max(0, bottom - 64);
  return { bottom, height, angle: CHART_ANGLE };
}
