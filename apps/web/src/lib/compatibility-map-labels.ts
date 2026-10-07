export function getRegistryCoverageLabel(reviewedChangeCount: number): string {
  return reviewedChangeCount > 0 ? 'Registry rules reviewed' : 'No registry-reviewed rules';
}

export function getRegistryCoverageDescription(): string {
  return 'Review status describes the matched compatibility rules in MY OWL’s registry; it does not indicate that a user reviewed this repository.';
}

export function getPullRequestStateLabel(state: string | null | undefined): string {
  switch (state) {
    case 'draft': return 'Draft PR';
    case 'open': return 'Open · Ready for review';
    case 'closed': return 'Closed';
    case 'merged': return 'Merged';
    default: return 'PR state unavailable';
  }
}

export interface CompatibilityProofTarget {
  matchedModel?: string | null;
  matchedResource?: string | null;
  matchedEndpoint?: string | null;
  matchedDomain?: string | null;
  matchedParameter?: string | null;
  matchedResponseField?: string | null;
  matchedAuthOrHeader?: string | null;
}

/** Returns the first authoritative target across every supported applicability dimension. */
export function getProofMatchedTarget(proof: CompatibilityProofTarget): string {
  return proof.matchedModel
    ?? proof.matchedResource
    ?? proof.matchedEndpoint
    ?? proof.matchedDomain
    ?? proof.matchedParameter
    ?? proof.matchedResponseField
    ?? proof.matchedAuthOrHeader
    ?? 'No exact target match';
}
