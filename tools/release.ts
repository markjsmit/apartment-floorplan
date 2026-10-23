// npm run release [-- --dry]
// Checks the house data, runs the tests, builds the static site and publishes dist/ to the gh-pages branch.
// One-time GitHub setting: Settings → Pages → Build and deployment → "Deploy from a branch" → gh-pages / (root).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ghpages from 'gh-pages';
import { ROOT } from './load-files';

const dry = process.argv.includes('--dry');
const run = (cmd: string) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });

const dirty = execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
if (dirty && !dry) {
  console.error('Uncommitted changes — commit first so the published site matches a commit:\n' + dirty);
  process.exit(1);
}

run('npm run -s check');
run('npx vitest run');
run('npm run -s build');

const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8')) as { publicUrl: string };
if (dry) {
  console.log('\n--dry: built dist/ but did not publish.');
  process.exit(0);
}

const commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
await ghpages.publish(path.join(ROOT, 'dist'), {
  branch: 'gh-pages',
  dotfiles: true,
  message: `Release ${commit}`,
});
console.log(`\nPublished ${commit} to gh-pages → ${site.publicUrl}`);
console.log('(first time? GitHub → Settings → Pages → Deploy from a branch → gh-pages / root)');
