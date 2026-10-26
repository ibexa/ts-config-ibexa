import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { validateRelease } from './lib/version.mjs';

const MANIFEST = 'package.json';

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'skip-ci': { type: 'boolean' }, 'dry-run': { type: 'boolean' } },
});
const skipCi = values['skip-ci'] ?? false;
const dryRun = values['dry-run'] ?? false;
const version = positionals[0];

const git = (...gitArgs) => execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();

const source = readFileSync(MANIFEST, 'utf8');
const manifest = JSON.parse(source);

const error = validateRelease({
    version,
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    currentVersion: manifest.version,
    tags: git('tag', '--list', 'v*').split('\n').filter(Boolean),
    requireReleaseBranch: !dryRun,
});

if (error) {
    throw new Error(error);
}

if (!skipCi) {
    execFileSync('yarn', ['test'], { stdio: 'inherit' });
}

writeFileSync(MANIFEST, source.replace(/^(\s*"version":\s*)"[^"]*"/m, `$1"${version}"`));

if (git('status', '--porcelain', MANIFEST)) {
    git('commit', '-m', `Released ${version}`, MANIFEST);
}

git('tag', `v${version}`);

process.stdout.write(
    dryRun
        ? `Dry run: committed and tagged v${version} locally; nothing should be pushed.\n`
        : `Committed and tagged v${version}. Push with: git push origin HEAD v${version}\n`,
);
