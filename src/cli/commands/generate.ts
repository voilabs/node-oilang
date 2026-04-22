import {
    writeFileSync,
    existsSync,
    statSync,
    mkdirSync,
    readFileSync,
} from "fs";
import { resolve, join, extname, dirname, relative } from "path";
import { findOilangConfig } from "../utils/config.js";
import {
    getFileInfoFromProject,
    getFileInfoFromSource,
} from "../utils/databases/index.js";

export async function generateCommand(options: {
    config?: string;
    path?: string;
}) {
    let configPath = options.config;
    let outputPath = options.path;

    const oilangConfigFilePath = resolve(process.cwd(), "oilang.config.ts");
    let savedConfig: any = {};

    if (existsSync(oilangConfigFilePath)) {
        try {
            const content = readFileSync(oilangConfigFilePath, "utf-8");
            const matchConfig = content.match(/configPath:\s*["']([^"']+)["']/);
            if (matchConfig) savedConfig.configPath = matchConfig[1];
            const matchPath = content.match(
                /(?:outputPath|output|path):\s*["']([^"']+)["']/,
            );
            if (matchPath) savedConfig.path = matchPath[1];
        } catch (e2) {}
    }

    if (!configPath) {
        if (savedConfig.configPath) {
            configPath = savedConfig.configPath;
            console.log(
                `Using configPath from oilang.config.ts: ${configPath}`,
            );
        } else if (existsSync(oilangConfigFilePath)) {
            console.error(
                "Error: Could not read 'configPath' from oilang.config.ts. Please provide it via --config or fix the configuration file.",
            );
            process.exit(1);
        } else {
            console.log(
                "No --config provided. Searching for 'export const oilang' in your project...",
            );
            const found = findOilangConfig(process.cwd());
            if (found) {
                const relativePath =
                    "./" + relative(process.cwd(), found).replace(/\\/g, "/");
                console.log(`Found OILang instance at ${relativePath}`);
                configPath = relativePath;

                const newConfigContent = `import { defineConfig } from "@voilabs/oilang";

export default defineConfig({
    configPath: "${relativePath}",
    outputPath: "./"
});
`;
                try {
                    writeFileSync(oilangConfigFilePath, newConfigContent);
                    console.log(`Created oilang.config.ts in root directory.`);
                } catch (e) {
                    console.warn("Warning: Could not save oilang.config.ts");
                }
            } else {
                console.error(
                    "Error: Could not find any file exporting 'oilang'. Please provide it manually via --config.",
                );
                process.exit(1);
            }
        }
    }

    if (!outputPath) {
        if (savedConfig.path) {
            outputPath = savedConfig.path;
            console.log(`Using path from oilang.config.ts: ${outputPath}`);
        } else {
            console.error(
                "Error: Please provide an output path using --path or -p",
            );
            console.error(
                "Usage: bunx oilang generate --path <output-directory-or-file> [--config <path-to-config>]",
            );
            process.exit(1);
        }
    }

    try {
        const absoluteConfigPath = resolve(process.cwd(), configPath as string);
        let fileInfo: any = getFileInfoFromSource(absoluteConfigPath);

        if (!fileInfo) {
            fileInfo = getFileInfoFromProject(process.cwd());
            if (fileInfo) {
                console.log(
                    "Could not resolve adapter from configPath directly, using project-wide static adapter scan fallback.",
                );
            }
        }

        if (!fileInfo) {
            console.error(
                `Error: Could not parse adapter info from ${configPath}. Ensure config includes detectable PostgreSQL/Drizzle adapter usage.`,
            );
            process.exit(1);
        }

        let content: string;
        let name: string = "oilang-schema.sql";

        if (typeof fileInfo === "string") {
            content = fileInfo;
        } else if (fileInfo && typeof fileInfo === "object") {
            content = fileInfo.content;
            name = fileInfo.name || name;
        } else {
            console.error(
                "Error: Generated schema file info has invalid format.",
            );
            process.exit(1);
            return;
        }

        let targetPath = resolve(process.cwd(), outputPath as string);

        if (existsSync(targetPath)) {
            if (statSync(targetPath).isDirectory()) {
                targetPath = join(targetPath, name);
            }
        } else {
            if (
                !extname(targetPath) ||
                (outputPath as string).endsWith("/") ||
                (outputPath as string).endsWith("\\")
            ) {
                targetPath = join(targetPath, name);
            }
        }

        try {
            const targetDir = dirname(targetPath);
            if (!existsSync(targetDir)) {
                mkdirSync(targetDir, { recursive: true });
            }

            writeFileSync(targetPath, content);
            console.log(`Schema successfully generated at ${targetPath}`);
        } catch (error: any) {
            console.error(
                `Error writing to file ${targetPath}:`,
                error.message,
            );
            process.exit(1);
        }
    } catch (err: any) {
        console.error(`Error: Failed while generating file: ${err.message}`);
        process.exit(1);
    }
}
