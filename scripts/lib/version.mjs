export const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/;
export const RELEASE_BRANCH = /^([0-9]+)\.x$/;

export const getVersionParts = (value) => value.replace(/-.*/, '').split('.').map(Number);

const isSame = (a, b) => a.every((part, index) => part === b[index]);
const compare = (a, b) => a.map((part, index) => part - b[index]).find((diff) => diff !== 0) ?? 0;
const isGreater = (a, b) => compare(a, b) > 0;

const latestStable = (tags, forMajor) =>
    tags
        .filter((tag) => /^v[0-9]+\.[0-9]+\.[0-9]+$/.test(tag))
        .map((tag) => getVersionParts(tag.slice(1)))
        .filter(([tagMajor]) => tagMajor === forMajor)
        .reduce((best, candidate) => (best === null || isGreater(candidate, best) ? candidate : best), null);

export const validateRelease = ({ version, branch, currentVersion, tags, requireReleaseBranch = true }) => {
    if (!version || !SEMVER.test(version)) {
        return `Invalid version ${version || 'nothing'}; expected semver like 1.1.5 or 1.2.0-alpha.1`;
    }

    if (tags.includes(`v${version}`)) {
        return `Tag v${version} already exists`;
    }

    const target = getVersionParts(version);

    if (requireReleaseBranch) {
        const releaseBranch = branch.match(RELEASE_BRANCH);

        if (!releaseBranch) {
            return `Refusing to tag from '${branch}'; release from an X.x branch`;
        }

        if (Number(releaseBranch[1]) !== target[0]) {
            return `Branch ${branch} releases ${releaseBranch[1]}.*.* only; got ${version}`;
        }
    }

    if (target[0] !== getVersionParts(currentVersion)[0]) {
        return `Major mismatch: ${currentVersion} -> ${version}; bump within the same major line`;
    }

    if (version.includes('-')) {
        return null;
    }

    const latest = latestStable(tags, target[0]);

    if (latest === null) {
        return null;
    }

    const [major, minor, patch] = latest;
    const nextPatch = [major, minor, patch + 1];
    const nextMinor = [major, minor + 1, 0];

    if (!isSame(target, nextPatch) && !isSame(target, nextMinor)) {
        return `Version ${version} does not follow the latest tag v${latest.join('.')}; expected ${nextPatch.join('.')} or ${nextMinor.join('.')}`;
    }

    return null;
};
