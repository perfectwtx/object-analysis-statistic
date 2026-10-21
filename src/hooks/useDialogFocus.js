import { useEffect, useRef } from 'react';
import { mountDialog } from '../lib/dialog-focus.js';

export function useDialogFocus({ open, onClose, initialFocus }) {
  const ref = useRef(null), closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    return mountDialog(ref.current, { onClose: () => closeRef.current?.(), initialFocus });
  }, [open, initialFocus]);
  return ref;
}
