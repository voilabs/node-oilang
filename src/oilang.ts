import type { MemoryStore } from "./stores/MemoryStore";
import type { PostgreSQL } from "./adapters/PostgreSQL";
import type { RedisStore } from "./stores/RedisStore";

type AdapterConfig = {
    database: InstanceType<typeof PostgreSQL>;
    store: InstanceType<typeof MemoryStore> | InstanceType<typeof RedisStore>;
};

export class OILang {
    private database: AdapterConfig["database"];
    private store: AdapterConfig["store"];
    constructor(private config: AdapterConfig) {
        this.database = config.database;
        this.store = config.store;
    }

    async init(): Promise<void> {
        await this.database.connect();

        const [locales, translations] = await Promise.all([
            this.database.getAllLocales(),
            this.database.getAllTranslations(),
        ]);

        if (locales.success && translations.success) {
            const loadableLocales = locales.data.map((l) => ({
                code: l.code,
                native_name: l.native_name,
                english_name: l.english_name,
                created_at: l.created_at,
                updated_at: l.updated_at,
            }));

            const loadableTranslations = loadableLocales.reduce(
                (acc, l) => {
                    acc[l.code] = translations.data
                        .filter((t) => t.locale_id === l.code)
                        .reduce(
                            (acc, t) => {
                                acc[t.key] = t.value;
                                return acc;
                            },
                            {} as Record<string, string>,
                        );
                    return acc;
                },
                {} as Record<string, Record<string, string>>,
            );

            await this.store.load(loadableLocales, loadableTranslations);
        } else {
            throw new Error("Failed to load locales or translations");
        }
    }

    async createLocale(
        locale: string,
        nativeName: string,
        englishName: string,
    ): Promise<
        | {
              error: Error & { code: string };
              data: null;
          }
        | {
              error: null;
              data: {
                  code: string;
                  native_name: string;
                  english_name: string;
                  created_at: string;
                  updated_at: string;
              };
          }
    > {
        const response = await this.database.addLocale(
            locale,
            nativeName,
            englishName,
        );

        if (response.success) {
            this.store.set({
                seed: "locales",
                locale: response.data,
            });

            return {
                error: null,
                data: response.data,
            };
        } else {
            return {
                error: response.error,
                data: null,
            };
        }
    }

    async deleteLocale(locale: string) {
        const response = await this.database.deleteLocale(locale);

        if (response.success) {
            this.store.remove({
                seed: "locales",
                locale,
            });
            return {
                error: null,
                data: response.data,
            };
        } else {
            return {
                error: response.error,
                data: null,
            };
        }
    }

    async getAllLocales() {
        const response = await this.store.getAll({
            seed: "locales",
        });

        return {
            error: null,
            data: response,
        };
    }

    async getAllTranslations(locale: string) {
        const response = await this.store.getAll({
            seed: "translations",
            locale,
        });

        return response;
    }

    async addTranslation(
        locale: string,
        config: { key: string; value: string },
    ): Promise<
        | {
              error: Error & { code: string };
              data: null;
          }
        | {
              error: null;
              data: {
                  locale_id: string;
                  key: string;
                  value: string;
              };
          }
    > {
        const response = await this.database.addTranslation(
            locale,
            config.key,
            config.value,
        );

        if (response.success) {
            this.store.set({
                seed: "translations",
                locale,
                key: config.key,
                value: config.value,
            });
            return {
                error: null,
                data: response.data,
            };
        } else {
            return {
                error: response.error,
                data: null,
            };
        }
    }
}
