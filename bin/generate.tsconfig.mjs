#!/usr/bin/env node
import { parseArgs } from 'node:util';

import TSConfigIbexaGenerator from '../src/TSConfigIbexaGenerator.mjs';

const { values } = parseArgs({
    options: {
        'use-relative-paths': { type: 'boolean' },
        'project-root-dir': { type: 'string' },
    },
});

const TSConfigIbexaGeneratorInstance = new TSConfigIbexaGenerator({
    useRelativePaths: values['use-relative-paths'],
    projectRootDir: values['project-root-dir'],
});

if (!TSConfigIbexaGeneratorInstance.isInComposerDirectory()) {
    console.error('Error: composer.json file not found in the current directory. Please run this script from the root of your project.');
    process.exit(1);
}

try {
    TSConfigIbexaGeneratorInstance.installDependencies();
    await TSConfigIbexaGeneratorInstance.generateTSConfigFile();
} catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `Error: ${error.message}`);
    process.exit(1);
}
