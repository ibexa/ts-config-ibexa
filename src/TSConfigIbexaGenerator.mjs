import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import { execSync } from 'child_process';

import GeneratedFilesCache from './GeneratedFilesCache.mjs';

export default class TSConfigIbexaGenerator {
    static IBEXA_TSCONFIG_FILENAME = 'tsconfig.ibexa.json';

    constructor({
        useRelativePaths,
        configSetupsAggregatorFilePath,
    }) {
        this.useRelativePaths = useRelativePaths;
        this.configSetupsAggregatorFilePath = configSetupsAggregatorFilePath;
        this.configSetupsAggregatorFullFilePath = path.resolve(configSetupsAggregatorFilePath);
        this.rootDir = TSConfigIbexaGenerator.getRootDir();
        this.generatedFilesCache = new GeneratedFilesCache();
    }

    static getRootDir = () => {
        let currentDir = process.cwd();

        while (currentDir !== path.parse(currentDir).root) {
            const webpackConfigPath = path.join(currentDir, 'webpack.config.js');

            if (fs.existsSync(webpackConfigPath)) {
                return currentDir;
            }

            currentDir = path.dirname(currentDir);
        }

        return process.cwd();
    };

    static isFile = (fullPath) => fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();

    // Converts a native path (which may use "\" on Windows) to a forward-slash path, as required by glob patterns and tsconfig entries.
    static toPosixPath = (nativePath) => nativePath.split(path.sep).join('/');

    isInComposerDirectory = () => {
        const composerFilePath = path.join(process.cwd(), 'composer.json');

        return fs.existsSync(composerFilePath);
    }

    static runComposerCommand = (command) => {
        try {
            execSync(command, { stdio: 'ignore' });
        } catch (error) {
            throw new Error(`Failed to run "${command}". Make sure Composer is installed and available in your PATH.\n${error.message}`);
        }
    }

    installDependencies = () => {
        const ibexaVendorDir = this.getIbexaVendorPath('', true);

        if (this.isBundleContext() && this.isStandaloneContext() && !fs.existsSync(ibexaVendorDir)) {
            // eslint-disable-next-line no-console
            console.log('\x1b[33m%s\x1b[0m', 'Installing dependencies...');
            TSConfigIbexaGenerator.runComposerCommand('composer install');

            const adminUiAssetsDir = this.getIbexaVendorPath('admin-ui-assets', true);

            if (!fs.existsSync(adminUiAssetsDir)) {
            // eslint-disable-next-line no-console
                console.log('\x1b[33m%s\x1b[0m', 'Installing admin-ui-assets...');
                TSConfigIbexaGenerator.runComposerCommand('composer require ibexa/admin-ui-assets');
            }

            // eslint-disable-next-line no-console
            console.log('\x1b[32m%s\x1b[0m', 'Dependencies installed successfully.');
        }
    }

    getIbexaVendorPath = (filename, fullPath = false) => {
        const composerFilepath = path.join(this.rootDir, 'composer.json');
        let composerContent;

        try {
            composerContent = JSON.parse(fs.readFileSync(composerFilepath, 'utf-8'));
        } catch (error) {
            throw new Error(`Could not read or parse "${composerFilepath}": ${error.message}`);
        }

        const vendorDir = composerContent.config?.['vendor-dir'] || 'vendor';
        const relativePath = path.posix.join(vendorDir, 'ibexa', filename);

        if (fullPath) {
            return TSConfigIbexaGenerator.toPosixPath(path.resolve(this.rootDir, relativePath));
        }

        return relativePath;
    }

    isBundleContext = () => {
        const webpackConfigPath = path.join(process.cwd(), 'webpack.config.js');

        return !fs.existsSync(webpackConfigPath);
    }

    isStandaloneContext = () => this.rootDir === process.cwd();

    getRootTSConfigPath = () => {
        const tsconfigPath = path.join(this.rootDir, TSConfigIbexaGenerator.IBEXA_TSCONFIG_FILENAME);

        return this.getPath(tsconfigPath);
    }

    static getDefaultImportFromFile = (filePath) => import(path.resolve(filePath))
        .then(({ default: defaultImport }) => defaultImport)
        .catch((error) => {
            throw new Error(`Failed to import "${filePath}": ${error.message}`);
        });

    static sortConfigAliases = (pathsUnsorted = {}) => {
        const pathsSorted = Object.keys(pathsUnsorted)
            .toSorted()
            .reduce(
                (output, aliasKey) => ({
                    ...output,
                    [aliasKey]: pathsUnsorted[aliasKey],
                }),
                {},
            );

        return pathsSorted;
    };

