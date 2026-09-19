import { useEffect } from 'react';
import { cn } from '../../lib/cn.js';

/**
 * Simple centered modal. Escape / backdrop click closes when onClose provided.
 */
export function Modal({ open, onClose, title, description, children, footer, className, size = 'lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const width =
    size === 'sm' ? 'max-w-md' : size === 'md' ? 'max-w-lg' : size === 'xl' ? 'max-w-3xl' : 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'oa-modal-title' : undefined}
        className={cn(
          'relative z-10 flex max-h-[min(90vh,720px)] w-full flex-col overflow-hidden rounded-2xl bg-card shadow-[var(--elev)]',
          width,
          className,
        )}
      >
        {(title || description) && (
          <div className="shrink-0 border-b border-border px-5 py-4">
            {title ? (
              <h2 id="oa-modal-title" className="text-base font-medium tracking-tight">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-border px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
