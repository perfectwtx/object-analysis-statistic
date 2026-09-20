import { useRef, useState } from 'react';
import { parseJsonc } from '../utils.js';

export const EMPTY_RULES = `{
  "runtime": { "flatten": true },
  "fields": {}
}`;

export const RULES_TEMPLATE = `{\n  // 全局运行配置放在 runtime 下（旧版的顶层 flatten 已迁入 runtime.flatten）\n  "runtime": {\n    "flatten": true\n  },\n\n  "fields": {\n    "gender": { "enumValues": ["Male", "Female", "Unknown"] },\n    "age": { "required": true, "minValue": 0, "maxValue": 120 },\n    "email": { "pattern": "\\\\S+@\\\\S+", "required": true },\n    "id": { "unique": true },\n\n    /* nullRateMax：字段缺失 + 显式 null 都会计入，超过 20% 就报违规 */\n    "address.district": { "nullRateMax": 0.2 },\n\n    // transform.parse：先把字符串按 json / jwt / base64 / url 解开再统计，可多级串联\n    "line": { "transform": { "parse": "json" } },\n    "line.body": { "transform": { "parse": "json" } }\n  },\n\n  // Excel/CSV：指定列单元格按 JSON 解析后再统计\n  // "valueParsers": [\n  //   { "source": "payload", "parseType": "auto", "flatten": true, "header": 1 }\n  // ],\n\n  "expectations": { "minRowCount": 3, "maxDuplicateRate": 0 }\n}`;

function UnknownList({ items, limit = 6 }) {
  return (
    <>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px]">
        {items.slice(0, limit).map((u, i) => (
          <li key={`${u.path}.${u.name}.${i}`}>
            <code className="text-foreground">{u.path === '$' ? '顶层' : u.path}</code>
            {' 的 '}
            <code className="text-foreground">{u.name}</code>
            {u.suggestion ? (
              <>
                {' → 是否想写 '}
                <code className="text-foreground">{u.suggestion}</code>？
              </>
            ) : null}
          </li>
        ))}
      </ul>
      {items.length > limit ? (
        <div className="mt-1 text-[11px] opacity-80">还有 {items.length - limit} 项未列出</div>
      ) : null}
    </>
  );
}

function RulesCheckBar({ check }) {
  if (!check) return null;
  const base = 'mt-2 rounded-lg px-2.5 py-1.5 text-xs';
  switch (check.state) {
    case 'checking':
      return <div className={`${base} bg-muted text-muted-foreground`}>校验中…</div>;
    case 'ok':
      return (
        <div className={`${base} bg-ok/15 text-ok`}>
          ✓ 后端校验通过{check.fields != null ? ` · ${check.fields} 个字段规则` : ''}
        </div>
      );
    case 'offline':
      return (
        <div className={`${base} bg-warn/15 text-warn`} title="后端不可用时无法校验字段类型与结构">
          ⚠ 后端未连接，仅完成本地语法检查
        </div>
      );
    case 'error':
      return (
        <div className={`${base} bg-danger/10 text-danger`}>
          <div>✗ {check.message}</div>
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
  const checking = check?.state === 'checking';

  const onImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      try {
        parseJsonc(raw);
        setText(raw.trim());
        setImportError('');
        onValidate?.(raw.trim());
      } catch (err) {
        setImportError(`导入失败：${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          onClick={() => onValidate?.()}
          disabled={busy || checking}
        >
          校验
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setText(RULES_TEMPLATE)}
        >
          模板
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => fileInput.current?.click()}
        >
          导入
        </button>
        <input ref={fileInput} type="file" accept=".json,.jsonc,.txt" className="hidden" onChange={onImport} />
        {onFetchReference ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onFetchReference}
          >
            参考
          </button>
        ) : null}
      </div>

      <textarea
        className="min-h-[160px] w-full resize-y rounded-lg border border-border bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:border-primary/40"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        disabled={busy}
      />

      <RulesCheckBar check={check} />

      {error ? <div className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs text-danger">{error}</div> : null}
      {importError ? (
        <div className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs text-danger">{importError}</div>
      ) : null}

      <button
        type="button"
        className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        onClick={onApply}
        disabled={busy}
      >
        {busy ? '分析中…' : '应用规则'}
      </button>
      <button
        type="button"
        className="inline-flex h-9 w-full items-center justify-center rounded-lg text-sm text-danger hover:bg-danger/10 disabled:opacity-40"
        onClick={() => {
          if (!window.confirm('确定清空所有规则（fields / valueParsers / expectations）？')) return;
          setText(EMPTY_RULES);
          onClear?.();
        }}
        disabled={busy}
      >
        清空所有规则
      </button>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">支持的规则字段</summary>
        <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed">
          <li><code className="text-foreground/80">runtime.flatten</code> 扁平化嵌套</li>
          <li><code className="text-foreground/80">transform.parse</code> json / jwt / base64 / url</li>
          <li><code className="text-foreground/80">enumValues</code> / <code className="text-foreground/80">required</code> / <code className="text-foreground/80">unique</code></li>
          <li><code className="text-foreground/80">minValue / maxValue</code> / <code className="text-foreground/80">pattern</code></li>
          <li><code className="text-foreground/80">nullRateMax</code> / <code className="text-foreground/80">expectations</code></li>
          <li><code className="text-foreground/80">valueParsers</code> Excel/CSV 列内 JSON 解析</li>
          <li><code className="text-foreground/80">pii</code> / <code className="text-foreground/80">redact</code> / <code className="text-foreground/80">transform</code>（加解密）</li>
        </ul>
      </details>
    </div>
  );
}
