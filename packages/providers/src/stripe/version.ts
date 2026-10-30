import { posix } from 'node:path';
import semver from 'semver';
import type { ApiChange, ScanResult, UsageFinding, ReasonCode } from '@apiproof/shared';

export function assessVersion(scan: ScanResult, usage: UsageFinding, change: ApiChange) {
  const dependency = scan.dependencies.filter((item) => {
    const directory = posix.dirname(item.manifest);
    return directory === '.' || usage.evidence.binding.file.startsWith(`${directory}/`);
  }).sort((a, b) => b.manifest.length - a.manifest.length)[0];
  const resolution = dependency?.versionResolution;
  const version = resolution?.version ?? dependency?.installedVersion ?? dependency?.lockedVersion;
  const source = resolution?.source ?? (dependency?.installedVersion ? 'installed' : 'lockfile');
  const outside = !!(change.affectedSdkVersions && version && !semver.satisfies(version, change.affectedSdkVersions));
  const assessment = !change.affectedSdkVersions ? 'not-constrained' : version ? 'in-range' : 'unknown';
  const reasonCode: ReasonCode = outside ? 'VERSION_OUTSIDE_AFFECTED_RANGE'
    : assessment === 'unknown' ? 'VERSION_UNKNOWN' : assessment === 'in-range' ? 'VERSION_IN_AFFECTED_RANGE' : 'VERSION_NOT_CONSTRAINED';
  const detail = outside ? `SDK ${version} from ${source} is outside ${change.affectedSdkVersions}.`
    : assessment === 'unknown' ? 'Exact SDK version is unavailable; applicability is uncertain.'
      : assessment === 'in-range' ? `SDK ${version} from ${source} satisfies ${change.affectedSdkVersions}.` : 'No SDK version constraint.';
  return { outside, assessment, reasonCode, detail, source,
    confidence: assessment === 'unknown' || change.apiVersion ? 0.7 : source === 'declared-exact' ? 0.75 : 0.95 } as const;
}
