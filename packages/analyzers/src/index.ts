export { TypeScriptRepositoryAnalyzer } from './typescript/index.js';
export { RepositorySnapshot } from './typescript/repository.js';
export { evaluateCompatibility } from './typescript/compatibility.js';
export type { CompatibilityInput, CompatibilityPolicy } from './typescript/compatibility.js';
export { evaluateNormalizedCompatibility } from './typescript/compatibility.js';
export type { NormalizedCompatibilityInput } from './typescript/compatibility.js';
export { normalizeCompatibilityUsage, normalizedUsageToCompatibilityUsage, usageFindingToCompatibilityUsage } from './typescript/usage-ir.js';
export type { UsageIRContext } from './typescript/usage-ir.js';
export { evaluateRegisteredCompatibility, evaluateRegisteredNormalizedCompatibility } from './typescript/compatibility.js';
