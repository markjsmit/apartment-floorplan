// npm run check — validate every house version and asset, then run sanity checks.
import { loadBundleFromDisk } from './load-files';
import { sanityCheck } from '../src/model/sanity';

const bundle = loadBundleFromDisk();
for (const e of bundle.errors) console.log(`ERROR ${e.file}: ${e.message}`);
// sanity checks run on whatever loaded fine, even if another file is broken
const issues = sanityCheck(bundle);
for (const i of issues) console.log(`${i.level === 'error' ? 'ERROR' : 'WARN '} ${i.message}`);
const errors = bundle.errors.length + issues.filter((i) => i.level === 'error').length;
const warnings = issues.length - issues.filter((i) => i.level === 'error').length;
const counts = `${bundle.versionOrder.length} versions, ${Object.keys(bundle.furniture).length} furniture, ${Object.keys(bundle.textures).length} textures`;
if (errors) {
  console.log(`\n✗ ${errors} errors, ${warnings} warnings (${counts})`);
  process.exit(1);
}
console.log(warnings ? `✓ no errors, ${warnings} warnings to look at (${counts})` : `✓ all good (${counts})`);
