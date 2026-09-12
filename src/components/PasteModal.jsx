import { useEffect, useMemo, useRef, useState } from 'react';
import { parseJsonc } from '../utils.js';

/** 「粘贴数据」可指定的文本格式；上传文件由后端按扩展名自动识别 */
export const TEXT_FORMATS = ['json', 'jsonl', 'csv', 'yaml', 'xml'];

/** 支持原地「格式化」的格式（CSV / YAML / XML 前端没有对应解析器，按钮置灰） */
const FORMATTABLE = new Set(['json', 'jsonl']);

const FORMAT_HINTS = {
  json: 'JSON 对象或数组，兼容 // 注释与尾随逗号',
  jsonl: '每行一个独立的 JSON 对象',
  csv: '逗号分隔，首行为表头',
  yaml: 'YAML 文档',
  xml: 'XML 文档',
};

/**
 * 粘贴数据弹窗：文本贴进输入框，格式在这里选（代替原侧栏的「文本格式」下拉框），
 * 确认后按所选格式包装成 pasted.<format> 提交——后端按扩展名选解析器。
 *
 * 组件常驻不卸载（open 只控制显隐），草稿文本在关闭后保留，误关/分析失败后重开不丢内容。
 *
 * @param {boolean} open
 * @param {string} format 当前文本格式（状态在 App，记住上次选择）
 * @param {(f: string) => void} onFormatChange
 * @param {boolean} busy 分析进行中
 * @param {(text: string) => void} onSubmit 确定回调（App 包装成 File 并触发分析）
 * @param {() => void} onClose
 */
export default function PasteModal({ open, format, onFormatChange, busy, onSubmit, onClose }) {
  const [text, setText] = useState('');
  const [fmtError, setFmtError] = useState('');
  const areaRef = useRef(null);

  // 打开时聚焦输入框（等 backdrop 渲染完）
  useEffect(() => {
    if (open) {
      setFmtError('');
      const t = requestAnimationFrame(() => areaRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
  }, [open]);

  // 「确定」经 ref 供快捷键调用，避免监听器随 text 频繁重挂
  const submitRef = useRef(() => {});
  submitRef.current = () => {
    if (text.trim() && !busy) onSubmit(text);
  };

  // Esc 关闭；Ctrl/Cmd+Enter 提交
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const stats = useMemo(() => {
    if (!text) return null;
    return { lines: text.split(/\r?\n/).length, chars: text.length };
  }, [text]);

  if (!open) return null;

  const formattable = FORMATTABLE.has(format);
  const canSubmit = !!text.trim() && !busy;

  const doFormat = () => {
    setFmtError('');
    if (!text.trim()) return;
    try {
      if (format === 'jsonl') {
        // JSONL 逐行校验并压缩成紧凑 JSON；带行号报错，方便定位坏行
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) return;
        setText(lines.map((line, i) => {
          try {
            return JSON.stringify(JSON.parse(line));
          } catch (e) {
            throw new Error(`第 ${i + 1} 行不是合法 JSON（${e.message}）`);
          }
        }).join('\n'));
      } else {
        // JSON：parseJsonc 兼容注释与尾随逗号——格式化的同时把它们清掉（后端不认 JSONC）
        setText(JSON.stringify(parseJsonc(text), null, 2));
      }
    } catch (e) {
      setFmtError(`无法格式化：${e.message}`);
    }
  };

  return (
    <div
      className="preflight-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="粘贴数据"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="paste-modal">
        <div className="paste-head">
          <div>
            <h3 className="paste-title">粘贴数据</h3>
            <p className="paste-subtitle">选择文本格式后提交，后端按该格式解析（上传文件则按扩展名自动识别）</p>
          </div>
          <button
            type="button"
            className="paste-close"
            onClick={onClose}
            disabled={busy}
            aria-label="关闭"
            title="关闭（Esc）"
          >
            ×
          </button>
        </div>

        <div className="paste-toolbar">
          <label htmlFor="paste-format">文本格式</label>
          <select
            id="paste-format"
            className="format-select"
            value={format}
            onChange={(e) => { onFormatChange(e.target.value); setFmtError(''); }}
            title={FORMAT_HINTS[format]}
          >
            {TEXT_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button
            type="button"
            className="btn paste-fmt-btn"
            onClick={doFormat}
            disabled={!formattable || !text.trim()}
            title={formattable
              ? '格式化文本：JSON 美化缩进（兼容注释/尾随逗号）；JSONL 逐行校验并压缩'
              : '该格式暂不支持格式化'}
          >
            格式化
          </button>
          <span className="paste-stats">
            {stats ? `${stats.lines} 行 · ${stats.chars} 字符` : ''}
          </span>
        </div>

        <textarea
          ref={areaRef}
          className="paste-area mono"
          value={text}
          onChange={(e) => { setText(e.target.value); setFmtError(''); }}
          placeholder={`在此粘贴${format.toUpperCase()}内容…`}
          spellCheck={false}
        />

        {fmtError && <div className="paste-error" role="alert">⚠ {fmtError}</div>}

        <div className="paste-footer">
          <span className="paste-kbd-hint">
            <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 提交 · <kbd>Esc</kbd> 关闭
          </span>
          <div className="paste-actions">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>取消</button>
            <button type="button" className="btn primary" onClick={() => submitRef.current()} disabled={!canSubmit}>
              {busy ? '分析中…' : '开始分析'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
