import Redis, { type RedisOptions } from "ioredis";
import { LocaleData } from "../types";
import { MemoryStore } from "./MemoryStore";

export type RedisStoreOptions = {
    prefix?: string;
    redis?: RedisOptions;
    logErrors?: boolean;
};

export class RedisStore {
    private client: Redis;
    private fallback = new MemoryStore();
    private available = false;
    private lastErrorMessage?: string;

    constructor(
        connectionString: string = "redis://localhost:6379",
        private options?: RedisStoreOptions,
    ) {
        this.client = new Redis(connectionString, {
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            retryStrategy: (times) => Math.min(times * 100, 2000),
            ...options?.redis,
        });

        this.client.on("ready", () => {
            this.available = true;
            this.lastErrorMessage = undefined;
        });

        this.client.on("end", () => {
            this.available = false;
        });

        this.client.on("close", () => {
            this.available = false;
        });

        this.client.on("reconnecting", () => {
            this.available = false;
        });

        this.client.on("error", (error) => {
            this.available = false;
            this.logError(error);
        });
    }

    private get prefix() {
        return this.options?.prefix ?? "oilang:";
    }

    private logError(error: unknown) {
        if (this.options?.logErrors === false) return;

        const message =
            error instanceof Error ? error.message : "Unknown Redis error";
        if (message === this.lastErrorMessage) return;

        this.lastErrorMessage = message;
        console.warn(`[OILang] RedisStore unavailable: ${message}`);
    }

    private async runRedis<T>(operation: () => Promise<T>) {
        if (!this.available && this.client.status !== "ready") {
            return undefined;
        }

        try {
            this.available = true;
            return await operation();
        } catch (error) {
            this.available = false;
            this.logError(error);
            return undefined;
        }
    }

    async load(
        locales: Array<LocaleData>,
        translations: Record<string, Record<string, string>>,
    ) {
        await this.fallback.load(locales, translations);

        await this.runRedis(async () => {
            const existingLocales = await this.client.hvals(
                `${this.prefix}locales`,
            );
            const pipeline = this.client.pipeline();

            if (existingLocales.length > 0) {
                existingLocales.forEach((lStr) => {
                    const l = JSON.parse(lStr);
                    pipeline.del(`${this.prefix}translations:${l.code}`);
                });
                pipeline.del(`${this.prefix}locales`);
            }

            if (locales.length > 0) {
                const localeMap: Record<string, string> = {};
                for (const locale of locales) {
                    localeMap[locale.code] = JSON.stringify(locale);
                }
                pipeline.hset(`${this.prefix}locales`, localeMap);
            }

            for (const [locale, trans] of Object.entries(translations)) {
                if (Object.keys(trans).length > 0) {
                    pipeline.hset(
                        `${this.prefix}translations:${locale}`,
                        trans,
                    );
                }
            }

            await pipeline.exec();
        });
    }

    async set(
        config:
            | {
                  seed: "translations";
                  locale: string;
                  key: string;
                  value: string;
              }
            | {
                  seed: "locales";
                  locale: LocaleData;
              },
    ) {
        await this.fallback.set(config as any);

        if (config.seed === "translations") {
            await this.runRedis(() =>
                this.client.hset(
                    `${this.prefix}translations:${config.locale}`,
                    config.key,
                    config.value,
                ),
            );
        } else {
            await this.runRedis(() =>
                this.client.hset(
                    `${this.prefix}locales`,
                    config.locale.code,
                    JSON.stringify(config.locale),
                ),
            );
        }
    }

    async get(
        config:
            | {
                  seed: "locales";
                  code: string;
              }
            | {
                  seed: "translations";
                  locale: string;
                  key: string;
              },
    ) {
        if (config.seed === "translations") {
            const val = await this.runRedis(() =>
                this.client.hget(
                    `${this.prefix}translations:${config.locale}`,
                    config.key,
                ),
            );
            return (
                val ??
                (await this.fallback.get({
                    seed: "translations",
                    locale: config.locale,
                    key: config.key,
                }))
            );
        } else {
            const val = await this.runRedis(() =>
                this.client.hget(`${this.prefix}locales`, config.code),
            );
            return (
                (val ? JSON.parse(val) : undefined) ??
                (await this.fallback.get({
                    seed: "locales",
                    code: config.code,
                }))
            );
        }
    }

    async getAll(
        config:
            | {
                  seed: "locales";
              }
            | {
                  seed: "translations";
                  locale: string;
              },
    ) {
        if (config.seed === "translations") {
            const translations = await this.runRedis(() =>
                this.client.hgetall(
                    `${this.prefix}translations:${config.locale}`,
                ),
            );
            return Object.keys(translations ?? {}).length > 0
                ? translations
                : await this.fallback.getAll(config);
        } else {
            const locales = await this.runRedis(() =>
                this.client.hvals(`${this.prefix}locales`),
            );
            return locales && locales.length > 0
                ? locales.map((l: string) => JSON.parse(l))
                : await this.fallback.getAll(config);
        }
    }

    async remove(
        config:
            | {
                  seed: "translations";
                  locale: string;
                  key: string;
              }
            | {
                  seed: "locales";
                  locale: string;
              },
    ) {
        await this.fallback.remove(config as any);

        if (config.seed === "translations") {
            await this.runRedis(() =>
                this.client.hdel(
                    `${this.prefix}translations:${config.locale}`,
                    config.key,
                ),
            );
        } else {
            await this.runRedis(async () => {
                const pipeline = this.client.pipeline();
                pipeline.hdel(`${this.prefix}locales`, config.locale);
                pipeline.del(`${this.prefix}translations:${config.locale}`);
                await pipeline.exec();
            });
        }
    }

    async update(
        config:
            | {
                  seed: "translations";
                  locale: string;
                  key: string;
                  value: string;
              }
            | {
                  seed: "locales";
                  code: string;
                  locale: {
                      native_name: string;
                      english_name: string;
                      is_default: boolean;
                  };
              },
    ) {
        await this.fallback.update(config as any);

        if (config.seed === "translations") {
            await this.runRedis(() =>
                this.client.hset(
                    `${this.prefix}translations:${config.locale}`,
                    config.key,
                    config.value,
                ),
            );
            return true;
        } else {
            await this.runRedis(async () => {
                const existingStr = await this.client.hget(
                    `${this.prefix}locales`,
                    config.code,
                );
                const existing = existingStr ? JSON.parse(existingStr) : {};
                const merged = { ...existing, ...config.locale };

                await this.client.hset(
                    `${this.prefix}locales`,
                    config.code,
                    JSON.stringify(merged),
                );
            });
            return true;
        }
    }

    isAvailable() {
        return this.available;
    }

    async disconnect() {
        await this.client.quit().catch(() => {
            this.client.disconnect();
        });
    }
}
