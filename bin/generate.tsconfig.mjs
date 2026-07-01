#!/usr/bin/env node
import TSConfigIbexaGenerator from '../src/TSConfigIbexaGenerator.mjs';

const useRelativePaths = process.argv.includes('--use-relative-paths');
const configSetupsAggregatorFilePath = './var/encore/ibexa.config.setup.js';

const TSConfigIbexaGeneratorInstance = new TSConfigIbexaGenerator({
    useRelativePaths,
    configSetupsAggregatorFilePath,
});

TSConfigIbexaGeneratorInstance.installDependencies();
TSConfigIbexaGeneratorInstance.generateTSConfigFile();
