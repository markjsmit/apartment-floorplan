// npm run check — validate every house version and asset, then run sanity checks.
import { loadBundleFromDisk } from './load-files';
import { sanityCheck } from '../src/model/sanity';

const bundle = loadBundleFromDisk();
for (const e of bundle.errors) console.log(`ERROR ${e.file}: ${e.message}`);
const issues = bundle.errors.length ? [] : sanityCheck(bundle);
for (const i of issues) console.log(`WARN  ${i}`);
const counts = `${bundle.versionOrder.length} versions, ${Object.keys(bundle.furniture).length} furniture, ${Object.keys(bundle.textures).length} textures`;
if (bundle.errors.length || issues.length) {
  console.log(`\n✗ ${bundle.errors.length} errors, ${issues.length} warnings (${counts})`);
  process.exit(1);
}
console.log(`✓ all good (${counts})`);
