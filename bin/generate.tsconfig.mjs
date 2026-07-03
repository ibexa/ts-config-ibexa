#!/usr/bin/env node
import TSConfigIbexaGenerator from '../src/TSConfigIbexaGenerator.mjs';

const useRelativePaths = process.argv.includes('--use-relative-paths');
const configSetupsAggregatorFilePath = './var/encore/ibexa.config.setup.js';

const TSConfigIbexaGeneratorInstance = new TSConfigIbexaGenerator({
    useRelativePaths,
    configSetupsAggregatorFilePath,
});

if (!TSConfigIbexaGeneratorInstance.isInComposerDirectory()) {
    console.error('Error: composer.json file not found in the current directory. Please run this script from the root of your project.');
    process.exit(1);
}

TSConfigIbexaGeneratorInstance.installDependencies();
TSConfigIbexaGeneratorInstance.generateTSConfigFile();
