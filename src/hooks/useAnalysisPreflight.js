import { useState } from 'react';
import { preflight } from '../api/index.js';
import { useLatestRequest } from './useLatestRequest.js';

export function useAnalysisPreflight({ execute, onSampleFields, onError }) {
  const request = useLatestRequest();
  const [preparing, setPreparing] = useState(false);
  const [pending, setPending] = useState(null);
  const [modal, setModal] = useState(null);
  const prepare = (source, options) => request.run(async (signal) => {
    if (!options.rulesJson) return null;
    try { return await preflight(source.file, { ...options, request: { signal } }); }
    catch (e) {
      // 旧后端没有预检时仍允许权威分析接口进行校验；其他错误不静默跳过。
      if (e.notImplemented) return null;
      throw e;
    }
  }, {
    onStart: () => { setPreparing(true); setPending(null); setModal(null); },
    onSuccess: async (result) => {
      const sample = result?.sampleFields ?? result?.SampleFields ?? [];
      if (Array.isArray(sample) && sample.length) onSampleFields(sample);
      if (result?.hasWarning) {
        setModal({ ruleFields: result.ruleFields ?? [], sampleFields: sample, truncated: result.truncatedSampleFieldCount ?? 0 });
        setPending({ source, options });
      } else await execute(source, options);
    },
    onError, onFinally: () => setPreparing(false),
  });
  const cancel = () => { request.cancel(); setPreparing(false); setPending(null); setModal(null); };
  const confirm = () => { const next = pending; cancel(); if (next) return execute(next.source, next.options); };
  return { prepare, preparing, preflightModal: modal, confirmPreflight: confirm, cancelPreflight: cancel };
}
