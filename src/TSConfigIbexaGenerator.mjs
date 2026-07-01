import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import { execSync } from 'child_process';

export default class TSConfigIbexaGenerator {
    constructor({
        useRelativePaths,
        configSetupsAggregatorFilePath,
    }) {
        this.useRelativePaths = useRelativePaths;
        this.configSetupsAggregatorFilePath = configSetupsAggregatorFilePath;
        this.configSetupsAggregatorFullFilePath = path.resolve(configSetupsAggregatorFilePath);
        this.rootDir = TSConfigIbexaGenerator.getRootDir();
    }

    static getRootDir = () => {
        let currentDir = process.cwd();

        while (currentDir !== '/') {
            const webpackConfigPath = path.join(currentDir, 'webpack.config.js');
            const tsConfigPath = path.join(currentDir, 'tsconfig.json');

            if (fs.existsSync(webpackConfigPath) && fs.existsSync(tsConfigPath)) {
                return currentDir;
            }

            currentDir = path.dirname(currentDir);
        }

        return process.cwd();
    };

    installDependencies = () => {
        const ibexaVendorDir = this.getIbexaVendorPath('', true);

        if (this.isBundleContext() && this.isStandaloneContext() && !fs.existsSync(ibexaVendorDir)) {
            console.log('\x1b[33m%s\x1b[0m', 'Installing dependencies...');
            execSync('composer install', { stdio: 'ignore' });

            const adminUiAssetsDir = this.getIbexaVendorPath('admin-ui-assets', true);

            if (!fs.existsSync(adminUiAssetsDir)) {
                console.log('\x1b[33m%s\x1b[0m', 'Installing admin-ui-assets...');
                execSync('composer require ibexa/admin-ui-assets', { stdio: 'ignore' });
            }

            console.log('\x1b[32m%s\x1b[0m', 'Dependencies installed successfully.');
        }
    }

    getIbexaVendorPath = (filename, fullPath = false) => {
        const composerFilepath = path.join(this.rootDir, 'composer.json');
        const composerContent = JSON.parse(fs.readFileSync(composerFilepath, 'utf-8'));
        const vendorDir = composerContent.config?.['vendor-dir'] || 'vendor';
        const relativePath = path.join(vendorDir, 'ibexa', filename);

        if (fullPath) {
            return path.resolve(this.rootDir, relativePath);
        }

        return relativePath;
    }

    isBundleContext = () => {
        const webpackConfigPath = path.join(process.cwd(), 'webpack.config.js');

        return !fs.existsSync(webpackConfigPath);
    }

    isStandaloneContext = () => this.rootDir === process.cwd();

    getExtendsConfigValue = () => {
        if (this.isStandaloneContext()) {
            return '@ibexa/ts-config';
        }

        const tsconfigPath = path.join(this.rootDir, '/tsconfig.ibexa.json');

        if (this.useRelativePaths) {
            const relativePath = path.relative(process.cwd(), tsconfigPath);

            return `./${relativePath}`;
        }

        return tsconfigPath;
    }

    static getDefaultImportFromFile = (filePath) => import(path.resolve(filePath)).then(({ default: defaultImport }) => defaultImport);

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

            return resolve(globSync('./vendor/ibexa/**/encore/ibexa.config.setup.js'));
        }).then((configSetupFiles) => Promise.all(
            configSetupFiles.map(TSConfigIbexaGenerator.getDefaultImportFromFile),
        ));
    };

    getEncoreAliases = async () => {
        const setupMethods = await this.getEncoreAliasSetupMethods();
        const listUnsorted = {};
        const EncoreMockup = {
            addAliases: (aliases) => {
                Object.entries(aliases).forEach(([alias, aliasFullPath]) => {
                    if (this.useRelativePaths) {
                        const relativeAliasPath = path.relative(process.cwd(), aliasFullPath);

                        listUnsorted[`${alias}/*`] = [`./${relativeAliasPath}/*`];
                        listUnsorted[alias] = [`./${relativeAliasPath}/index`];
                    } else {
                        listUnsorted[`${alias}/*`] = [`${aliasFullPath}/*`];
                        listUnsorted[alias] = [`${aliasFullPath}/index`];
                    }
                });
            },
        };

        setupMethods.forEach((setupMethod) => {
            setupMethod(EncoreMockup);
        });

        return TSConfigIbexaGenerator.sortConfigAliases(listUnsorted);
    };

    generateTSConfigFile = async () => {
        const configFileContent = {
            extends: this.getExtendsConfigValue(),
            include: [
                this.getIbexaVendorPath('**/*'),
            ],
            exclude: [
                this.getIbexaVendorPath('**/node_modules/**/*'),
                this.getIbexaVendorPath('**/vendors/**/*'),
                this.getIbexaVendorPath('**/vendor/**/*'),
            ],
        };
        const configFilePath = path.resolve('tsconfig.ibexa.json');

        if (this.isStandaloneContext()) {
            configFileContent.compilerOptions ??= {};
            configFileContent.compilerOptions.paths = await this.getEncoreAliases();
            configFileContent.compilerOptions.typeRoots = [
                `./${this.getIbexaVendorPath('admin-ui-assets/src/bundle/Resources/public/vendors/@types')}`,
                './node_modules/@types',
            ];
        }

        fs.writeFileSync(configFilePath, JSON.stringify(configFileContent, null, 4));
        console.log('\x1b[32m%s\x1b[0m', `Generated ${configFilePath} successfully.`);
    }
};
