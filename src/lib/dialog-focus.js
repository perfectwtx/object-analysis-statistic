const documents = new WeakMap();
export function mountDialog(dialog, { onClose, initialFocus, document: doc = document } = {}) {
  let state = documents.get(doc);
  if (!state) { state = { stack: [], overflow: doc.body.style.overflow }; documents.set(doc, state); }
  const previousFocus = doc.activeElement;
  const entry = { dialog }; state.stack.push(entry); doc.body.style.overflow = 'hidden';
  const top = () => state.stack.at(-1) === entry;
  const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((el) => el.tabIndex !== -1 && !el.hidden && el.getClientRects().length > 0);
  const focusFirst = () => (initialFocus?.current || dialog.querySelector('[data-autofocus]') || focusable()[0] || dialog).focus();
  if (!dialog.contains(doc.activeElement)) focusFirst();
  const keydown = (event) => {
    if (!top()) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose?.(); return; }
    if (event.key !== 'Tab') return;
    const items = focusable(); const first = items[0], last = items.at(-1);
    if (!first) { event.preventDefault(); dialog.focus(); }
    else if (event.shiftKey && (doc.activeElement === first || doc.activeElement === dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (doc.activeElement === last || doc.activeElement === dialog)) { event.preventDefault(); first.focus(); }
  };
  const focusin = (event) => { if (top() && !dialog.contains(event.target)) focusFirst(); };
  doc.addEventListener('keydown', keydown); doc.addEventListener('focusin', focusin);
  return () => {
    doc.removeEventListener('keydown', keydown); doc.removeEventListener('focusin', focusin);
    state.stack = state.stack.filter((item) => item !== entry);
    if (!state.stack.length) { doc.body.style.overflow = state.overflow; documents.delete(doc); }
    if (previousFocus?.isConnected) previousFocus.focus();
  };
}
