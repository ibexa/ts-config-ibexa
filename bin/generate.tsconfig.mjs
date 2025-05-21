#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const configSetupsAggregatorFilePath = './var/encore/ibexa.config.setup.js';
const configSetupsAggregatorFullFilePath = path.resolve(configSetupsAggregatorFilePath);
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
const getConfigFileContent = (filename) => {
    const configFilePath = path.resolve(filename);

    if (!fs.existsSync(configFilePath)) {
        throw new Error(`${filename} not found.`);
    }

    const content = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));

    return content;
};
const saveConfigFileContent = (filename, content) => {
    const configFilePath = path.resolve(filename);
    const contentJSON = JSON.stringify(content, null, 4);

    fs.writeFileSync(configFilePath, contentJSON);
};
const sortConfigAliases = (configContent) => {
    const { paths } = configContent.compilerOptions;
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

    config.compilerOptions.paths = paths;
};
const encoreSetupMethods = await getEncoreAliasSetupMethods();
const ibexaConfigContent = getConfigFileContent('ibexa.tsconfig.json');
const encoreAliasesList = getEncoreAliases(encoreSetupMethods);
const aliasesListMerged = mergeAliases(encoreAliasesList, ibexaConfigContent.compilerOptions?.paths ?? {});

updatePathsConfig(ibexaConfigContent, aliasesListMerged);
sortConfigAliases(ibexaConfigContent);
saveConfigFileContent('tsconfig.json', ibexaConfigContent);
