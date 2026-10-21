import { useRef, useState } from 'react';
import { exportReport } from '../lib/report-export.js';

export function useReportExport({ result, fileName, onError, onClose }) {
  const [exporting, setExporting] = useState(false);
  const active = useRef(false);
  const run = async (format) => {
    if (active.current || !result) return;
    active.current = true; setExporting(true); onClose?.();
    try { await exportReport(result, fileName, format); }
    catch (e) { onError?.(e); }
    finally { active.current = false; setExporting(false); }
  };
  return { exporting, exportReport: run };
}
