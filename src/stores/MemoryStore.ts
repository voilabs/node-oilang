export class MemoryStore {
    private translations: Record<string, Record<string, string>> = {};
    private locales: Array<{
        code: string;
        native_name: string;
        english_name: string;
    }> = [];

    async load(
        locales: Array<{
            code: string;
            native_name: string;
            english_name: string;
        }>,
        translations: Record<string, Record<string, string>>,
    ) {
        this.locales = locales;
        this.translations = translations;
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
            (this.translations[config.locale] as any)[config.key] =
                config.value;
        } else {
            this.locales.push(config.locale);
            this.translations[config.locale.code] = {};
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
            for (const [key, value] of Object.entries(config.translations)) {
                this.translations[config.locale][key] = value;
            }
        } else {
            for (const [key, value] of Object.entries(config.locales)) {
                this.locales.push({
                    code: key,
                    native_name: value,
                    english_name: value,
                });
                this.translations[key] = {};
            }
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
            return this.translations[config.locale]?.[config.key];
        } else {
            return this.locales.find((l) => l.code === config.code);
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
            return this.translations[config.locale];
        } else {
            return this.locales;
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
            if (
                this.translations[config.locale] &&
                this.translations[config.locale]?.[config.key]
            ) {
                delete this.translations[config.locale]?.[config.key];
            }
        } else {
            this.locales = this.locales.filter((l) => l.code !== config.locale);
            delete this.translations[config.locale];
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
            this.locales = this.locales.map((l) =>
                l.code === config.code ? { ...l, ...config.locale } : l,
            );
            return true;
        }
    }
}
