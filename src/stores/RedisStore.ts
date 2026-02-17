import Redis from "ioredis";

export class RedisStore {
    private client: Redis;

    constructor(
        connectionString: string = "redis://localhost:6379",
        private options?: { prefix?: string },
    ) {
        this.client = new Redis(connectionString);
    }

    private get prefix() {
        return this.options?.prefix ?? "oilang:";
    }

    async load(
        locales: Array<{
            code: string;
            native_name: string;
            english_name: string;
        }>,
        translations: Record<string, Record<string, string>>,
    ) {
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
                pipeline.hset(`${this.prefix}translations:${locale}`, trans);
            }
        }

        await pipeline.exec();
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
                  locale: {
                      code: string;
                      native_name: string;
                      english_name: string;
                  };
              },
    ) {
        if (config.seed === "translations") {
            await this.client.hset(
                `${this.prefix}translations:${config.locale}`,
                config.key,
                config.value,
            );
        } else {
            await this.client.hset(
                `${this.prefix}locales`,
                config.locale.code,
                JSON.stringify(config.locale),
            );
        }
    }

    async setMany(
        config:
            | {
                  seed: "translations";
                  locale: string;
                  translations: Record<string, string>;
              }
            | {
                  seed: "locales";
                  locales: Record<string, string>;
              },
    ) {
        if (config.seed === "translations") {
            const pipeline = this.client.pipeline();
            for (const [key, value] of Object.entries(config.translations)) {
                pipeline.hset(
                    `${this.prefix}translations:${config.locale}`,
                    key,
                    value,
                );
            }
            await pipeline.exec();
        } else {
            const pipeline = this.client.pipeline();
            for (const [key, value] of Object.entries(config.locales)) {
                pipeline.hset(`${this.prefix}locales`, key, value);
            }
            await pipeline.exec();
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
            const val = await this.client.hget(
                `${this.prefix}translations:${config.locale}`,
                config.key,
            );
            return val ?? undefined;
        } else {
            const val = await this.client.hget(
                `${this.prefix}locales`,
                config.code,
            );
            return val ? JSON.parse(val) : undefined;
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
            return await this.client.hgetall(
                `${this.prefix}translations:${config.locale}`,
            );
        } else {
            const locales = await this.client.hvals(`${this.prefix}locales`);
            return locales.map((l: string) => JSON.parse(l));
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
        if (config.seed === "translations") {
            await this.client.hdel(
                `${this.prefix}translations:${config.locale}`,
                config.key,
            );
        } else {
            const pipeline = this.client.pipeline();
            pipeline.hdel(`${this.prefix}locales`, config.locale);
            pipeline.del(`${this.prefix}translations:${config.locale}`);
            await pipeline.exec();
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
                  };
              },
    ) {
        if (config.seed === "translations") {
            return this.set({
                seed: "translations",
                locale: config.locale,
                key: config.key,
                value: config.value,
            });
        } else {
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
            return true;
        }
    }
}
