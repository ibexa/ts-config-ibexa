import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

export default class TypeDependenciesInstaller {
    static CACHE_DIR_NAME = 'ibexa-ts-config';
    static PACKAGES = [
        { name: 'ibexa/admin-ui-assets', isRequired: () => true },
        { name: 'ibexa/headless-assets', isRequired: (composerContent) => composerContent.license === 'proprietary' },
    ];

    constructor({ rootDir, getIbexaVendorPath, update = false }) {
        this.rootDir = rootDir;
        this.getIbexaVendorPath = getIbexaVendorPath;
        this.update = update;
        this.composerContent = TypeDependenciesInstaller.readJson(path.join(rootDir, 'composer.json')) ?? {};
    }

    static getCacheDir = () => {
        const { XDG_CACHE_HOME, LOCALAPPDATA } = process.env;

        if (XDG_CACHE_HOME) {
            return path.join(XDG_CACHE_HOME, TypeDependenciesInstaller.CACHE_DIR_NAME);
        }

        if (process.platform === 'darwin') {
            return path.join(os.homedir(), 'Library', 'Caches', TypeDependenciesInstaller.CACHE_DIR_NAME);
        }

        if (process.platform === 'win32') {
            return path.join(
                LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'),
                TypeDependenciesInstaller.CACHE_DIR_NAME,
                'Cache',
            );
        }

        return path.join(os.homedir(), '.cache', TypeDependenciesInstaller.CACHE_DIR_NAME);
    };

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
        const versionLine = branchAliases.map((alias) => /^(\d+\.\d+)\.x-dev$/.exec(alias)?.[1]).find(Boolean);

        return versionLine ?? null;
    };

    getPackages = () =>
        TypeDependenciesInstaller.PACKAGES.filter(
            ({ name, isRequired }) => name !== this.composerContent.name && isRequired(this.composerContent),
        ).map(({ name }) => name);

    getVendorPath = (name) => this.getIbexaVendorPath(name.replace(/^ibexa\//, ''), true);

    getCacheProjectDir = (name, constraint) =>
        path.join(TypeDependenciesInstaller.getCacheDir(), 'packages', `${name.replace('/', '_')}@${constraint}`);

    isManagedLink = (filePath) =>
        TypeDependenciesInstaller.isSymlink(filePath) &&
        fs.existsSync(filePath) &&
        fs.realpathSync(filePath).startsWith(fs.realpathSync(TypeDependenciesInstaller.getCacheDir()));

    install = (name, constraint) => {
        const projectDir = this.getCacheProjectDir(name, constraint);
        const installedDir = path.join(projectDir, 'vendor', name);
        const isInstalled = fs.existsSync(path.join(installedDir, 'composer.json'));

        if (isInstalled && !this.update) {
            return installedDir;
        }

        // eslint-disable-next-line no-console
        console.log('\x1b[33m%s\x1b[0m', `${isInstalled ? 'Updating' : 'Installing'} ${name} (${constraint}) in ${projectDir}...`);

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

        const authFilePath = path.join(this.rootDir, 'auth.json');

        if (fs.existsSync(authFilePath)) {
            fs.copyFileSync(authFilePath, path.join(projectDir, 'auth.json'));
        }

        TypeDependenciesInstaller.runComposer(isInstalled ? 'update' : 'install', projectDir);

        return installedDir;
    };

    link = (name, targetDir) => {
        const linkPath = this.getVendorPath(name);

        if (TypeDependenciesInstaller.isSymlink(linkPath)) {
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
            const vendorPath = this.getVendorPath(name);

            if (fs.existsSync(vendorPath) && !(this.update && this.isManagedLink(vendorPath))) {
                return;
            }

            this.link(name, this.install(name, `dev-${versionLine}-next`));
        });
    };
}
