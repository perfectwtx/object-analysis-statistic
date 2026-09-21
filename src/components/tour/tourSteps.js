/** @typedef {{ id: string, route?: string, target?: string, titleKey: string, bodyKey: string, placement?: 'bottom'|'top'|'left'|'right'|'center' }} TourStep */

/** @type {TourStep[]} */
export const TOUR_STEPS = [
  {
    id: 'welcome',
    route: '/',
    target: '[data-tour="logo"]',
    titleKey: 'tourWelcomeTitle',
    bodyKey: 'tourWelcomeBody',
    placement: 'bottom',
  },
  {
    id: 'nav',
    route: '/',
    target: '[data-tour="primary-nav"]',
    titleKey: 'tourNavTitle',
    bodyKey: 'tourNavBody',
    placement: 'bottom',
  },
  {
    id: 'analyze-nav',
    route: '/analyze',
    target: '[data-tour="nav-analyze"]',
    titleKey: 'tourAnalyzeNavTitle',
    bodyKey: 'tourAnalyzeNavBody',
    placement: 'bottom',
  },
  {
    id: 'data-source',
    route: '/analyze',
    target: '[data-tour="data-source"]',
    titleKey: 'tourDataTitle',
    bodyKey: 'tourDataBody',
    placement: 'right',
  },
  {
    id: 'rules',
    route: '/analyze',
    target: '[data-tour="rules-config"]',
    titleKey: 'tourRulesTitle',
    bodyKey: 'tourRulesBody',
    placement: 'right',
  },
  {
    id: 'results',
    route: '/analyze',
    target: '[data-tour="results-panel"]',
    titleKey: 'tourResultsTitle',
    bodyKey: 'tourResultsBody',
    placement: 'left',
  },
  {
    id: 'quality',
    route: '/quality',
    target: '[data-tour="nav-quality"]',
    titleKey: 'tourQualityTitle',
    bodyKey: 'tourQualityBody',
    placement: 'bottom',
  },
  {
    id: 'insights',
    route: '/relations',
    target: '[data-tour="nav-insights"]',
    titleKey: 'tourInsightsTitle',
    bodyKey: 'tourInsightsBody',
    placement: 'bottom',
  },
  {
    id: 'theme',
    route: '/',
    target: '[data-tour="theme-locale"]',
    titleKey: 'tourThemeTitle',
    bodyKey: 'tourThemeBody',
    placement: 'bottom',
  },
  {
    id: 'done',
    route: '/',
    target: null,
    titleKey: 'tourDoneTitle',
    bodyKey: 'tourDoneBody',
    placement: 'center',
  },
];

export const TOUR_STORAGE_KEY = 'oaProductTourSeen';
