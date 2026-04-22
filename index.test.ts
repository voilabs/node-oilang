import { PostgreSQL } from "./src/adapters/PostgreSQL";
import { DrizzleAdapter } from "./src/adapters/Drizzle";
import { OILang } from "./src/index";
import { MemoryStore } from "./src/stores/MemoryStore";

const adapter = new OILang({
    database: new DrizzleAdapter(process.env.POSTGRES_URL!, {
        provider: "pg",
        schemaNames: {
            keys: "keys",
            locales: "locales",
        },
    }),
    store: new MemoryStore(),
});

await adapter.init();

console.log(await adapter.locales.list());

// await adapter.locales.create({
//     locale: "tr-TR",
//     nativeName: "Türkçe",
//     englishName: "Turkish",
//     isDefault: true,
// });
// await adapter.translations.create("tr-TR", { key: "abc", value: "dfe" });
// await adapter.locales.create({
//     locale: "en-US",
//     nativeName: "English (US)",
//     englishName: "English (US)",
//     translationsFromDefault: true,
// });
