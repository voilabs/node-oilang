import type { MemoryStore } from "./stores/MemoryStore";
import type { DatabaseAdapter } from "./types";
import type { RedisStore } from "./stores/RedisStore";
import { LocaleData, TranslationData } from "./types";

type AdapterConfig = {
    database: DatabaseAdapter;
    store: InstanceType<typeof MemoryStore> | InstanceType<typeof RedisStore>;
    fallbackLocale?: string;
    throwOnInitError?: boolean;
};

type ActionResponse<T> =
    | { error: Error & { code?: string }; data: null }
    | { error: null; data: T };

type OILangStatus = {
    initialized: boolean;
    databaseAvailable: boolean;
    storeLoaded: boolean;
    lastError?: Error;
};

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

function getResponseError(response: { success: boolean; error?: unknown }) {
    return !response.success && response.error
        ? toError(response.error)
        : undefined;
}

const warningCache = new Map<string, string>();

function warn(context: string, error: unknown) {
    const message = toError(error).message;
    if (warningCache.get(context) === message) return;

    warningCache.set(context, message);
    console.warn(`[OILang] ${context}: ${message}`);
}

function errorResponse<T>(error: unknown): ActionResponse<T> {
    return {
        error: toError(error) as Error & { code?: string },
        data: null,
    };
}

async function tryStore(operation: () => Promise<unknown>, context: string) {
    try {
        await operation();
    } catch (error) {
        warn(context, error);
    }
}

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

    async list(): Promise<ActionResponse<Array<LocaleData & {
        percent: number;
        total_translations: number;
    }>>> {
        try {
            const response = (await this.store.getAll({
                seed: "locales",
            })) as LocaleData[];

            const defaultLocale = response.find((e) => e.is_default);
            const defaultTranslations = defaultLocale
                ? ((await this.store.getAll({
                      seed: "translations",
                      locale: defaultLocale.code,
                  })) as Record<string, string>)
                : {};

            const res = await Promise.all(
                response.map(async (locale) => {
                    const translations = (await this.store.getAll({
                        seed: "translations",
                        locale: locale.code,
                    })) as Record<string, string>;

                    const keys = Object.keys(defaultTranslations);
                    const totalCount = keys.length;

                    if (totalCount === 0) {
                        return { ...locale, percent: 0, total_translations: 0 };
                    }

                    if (locale.is_default) {
                        return {
                            ...locale,
                            percent: 100,
                            total_translations: totalCount,
                        };
                    }

                    const translatedCount = keys.filter((key) => {
                        const defaultValue = defaultTranslations[key];
                        const currentValue = translations[key];

                        return currentValue && currentValue !== defaultValue;
                    }).length;

                    const percent = (translatedCount / totalCount) * 100;

                    return {
                        ...locale,
                        percent: Math.round(percent),
                        total_translations: totalCount,
                    };
                }),
            );

            return {
                error: null,
                data: res,
            };
        } catch (error) {
            warn("Locale cache could not be read", error);
            return errorResponse(error);
        }
    }

    async create({
        locale,
        nativeName,
        englishName,
        translationsFromDefault = false,
        isDefault = false,
    }: {
        locale: string;
        nativeName: string;
        englishName: string;
        translationsFromDefault?: boolean;
        isDefault?: boolean;
    }): Promise<ActionResponse<LocaleData>> {
        try {
            const response = await this.database.locales.create(
                locale,
                nativeName,
                englishName,
                isDefault,
            );

            if (!response.success) {
                return {
                    error: response.error,
                    data: null,
                };
            }

            await tryStore(
                () =>
                    this.store.set({
                        seed: "locales",
                        locale: response.data,
                    }),
                "Locale cache could not be updated",
            );

            if (translationsFromDefault) {
                const defaultLocale = await this.database.locales.getDefault();
                if (defaultLocale.success) {
                    const translations = await this.database.translations.list(
                        defaultLocale.data.code,
                    );
                    if (translations.success) {
                        for (const translation of translations.data) {
                            const created =
                                await this.database.translations.create(
                                    translation.key,
                                    translation.value,
                                    response.data.code,
                                );

                            if (!created.success) continue;

                            await tryStore(
                                () =>
                                    this.store.set({
                                        seed: "translations",
                                        locale: response.data.code,
                                        key: translation.key,
                                        value: translation.value,
                                    }),
                                "Translation cache could not be updated",
                            );
                        }
                    }
                }
            }

            return {
                error: null,
                data: response.data,
            };
        } catch (error) {
            warn("Locale create failed", error);
            return errorResponse(error);
        }
    }

    async delete(locale: string) {
        try {
            const response = await this.database.locales.delete(locale);

            if (!response.success) {
                return {
                    error: response.error,
                    data: null,
                };
            }

            await tryStore(
                () =>
                    this.store.remove({
                        seed: "locales",
                        locale,
                    }),
                "Locale cache could not be removed",
            );

            return {
                error: null,
                data: response.data,
            };
        } catch (error) {
            warn("Locale delete failed", error);
            return errorResponse(error);
        }
    }

    async update(
        locale: string,
        nativeName: string,
        englishName: string,
        isDefault?: boolean,
    ): Promise<ActionResponse<LocaleData>> {
        try {
            const response = await this.database.locales.update(
                locale,
                nativeName,
                englishName,
                isDefault,
            );

            if (!response.success) {
                return {
                    error: response.error,
                    data: null,
                };
            }

            await tryStore(
                () =>
                    this.store.update({
                        seed: "locales",
                        code: locale,
                        locale: {
                            native_name: nativeName,
                            english_name: englishName,
                            is_default: isDefault ?? response.data.is_default,
                        },
                    }),
                "Locale cache could not be updated",
            );

            return {
                error: null,
                data: response.data,
            };
        } catch (error) {
            warn("Locale update failed", error);
            return errorResponse(error);
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
        try {
            const response = await this.store.getAll({
                seed: "translations",
                locale,
            });

            return {
                error: null,
                data: response as any,
            };
        } catch (error) {
            warn("Translation cache could not be read", error);
            return errorResponse(error);
        }
    }

    async create(
        locale: string,
        config: { key: string; value: string },
    ): Promise<ActionResponse<TranslationData>> {
        try {
            const response = await this.database.translations.create(
                config.key,
                config.value,
                locale,
            );

            if (!response.success) {
                return {
                    error: response.error,
                    data: null,
                };
            }

            await tryStore(
                () =>
                    this.store.set({
                        seed: "translations",
                        locale,
                        key: config.key,
                        value: config.value,
                    }),
                "Translation cache could not be updated",
            );

            return {
                error: null,
                data: response.data,
            };
        } catch (error) {
            warn("Translation create failed", error);
            return errorResponse(error);
        }
    }

    async update(
        locale: string,
        key: string,
        newValue: string,
    ): Promise<ActionResponse<TranslationData>> {
        try {
            const response = await this.database.translations.update(
                key,
                newValue,
                locale,
            );

            if (!response.success) {
                return {
                    error: response.error,
                    data: null,
                };
            }

            await tryStore(
                () =>
                    this.store.update({
                        seed: "translations",
                        locale,
                        key,
                        value: newValue,
                    }),
                "Translation cache could not be updated",
            );

            return {
                error: null,
                data: response.data,
            };
        } catch (error) {
            warn("Translation update failed", error);
            return errorResponse(error);
        }
    }

    async delete(locale: string, key: string) {
        try {
            const response = await this.database.translations.delete(
                key,
                locale,
            );

            if (!response.success) {
                return {
                    error: response.error,
                    data: null,
                };
            }

            await tryStore(
                () =>
                    this.store.remove({
                        seed: "translations",
                        locale,
                        key,
                    }),
                "Translation cache could not be removed",
            );

            return {
                error: null,
                data: response.data,
            };
        } catch (error) {
            warn("Translation delete failed", error);
            return errorResponse(error);
        }
    }

    async translate(
        locale: string,
        key: string,
        variables?: Record<string, string | number>,
    ): Promise<string> {
        try {
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
        } catch (error) {
            warn("Translation cache could not be read", error);
            return key;
        }
    }
}

