import { useEffect, useRef, useState } from 'react';
import * as api from '../api/index.js';
import { adaptAnalysisResponse } from '../adapter.js';
import { createAnalyzeSession, idleAnalysis } from '../lib/analyze-session.js';
import { usePlatform } from '../lib/store.js';
import { useT } from '../lib/i18n.js';

export function useAsyncAnalyze() {
  const { t } = useT();
  const [state, setState] = useState(idleAnalysis);
  const sessionRef = useRef(null);
  if (!sessionRef.current) {
    sessionRef.current = createAnalyzeSession({
      ...api, onCompleted: () => { void usePlatform.getState().refresh(); },
    }, adaptAnalysisResponse, (patch) => setState((s) => ({ ...s, ...patch })));
  }
  useEffect(() => () => sessionRef.current.dispose(), []);
  return { ...state, error: state.error ? t(state.error) : state.error, busy: state.phase === 'submitting' || state.phase === 'running',
    start: sessionRef.current.start, cancel: sessionRef.current.cancel, reset: sessionRef.current.reset };
}
export default useAsyncAnalyze;
