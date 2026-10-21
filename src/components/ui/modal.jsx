import { useId } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus.js';
import { useT } from '../../lib/i18n.js';
import { cn } from '../../lib/cn.js';

/**
 * Simple centered modal. Escape / backdrop click closes when onClose provided.
 */
export function Modal({ open, onClose, title, description, children, footer, className, size = 'lg' }) {
  const { t } = useT();
  const titleId = useId(), descriptionId = useId();
  const dialogRef = useDialogFocus({ open, onClose });

  if (!open) return null;

  const width =
    size === 'sm' ? 'max-w-md' : size === 'md' ? 'max-w-lg' : size === 'xl' ? 'max-w-3xl' : 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label={t('关闭')}
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-label={!title ? t('配置') : undefined}
        className={cn(
          'relative z-10 flex max-h-[min(90vh,720px)] w-full flex-col overflow-hidden rounded-2xl bg-card shadow-[var(--elev)]',
          width,
          className,
        )}
      >
        {(title || description) && (
          <div className="shrink-0 border-b border-border px-5 py-4">
            {title ? (
              <h2 id={titleId} className="text-base font-medium tracking-tight">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">{description}</p>
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
