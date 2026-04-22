import { readdirSync, statSync } from "fs";
import { join } from "path";
import {
    extractSchemaNames,
    GeneratedFileInfo,
    readSource,
} from "./shared.js";
import { buildPostgreSqlFileInfo } from "./postgres.js";
import { buildDrizzleFileInfo } from "./drizzle.js";

export function getFileInfoFromSource(
    configFilePath: string,
): GeneratedFileInfo | null {
    const source = readSource(configFilePath);
    const schemaNames = extractSchemaNames(source);

    if (source.includes("new PostgreSQL(") || source.includes("PostgreSQL(")) {
        return buildPostgreSqlFileInfo(schemaNames);
    }

    const drizzleProviderMatch = source.match(
        /(?:drizzleAdapter|DrizzleAdapter)\s*\([\s\S]*?provider\s*:\s*["'](pg|mysql|sqlite)["']/s,
    );
    if (drizzleProviderMatch) {
        return buildDrizzleFileInfo(
            drizzleProviderMatch[1] as "pg" | "mysql" | "sqlite",
            schemaNames,
        );
    }

    if (
        source.includes("drizzleAdapter(") ||
        source.includes("DrizzleAdapter(")
    ) {
        return buildDrizzleFileInfo("pg", schemaNames);
    }

    return null;
}

export function getFileInfoFromProject(
    projectRoot: string,
): GeneratedFileInfo | null {
    const ignoredDirs = new Set(["node_modules", "dist", ".git", ".next"]);

    function walk(dir: string): string[] {
        const out: string[] = [];
        const entries = readdirSync(dir);
        for (const entry of entries) {
            if (ignoredDirs.has(entry)) continue;
            const fullPath = join(dir, entry);
            const st = statSync(fullPath);
            if (st.isDirectory()) {
                out.push(...walk(fullPath));
            } else if (entry.endsWith(".ts") || entry.endsWith(".js")) {
                out.push(fullPath);
            }
        }
        return out;
    }

    try {
        const files = walk(projectRoot);
        for (const file of files) {
            const info = getFileInfoFromSource(file);
            if (info) return info;
        }
    } catch (e) {
        return null;
    }

    return null;
}
