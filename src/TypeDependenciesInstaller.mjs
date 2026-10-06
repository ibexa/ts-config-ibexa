import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

import GeneratedFilesCache from './GeneratedFilesCache.mjs';

export default class TypeDependenciesInstaller {
    static PACKAGES = [
        { name: 'ibexa/admin-ui-assets', isRequired: () => true },
        { name: 'ibexa/headless-assets', isRequired: (composerContent) => composerContent.license === 'proprietary' },
    ];

    constructor({ rootDir, getIbexaVendorPath }) {
        this.rootDir = rootDir;
        this.getIbexaVendorPath = getIbexaVendorPath;
        this.composerContent = TypeDependenciesInstaller.readJson(path.join(rootDir, 'composer.json')) ?? {};
        this.packagesDir = path.join(GeneratedFilesCache.findNodeModulesDir(), '.cache', 'ibexa-ts-config', 'packages');
    }

    static readJson = (filePath) => {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch {
            return null;
        }
    };

    static isSymlink = (filePath) => {
        try {
            return fs.lstatSync(filePath).isSymbolicLink();
        } catch {
            return false;
        }
    };

    static runComposer = (command, cwd) => {
        const fullCommand = `composer ${command} --no-interaction --no-progress --no-plugins --no-scripts --prefer-dist`;

        try {
            execSync(fullCommand, { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
        } catch (error) {
            const stderr = error.stderr?.toString().trim();

            throw new Error(`Failed to run "${fullCommand}" in "${cwd}".\n${stderr || error.message}`);
        }
    };

    getVersionLine = () => {
        const branchAliases = Object.values(this.composerContent.extra?.['branch-alias'] ?? {});

        return branchAliases.map((alias) => /^(\d+\.\d+)\.x-dev$/.exec(alias)?.[1]).find(Boolean) ?? null;
    };

    getPackages = () =>
        TypeDependenciesInstaller.PACKAGES.filter(
            ({ name, isRequired }) => name !== this.composerContent.name && isRequired(this.composerContent),
        ).map(({ name }) => name);

    getVendorPath = (name) => this.getIbexaVendorPath(name.replace(/^ibexa\//, ''), true);

    isForeign = (vendorPath) => {
        if (!fs.existsSync(vendorPath)) {
            return false;
        }

        if (!TypeDependenciesInstaller.isSymlink(vendorPath)) {
            return true;
        }

        return !fs.realpathSync(vendorPath).startsWith(this.packagesDir);
    };

    install = (name, constraint) => {
        const projectDir = path.join(this.packagesDir, `${name.replace('/', '_')}@${constraint}`);
        const installedDir = path.join(projectDir, 'vendor', name);
        const authFilePath = path.join(this.rootDir, 'auth.json');

        if (!fs.existsSync(path.join(installedDir, 'composer.json'))) {
            // eslint-disable-next-line no-console
            console.log('\x1b[33m%s\x1b[0m', `Installing ${name} (${constraint}) in ${projectDir}...`);
        }

        fs.mkdirSync(projectDir, { recursive: true });
        fs.writeFileSync(
            path.join(projectDir, 'composer.json'),
            JSON.stringify(
                {
                    repositories: (this.composerContent.repositories ?? []).filter((repository) => repository.type !== 'path'),
                    'minimum-stability': 'dev',
                    'prefer-stable': true,
                    config: { 'allow-plugins': false },
                    require: { [name]: constraint },
                },
                null,
                4,
            ),
        );

        if (fs.existsSync(authFilePath)) {
            fs.copyFileSync(authFilePath, path.join(projectDir, 'auth.json'));
        }

        TypeDependenciesInstaller.runComposer('update', projectDir);

        return installedDir;
    };

    link = (name, targetDir) => {
        const linkPath = this.getVendorPath(name);

        if (TypeDependenciesInstaller.isSymlink(linkPath)) {
            if (fs.existsSync(linkPath) && fs.realpathSync(linkPath) === fs.realpathSync(targetDir)) {
                return;
            }

            fs.unlinkSync(linkPath);
        }

        fs.mkdirSync(path.dirname(linkPath), { recursive: true });
        fs.symlinkSync(targetDir, linkPath, 'junction');

        // eslint-disable-next-line no-console
        console.log('\x1b[32m%s\x1b[0m', `Linked ${linkPath} -> ${targetDir}`);
    };

    run = () => {
        const packages = this.getPackages();
        const versionLine = this.getVersionLine();

        if (packages.length === 0) {
            return;
        }

        if (!versionLine) {
            console.warn('\x1b[33m%s\x1b[0m', 'No "X.Y.x-dev" branch alias found in composer.json. Skipping the assets packages.');

            return;
        }

        packages.forEach((name) => {
            if (this.isForeign(this.getVendorPath(name))) {
                return;
            }

            this.link(name, this.install(name, `dev-${versionLine}-next`));
        });
    };
}
