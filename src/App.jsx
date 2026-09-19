import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './layout/AppShell.jsx';
import HomePage from './pages/HomePage.jsx';
import AnalyzeWorkbench from './pages/AnalyzeWorkbench.jsx';
import QualityDashboard from './pages/QualityDashboard.jsx';
import QualityTrend from './pages/QualityTrend.jsx';
import FieldQuality from './pages/FieldQuality.jsx';
import IssueCenter from './pages/IssueCenter.jsx';
import BaselinesPage from './pages/BaselinesPage.jsx';
import AlertRulesPage from './pages/AlertRulesPage.jsx';
import RegressionPage from './pages/RegressionPage.jsx';
import RelationsPage from './pages/RelationsPage.jsx';
import ObjectRelationshipsPage from './pages/ObjectRelationshipsPage.jsx';
import SchemaImpactPage from './pages/SchemaImpactPage.jsx';
import DataLineagePage from './pages/DataLineagePage.jsx';
import ImpactAnalysisPage from './pages/ImpactAnalysisPage.jsx';
import RecommendationsPage from './pages/RecommendationsPage.jsx';

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
