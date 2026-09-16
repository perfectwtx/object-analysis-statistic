/**
 * 领域模型说明（JSDoc）
 * @typedef {Object} AnalysisJobSummary
 * @property {string} id
 * @property {string} [sourceName]
 * @property {string} [status]
 * @property {number} [qualityScore]
 * @property {number} [issueCount]
 *
 * @typedef {Object} QualitySnapshot
 * @property {string} [jobId]
 * @property {string} [sourceName]
 * @property {number} [overallScore]
 * @property {number} [completeness]
 * @property {number} [validity]
 * @property {number} [uniqueness]
 * @property {number} [consistency]
 * @property {number} [anomalyControl]
 *
 * @typedef {Object} QualityIssue
 * @property {string} [field]
 * @property {string} [check]
 * @property {number} [count]
 * @property {string} [message]
 *
 * @typedef {Object} QualityBaseline
 * @property {string} sourceName
 * @property {number} [minOverall]
 */
export {};
