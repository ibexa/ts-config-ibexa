import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRelease } from './version.mjs';

const base = { version: '1.1.5', branch: '1.x', currentVersion: '1.1.0', tags: ['v1.1.3', 'v1.1.4', 'v2.0.1'] };
const validate = (overrides) => validateRelease({ ...base, ...overrides });

test('accepts the next patch on a release branch', () => {
    assert.equal(validate({}), null);
});

test('accepts the next minor', () => {
    assert.equal(validate({ version: '1.2.0' }), null);
});

test('rejects a missing version', () => {
    assert.match(validate({ version: undefined }), /Invalid version/);
});

test('rejects a non-semver version', () => {
    assert.match(validate({ version: '1.1' }), /Invalid version/);
});

test('rejects an existing tag', () => {
    assert.match(validate({ version: '1.1.4' }), /already exists/);
});

test('rejects a non-release branch', () => {
    assert.match(validate({ branch: 'IBX-1-foo' }), /Refusing to tag/);
    assert.match(validate({ branch: 'main' }), /Refusing to tag/);
    assert.match(validate({ branch: '1.1' }), /Refusing to tag/);
});

test('rejects a release branch of another major line', () => {
    assert.match(validate({ branch: '2.x' }), /Branch 2.x releases 2\.\*\.\* only/);
});

test('accepts a non-release branch when the release-branch check is off', () => {
    assert.equal(validate({ branch: 'IBX-1-foo', requireReleaseBranch: false }), null);
    assert.match(validate({ branch: 'IBX-1-foo', version: '2.0.2', requireReleaseBranch: false }), /Major mismatch/);
});

test('rejects a major jump', () => {
    assert.match(validate({ version: '2.0.2', branch: '2.x' }), /Major mismatch/);
});

test('rejects a skipped patch', () => {
    assert.match(validate({ version: '1.1.6' }), /does not follow/);
});

test('rejects a skipped minor', () => {
    assert.match(validate({ version: '1.3.0' }), /does not follow/);
});

test('rejects going backwards', () => {
    assert.match(validate({ version: '1.1.3', tags: ['v1.1.3', 'v1.1.4', 'v1.1.8'] }), /already exists/);
    assert.match(validate({ version: '1.1.5', tags: ['v1.1.4', 'v1.1.8'] }), /does not follow/);
});

test('allows the first stable tag on a major line', () => {
    assert.equal(validateRelease({ version: '3.0.0', branch: '3.x', currentVersion: '3.0.0', tags: ['v2.0.1'] }), null);
});

test('leaves prereleases unconstrained by sequencing', () => {
    assert.equal(validate({ version: '1.1.9-alpha.1' }), null);
});

test('still guards prereleases on branch, major and existing tag', () => {
    assert.match(validate({ version: '1.1.5-alpha.1', branch: 'IBX-1-foo' }), /Refusing to tag/);
    assert.match(validate({ version: '2.0.2-alpha.1', branch: '2.x' }), /Major mismatch/);
    assert.match(validate({ version: '1.1.4-alpha.1', tags: ['v1.1.3', 'v1.1.4', 'v1.1.4-alpha.1'] }), /already exists/);
});

test('ignores tags from other major lines when sequencing', () => {
    assert.equal(validate({ version: '1.1.5', tags: ['v0.9.9', 'v1.1.4', 'v2.0.1'] }), null);
});
