#!/usr/bin/env node
import TSConfigIbexaGenerator from '../src/TSConfigIbexaGenerator.mjs';

const useRelativePaths = process.argv.includes('--use-relative-paths');
const projectRootDir = process.argv.find(arg => arg.startsWith('--project-root-dir='))?.split('=')[1];

const TSConfigIbexaGeneratorInstance = new TSConfigIbexaGenerator({
    useRelativePaths,
    projectRootDir,
});

if (!TSConfigIbexaGeneratorInstance.isInComposerDirectory()) {
    console.error('Error: composer.json file not found in the current directory. Please run this script from the root of your project.');
    process.exit(1);
}

TSConfigIbexaGeneratorInstance.installDependencies();
TSConfigIbexaGeneratorInstance.generateTSConfigFile();