export class OILang {
    private database: AdapterConfig["database"];
    private store: AdapterConfig["store"];
    private fallbackLocale: string | undefined;
    private status: OILangStatus = {
        initialized: false,
        databaseAvailable: false,
        storeLoaded: false,
    };

    public locales: Locale;
    public translations: Translation;
    public adapter: AdapterConfig["database"];

    constructor(private config: AdapterConfig) {
        this.database = config.database;
        this.adapter = config.database;
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
        try {
            await this.database.connect();
            this.status.databaseAvailable = true;

            const [locales, translations] = await Promise.all([
                this.database.locales.list(),
                this.database.translations.list(),
            ]);

            if (!locales.success || !translations.success) {
                throw (
                    getResponseError(locales) ??
                    getResponseError(translations) ??
                    new Error("Failed to load locales or translations")
                );
            }

            const loadableLocales = locales.data.map((l: any) => ({
                code: l.code,
                native_name: l.native_name,
                english_name: l.english_name,
                is_default: l.is_default,
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

            try {
                await this.store.load(loadableLocales, loadableTranslations);
                this.status.storeLoaded = true;
                this.status.lastError = undefined;
            } catch (error) {
                this.status.storeLoaded = false;
                this.status.lastError = toError(error);
                warn("Store cache could not be loaded", error);
            }

            this.status.initialized = true;
        } catch (error) {
            const initError = toError(error);

            this.status = {
                initialized: false,
                databaseAvailable: false,
                storeLoaded: false,
                lastError: initError,
            };

            warn("Database initialization failed", initError);

            if (this.config.throwOnInitError) {
                throw initError;
            }
        }
    }

    async refreshCache() {
        return await this.init();
    }

    getAdapter() {
        return this.adapter;
    }

    getStatus() {
        return { ...this.status };
    }
}

export function defineConfig(config: {
    configPath?: string;
    outputPath?: string;
    path?: string;
    output?: string;
}) {
    return config;
}
