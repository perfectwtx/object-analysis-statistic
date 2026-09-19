import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { download, toCsv, toHtml, toJson, toJsonSchema, toMarkdown } from '../exporters.js';
import {
  fetchRulesReference,
  preflight,
  validateRules,
  ASYNC_THRESHOLD_BYTES,
} from '../api/index.js';
import { useAsyncAnalyze } from '../hooks/useAsyncAnalyze.js';
import JobProgress from '../components/JobProgress.jsx';
import { computeRuleFieldWarning, formatRulesError, parseJsonc, toBackendRulesText } from '../utils.js';
import { SAMPLE_DATA } from '../sampleData.js';
import OverviewCards from '../components/OverviewCards.jsx';
import CoverageChart from '../components/CoverageChart.jsx';
import TypeChart from '../components/TypeChart.jsx';
import FieldTable from '../components/FieldTable.jsx';
import ValueDistribution from '../components/ValueDistribution.jsx';
import RulesEditor, { RULES_TEMPLATE } from '../components/RulesEditor.jsx';
import RulesRuntimeSection from '../components/RulesRuntimeSection.jsx';
import QualityPanel from '../components/QualityPanel.jsx';
import InsightsPanel from '../components/InsightsPanel.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

const TABS = [
  { key: 'fields', label: '字段明细' },
  { key: 'insights', label: '深度分析' },
  { key: 'values', label: '取值分布' },
  { key: 'quality', label: '质量报告' },
];
const TEXT_FORMATS = ['json', 'jsonl', 'csv', 'yaml', 'xml'];
const EMPTY_INSIGHTS = {
  correlations: { fields: [], pairs: [], strongPairs: [] },
  patterns: {}, hygiene: {},
  fuzzy: { groupss: [], groupCount: 0, similarDuplicates: 0, totalSamples: 0, uniqueCanonical: 0 },
};
