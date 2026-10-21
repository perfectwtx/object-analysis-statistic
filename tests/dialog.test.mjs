import test from 'node:test';
import assert from 'node:assert/strict';
import { mountDialog } from '../src/lib/dialog-focus.js';

test('弹窗循环 Tab、恢复触发按钮，嵌套弹窗只处理最上层 Escape', () => {
  const listeners = new Map();
  const doc = { body: { style: { overflow: 'auto' } }, addEventListener(k, fn) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(fn); }, removeEventListener(k, fn) { listeners.get(k).delete(fn); } };
  const node = () => ({ isConnected: true, tabIndex: 0, getClientRects: () => [1], focus() { doc.activeElement = this; } });
  const opener = node(), first = node(), last = node(); opener.focus();
  const dialog = { ...node(), querySelectorAll: () => [first, last], querySelector: () => null, contains: (el) => [first, last].includes(el) };
  let closes = 0;
  const off = mountDialog(dialog, { document: doc, onClose: () => closes++ });
  assert.equal(doc.activeElement, first); assert.equal(doc.body.style.overflow, 'hidden');
  const key = (key, shiftKey = false) => { const event = { key, shiftKey, preventDefault() {}, stopPropagation() {} }; [...listeners.get('keydown')].forEach((fn) => fn(event)); };
  last.focus(); key('Tab'); assert.equal(doc.activeElement, first);
  key('Tab', true); assert.equal(doc.activeElement, last);
  const child = { ...node(), querySelectorAll: () => [], querySelector: () => null, contains: () => false };
  let childCloses = 0;
  const offChild = mountDialog(child, { document: doc, onClose: () => childCloses++ });
  key('Escape'); assert.equal(childCloses, 1); assert.equal(closes, 0);
  offChild(); assert.equal(doc.body.style.overflow, 'hidden'); assert.equal(doc.activeElement, last);
  key('Escape'); assert.equal(closes, 1); off();
  assert.equal(doc.activeElement, opener); assert.equal(doc.body.style.overflow, 'auto');
});
