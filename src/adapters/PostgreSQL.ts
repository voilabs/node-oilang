import { Client, type ClientConfig } from "pg";

export class PostgreSQL {
    client: Client;
    schemaNames: { keys: string; locales: string };

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
    }

    async connect() {
        await this.client.connect();

        const QUERY = [
            `CREATE SCHEMA IF NOT EXISTS ${this.schemaNames.locales};`,
            `CREATE SCHEMA IF NOT EXISTS ${this.schemaNames.keys};`,
            `
                CREATE TABLE IF NOT EXISTS ${this.schemaNames.locales} (
                    code VARCHAR(10) PRIMARY KEY,
                    native_name VARCHAR(255) NOT NULL,
                    english_name VARCHAR(255) NOT NULL
                );
            `,
            `
                CREATE TABLE IF NOT EXISTS ${this.schemaNames.keys} (
                    key VARCHAR(255) NOT NULL,
                    value TEXT NOT NULL,
                    locale_id VARCHAR(10) NOT NULL,
                    FOREIGN KEY (locale_id) REFERENCES ${this.schemaNames.locales}(code)
                );
            `,
        ];

        await this.client.query(QUERY.join("\n"));
    }

    getSchemaNames() {
        return this.schemaNames;
    }

    async addLocale(
        locale: string,
        nativeName: string,
        englishName: string,
    ): Promise<
        | {
              success: true;
              data: {
                  code: string;
                  native_name: string;
                  english_name: string;
                  created_at: string;
                  updated_at: string;
              };
          }
        | {
              success: false;
              error: any;
          }
    > {
        try {
            const existingLocale = await this.client.query(
                `SELECT * FROM ${this.schemaNames.locales} WHERE code = $1`,
                [locale],
            );

            if (existingLocale.rows.length > 0) {
                const error = new Error("Locale already exists");
                (error as any).code = "LOCALE_ALREADY_EXISTS";
                throw error;
            }

            const result = await this.client.query(
                `INSERT INTO ${this.schemaNames.locales} (code, native_name, english_name) VALUES ($1, $2, $3) RETURNING *`,
                [locale, nativeName, englishName],
            );
            return {
                success: true,
                data: result.rows.at(0),
            };
        } catch (error) {
            return {
                success: false,
                error: error,
            };
        }
    }

    async getAllLocales(): Promise<
        | {
              success: true;
              data: Array<{
                  code: string;
                  native_name: string;
                  english_name: string;
                  created_at: string;
                  updated_at: string;
              }>;
          }
        | {
              success: false;
              error: any;
          }
    > {
        try {
            const result = await this.client.query(
                `SELECT * FROM ${this.schemaNames.locales}`,
            );
            return {
                success: true,
                data: result.rows,
            };
        } catch (error) {
            return {
                success: false,
                error: error,
            };
        }
    }

    async getAllTranslations(): Promise<
        | {
              success: true;
              data: Array<{
                  locale_id: string;
                  key: string;
                  value: string;
              }>;
          }
        | {
              success: false;
              error: any;
          }
    > {
        try {
            const result = await this.client.query(
                `SELECT * FROM ${this.schemaNames.keys}`,
            );
            return {
                success: true,
                data: result.rows,
            };
        } catch (error) {
            return {
                success: false,
                error: error,
            };
        }
    }

    async deleteLocale(locale: string) {
        try {
            await this.client.query(
                `DELETE FROM ${this.schemaNames.locales} WHERE code = $1`,
                [locale],
            );
            await this.client.query(
                `DELETE FROM ${this.schemaNames.keys} WHERE locale_id = $1`,
                [locale],
            );
            return {
                success: true,
                data: {
                    code: locale,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error,
            };
        }
    }

    async addTranslation(
        locale: string,
        key: string,
        value: string,
    ): Promise<
        | {
              success: false;
              error: Error & { code: string };
          }
        | {
              success: true;
              data: {
                  locale_id: string;
                  key: string;
                  value: string;
              };
          }
    > {
        try {
            const existingTranslation = await this.client.query(
                `SELECT * FROM ${this.schemaNames.keys} WHERE locale_id = $1 AND key = $2`,
                [locale, key],
            );

            if (existingTranslation.rows.length > 0) {
                const error = new Error("Translation already exists");
                (error as any).code = "TRANSLATION_ALREADY_EXISTS";
                throw error;
            }

            const existingLocale = await this.client.query(
                `SELECT * FROM ${this.schemaNames.locales} WHERE code = $1`,
                [locale],
            );

            if (existingLocale.rows.length === 0) {
                const error = new Error("Locale does not exist");
                (error as any).code = "LOCALE_NOT_FOUND";
                throw error;
            }

            const result = await this.client.query(
                `INSERT INTO ${this.schemaNames.keys} (locale_id, key, value) VALUES ($1, $2, $3) RETURNING *`,
                [locale, key, value],
            );
            return {
                success: true,
                data: result.rows.at(0),
            };
        } catch (error) {
            return {
                success: false,
                error: error as Error & { code: string },
            };
        }
    }
}
