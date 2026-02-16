# OILang

OILang is a robust internationalization (i18n) handling library designed for performance and flexibility. It employs a dual-layer architecture, utilizing a persistent database as the source of truth and a high-performance in-memory or Redis-based store for fast runtime access. This ensures that your application remains responsive while maintaining data integrity and persistence.

## Features

- **Dual-Layer Architecture**: Combines persistent storage with fast caching.
- **Flexible Storage**: Choose between in-memory storage for simple use cases or Redis for distributed systems.
- **Customizable Schemas**: Configurable database schema names to fit existing database structures.
- **Type-Safe**: Built with TypeScript for reliable development.

## Installation

To use OILang, you need to install the package and its peer dependencies.

```bash
bun add @voilabs/oilang
```

## Usage

Here is a basic example of how to initialize and use OILang within your application.

```typescript
import { OILang } from "@voilabs/oilang";
import { PostgreSQL } from "@voilabs/oilang/adapters";
import { MemoryStore } from "@voilabs/oilang/stores";

// Initialize the library
const oilang = new OILang({
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

async function main() {
    // Connect to database and load data into store
    await oilang.init();

    // Create a new locale
    await oilang.locales.create("en-US", "English (US)", "English");

    // Add a translation key
    await oilang.translations.create("en-US", {
        key: "greeting",
        value: "Hello, World!",
    });

    // Retrieve translations
    // Example: Translations are stored in memory or Redis as a key-value pair.
    const translations = await oilang.translations.list("en-US");
    console.log(translations);
}

main();
```

## API Reference

### OILang

The main entry point for the library. It orchestrates the interaction between the database adapter and the store, delegating specific operations to `locales` and `translations` namespaces.

#### Constructor

```typescript
new OILang(config: AdapterConfig)
```

- `config`: Configuration object containing initialized `database` and `store` instances.

#### Methods

- **`init(): Promise<void>`**
  Connects to the database and initializes the store by loading existing locales and translations.

- **`refreshCache(): Promise<void>`**
  Refreshes the internal cache by reloading data from the database.

#### Namespaces

- **`oilang.locales`**: Manages locale operations.
- **`oilang.translations`**: Manages translation operations.

### Locales

Access via `oilang.locales`.

#### Methods

- **`list(): Promise<ActionResponse<LocaleData[]>>`**
  Retrieves all available locales from the store.

- **`create(locale: string, nativeName: string, englishName: string): Promise<ActionResponse<LocaleData>>`**
  Creates a new locale in the database and updates the store.

- **`delete(locale: string): Promise<ActionResponse<LocaleData>>`**
  Deletes a locale and its associated translations from both the database and the store.

- **`update(locale: string, nativeName: string, englishName: string): Promise<ActionResponse<LocaleData>>`**
  Updates locale information in the database and store.

### Translations

Access via `oilang.translations`.

#### Methods

- **`list(locale: string): Promise<Record<string, string>>`**
  Retrieves all translations for a specific locale from the store. Returns a key-value map.

- **`create(locale: string, config: { key: string; value: string }): Promise<ActionResponse<TranslationData>>`**
  Adds a translation key-value pair for a specific locale.

- **`update(locale: string, key: string, newValue: string): Promise<ActionResponse<TranslationData>>`**
  Updates an existing translation value.

- **`delete(locale: string, key: string): Promise<ActionResponse<TranslationData>>`**
  Deletes a translation key.

- **`translate(locale: string, key: string, variables?: Record<string, string | number>): Promise<string>`**
  Retrieves a single translation, optionally performing variable interpolation. Uses fallback locale if translation is missing.

### Adapters

#### PostgreSQL

Handles persistent storage of locales and translations.

**Constructor**

```typescript
new PostgreSQL(connectionString: string | ClientConfig, config: { schemaNames: { keys: string; locales: string } })
```

- `connectionString`: PostgreSQL connection string or configuration object.
- `config.schemaNames`: Custom table names for keys and locales.

### Stores

Stores handle the runtime access to data. They act as a cache that is synchronized with the database.

#### MemoryStore

Stores data in the application's memory. Suitable for single-instance applications or development.

**Constructor**

```typescript
new MemoryStore();
```

#### RedisStore

Stores data in a Redis instance. Essential for distributed applications or when data persistence across restarts (without DB reload) is desired.

**Constructor**

```typescript
new RedisStore(connectionString: string, options?: { prefix?: string })
```

- `connectionString`: Redis connection URL (default: `redis://localhost:6379`).
- `options.prefix`: specific prefix for Redis keys (default: `oilang:`).

## Frameworks Support

OILang provides built-in handlers to easily integrate with popular web frameworks.

