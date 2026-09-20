import { parseJsonc } from '../utils.js';

export function parseFieldsFromText(text) {
  try {
    if (!text?.trim()) return {};
    const obj = parseJsonc(text);
    const fields = obj?.fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
    return fields;
  } catch {
    return null;
  }
}

export function writeFieldsIntoText(text, fields) {
  let obj;
  try {
    obj = text?.trim() ? parseJsonc(text) : {};
  } catch {
    obj = { runtime: { flatten: true }, fields: {}, expectations: {} };
  }
  if (!obj || typeof obj !== 'object') obj = {};
  obj.fields = fields;
  return `${JSON.stringify(obj, null, 2)}\n`;
}

/** Merge field names into rules.fields without overwriting existing configs. */
export function mergeFieldNamesIntoRulesText(text, fieldNames = []) {
  const names = [...new Set((fieldNames || []).map((x) => String(x).trim()).filter(Boolean))];
  if (!names.length) return text;
  let fields = parseFieldsFromText(text);
  if (fields === null) fields = {};
  const next = { ...fields };
  let changed = false;
  for (const n of names) {
    if (!(n in next)) {
      next[n] = {};
      changed = true;
    }
  }
  if (!changed) return text;
  return writeFieldsIntoText(text, next);
}
