import { useRef, useState } from 'react';
import { formatJsonc, parseJsonc } from '../utils.js';

export const RULES_TEMPLATE = `{
  // 全局运行配置放在 runtime 下（旧版的顶层 flatten 已迁入 runtime.flatten）
  "runtime": {
    "flatten": true
  },

  "fields": {
    "gender": { "enumValues": ["Male", "Female", "Unknown"] },
    "age": { "required": true, "minValue": 0, "maxValue": 120 },
    "email": { "pattern": "\\\\S+@\\\\S+", "required": true },
    "id": { "unique": true },

    /* nullRateMax：字段缺失 + 显式 null 都会计入，超过 20% 就报违规 */
    "address.district": { "nullRateMax": 0.2 },

    // transform：type 先做值转换（jwt / base64 / url / aes / sm4 / sm2），
    // parse 再把结果按 JSON 展开为嵌套字段统计，可多级串联
    "line": { "transform": { "parse": "json" } },
    "line.body": { "transform": { "parse": "json" } }
  },

  "expectations": { "minRowCount": 3, "maxDuplicateRate": 0 }
}`;

/** 不被后端识别的规则名清单，逐项给出建议写法。 */
function UnknownList({ items, limit = 6 }) {
  return (
    <>
      <ul className="unknown-list">
        {items.slice(0, limit).map((u, i) => (
          <li key={`${u.path}.${u.name}.${i}`}>
            <code>{u.path === '$' ? '顶层' : u.path}</code>
            {' 的 '}
            <code>{u.name}</code>
            {u.suggestion && (
              <>
                {' → 是否想写 '}
                <code>{u.suggestion}</code>
                ？
              </>
            )}
          </li>
        ))}
      </ul>
      {items.length > limit && (
        <div className="unknown-more">还有 {items.length - limit} 项未列出</div>
      )}
    </>
  );
}

/**
 * 校验状态条。后端校验是权威结果，本地只做语法兜底，两者要区分展示。
 * @param {{state: string, message?: string, fields?: number,
 *   unknowns?: Array<{path: string, name: string, suggestion?: string}>}} check
 */
function RulesCheckBar({ check }) {
  if (!check) return null;
  switch (check.state) {
    case 'checking':
      return <div className="rules-check checking">校验中…</div>;
    case 'ok':
      return (
        <div className="rules-check ok">
          ✓ 后端校验通过{check.fields != null && ` · ${check.fields} 个字段规则`}
        </div>
      );
    case 'offline':
      return (
        <div className="rules-check warn" title="后端不可用时无法校验字段类型与结构">
          ⚠ 后端未连接，仅完成本地语法检查
        </div>
      );
    case 'error':
      return (
        <div className="rules-check error">
          <div>✗ {check.message}</div>
          {/* 未知键会整份列出：这类错误必须逐条指明改法，否则用户无从下手 */}
          {check.unknowns?.length ? <UnknownList items={check.unknowns} /> : null}
        </div>
      );
    default:
      return null;
  }
}

