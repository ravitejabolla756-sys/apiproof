export type CompatibilityFindingProjection = {
  id: string;
  provider: string;
  title: string;
  status: string;
  filePath: string;
  symbol: string;
  migration: { id: string; status: string | null } | null;
  pullRequest: { id: string; number: number | null; state: string | null; url: string | null; createdAt: string | null } | null;
};

export type CompatibilityMapProjection = {
  repositories: Array<{
    id: string;
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    latestScanStatus: string;
    latestCompletedScan: { id: string; sha: string | null; baselineSha: string | null; filesAnalyzed: number; findingsCount: number; completedAt: string | null } | null;
    analysisEvidenceAvailable: boolean;
    integrations: Array<{
      provider: string;
      providerName?: string;
      detected: boolean;
      usageCount: number | null;
      mappedSymbolCount: number | null;
      reviewedChangeCount: number;
      packageName?: string | null;
      declaredVersion?: string | null;
      resolvedVersion?: string | null;
      versionConfidence?: string | null;
      capability?: string | null;
      capabilities?: string[];
    }>;
    openFindingCount: number;
    findings: CompatibilityFindingProjection[];
    compatibilityProofs?: Array<Record<string, unknown> & {
      changeId: string;
      providerId: string;
      status: string;
      changeTitle?: string;
      severity?: string;
      exactFile?: string | null;
      exactLine?: number | null;
      matchedModel?: string | null;
      matchedResource?: string | null;
      matchedEndpoint?: string | null;
      matchedDomain?: string | null;
      matchedParameter?: string | null;
      matchedResponseField?: string | null;
      matchedAuthOrHeader?: string | null;
      removalAt?: string | null;
      reasonCodes?: string[];
    }>;
  }>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nullableText(value: unknown): value is string | null {
  return value === null || text(value);
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function nullableCount(value: unknown): value is number | null {
  return value === null || count(value);
}

function parseFinding(value: unknown): CompatibilityFindingProjection | null {
  if (!record(value) || !text(value.id) || !text(value.provider) || !text(value.title) || !text(value.status) || !text(value.filePath) || !text(value.symbol)) return null;
  let migration: CompatibilityFindingProjection['migration'] = null;
  if (value.migration !== null) {
    if (!record(value.migration) || !text(value.migration.id) || !nullableText(value.migration.status)) return null;
    migration = { id: value.migration.id, status: value.migration.status };
  }
  let pullRequest: CompatibilityFindingProjection['pullRequest'] = null;
  if (value.pullRequest !== null) {
    if (!record(value.pullRequest) || !text(value.pullRequest.id) || !nullableCount(value.pullRequest.number) || !nullableText(value.pullRequest.state) || !nullableText(value.pullRequest.url) || !nullableText(value.pullRequest.createdAt)) return null;
    pullRequest = { id: value.pullRequest.id, number: value.pullRequest.number, state: value.pullRequest.state, url: value.pullRequest.url, createdAt: value.pullRequest.createdAt };
  }
  return { id: value.id, provider: value.provider, title: value.title, status: value.status, filePath: value.filePath, symbol: value.symbol, migration, pullRequest };
}

function parseIntegration(value: unknown) {
  if (!record(value) || !text(value.provider) || typeof value.detected !== 'boolean' || !nullableCount(value.usageCount) || !nullableCount(value.mappedSymbolCount) || !count(value.reviewedChangeCount)) return null;
  const optionalTextKeys = ['providerName', 'packageName', 'declaredVersion', 'resolvedVersion', 'versionConfidence', 'capability'] as const;
  for (const key of optionalTextKeys) if (value[key] !== undefined && !nullableText(value[key])) return null;
  if (value.capabilities !== undefined && (!Array.isArray(value.capabilities) || !value.capabilities.every(text))) return null;
  return {
    provider: value.provider,
    ...(value.providerName === undefined ? {} : { providerName: value.providerName as string }),
    detected: value.detected,
    usageCount: value.usageCount,
    mappedSymbolCount: value.mappedSymbolCount,
    reviewedChangeCount: value.reviewedChangeCount,
    ...(value.packageName === undefined ? {} : { packageName: value.packageName as string | null }),
    ...(value.declaredVersion === undefined ? {} : { declaredVersion: value.declaredVersion as string | null }),
    ...(value.resolvedVersion === undefined ? {} : { resolvedVersion: value.resolvedVersion as string | null }),
    ...(value.versionConfidence === undefined ? {} : { versionConfidence: value.versionConfidence as string | null }),
    ...(value.capability === undefined ? {} : { capability: value.capability as string | null }),
    ...(value.capabilities === undefined ? {} : { capabilities: value.capabilities as string[] }),
  };
}

function parseProof(value: unknown): Record<string, unknown> & { changeId: string; providerId: string; status: string } | null {
  return record(value) && text(value.changeId) && text(value.providerId) && text(value.status) ? value as Record<string, unknown> & { changeId: string; providerId: string; status: string } : null;
}

/** Validate the nested compatibility-map projection before the dashboard renders it. */
export function parseCompatibilityMapResponse(value: unknown): CompatibilityMapProjection | null {
  if (!record(value) || !Array.isArray(value.repositories)) return null;
  const repositoryIds = new Set<string>();
  const repositories: CompatibilityMapProjection['repositories'] = [];
  for (const item of value.repositories) {
    if (!record(item) || !text(item.id) || !text(item.owner) || !text(item.name) || !text(item.fullName) || !text(item.defaultBranch) || !text(item.latestScanStatus) || typeof item.analysisEvidenceAvailable !== 'boolean' || !count(item.openFindingCount) || !Array.isArray(item.integrations) || !Array.isArray(item.findings) || repositoryIds.has(item.id)) return null;
    const integrations = item.integrations.map(parseIntegration);
    const findings = item.findings.map(parseFinding);
    if (integrations.some((entry) => entry === null) || findings.some((entry) => entry === null)) return null;
    const integrationIds = new Set<string>();
    if (integrations.some((entry) => entry && (integrationIds.has(entry.provider) || (integrationIds.add(entry.provider), false)))) return null;
    const findingIds = new Set<string>();
    if (findings.some((entry) => entry && (findingIds.has(entry.id) || (findingIds.add(entry.id), false)))) return null;
    let latestCompletedScan: CompatibilityMapProjection['repositories'][number]['latestCompletedScan'] = null;
    if (item.latestCompletedScan !== null) {
      const scan = item.latestCompletedScan;
      if (!record(scan) || !text(scan.id) || !nullableText(scan.sha) || !nullableText(scan.baselineSha) || !count(scan.filesAnalyzed) || !count(scan.findingsCount) || !nullableText(scan.completedAt)) return null;
      latestCompletedScan = { id: scan.id, sha: scan.sha, baselineSha: scan.baselineSha, filesAnalyzed: scan.filesAnalyzed, findingsCount: scan.findingsCount, completedAt: scan.completedAt };
    }
    let compatibilityProofs: CompatibilityMapProjection['repositories'][number]['compatibilityProofs'];
    if (item.compatibilityProofs !== undefined) {
      if (!Array.isArray(item.compatibilityProofs)) return null;
      const proofIds = new Set<string>();
      const parsedProofs = item.compatibilityProofs.map(parseProof);
      if (parsedProofs.some((proof) => proof === null) || parsedProofs.some((proof) => proof && (proofIds.has(proof.changeId) || (proofIds.add(proof.changeId), false)))) return null;
      compatibilityProofs = parsedProofs as NonNullable<typeof compatibilityProofs>;
    }
    repositoryIds.add(item.id);
    repositories.push({ id: item.id, owner: item.owner, name: item.name, fullName: item.fullName, defaultBranch: item.defaultBranch, latestScanStatus: item.latestScanStatus, latestCompletedScan, analysisEvidenceAvailable: item.analysisEvidenceAvailable, integrations: integrations as NonNullable<typeof integrations[number]>[], openFindingCount: item.openFindingCount, findings: findings as CompatibilityFindingProjection[], ...(compatibilityProofs ? { compatibilityProofs } : {}) });
  }
  return { repositories };
}
