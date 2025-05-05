import fs from 'fs';
import path from 'path';
import process from 'process';

const isDesignSystemAlias = (alias) => alias === '@ds-assets' || alias === '@ds-components';
const getArg = (argName) => {
    const noValueArgExists = process.argv.includes(argName);

    if (noValueArgExists) {
        return true;
    }

    const argIndex = process.argv.findIndex((arg) => arg.indexOf(`${argName}=`) === 0);

    if (argIndex >= 2) {
        return process.argv[argIndex].replace(`${argName}=`, '');
    }

    return null;
};
const getRelativePath = (basePath, targetPath) => {
    const relativePath = path.relative(basePath, targetPath);

    return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
};
const getAliasesList = async () => {
    const cwd = process.cwd();
    const projectPath = getArg('--project-path') ?? cwd;
    const designSystemPath = getArg('--design-system-path');
    const relativeTo = getArg('--relative-to');
    const configSetupFiles = fs.globSync('./vendor/ibexa/**/encore/ibexa.config.setup.js', { cwd: projectPath });
    const aliasesList = {};
    const EncoreMockup = {
        addAliases: (aliases) => {
            Object.entries(aliases).forEach(([alias, aliasFullPath]) => {
                let aliasPath;

                if (isDesignSystemAlias(alias) && designSystemPath) {
                    const designSystemPackageName = alias.replace('@ds-', '');

                    aliasPath = path.resolve(designSystemPath, 'packages', designSystemPackageName, 'src');
                } else {
                    const relativeAliasPath = path.relative(cwd, aliasFullPath);
                    const absoluteAliasPath = path.resolve(projectPath, relativeAliasPath);
                    const customRelativePath = getArg('--custom-relative-path');

                    switch (relativeTo) {
                        case 'project':
                            aliasPath = getRelativePath(projectPath, absoluteAliasPath);

                            break;
                        case 'bundle':
                            aliasPath = getRelativePath(cwd, absoluteAliasPath);

                            break;
                        case 'custom':
                            aliasPath = path.join(customRelativePath, relativeAliasPath);

                            break;
                        default:
                            aliasPath = absoluteAliasPath;
                    }
                }

                aliasesList[`${alias}/*`] = [`${aliasPath}/*`];
            });
        },
    };

    await Promise.all(
        configSetupFiles.map(async (filePath) => {
            const fullFilePath = path.resolve(projectPath, filePath);
            const { default: setupMethod } = await import(fullFilePath);

            setupMethod(EncoreMockup);

            return Promise.resolve();
        }),
    );

    console.log('\x1b[32mGenerated aliases:\x1b[0m'); // eslint-disable-line no-console

    Object.entries(aliasesList).forEach(([alias, [aliasFullPath]]) => {
        const aliasName = alias.replace('/*', '');
        const aliasPath = aliasFullPath.replace('/*', '');

        console.log(`\x1b[32m  ${aliasName} -> ${aliasPath}\x1b[0m`); // eslint-disable-line no-console
    });

    return aliasesList;
};

const projectPath = getArg('--project-path') ?? process.cwd();
const tsConfigFilename = getArg('--tsconfig-filename') ?? 'tsconfig.json';
const tsconfigPath = path.resolve(projectPath, tsConfigFilename);

if (!fs.existsSync(tsconfigPath)) {
    throw new Error(`${tsConfigFilename} not found.`);
}

const tsconfigContent = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));

if (!tsconfigContent.compilerOptions) {
    tsconfigContent.compilerOptions = {};
}

tsconfigContent.compilerOptions.paths = await getAliasesList();

fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfigContent, null, 4));

console.log(`\n\x1b[32mUpdated ${tsConfigFilename} with aliases.\x1b[0m`); // eslint-disable-line no-console
