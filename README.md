<div align="center">

# OILang

**A robust internationalization (i18n) library for Node.js & Bun — built for performance, flexibility and DX.**

[![npm](https://img.shields.io/badge/npm-%40voilabs%2Foilang-red)](https://www.npmjs.com/package/@voilabs/oilang)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

</div>

---

OILang is a dual-layer i18n engine: a **persistent adapter** (PostgreSQL / Drizzle ORM) acts as the source of truth, while a **runtime store** (Memory / Redis) provides fast access during request handling.

It ships with a first-class **CLI** (`bunx oilang generate`), built-in **framework handlers** (Elysia), and a fully typed API.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI](#cli)
- [Configuration File](#configuration-file)
- [API Reference](#api-reference)
- [Adapters](#adapters)
- [Stores](#stores)
- [Elysia Handler](#elysia-handler)
    - [API Endpoints](#api-endpoints)
- [Utils](#utils)
- [Troubleshooting](#troubleshooting)
- [Changelog](#changelog)

---

## Features

- Dual-layer architecture (persistent DB + runtime cache)
- PostgreSQL and Drizzle ORM adapters (`pg`, `mysql`, `sqlite`)
- CLI schema generator (SQL or Drizzle schema files)
- First-class TypeScript types
- Pluggable stores: `MemoryStore`, `RedisStore`
- Built-in Elysia handler with ready-to-use REST endpoints

---

## Installation

```bash
bun add @voilabs/oilang
```

Or with npm:

```bash
npm install @voilabs/oilang
```

---

## Quick Start

### PostgreSQL + MemoryStore

```ts
import { OILang } from "@voilabs/oilang";
import { PostgreSQL } from "@voilabs/oilang/adapters";
import { MemoryStore } from "@voilabs/oilang/stores";

export const oilang = new OILang({
    database: new PostgreSQL(
        "postgresql://user:password@localhost:5432/dbname",
        {
            schemaNames: {
                keys: "i18n_keys",
                locales: "i18n_locales",
            },
        },
    ),
    store: new MemoryStore(),
});

await oilang.init();
```

### Drizzle + RedisStore

```ts
import { OILang } from "@voilabs/oilang";
import { DrizzleAdapter } from "@voilabs/oilang/adapters";
import { RedisStore } from "@voilabs/oilang/stores";
import { db } from "./db";

export const oilang = new OILang({
    database: new DrizzleAdapter(db, {
        provider: "pg", // "pg" | "mysql" | "sqlite"
        schemaNames: {
            keys: "i18n_keys",
            locales: "i18n_locales",
        },
    }),
    store: new RedisStore(process.env.REDIS_URL!),
});

await oilang.init();
```

---

## CLI

OILang ships with a CLI that statically analyzes your config and generates schema files.

### Command

```bash
bunx oilang generate --path <output-file-or-directory> --config <path-to-oilang-config>
```

### Examples

Generate a Drizzle schema file:

```bash
bunx oilang generate \
  --path ./src/server/drizzle/oilang-schema.ts \
  --config ./src/server/lib/oilang.ts
```

Generate into a directory (auto-picks file name):

```bash
bunx oilang generate --path ./database
```

If `--config` is omitted, CLI will:

1. Read from `oilang.config.ts` if available.
2. Otherwise search the project for a file exporting `oilang` and create a config for you.

---

## Configuration File

OILang uses an optional `oilang.config.ts` at project root:

```ts
import { defineConfig } from "@voilabs/oilang";

export default defineConfig({
    configPath: "./src/server/lib/oilang.ts",
    outputPath: "./src/server/drizzle/oilang-schema.ts",
});
```

Supported keys:

| Key          | Description                                     |
| ------------ | ----------------------------------------------- |
| `configPath` | Path to the file exporting your OILang instance |
| `outputPath` | Destination for generated schema file           |
| `output`     | Alias for `outputPath`                          |
| `path`       | Alias for `outputPath`                          |

---

## API Reference

### `OILang`

Main entry point. Orchestrates the adapter and the store.

| Method           | Description                                     |
| ---------------- | ----------------------------------------------- |
| `init()`         | Connect the adapter and hydrate the store cache |
| `refreshCache()` | Reload all locales/translations into the store  |
| `getAdapter()`   | Return the configured database adapter instance |
| `locales`        | Locale management namespace                     |
| `translations`   | Translation management namespace                |

### `oilang.locales`

| Method                                                                              | Description        |
| ----------------------------------------------------------------------------------- | ------------------ |
| `list()`                                                                            | List all locales   |
| `create({ locale, nativeName, englishName, isDefault?, translationsFromDefault? })` | Create a locale    |
| `update(locale, nativeName, englishName, isDefault?)`                               | Update locale info |
| `delete(locale)`                                                                    | Delete a locale    |

### `oilang.translations`

| Method                               | Description                                       |
| ------------------------------------ | ------------------------------------------------- |
| `list(locale)`                       | List all translations for a locale                |
| `create(locale, { key, value })`     | Add a translation                                 |
| `update(locale, key, newValue)`      | Update a translation                              |
| `delete(locale, key)`                | Delete a translation                              |
| `translate(locale, key, variables?)` | Resolve a translation (with variables + fallback) |

---

## Adapters

### `PostgreSQL`

Uses the `pg` library and manages tables on `connect()` via `CREATE TABLE IF NOT EXISTS`.

```ts
new PostgreSQL(connectionString, {
    schemaNames: { keys: "i18n_keys", locales: "i18n_locales" },
});
```

### `DrizzleAdapter`

Works with the Drizzle ORM. Supports PostgreSQL, MySQL and SQLite providers.

```ts
new DrizzleAdapter(db, {
    provider: "pg", // "pg" | "mysql" | "sqlite"
    schemaNames: { keys: "i18n_keys", locales: "i18n_locales" },
    schemas: { locales, translations }, // optional; auto-detected otherwise
});
```

- `schemas` is optional. When omitted, OILang tries to discover tables via Drizzle internals.
- CLI generates a matching Drizzle schema file so you can import it back into your project.

---

## Stores

### `MemoryStore`

Fast in-process cache — ideal for single-node apps and development.

```ts
new MemoryStore();
```

### `RedisStore`

Shared cache for distributed deployments.

```ts
new RedisStore(connectionString, { prefix?: "oilang:" });
```

---

## Elysia Handler

Mount OILang as a ready-to-use Elysia module:

```ts
import { Elysia } from "elysia";
import { elysiaHandler } from "@voilabs/oilang/handlers";

new Elysia()
    .use(
        elysiaHandler(oilang, {
            onAuthHandle: async ({ request }) => {
                // optional auth pre-handler
            },
        }),
    )
    .listen(3000);
```

### API Endpoints

All endpoints are mounted under the `/oilang` prefix.  
Endpoints marked `🔒` support the optional `onAuthHandle` hook.

#### Locales

| Method   | Route                         | Description            |
| -------- | ----------------------------- | ---------------------- |
| `GET`    | `/oilang/locales`             | List all locales       |
| `POST`   | `/oilang/locales`             | Create a new locale 🔒 |
| `PUT`    | `/oilang/locales/:localeCode` | Update a locale 🔒     |
| `DELETE` | `/oilang/locales/:locale`     | Delete a locale 🔒     |

**`POST /oilang/locales`** body:

```json
{
    "locale": "en-US",
    "native_name": "English",
    "english_name": "English",
    "is_default": true,
    "translations_from_default": false
}
```

**`PUT /oilang/locales/:localeCode`** body:

```json
{
    "native_name": "English",
    "english_name": "English"
}
```

#### Translations

| Method   | Route                          | Description                                            |
| -------- | ------------------------------ | ------------------------------------------------------ |
| `GET`    | `/oilang/translations/:locale` | Fetch translations. `?format=true` returns nested JSON |
| `POST`   | `/oilang/translations/:locale` | Add multiple translations 🔒                           |
| `PUT`    | `/oilang/translations/:locale` | Update multiple translations 🔒                        |
| `DELETE` | `/oilang/translations/:locale` | Delete multiple translations 🔒                        |

**`POST` / `PUT` body:**

```json
{
    "translations": [
        { "key": "home.title", "value": "Welcome" },
        { "key": "home.subtitle", "value": "Hello there" }
    ]
}
```

**`DELETE` body:**

```json
{
    "translations": [{ "key": "home.title" }]
}
```

#### Session

| Method | Route                | Description                          |
| ------ | -------------------- | ------------------------------------ |
| `POST` | `/oilang/set-locale` | Set the active locale on the session |

Body:

```json
{ "locale": "en-US" }
```

#### System

| Method | Route             | Description                           |
| ------ | ----------------- | ------------------------------------- |
| `POST` | `/oilang/refresh` | Refresh the internal cache from DB 🔒 |

---

## Utils

### `wrap(locales: Record<string, string>): string`

```ts
import { wrap } from "@voilabs/oilang/utils";

wrap({ "en-US": "Hello", "tr-TR": "Merhaba" });
// => "<en-US>Hello</en-US><tr-TR>Merhaba</tr-TR>"
```

### `unwrap(string, locale, fallbackLocale?): string`

```ts
import { unwrap } from "@voilabs/oilang/utils";

unwrap("<en-US>Hello</en-US><tr-TR>Merhaba</tr-TR>", "tr-TR");
// => "Merhaba"
```

### `unwrapObject(string): Record<string, string>`

```ts
import { unwrapObject } from "@voilabs/oilang/utils";

unwrapObject("<en-US>Hello</en-US><tr-TR>Merhaba</tr-TR>");
// => { "en-US": "Hello", "tr-TR": "Merhaba" }
```

---

## Troubleshooting

- If the CLI cannot resolve your config, check `configPath` inside `oilang.config.ts`.
- When CLI runtime import fails, it falls back to static source analysis automatically.
- Missing `schemaNames`? Use explicit string literals in your config so the analyzer can detect them.
- On Windows, CLI internally uses proper file URLs for path compatibility.

---

## Changelog

### [0.0.35] - 2026-04-22

#### Changed

- **CLI Internal Refactor (`src/cli`)**:
    - Database schema generation logic was split into dedicated modules under `src/cli/utils/databases/`.
    - `generate` command now uses modular static-analysis helpers (`drizzle`, `postgres`, `shared`, `index`).
- **Adapter Contract Simplification**:
    - Removed `getFileInfo()` requirement from the adapter interface and implementations.
    - Schema generation is now fully handled by CLI static analysis.

#### Fixed

- **PostgreSQL Runtime Bootstrap (`src/adapters/PostgreSQL.ts`)**:
    - Restored `CREATE TABLE IF NOT EXISTS` flow inside `connect()` so PostgreSQL users keep auto-init behavior.

### [0.0.34] - 2026-04-22

#### Fixed

- Improved `schemaNames` parsing for more robust `keys`/`locales` detection.
- PostgreSQL fallback generation now better respects custom `schemaNames`.

### [0.0.33] - 2026-04-22

#### Fixed

- Resilient config loading for CLI: `import` → `require` → static source-analysis fallback.
- Better schema generation reliability for `PostgreSQL` and `drizzleAdapter` configs.

### [0.0.32] - 2026-04-22

#### Changed

- Safer config loading flow (ESM/CJS compatibility).
- Better `oilang.config.ts` handling (`configPath`, `outputPath`, `output`, `path`).
- CLI refactored into modular folders (`commands`, `utils`, `index`).

### [0.0.31] - 2026-04-22

#### Changed

- Added `defineConfig(...)` helper and extended config keys.

### [0.0.30] - 2026-04-22

#### Fixed

- Windows config import path compatibility using proper file URL conversion.

### [0.0.29] - 2026-04-22

#### Added

- Drizzle adapter: optional `schemas` + automatic schema discovery.

### [0.0.28] - 2026-04-22

#### Changed

- Standardized adapter file generation via `{ content, name }`.
- Improved output target resolution.

### [0.0.27] - 2026-04-22

#### Added

- Drizzle ORM support (`src/adapters/Drizzle.ts`).
- CLI generator (`bunx oilang generate`).

### [0.0.25] - 2026-02-17

#### Added

- Initial public release (`OILang`, locale/translation APIs, stores, utilities).
