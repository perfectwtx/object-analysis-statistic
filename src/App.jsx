import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './layout/AppShell.jsx';
import HomePage from './pages/HomePage.jsx';
const AnalyzeWorkbench = lazy(() => import('./pages/AnalyzeWorkbench.jsx'));
const QualityDashboard = lazy(() => import('./pages/QualityDashboard.jsx'));
const QualityTrend = lazy(() => import('./pages/QualityTrend.jsx'));
const FieldQuality = lazy(() => import('./pages/FieldQuality.jsx'));
const IssueCenter = lazy(() => import('./pages/IssueCenter.jsx'));
const BaselinesPage = lazy(() => import('./pages/BaselinesPage.jsx'));
const AlertRulesPage = lazy(() => import('./pages/AlertRulesPage.jsx'));
const RegressionPage = lazy(() => import('./pages/RegressionPage.jsx'));
const RelationsPage = lazy(() => import('./pages/RelationsPage.jsx'));
const ObjectRelationshipsPage = lazy(() => import('./pages/ObjectRelationshipsPage.jsx'));
const SchemaImpactPage = lazy(() => import('./pages/SchemaImpactPage.jsx'));
const DataLineagePage = lazy(() => import('./pages/DataLineagePage.jsx'));
const ImpactAnalysisPage = lazy(() => import('./pages/ImpactAnalysisPage.jsx'));
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage.jsx'));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="analyze" element={<AnalyzeWorkbench />} />
          <Route path="quality" element={<QualityDashboard />} />
          <Route path="quality/trend" element={<QualityTrend />} />
          <Route path="quality/fields" element={<FieldQuality />} />
          <Route path="issues" element={<IssueCenter />} />
          <Route path="baselines" element={<BaselinesPage />} />
          <Route path="alerts" element={<AlertRulesPage />} />
          <Route path="regression" element={<RegressionPage />} />
          <Route path="relations" element={<RelationsPage />} />
          <Route path="relationships" element={<ObjectRelationshipsPage />} />
          <Route path="schema-impact" element={<SchemaImpactPage />} />
          <Route path="lineage" element={<DataLineagePage />} />
          <Route path="impact" element={<ImpactAnalysisPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