export default function RulesEditor({
  text, setText, error, check, onValidate, onApply, onClear, onFetchReference, applied, busy,
}) {
  const fileInput = useRef(null);
  const [importError, setImportError] = useState('');
  const [fmtError, setFmtError] = useState('');
  const checking = check?.state === 'checking';

  // 把规则框里的 JSONC 重新排版为 2 空格缩进；保留注释；解析失败则提示不覆盖
  const onFormat = () => {
    setFmtError('');
    if (!text || !text.trim()) return;
    try {
      parseJsonc(text); // 先验证，避免把非法内容格式化后反而更乱
    } catch (e) {
      setFmtError(`无法格式化：${e.message}`);
      return;
    }
    const formatted = formatJsonc(text);
    if (!formatted) {
      setFmtError('格式化失败：内容为空或无法解析');
      return;
    }
    setText(formatted);
    onValidate?.(formatted); // 刷新校验状态条
  };

  const onImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      try {
        // 支持 .jsonc：带注释 / 尾随逗号也能导入；语法校验通过后保留原文（注释不丢）
        parseJsonc(raw);
        setText(raw.trim());
        setImportError('');
        // 导入完立刻走后端校验，类型和结构问题当场暴露
        onValidate?.(raw.trim());
      } catch (err) {
        setImportError(`导入失败：${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="rules-editor-wrap">
      <textarea
        className="rules-editor mono"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{ // 支持注释\n  "fields": { ... }\n}'
      />
      <div className="rules-note">
        <span>
          支持 <code>//</code> 与 <code>/* */</code> 注释、尾随逗号
        </span>
        <span className="rules-note-actions">
          <button
            className="btn link"
            onClick={onFormat}
            disabled={!text || !text.trim()}
            title="把规则框里的 JSONC 重新排版为 2 空格缩进（保留注释）"
          >
            格式化
          </button>
          <button
            className="btn link"
            onClick={() => onValidate?.()}
            disabled={checking}
            title="提交给后端 /api/rules/validate 校验字段类型与结构"
          >
            {checking ? '校验中…' : '校验'}
          </button>
        </span>
      </div>

      <RulesCheckBar check={check} />

      {error && <div className="error side-error">{error}</div>}
      {importError && <div className="error side-error">{importError}</div>}
      {fmtError && <div className="error side-error">{fmtError}</div>}
      <div className="side-actions">
        <button className="btn primary block" onClick={onApply} disabled={busy}>
          {busy ? '分析中…' : '应用规则'}
        </button>
        <div className="btn-row">
          <button className="btn half" onClick={() => fileInput.current?.click()}>
            导入文件
          </button>
          <input ref={fileInput} type="file" accept=".json,.jsonc,.txt" hidden onChange={onImport} />
          <button className="btn half" onClick={() => setText(RULES_TEMPLATE)}>填入模板</button>
        </div>
        {onFetchReference && (
          <button className="btn block" onClick={onFetchReference} title="从后端拉取 rules_full_reference.jsonc">
            拉取全量参考模板
          </button>
        )}
        {applied && (
          <button className="btn block" onClick={onClear} disabled={busy}>清除规则</button>
        )}
      </div>
      <details className="rules-help">
        <summary>支持的规则字段</summary>
        <ul>
          <li><code>runtime.flatten</code>：是否扁平化嵌套对象（旧版为顶层 flatten，现已迁入 runtime）</li>
          <li><code>transform.type</code> 值转换：jwt / base64 / url / aes / sm4 / sm2</li>
          <li><code>transform.parse</code> 转换结果按 JSON 展开统计（当前支持 json，支持多级）</li>
          <li><code>valueParsers</code> 字段级解析器：source / parseType / flatten / header</li>
          <li><code>enumValues</code> 枚举白名单</li>
          <li><code>minValue / maxValue</code> 数值范围</li>
          <li><code>required</code> 必填</li>
          <li><code>pattern</code> 正则匹配</li>
          <li><code>unique</code> 唯一性</li>
          <li><code>nullRateMax</code> Null 率上限</li>
          <li><code>maxOutlierRatio</code> 异常值占比上限</li>
          <li><code>defaultValue</code> 指定默认值</li>
          <li><code>primaryType</code> 期望主导类型</li>
          <li><code>pii / redact</code> 敏感字段打码</li>
          <li><code>runtime.selectedFields</code>：仅统计指定字段</li>
          <li><code>runtime.filter</code>：全局过滤表达式</li>
          <li><code>expectations</code> minRowCount / maxDuplicateRate</li>
        </ul>
        <div className="rules-help-note">
          点「校验」会把规则提交给后端 <code>/api/rules/validate</code> 做权威检查——
          字段类型、结构错误只有后端能查出（例如 <code>"minValue": "abc"</code>）；
          不认识的键（拼错或已废弃）同样判为校验失败并阻断分析，避免规则看似生效实则被忽略。
        </div>
        <div className="rules-help-note">
          完整字段说明见「拉取全量参考模板」（<code>rules_full_reference.jsonc</code>）
        </div>
      </details>
    </div>
  );
}
