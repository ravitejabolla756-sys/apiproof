/** Trusted, source-independent cache hashing code run only in the pinned Docker image. */
export const ARTIFACT_DIGEST_SCRIPT = `
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = process.argv[1], hash = crypto.createHash('sha256');
function walk(directory, relative = '') {
  for (const name of fs.readdirSync(directory).sort()) {
    if (name === 'provisioning.json' || name === '_logs' || name === '_update-notifier-last-checked') continue;
    const file = path.join(directory, name), key = relative ? relative + '/' + name : name;
    const stat = fs.lstatSync(file);
    if (stat.isDirectory()) { walk(file, key); continue; }
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(file), resolved = path.resolve(directory, target);
      if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error('Cache symlink escapes provisioning (' + key + ')');
      hash.update(JSON.stringify([key, 'link', target]) + '\\n');
    } else if (stat.isFile()) {
      hash.update(JSON.stringify([key, 'file', crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]) + '\\n');
    } else throw new Error('Unsupported cache entry');
  }
}
walk(root);
const actual = hash.digest('hex');
if (process.argv[2] && actual !== process.argv[2]) throw new Error('VERIFICATION_PROVISIONING_INTEGRITY_FAILED: Cache content mismatch');
process.stdout.write(actual);
`;

/** Remove only pnpm's ephemeral project registry, not package files/indexes. */
export const FINALIZE_ARTIFACTS_SCRIPT = `
require('fs').rmSync(require('path').join(process.argv[1], 'pnpm-store/v10/projects'), { recursive: true, force: true });
if (require('fs').existsSync(require('path').join(process.argv[1], 'pnpm-store/v10'))) require('fs').mkdirSync(require('path').join(process.argv[1], 'pnpm-store/v10/projects'));
` + ARTIFACT_DIGEST_SCRIPT;
