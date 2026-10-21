import { useState } from 'react';
import { fetchRulesReference, validateRules } from '../api/index.js';
import { formatRulesError, parseJsonc, toBackendRulesText } from '../utils.js';
import { EMPTY_RULES, RULES_TEMPLATE } from '../components/RulesEditor.jsx';
import { useLatestRequest } from './useLatestRequest.js';

export function useWorkbenchRules() {
  const [rulesText, setRulesText] = useState(RULES_TEMPLATE);
  const [rules, setRules] = useState(null);
  const [rulesError, setRulesError] = useState('');
  const [rulesCheck, setRulesCheck] = useState(null);
  const request = useLatestRequest();
  const checkRules = (text) => request.run(async (signal) => {
    if (!text?.trim()) return { ok: true, empty: true };
    let parsed;
    try { parsed = parseJsonc(text); }
    catch (e) { return { ok: false, message: e.message, state: 'error', source: 'local' }; }
    const result = await validateRules(toBackendRulesText(text), { signal });
    if (result.ok) return { ...result, parsed, state: 'ok' };
    if (result.offline) return { ok: true, parsed, degraded: true, state: 'offline' };
    return { ...result, message: formatRulesError(result.error), state: 'error', source: 'backend' };
  }, {
    onStart: () => setRulesCheck({ state: 'checking' }),
    onSuccess: (result) => { setRulesCheck(result.empty ? null : result); return result; },
    onError: (e) => setRulesError(e.message),
  });
  const clear = () => { request.cancel(); setRules(null); setRulesText(EMPTY_RULES); setRulesError(''); setRulesCheck(null); };
  const fetchReference = async () => {
    try {
      const ref = await fetchRulesReference();
      const text = typeof ref === 'string' ? ref : JSON.stringify(ref, null, 2);
      setRulesText(text); setRulesError(''); await checkRules(text);
    } catch (e) { setRulesError(e.message); }
  };
  return { rulesText, setRulesText, rules, setRules, rulesError, setRulesError, rulesCheck, setRulesCheck, checkRules, clear, fetchReference };
}