### Elysia.js

The `elysiaHandler` allows you to expose RESTful API endpoints for managing locales and translations directly from your Elysia application.

#### Usage

```typescript
import { Elysia } from "elysia";
import { elysiaHandler } from "@voilabs/oilang/handlers";

const app = new Elysia()
    .use(elysiaHandler(oilang)) // oilang instance
    .get("/", ({ locale }) => {
        return `Current locale: ${locale}`;
    })
    .listen(3000);
```

#### Context & Derive

The handler enriches the Elysia context:

- **State**: Adds `locale` to the global state (`store.locale`).
- **Derive**: Automatically detects `?locale=code` in query parameters and updates `store.locale` for the requests.

#### API Endpoints

The handler exposes the following endpoints under the `/oilang` prefix:

> **Note**: Endpoints marked with `*` support the `onAuthHandle` hook for authentication.

##### Locales

- **`POST /oilang/set-locale`**
  Sets the current locale for the session/request.
    - **Body**: `{ locale: string }`

- **`GET /oilang/locales`**
  List all available locales.

- **`POST /oilang/locales`** \*
  Create a new locale.
    - **Body**:
        ```typescript
        {
            locale: string;
            native_name: string;
            english_name: string;
        }
        ```

- **`PUT /oilang/locales/:localeCode`** \*
  Update an existing locale.
    - **Params**: `localeCode` (string)
    - **Body**:
        ```typescript
        {
            native_name: string;
            english_name: string;
        }
        ```

- **`DELETE /oilang/locales/:locale`** \*
  Delete a locale.
    - **Params**: `locale` (string)

##### Translations

- **`GET /oilang/translations/:locale`**
  Get translations for a specific locale.
    - **Params**: `locale` (string)
    - **Query**: `format` (optional, "true" for nested JSON)

- **`POST /oilang/translations/:locale`** \*
  Add multiple translations.
    - **Params**: `locale` (string)
    - **Body**:
        ```typescript
        {
            translations: {
                key: string;
                value: string;
            }
            [];
        }
        ```

- **`PUT /oilang/translations/:locale`** \*
  Update multiple translations.
    - **Params**: `locale` (string)
    - **Body**:
        ```typescript
        {
            translations: {
                key: string;
                value: string;
            }
            [];
        }
        ```

- **`DELETE /oilang/translations/:locale`** \*
  Delete multiple translations.
    - **Params**: `locale` (string)
    - **Body**:
        ```typescript
        {
            translations: {
                key: string;
            }
            [];
        }
        ```

##### System

- **`POST /oilang/refresh`** \*
  Refresh the internal cache from the database.

#### Options

You can pass an optional configuration object to `elysiaHandler`:

```typescript
elysiaHandler(oilang, {
    onAuthHandle: async ({ request }) => {
        // Implement authentication logic here
    },
});
```

- `onAuthHandle`: A hook to run before handling requests, useful for authentication.

## Database Schema

The Database adapter automatically creates the necessary tables if they do not exist.

### Locales Table

Stores information about supported languages.

- `code` (Primary Key): The locale code (e.g., "en-US").
- `native_name`: Name of the language in its own script.
- `english_name`: Name of the language in English.
- `created_at`: Timestamp of creation.
- `updated_at`: Timestamp of last update.

### Keys Table

Stores the translation strings.

- `id` (Primary Key): Unique identifier.
- `key`: The translation key (e.g., "homepage.title").
- `value`: The translated string.
- `locale_id` (Foreign Key): References `Locales(code)`.

## Return Types

Most methods return a result object pattern to handle errors gracefully without throwing.

```typescript
type ActionResponse<T> =
    | { error: Error & { code?: string }; data: null }
    | { error: null; data: T };
```

## Utils

OILang provides utility functions to help with string manipulation for i18n.

### Wrap & Unwrap

Helper functions to handle multi-language strings formats used in some legacy systems or specific storage patterns.

#### `wrap(locales: Record<string, string>): string`

Wraps a dictionary of locale-value pairs into a single string format `<locale>value</locale>`.

```typescript
import { wrap } from "@voilabs/oilang/utils";

const wrapped = wrap({
    "en-US": "Hello",
    "tr-TR": "Merhaba",
});
// Output: "<en-US>Hello</en-US><tr-TR>Merhaba</tr-TR>"
```

#### `unwrap(string: string, locale: string, fallbackLocale?: string): string`

Extracts the value for a specific locale from a wrapped string.

```typescript
import { unwrap } from "@voilabs/oilang/utils";

const value = unwrap("<en-US>Hello</en-US><tr-TR>Merhaba</tr-TR>", "tr-TR");
// Output: "Merhaba"
```