    getEncoreAliasSetupMethods = () => {
        return new Promise((resolve) => {
            if (fs.existsSync(this.configSetupsAggregatorFullFilePath)) {
                resolve(TSConfigIbexaGenerator.getDefaultImportFromFile(this.configSetupsAggregatorFilePath));

                return;
            }

            console.warn(
                '\x1b[33m%s\x1b[0m',
                `No ${this.configSetupsAggregatorFilePath} file found. Searching for all encore config setup files in ibexa bundles...`,
            );

            return resolve(globSync(this.getIbexaVendorPath('**/encore/ibexa.config.setup.js', true)));
        }).then((configSetupFiles) => Promise.all(
            configSetupFiles.map(TSConfigIbexaGenerator.getDefaultImportFromFile),
        ));
    };

    shouldAddIndexFileToAlias = (aliasFullPath) => {
        const isFile = TSConfigIbexaGenerator.isFile(aliasFullPath);

        if (isFile) {
            return false;
        }

        const indexFilePattern = TSConfigIbexaGenerator.toPosixPath(path.join(aliasFullPath, 'index.{ts,tsx,js,jsx}'));
        const indexFileExist = globSync(indexFilePattern).length > 0;

        return indexFileExist;
    }

    getPath = (fullPath) => {
        if (this.useRelativePaths) {
            const relativePath = TSConfigIbexaGenerator.toPosixPath(path.relative(process.cwd(), fullPath));

            return `./${relativePath}`;
        }

        return TSConfigIbexaGenerator.toPosixPath(fullPath);
    }

    getEncoreAliases = async () => {
        const setupMethods = await this.getEncoreAliasSetupMethods();
        const listUnsorted = {};
        const EncoreMockup = {
            addAliases: (aliases) => {
                Object.entries(aliases).forEach(([alias, aliasFullPath]) => {
                    if (!fs.existsSync(aliasFullPath)) {
                        console.warn('\x1b[33m%s\x1b[0m', `Alias "${alias}" points to "${aliasFullPath}", which does not exist. Skipping.`);

                        return;
                    }

                    const isFile = TSConfigIbexaGenerator.isFile(aliasFullPath);
                    const aliasPath = this.getPath(aliasFullPath);

                    if (isFile) {
                        listUnsorted[alias] = [aliasPath];

                        return;
                    }

                    const shouldAddIndexFile = this.shouldAddIndexFileToAlias(aliasFullPath);

                    listUnsorted[`${alias}/*`] = [`${aliasPath}/*`];

                    if (shouldAddIndexFile) {
                        listUnsorted[alias] = [`${aliasPath}/index`];
                    }
                });
            },
        };

        setupMethods.forEach((setupMethod, index) => {
            if (typeof setupMethod !== 'function') {
                throw new Error(`Encore config setup file #${index + 1} does not have a default export that is a function.`);
            }

            setupMethod(EncoreMockup);
        });

        return TSConfigIbexaGenerator.sortConfigAliases(listUnsorted);
    };

    getTypeRoots = () => {
        return [
            `./${this.getIbexaVendorPath('admin-ui-assets/src/bundle/Resources/public/vendors/@types')}`,
            './node_modules/@types',
        ]
    }

    generateBundleTSConfigContent = async () => {
        const configFileContent = {
            include: [
                'src/bundle/**/*.ts',
                'src/bundle/**/*.tsx',
            ],
        };

        if (this.isStandaloneContext()) {
            configFileContent.extends = '@ibexa/ts-config';
            configFileContent.compilerOptions = {
                paths: await this.getEncoreAliases(),
                typeRoots: this.getTypeRoots(),
            };
        } else {
            configFileContent.extends = this.getRootTSConfigPath();
        }

        return configFileContent;
    };

    generateProjectTSConfigContent = async () => {
        const configFileContent = {
            extends: '@ibexa/ts-config',
            include: [
                this.getIbexaVendorPath('**/*'),
            ],
            exclude: [
                this.getIbexaVendorPath('**/node_modules/**/*'),
                this.getIbexaVendorPath('**/vendors/**/*'),
                this.getIbexaVendorPath('**/vendor/**/*'),
            ],
            compilerOptions: {
                paths: await this.getEncoreAliases(),
                typeRoots: this.getTypeRoots(),
            },
        };

        return configFileContent;
    };

    generateTSConfigFile = async () => {
        let configFileContent;

        if (this.isBundleContext()) {
            configFileContent = await this.generateBundleTSConfigContent();
        } else {
            configFileContent = await this.generateProjectTSConfigContent();
        }

        const tsconfigJsonPath = path.resolve('tsconfig.json');
        const hasForeignTSConfig = fs.existsSync(tsconfigJsonPath) && !this.generatedFilesCache.wasFileGeneratedByThisTool(tsconfigJsonPath);
        const configFilePath = hasForeignTSConfig ? path.resolve(TSConfigIbexaGenerator.IBEXA_TSCONFIG_FILENAME) : tsconfigJsonPath;
        const configFileContentString = JSON.stringify(configFileContent, null, 4);

        fs.writeFileSync(configFilePath, configFileContentString);
        this.generatedFilesCache.rememberGeneratedFile(configFilePath, configFileContentString);

        // eslint-disable-next-line no-console
        console.log('\x1b[32m%s\x1b[0m', `Generated ${configFilePath} successfully.`);
    }
};
