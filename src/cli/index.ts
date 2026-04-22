import { parseArgs } from "util";
import { generateCommand } from "./commands/generate.js";

export async function runCli() {
    const args = parseArgs({
        options: {
            path: {
                type: "string",
                short: "p",
            },
            config: {
                type: "string",
                short: "c",
                description: "Path to the file exporting the oilang instance",
            },
        },
        allowPositionals: true,
    });

    const command = args.positionals[0];

    if (command === "generate") {
        await generateCommand({
            config: args.values.config,
            path: args.values.path,
        });
    } else {
        console.log(
            "Usage: bunx oilang generate --path <output-directory-or-file> [--config <path-to-config>]",
        );
    }
}
