import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

export default class TypeDependenciesInstaller {
    static CACHE_DIR_NAME = 'ibexa-ts-config';
    static CACHE_SUBDIR_NAME = 'type-dependencies';
    static COMPOSER_EXTRA_KEY = 'ts-config';
    static VENDOR_PREFIX = 'ibexa/';

    constructor({ rootDir, getIbexaVendorPath, update = false }) {
        this.rootDir = rootDir;
        this.getIbexaVendorPath = getIbexaVendorPath;
        this.update = update;
    }

    static getUserCacheDir = () => {
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

    static slugify = (value) => value.replace(/[^a-zA-Z0-9.-]+/g, '_');

    static runComposer = (args, cwd) => {
        const command = `composer ${args} --no-interaction --no-progress --no-plugins --no-scripts --prefer-dist`;

        try {
            execSync(command, { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
        } catch (error) {
            const stderr = error.stderr?.toString().trim();

            throw new Error(`Failed to run "${command}" in "${cwd}".\n${stderr || error.message}`);
        }
    };

    getPackageVendorPath = (name) => this.getIbexaVendorPath(name.slice(TypeDependenciesInstaller.VENDOR_PREFIX.length), true);

    getCacheProjectDir = (name, constraint) =>
        path.join(
            TypeDependenciesInstaller.getUserCacheDir(),
            TypeDependenciesInstaller.CACHE_SUBDIR_NAME,
            `${TypeDependenciesInstaller.slugify(name)}@${TypeDependenciesInstaller.slugify(constraint)}`,
        );

    isManagedLink = (filePath) => {
        if (!TypeDependenciesInstaller.isSymlink(filePath) || !fs.existsSync(filePath)) {
            return false;
        }

        const cacheDir = path.join(TypeDependenciesInstaller.getUserCacheDir(), TypeDependenciesInstaller.CACHE_SUBDIR_NAME);

        return fs.realpathSync(filePath).startsWith(fs.realpathSync(cacheDir));
    };

    collect = () => {
        const vendorIbexaDir = this.getIbexaVendorPath('', true);
        const dependencies = {};

        if (!fs.existsSync(vendorIbexaDir)) {
            return dependencies;
        }

        fs.readdirSync(vendorIbexaDir).forEach((packageDirName) => {
            const composerContent = TypeDependenciesInstaller.readJson(path.join(vendorIbexaDir, packageDirName, 'composer.json'));
            const required = composerContent?.extra?.ibexa?.[TypeDependenciesInstaller.COMPOSER_EXTRA_KEY]?.require ?? {};

            Object.entries(required).forEach(([name, constraint]) => {
                if (!name.startsWith(TypeDependenciesInstaller.VENDOR_PREFIX)) {
                    console.warn(
                        '\x1b[33m%s\x1b[0m',
                        `Type dependency "${name}" declared by "${packageDirName}" is not an ${TypeDependenciesInstaller.VENDOR_PREFIX}* package. Skipping.`,
                    );

                    return;
                }

                if (dependencies[name] && dependencies[name] !== constraint) {
                    console.warn(
                        '\x1b[33m%s\x1b[0m',
                        `Type dependency "${name}" is declared as "${dependencies[name]}" and as "${constraint}" (by "${packageDirName}"). Keeping "${dependencies[name]}".`,
                    );

                    return;
                }

                dependencies[name] = constraint;
            });
        });

        return dependencies;
    };

    writeCacheProject = (projectDir, name, constraint) => {
        const rootComposerContent = TypeDependenciesInstaller.readJson(path.join(this.rootDir, 'composer.json')) ?? {};
        const repositories = (rootComposerContent.repositories ?? []).filter((repository) => repository.type !== 'path');
        const composerContent = {
            repositories,
            'minimum-stability': rootComposerContent['minimum-stability'] ?? 'dev',
            'prefer-stable': true,
            config: { 'allow-plugins': false },
            require: { [name]: constraint },
        };
        const authFilePath = path.join(this.rootDir, 'auth.json');

        fs.mkdirSync(projectDir, { recursive: true });
        fs.writeFileSync(path.join(projectDir, 'composer.json'), JSON.stringify(composerContent, null, 4));

        if (fs.existsSync(authFilePath)) {
            fs.copyFileSync(authFilePath, path.join(projectDir, 'auth.json'));
        }
    };

    install = (name, constraint) => {
        const projectDir = this.getCacheProjectDir(name, constraint);
        const installedDir = path.join(projectDir, 'vendor', name);
        const isInstalled = fs.existsSync(path.join(installedDir, 'composer.json'));

        if (isInstalled && !this.update) {
            return installedDir;
        }

        // eslint-disable-next-line no-console
        console.log(
            '\x1b[33m%s\x1b[0m',
            `${isInstalled ? 'Updating' : 'Installing'} type dependency ${name} (${constraint}) in ${projectDir}...`,
        );

        this.writeCacheProject(projectDir, name, constraint);

        if (!isInstalled) {
            fs.rmSync(path.join(projectDir, 'composer.lock'), { force: true });
        }

        TypeDependenciesInstaller.runComposer(isInstalled ? 'update' : 'install', projectDir);

        return installedDir;
    };

    link = (name, targetDir) => {
        const linkPath = this.getPackageVendorPath(name);

        if (TypeDependenciesInstaller.isSymlink(linkPath)) {
            fs.unlinkSync(linkPath);
        }

        fs.mkdirSync(path.dirname(linkPath), { recursive: true });
        fs.symlinkSync(targetDir, linkPath, 'junction');
    };

    run = () => {
        Object.entries(this.collect()).forEach(([name, constraint]) => {
            const vendorPath = this.getPackageVendorPath(name);
            const isPresent = fs.existsSync(vendorPath);

            if (isPresent && !(this.update && this.isManagedLink(vendorPath))) {
                return;
            }

            const installedDir = this.install(name, constraint);

            this.link(name, installedDir);

            // eslint-disable-next-line no-console
            console.log('\x1b[32m%s\x1b[0m', `Linked ${vendorPath} -> ${installedDir}`);
        });
    };
}
