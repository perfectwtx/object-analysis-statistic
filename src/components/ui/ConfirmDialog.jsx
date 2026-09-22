import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button.jsx';
import { cn } from '../../lib/cn.js';
import { useT } from '../../lib/i18n.js';

/**
 * 应用内确认对话框，替代 window.confirm。
 * 文案默认走 i18n；也可由调用方覆盖 title / description / 按钮文字。
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  loading = false,
}) {
  const { t } = useT();
  const confirmRef = useRef(null);

  const resolvedTitle = title ?? t('confirmOk');
  const resolvedConfirm = confirmLabel ?? t('confirmDelete');
  const resolvedCancel = cancelLabel ?? t('confirmCancel');
  const processingLabel = t('processing');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => confirmRef.current?.focus?.(), 30);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, loading]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label={resolvedCancel}
        disabled={loading}
        onClick={() => !loading && onClose?.()}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="oa-confirm-title"
        aria-describedby="oa-confirm-desc"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--elev)]"
      >
        <div className="flex gap-4 px-5 pt-5 pb-2">
          <div
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-xl',
              isDanger ? 'bg-red-500/15 text-red-500' : 'bg-primary/15 text-primary',
            )}
          >
            <AlertTriangle className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="oa-confirm-title" className="text-base font-medium tracking-tight text-foreground">
              {resolvedTitle}
            </h2>
            {description ? (
              <p id="oa-confirm-desc" className="mt-1.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4">
          <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={onClose}>
            {resolvedCancel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            size="sm"
            disabled={loading}
            className={cn(
              isDanger &&
                'bg-red-600 text-white hover:bg-red-600/90 focus-visible:ring-red-600/40',
            )}
            onClick={onConfirm}
          >
            {loading ? processingLabel : resolvedConfirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
