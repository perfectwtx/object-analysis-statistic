import { useEffect, useState } from 'react';
import { Modal } from './ui/modal.jsx';
import { cn } from '../lib/cn.js';

export const PASTE_FORMATS = [
  { key: 'json', label: 'JSON', hint: '对象或数组' },
  { key: 'jsonl', label: 'JSONL', hint: '每行一个 JSON' },
  { key: 'csv', label: 'CSV', hint: '逗号分隔表格' },
  { key: 'yaml', label: 'YAML', hint: 'YAML / YML' },
  { key: 'xml', label: 'XML', hint: 'XML 文档' },
];

/**
 * Modal for pasting text data with format selection.
 * onSubmit(text, format) — parent creates File and runs analysis.
 */
export default function PasteDataModal({
  open,
  onClose,
  onSubmit,
  busy,
  defaultFormat = 'json',
}) {
  const [format, setFormat] = useState(defaultFormat);
  const [text, setText] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFormat(defaultFormat || 'json');
    setText('');
    setLocalError('');
  }, [open, defaultFormat]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setLocalError('请粘贴数据内容');
      return;
    }
    setLocalError('');
    onSubmit?.(trimmed, format);
    onClose?.();
  };

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-muted-foreground">
        {text.length ? `${text.length.toLocaleString()} 字符` : '支持从剪贴板粘贴大段文本'}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted"
          onClick={onClose}
          disabled={busy}
        >
          取消
        </button>
        <button
          type="button"
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          disabled={busy || !text.trim()}
          onClick={submit}
        >
          开始分析
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="粘贴数据"
      description="选择格式后粘贴内容，将作为数据源进行分析。"
      size="xl"
      footer={footer}
    >
      <div className="space-y-4">
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">数据格式</div>
          <div className="flex flex-wrap gap-1.5">
            {PASTE_FORMATS.map((f) => (
              <button
                key={f.key}
                type="button"
                disabled={busy}
                title={f.hint}
                onClick={() => setFormat(f.key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  format === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {PASTE_FORMATS.find((f) => f.key === format)?.hint}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">内容</span>
            <button
              type="button"
              className="text-[11px] text-primary hover:underline disabled:opacity-40"
              disabled={busy}
              onClick={async () => {
                try {
                  const clip = await navigator.clipboard.readText();
                  if (clip) {
                    setText(clip);
                    setLocalError('');
                  } else {
                    setLocalError('剪贴板为空');
                  }
                } catch {
                  setLocalError('无法读取剪贴板，请手动粘贴到下方');
                }
              }}
            >
              从剪贴板填入
            </button>
          </div>
          <textarea
            className="min-h-[220px] w-full resize-y rounded-xl border border-border bg-muted/40 p-3 font-mono text-[12px] leading-relaxed text-foreground outline-none focus:border-primary/40"
            placeholder={
              format === 'csv'
                ? 'name,age\nAlice,30\n...'
                : format === 'jsonl'
                  ? '{"id":1}\n{"id":2}\n...'
                  : '在此粘贴数据…'
            }
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (localError) setLocalError('');
            }}
            spellCheck={false}
            disabled={busy}
            autoFocus
          />
          {localError ? (
            <div className="mt-2 text-xs text-danger">{localError}</div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
