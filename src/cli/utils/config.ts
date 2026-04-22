import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";

export function findOilangConfig(dir: string): string | null {
    try {
        const files = readdirSync(dir);
        for (const file of files) {
            if (["node_modules", "dist", ".git", ".next"].includes(file))
                continue;
            const fullPath = join(dir, file);
            if (statSync(fullPath).isDirectory()) {
                const res = findOilangConfig(fullPath);
                if (res) return res;
            } else if (file.endsWith(".ts") || file.endsWith(".js")) {
                const content = readFileSync(fullPath, "utf-8");
                if (
                    content.includes("export const oilang =") ||
                    content.includes("export const oilang=") ||
                    content.includes("module.exports = new OILang(") ||
                    content.includes("new OILang(")
                ) {
                    return fullPath;
                }
            }
        }
    } catch (e) {}
    return null;
}
