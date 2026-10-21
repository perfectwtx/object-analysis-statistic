import { toAnalyzeRequestOptions } from './analyzeOptions.js';

export function buildAnalysisOptions({ rules, features, csvInfer, runtime }) {
  const { flatten: ruleFlatten, selectedFields, filter, ...body } = rules || {};
  const flatten = ruleFlatten ?? rules?.runtime?.flatten ?? runtime?.flatten;
  const options = toAnalyzeRequestOptions(runtime);
  return {
    ...options, flatten, rulesJson: rules ? JSON.stringify(body) : null,
    fields: selectedFields?.length ? selectedFields.join(',') : options.fields,
    filter: filter || options.filter, features, csvInferNumbers: csvInfer,
  };
}
