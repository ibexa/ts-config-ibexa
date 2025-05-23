#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const useRootProjectTSConfig = process.argv.includes('--use-root-project-tsconfig') || process.env.USE_ROOT_PROJECT_TSCONFIG === 'true';
const configSetupsAggregatorFilePath = './var/encore/ibexa.config.setup.js';
const configSetupsAggregatorFullFilePath = path.resolve(configSetupsAggregatorFilePath);
const customConfigFilePath = './custom.tsconfig.mjs';
const getDefaultImportFromFile = (filePath) => import(path.resolve(filePath)).then(({ default: defaultImport }) => defaultImport);
const getEncoreAliasSetupMethods = () => {
    return new Promise((resolve) => {
        if (fs.existsSync(configSetupsAggregatorFullFilePath)) {
            resolve(getDefaultImportFromFile(configSetupsAggregatorFilePath));

            return;
        }

        console.warn(
            '\x1b[33m%s\x1b[0m', 
            `No ${configSetupsAggregatorFilePath} file found. Searching for all encore config setup files in ibexa bundles...`,
        );

        return resolve(globSync('./vendor/ibexa/**/encore/ibexa.config.setup.js'));
    }).then((configSetupFiles) => Promise.all(
        configSetupFiles.map(getDefaultImportFromFile),
    ));
};
const getEncoreAliases = (setupMethods) => {
    const listUnsorted = {};
    const EncoreMockup = {
        addAliases: (aliases) => {
            Object.entries(aliases).forEach(([alias, aliasFullPath]) => {
                listUnsorted[`${alias}/*`] = [`${aliasFullPath}/*`];
            });
        },
    };

    setupMethods.forEach((setupMethod) => {
        setupMethod(EncoreMockup);
    });

    return listUnsorted;
};
const getConfigFileContent = (fileName) => {
    const configFilePath = path.resolve(fileName);

    if (!fs.existsSync(configFilePath)) {
        throw new Error(`${fileName} not found.`);
    }

    const content = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));

    return content;
};
const saveConfigFileContent = (fileName, content) => {
    const configFilePath = path.resolve(fileName);
    const contentJSON = JSON.stringify(content, null, 4);

    fs.writeFileSync(configFilePath, `${contentJSON}\n`, 'utf-8');
};
const sortConfigAliases = (configContent) => {
    const { paths } = configContent?.compilerOptions ?? {};

    if (!paths) {
        return;
    }

    const pathsSorted = Object.keys(paths)
        .toSorted()
        .reduce(
            (output, aliasKey) => ({
                ...output,
                [aliasKey]: paths[aliasKey],
            }),
            {},
        );

    configContent.compilerOptions.paths = pathsSorted;
};
const mergeAliases = (...aliasesLists) => {
    return Object.assign({}, ...aliasesLists);
};
const updatePathsConfig = (config, aliases) => {
    const paths = {
        ...aliases,
        ...(config.compilerOptions?.paths ?? {}),
    };

    if (Object.keys(paths).length) {
        config.compilerOptions = {
            ...config.compilerOptions ?? {},
            paths,
        };
    }
};
const updateCustomConfig = async (configContent) => {
    if (fs.existsSync(customConfigFilePath)) {
        const modifyConfig = await getDefaultImportFromFile(customConfigFilePath);

        return modifyConfig(configContent);
    }

    return configContent;
};
const findRootProjectTSConfigPath = () => {
    if (!useRootProjectTSConfig) {
        return;
    }

    let currentDir = process.cwd();

    while (currentDir !== '/') {
        const webpackConfigPath = path.join(currentDir, 'ibexa.webpack.config.js');
        const tsConfigPath = path.join(currentDir, 'tsconfig.json');

        if (fs.existsSync(webpackConfigPath) && fs.existsSync(tsConfigPath)) {
            return tsConfigPath;
        }

        currentDir = path.dirname(currentDir);
    }

    return;
};
const updateParentConfig = (configContent) => {
    if (rootProjectTSConfigPath) {
        configContent.extends = rootProjectTSConfigPath;
    }
};
let ibexaConfigContent = getConfigFileContent('ibexa.tsconfig.json');
const rootProjectTSConfigPath = findRootProjectTSConfigPath();

updateParentConfig(ibexaConfigContent, rootProjectTSConfigPath);

if (!rootProjectTSConfigPath) {
    const encoreSetupMethods = await getEncoreAliasSetupMethods();
    const encoreAliasesList = getEncoreAliases(encoreSetupMethods);
    const aliasesListMerged = mergeAliases(encoreAliasesList, ibexaConfigContent.compilerOptions?.paths ?? {});

    updatePathsConfig(ibexaConfigContent, aliasesListMerged);
}

sortConfigAliases(ibexaConfigContent);

ibexaConfigContent = await updateCustomConfig(ibexaConfigContent);

saveConfigFileContent('tsconfig.json', ibexaConfigContent);
