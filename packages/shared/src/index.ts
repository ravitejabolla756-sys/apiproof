export * from './models.js';
export * from './change-rules.js';
export * from './json-file.js';
export * from './evaluation.js';
export * from './version.js';
export * from './source-policy.js';
export * from './planning.js';
export * from './patching.js';
export * from './verification.js';
export * from './contracts.js';
export * from './compatibility.js';
export * from './change-ingestion.js';
export * from './usage-ir.js';
export * from './migration-v2.js';
export * from './verification-v2.js';
export * from './github-check-v2.js';
export * from './compatibility-proof.js';

/** Safe errors carry fixed messages; raw parser errors may contain customer code. */
export { AnalysisError } from './errors.js';
