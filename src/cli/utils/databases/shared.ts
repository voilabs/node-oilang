import { readFileSync } from "fs";

export type GeneratedFileInfo = { content: string; name: string };

export function extractSchemaNames(source: string): {
    locales: string;
    keys: string;
} {
    const schemaBlockMatch = source.match(/schemaNames\s*:\s*\{([\s\S]*?)\}/s);
    if (!schemaBlockMatch) {
        return { locales: "locales", keys: "keys" };
    }

    const schemaBlock = schemaBlockMatch[1];
    const keysMatch = schemaBlock.match(/\bkeys\s*:\s*["'`]([^"'`]+)["'`]/);
    const localesMatch = schemaBlock.match(
        /\blocales\s*:\s*["'`]([^"'`]+)["'`]/,
    );

    return {
        keys: keysMatch?.[1] ?? "keys",
        locales: localesMatch?.[1] ?? "locales",
    };
}

export function readSource(configFilePath: string): string {
    return readFileSync(configFilePath, "utf-8");
}
