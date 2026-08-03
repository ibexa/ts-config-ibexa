import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export default class GeneratedFilesCache {
    constructor() {
        this.cacheFilePath = path.join(GeneratedFilesCache.findNodeModulesDir(), '.cache', 'ibexa-ts-config', 'generated-files.json');
    }

    static findNodeModulesDir = () => {
        let currentDir = process.cwd();

        while (currentDir !== path.parse(currentDir).root) {
            const nodeModulesPath = path.join(currentDir, 'node_modules');

            if (fs.existsSync(nodeModulesPath)) {
                return nodeModulesPath;
            }

            currentDir = path.dirname(currentDir);
        }

        return path.join(process.cwd(), 'node_modules');
    };

    static hashContent = (content) => createHash('sha256').update(content).digest('hex');

    read = () => {
        try {
            return JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf-8'));
        } catch {
            return {};
        }
    }

    write = (cache) => {
        try {
            fs.mkdirSync(path.dirname(this.cacheFilePath), { recursive: true });
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(cache, null, 4));
        } catch {
            // Best-effort cache - failing to persist it shouldn't break the generation itself.
        }
    }

    wasFileGeneratedByThisTool = (filePath) => {
        if (!fs.existsSync(filePath)) {
            return false;
        }

        const cachedHash = this.read()[filePath];

        if (!cachedHash) {
            return false;
        }

        return cachedHash === GeneratedFilesCache.hashContent(fs.readFileSync(filePath, 'utf-8'));
    }

    rememberGeneratedFile = (filePath, content) => {
        const cache = this.read();

        cache[filePath] = GeneratedFilesCache.hashContent(content);

        this.write(cache);
    }
};
