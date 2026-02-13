import type { MemoryStore } from "./stores/MemoryStore";
import type { PostgreSQL } from "./adapters/PostgreSQL";
import type { RedisStore } from "./stores/RedisStore";
import { LocaleData, TranslationData } from "./types";

type AdapterConfig = {
    database: InstanceType<typeof PostgreSQL>;
    store: InstanceType<typeof MemoryStore> | InstanceType<typeof RedisStore>;
    fallbackLocale?: string;
};

type ActionResponse<T> =
    | { error: Error & { code?: string }; data: null }
    | { error: null; data: T };

class Locale {
    private database: AdapterConfig["database"];
    private store: AdapterConfig["store"];

    constructor(
        database: AdapterConfig["database"],
        store: AdapterConfig["store"],
    ) {
        this.database = database;
        this.store = store;
    }

    async list() {
        const response = await this.store.getAll({
            seed: "locales",
        });

        return {
            error: null,
            data: response,
        };
    }

    async create(
        locale: string,
        nativeName: string,
        englishName: string,
    ): Promise<ActionResponse<LocaleData>> {
        const response = await this.database.locales.create(
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

    async delete(locale: string) {
        const response = await this.database.locales.delete(locale);

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

    async update(
        locale: string,
        nativeName: string,
        englishName: string,
    ): Promise<ActionResponse<LocaleData>> {
        const response = await this.database.locales.update(
            locale,
            nativeName,
            englishName,
        );

        if (response.success) {
            this.store.update({
                seed: "locales",
                code: locale,
                locale: {
                    native_name: nativeName,
                    english_name: englishName,
                },
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

class Translation {
    private database: AdapterConfig["database"];
    private store: AdapterConfig["store"];
    private fallbackLocale?: string;

    constructor(
        database: AdapterConfig["database"],
        store: AdapterConfig["store"],
        fallbackLocale?: string,
    ) {
        this.database = database;
        this.store = store;
        this.fallbackLocale = fallbackLocale;
    }

    async list(locale: string): Promise<ActionResponse<TranslationData[]>> {
        const response = await this.store.getAll({
            seed: "translations",
            locale,
        });

        return {
            error: null,
            data: response as any,
        };
    }

    async create(
        locale: string,
        config: { key: string; value: string },
    ): Promise<ActionResponse<TranslationData>> {
        const response = await this.database.translations.create(
            config.key,
            config.value,
            locale,
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

    async update(
        locale: string,
        key: string,
        newValue: string,
    ): Promise<ActionResponse<TranslationData>> {
        const response = await this.database.translations.update(
            key,
            newValue,
            locale,
        );

        if (response.success) {
            this.store.update({
                seed: "translations",
                locale,
                key,
                value: newValue,
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

    async delete(locale: string, key: string) {
        const response = await this.database.translations.delete(key, locale);

        if (response.success) {
            this.store.remove({
                seed: "translations",
                locale,
                key,
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

    async translate(
        locale: string,
        key: string,
        variables?: Record<string, string | number>,
    ): Promise<string> {
        let translation = await this.store.get({
            seed: "translations",
            locale,
            key,
        });

        if (!translation && this.fallbackLocale) {
            translation = await this.store.get({
                seed: "translations",
                locale: this.fallbackLocale,
                key,
            });
        }

        if (!translation) return key;

        if (variables) {
            for (const [varKey, varValue] of Object.entries(variables)) {
                translation = translation.replace(
                    new RegExp(`{{${varKey}}}`, "g"),
                    String(varValue),
                );
            }
        }

        return translation;
    }
}

export class OILang {
    private database: AdapterConfig["database"];
    private store: AdapterConfig["store"];
    private fallbackLocale: string | undefined;

    public locales: Locale;
    public translations: Translation;

    constructor(private config: AdapterConfig) {
        this.database = config.database;
        this.store = config.store;
        this.fallbackLocale = config.fallbackLocale ?? "en-US";

        this.locales = new Locale(this.database, this.store);

        this.translations = new Translation(
            this.database,
            this.store,
            this.fallbackLocale,
        );
    }

    async init(): Promise<void> {
        await this.database.connect();

        const [locales, translations] = await Promise.all([
            this.database.locales.list(),
            this.database.translations.list(),
        ]);

        if (locales.success && translations.success) {
            const loadableLocales = locales.data.map((l: any) => ({
                code: l.code,
                native_name: l.native_name,
                english_name: l.english_name,
                created_at: l.created_at,
                updated_at: l.updated_at,
            }));

            const loadableTranslations = loadableLocales.reduce(
                (acc: Record<string, Record<string, string>>, l: any) => {
                    acc[l.code] = translations.data
                        .filter((t: any) => t.locale_id === l.code)
                        .reduce(
                            (accData: Record<string, string>, t: any) => {
                                accData[t.key] = t.value;
                                return accData;
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

    async refreshCache() {
        return await this.init();
    }
}
