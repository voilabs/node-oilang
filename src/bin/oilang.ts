#!/usr/bin/env node
import { runCli } from "../cli/index.js";

runCli().catch((err) => {
    console.error(err);
    process.exit(1);
});
