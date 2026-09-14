import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { download, toCsv, toHtml, toJson, toJsonSchema, toMarkdown } from './exporters.js';
import { analyzeFile, fetchRulesReference, getBaseUrl, health, preflight, setBaseUrl, validateRules } from './api.js';
import { adaptAnalysisResponse } from './adapter.js';
import { computeRuleFieldWarning, formatRulesError, parseJsonc, toBackendRulesText } from './utils.js';
import { SAMPLE_DATA } from './sampleData.js';
import OverviewCards from './components/OverviewCards.jsx';
import CoverageChart from './components/CoverageChart.jsx';
import TypeChart from './components/TypeChart.jsx';
import FieldTable from './components/FieldTable.jsx';
import ValueDistribution from './components/ValueDistribution.jsx';
import RulesEditor, { RULES_TEMPLATE } from './components/RulesEditor.jsx';
import QualityPanel from './components/QualityPanel.jsx';
import InsightsPanel from './components/InsightsPanel.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ThemeSwitch from './components/ThemeSwitch.jsx';

// PLACEHOLDER_RESTORE - will be replaced with full file
export default function App() {
  return <div className="workbench"><main className="main"><p>请将本地 frontend-p0/src/App.jsx 覆盖此文件后重新提交。api / hooks / JobProgress 已推送。</p></main></div>;
}
