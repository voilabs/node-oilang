import { Client, type ClientConfig } from "pg";
import { LocaleData, TranslationData } from "../types";

type ActionResponse<T> =
    | { success: true; data: T }
    | { success: false; error: any };

class Locales {
    private schema: string;
    private client: Client;

    constructor(schema: string, client: Client) {
        this.schema = schema;
        this.client = client;
    }

    async list(): Promise<ActionResponse<LocaleData[]>> {
        try {
            const result = await this.client.query(
                `SELECT * FROM ${this.schema}`,
            );
            return { success: true, data: result.rows };
        } catch (error) {
            return { success: false, error };
        }
    }

    async create(
        locale: string,
        nativeName: string,
        englishName: string,
    ): Promise<ActionResponse<LocaleData>> {
        try {
            const existing = await this.client.query(
                `SELECT * FROM ${this.schema} WHERE code = $1`,
                [locale],
            );
            if (existing.rows.length > 0) {
                const error = new Error("Locale already exists");
                (error as any).code = "LOCALE_ALREADY_EXISTS";
                throw error;
            }

            const result = await this.client.query(
                `INSERT INTO ${this.schema} (code, native_name, english_name) VALUES ($1, $2, $3) RETURNING *`,
                [locale, nativeName, englishName],
            );
            return { success: true, data: result.rows[0] };
        } catch (error) {
            return { success: false, error };
        }
    }

    async delete(locale: string): Promise<ActionResponse<{ code: string }>> {
        try {
            await this.client.query(
                `DELETE FROM ${this.schema} WHERE code = $1`,
                [locale],
            );
            return { success: true, data: { code: locale } };
        } catch (error) {
            return { success: false, error };
        }
    }

    async update(
        locale: string,
        nativeName: string,
        englishName: string,
    ): Promise<ActionResponse<LocaleData>> {
        try {
            const result = await this.client.query(
                `UPDATE ${this.schema} SET native_name = $2, english_name = $3 WHERE code = $1 RETURNING *`,
                [locale, nativeName, englishName],
            );

            if (result.rows.length === 0) {
                const error = new Error("Locale does not exist");
                (error as any).code = "LOCALE_NOT_FOUND";
                throw error;
            }

            return { success: true, data: result.rows[0] };
        } catch (error) {
            return { success: false, error: error as any };
        }
    }
}

class Translations {
    private schema: string;
    private client: Client;
    private localesSchema: string;

    constructor(schema: string, client: Client, localesSchema: string) {
        this.schema = schema;
        this.client = client;
        this.localesSchema = localesSchema;
    }

    async list(): Promise<ActionResponse<TranslationData[]>> {
        try {
            const result = await this.client.query(
                `SELECT * FROM ${this.schema}`,
            );
            return { success: true, data: result.rows };
        } catch (error) {
            return { success: false, error };
        }
    }

    async create(
        key: string,
        value: string,
        locale: string,
    ): Promise<ActionResponse<TranslationData>> {
        try {
            const localeCheck = await this.client.query(
                `SELECT * FROM ${this.localesSchema} WHERE code = $1`,
                [locale],
            );
            if (localeCheck.rows.length === 0) {
                const error = new Error("Locale does not exist");
                (error as any).code = "LOCALE_NOT_FOUND";
                throw error;
            }

            const result = await this.client.query(
                `INSERT INTO ${this.schema} (key, value, locale_id) VALUES ($1, $2, $3) RETURNING *`,
                [key, value, locale],
            );
            return { success: true, data: result.rows[0] };
        } catch (error) {
            return { success: false, error: error as any };
        }
    }

    async delete(
        key: string,
        locale: string,
    ): Promise<ActionResponse<{ locale_id: string; key: string }>> {
        try {
            await this.client.query(
                `DELETE FROM ${this.schema} WHERE key = $1 AND locale_id = $2`,
                [key, locale],
            );
            return { success: true, data: { locale_id: locale, key } };
        } catch (error) {
            return { success: false, error };
        }
    }

    async update(
        key: string,
        value: string,
        locale: string,
    ): Promise<ActionResponse<TranslationData>> {
        try {
            const result = await this.client.query(
                `UPDATE ${this.schema} SET value = $2 WHERE key = $1 AND locale_id = $3 RETURNING *`,
                [key, value, locale],
            );

            if (result.rows.length === 0) {
                const error = new Error("Translation does not exist");
                (error as any).code = "TRANSLATION_NOT_FOUND";
                throw error;
            }

            return { success: true, data: result.rows[0] };
        } catch (error) {
            return { success: false, error: error as any };
        }
    }
}

export class PostgreSQL {
    client: Client;
    schemaNames: { keys: string; locales: string };
    public locales: Locales;
    public translations: Translations;

    constructor(
        private config: string | ClientConfig | undefined,
        customizationConfig: {
            schemaNames: { keys: string; locales: string };
        },
    ) {
        this.client = new Client(config);
        this.schemaNames = customizationConfig.schemaNames ?? {
            keys: "keys",
            locales: "locales",
        };

        this.locales = new Locales(this.schemaNames.locales, this.client);
        this.translations = new Translations(
            this.schemaNames.keys,
            this.client,
            this.schemaNames.locales,
        );
    }

    async connect() {
        await this.client.connect();

        const QUERY = `
            CREATE TABLE IF NOT EXISTS ${this.schemaNames.locales} (
                code VARCHAR(10) PRIMARY KEY,
                native_name VARCHAR(255) NOT NULL,
                english_name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ${this.schemaNames.keys} (
                key VARCHAR(255) NOT NULL,
                value TEXT NOT NULL,
                locale_id VARCHAR(10) NOT NULL,
                PRIMARY KEY (key, locale_id),
                FOREIGN KEY (locale_id) REFERENCES ${this.schemaNames.locales}(code) ON DELETE CASCADE
            );
        `;

        await this.client.query(QUERY);
    }

    getSchemaNames() {
        return this.schemaNames;
    }
}
