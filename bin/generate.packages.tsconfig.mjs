#!/usr/bin/env node

/**
 * Generates tsconfig.json files for all Ibexa packages in vendor/ibexa/
 *
 * Usage: node generate-packages-tsconfig.mjs [--dry-run] [--package=<name>] [--verbose]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function resolveProjectRoot() {
    return join(__dirname, '..', '..', '..', '..');
}

function resolveVendorIbexaDir(rootDir) {
    return join(rootDir, 'vendor', 'ibexa');
}

function parseCliArguments() {
    const args = process.argv.slice(2);

    return {
        dryRun: args.includes('--dry-run'),
        verbose: args.includes('--verbose'),
        packageFilter: args.find(a => a.startsWith('--package='))?.split('=')[1]
    };
}

function stripJsonComments(content) {
    return content.replace(/\/\/.*$/gm, '');
}

function stripTrailingCommas(content) {
    return content.replace(/,(\s*[}\]])/g, '$1');
}

function parseJsonWithComments(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const cleanedContent = stripTrailingCommas(stripJsonComments(content));

    return JSON.parse(cleanedContent);
}

function isIbexaPackagePath(target) {
    return target.match(/^\.\/vendor\/ibexa\/([^/]+)\/(.*)$/);
}

function isSelfReference(targetPackage, currentPackage) {
    return targetPackage === currentPackage;
}

function convertToSelfReferencePath(rest) {
    return `./${rest}`;
}

function convertToSiblingPackagePath(targetPackage, rest) {
    return `../${targetPackage}/${rest}`;
}

function convertToRootRelativePath(target) {
    return `../../../${target.slice(2)}`;
}

function convertSinglePath(target, currentPackageName) {
    const ibexaPathMatch = isIbexaPackagePath(target);

    if (ibexaPathMatch) {
        const [, targetPackage, rest] = ibexaPathMatch;

        if (isSelfReference(targetPackage, currentPackageName)) {
            return convertToSelfReferencePath(rest);
        }

        return convertToSiblingPackagePath(targetPackage, rest);
    }

    if (target.startsWith('./')) {
        return convertToRootRelativePath(target);
    }

    return target;
}

function convertPathsToRelative(rootPaths, packageName) {
    const converted = {};

    for (const [alias, targets] of Object.entries(rootPaths)) {
        converted[alias] = targets.map(target => convertSinglePath(target, packageName));
    }

    return converted;
}

function hasIbexaTsConfigFile(packageDir) {
    return existsSync(join(packageDir, 'ibexa.tsconfig.json'));
}

function hasBundleResourcesDir(packageDir) {
    return existsSync(join(packageDir, 'src', 'bundle', 'Resources'));
}

function hasTypeScriptSource(packageDir) {
    return hasIbexaTsConfigFile(packageDir) || hasBundleResourcesDir(packageDir);
}

function buildTsConfigObject(relativePaths) {
    return {
        extends: '../../../tsconfig.json',
        include: [
            'src/bundle/**/*.ts',
            'src/bundle/**/*.tsx'
        ],
        compilerOptions: {
            paths: relativePaths
        }
    };
}

function generatePackageTsConfig(packageName, rootPaths, vendorIbexaDir, dryRun) {
    const packageDir = join(vendorIbexaDir, packageName);

    if (!hasTypeScriptSource(packageDir)) {
        return { skipped: true, reason: 'no TypeScript source' };
    }

    const relativePaths = convertPathsToRelative(rootPaths, packageName);
    const tsconfig = buildTsConfigObject(relativePaths);
    const tsconfigPath = join(packageDir, 'tsconfig.json');
    const content = JSON.stringify(tsconfig, null, 4) + '\n';

    if (dryRun) {
        return { dryRun: true, path: tsconfigPath, content };
    }

    writeFileSync(tsconfigPath, content, 'utf-8');

    return { written: true, path: tsconfigPath };
}

function getIbexaPackageNames(vendorIbexaDir) {
    return readdirSync(vendorIbexaDir)
        .filter(name => statSync(join(vendorIbexaDir, name)).isDirectory());
}

function filterPackages(packages, packageFilter) {
    if (!packageFilter) {
        return packages;
    }

    return packages.filter(name => name === packageFilter);
}

function loadRootTsConfig(rootDir) {
    const rootTsConfigPath = join(rootDir, 'tsconfig.json');

    if (!existsSync(rootTsConfigPath)) {
        console.error('Error: Root tsconfig.json not found at', rootTsConfigPath);
        process.exit(1);
    }

    return parseJsonWithComments(rootTsConfigPath);
}

function extractPathAliases(tsConfig) {
    const paths = tsConfig.compilerOptions?.paths || {};

    if (Object.keys(paths).length === 0) {
        console.error('Error: No paths found in root tsconfig.json');
        process.exit(1);
    }

    return paths;
}

function processPackage(packageName, rootPaths, vendorIbexaDir, dryRun, results) {
    const result = generatePackageTsConfig(packageName, rootPaths, vendorIbexaDir, dryRun);

    if (result.skipped) {
        results.skipped.push({ name: packageName, reason: result.reason });
    } else if (result.dryRun) {
        results.dryRun.push({ name: packageName, path: result.path });
        console.log(`[DRY-RUN] Would write: ${result.path}`);
    } else if (result.written) {
        results.written.push({ name: packageName, path: result.path });
        console.log(`Generated: ${result.path}`);
    }
}

function printSummary(results, dryRun, verbose) {
    console.log('\n--- Summary ---');

    if (dryRun) {
        console.log(`Would generate: ${results.dryRun.length} files`);
    } else {
        console.log(`Generated: ${results.written.length} files`);
    }

    console.log(`Skipped: ${results.skipped.length} packages (no TypeScript source)`);

    if (results.skipped.length > 0 && verbose) {
        console.log('\nSkipped packages:');
        results.skipped.forEach(({ name, reason }) => {
            console.log(`  - ${name}: ${reason}`);
        });
    }
}

function main() {
    const { dryRun, verbose, packageFilter } = parseCliArguments();
    const rootDir = resolveProjectRoot();
    const vendorIbexaDir = resolveVendorIbexaDir(rootDir);

    console.log('Generating tsconfig.json for Ibexa packages...\n');

    const rootTsConfig = loadRootTsConfig(rootDir);
    const rootPaths = extractPathAliases(rootTsConfig);

    console.log(`Found ${Object.keys(rootPaths).length} path aliases in root tsconfig.json\n`);

    const allPackages = getIbexaPackageNames(vendorIbexaDir);
    const packages = filterPackages(allPackages, packageFilter);

    if (packageFilter && packages.length === 0) {
        console.error(`Error: Package "${packageFilter}" not found`);
        process.exit(1);
    }

    const results = { written: [], skipped: [], dryRun: [] };

    for (const packageName of packages) {
        processPackage(packageName, rootPaths, vendorIbexaDir, dryRun, results);
    }

    printSummary(results, dryRun, verbose);
}

main();
