import { sql, eq, and } from "drizzle-orm";
import {
    pgTable,
    varchar as pgVarchar,
    boolean as pgBoolean,
    timestamp as pgTimestamp,
    text as pgText,
    primaryKey as pgPrimaryKey,
} from "drizzle-orm/pg-core";
import {
    mysqlTable,
    varchar as mysqlVarchar,
    boolean as mysqlBoolean,
    timestamp as mysqlTimestamp,
    text as mysqlText,
    primaryKey as mysqlPrimaryKey,
} from "drizzle-orm/mysql-core";
import {
    sqliteTable,
    text as sqliteText,
    integer as sqliteInteger,
    primaryKey as sqlitePrimaryKey,
} from "drizzle-orm/sqlite-core";
import type {
    DatabaseAdapter,
    LocaleData,
    TranslationData,
    ActionResponse,
} from "../types";

export type DrizzleProvider = "pg" | "mysql" | "sqlite";

export interface DrizzleAdapterConfig {
    provider: DrizzleProvider;
    schemaNames?: { keys: string; locales: string };
    schemas?: {
        locales: any;
        keys: any;
    };
}

function createFallbackSchemas(
    provider: DrizzleProvider,
    schemaNames: { keys: string; locales: string },
) {
    if (provider === "pg") {
        const locales = pgTable(schemaNames.locales, {
            code: pgVarchar("code", { length: 10 }).primaryKey(),
            native_name: pgVarchar("native_name", { length: 255 }).notNull(),
            english_name: pgVarchar("english_name", { length: 255 }).notNull(),
            is_default: pgBoolean("is_default").default(false),
            created_at: pgTimestamp("created_at").defaultNow(),
            updated_at: pgTimestamp("updated_at").defaultNow(),
        });

        const translations = pgTable(
            schemaNames.keys,
            {
                key: pgVarchar("key", { length: 255 }).notNull(),
                value: pgText("value").notNull(),
                locale_id: pgVarchar("locale_id", { length: 10 })
                    .notNull()
                    .references(() => locales.code, { onDelete: "cascade" }),
            },
            (t) => [pgPrimaryKey({ columns: [t.key, t.locale_id] })],
        );
        return { locales, translations };
    } else if (provider === "mysql") {
        const locales = mysqlTable(schemaNames.locales, {
            code: mysqlVarchar("code", { length: 10 }).primaryKey(),
            native_name: mysqlVarchar("native_name", { length: 255 }).notNull(),
            english_name: mysqlVarchar("english_name", {
                length: 255,
            }).notNull(),
            is_default: mysqlBoolean("is_default").default(false),
            created_at: mysqlTimestamp("created_at").defaultNow(),
            updated_at: mysqlTimestamp("updated_at").defaultNow(),
        });

        const translations = mysqlTable(
            schemaNames.keys,
            {
                key: mysqlVarchar("key", { length: 255 }).notNull(),
                value: mysqlText("value").notNull(),
                locale_id: mysqlVarchar("locale_id", { length: 10 })
                    .notNull()
                    .references(() => locales.code, { onDelete: "cascade" }),
            },
            (t) => [mysqlPrimaryKey({ columns: [t.key, t.locale_id] })],
        );
        return { locales, translations };
    } else {
        const locales = sqliteTable(schemaNames.locales, {
            code: sqliteText("code").primaryKey(),
            native_name: sqliteText("native_name").notNull(),
            english_name: sqliteText("english_name").notNull(),
            is_default: sqliteInteger("is_default", {
                mode: "boolean",
            }).default(false),
            created_at: sqliteText("created_at").default(
                sql`(CURRENT_TIMESTAMP)`,
            ),
            updated_at: sqliteText("updated_at").default(
                sql`(CURRENT_TIMESTAMP)`,
            ),
        });

        const translations = sqliteTable(
            schemaNames.keys,
            {
                key: sqliteText("key").notNull(),
                value: sqliteText("value").notNull(),
                locale_id: sqliteText("locale_id")
                    .notNull()
                    .references(() => locales.code, { onDelete: "cascade" }),
            },
            (t) => [sqlitePrimaryKey({ columns: [t.key, t.locale_id] })],
        );
        return { locales, translations };
    }
}

class DrizzleLocales {
    constructor(
        private db: any,
        private schemas: any,
        private provider: DrizzleProvider,
    ) {}

    async list(): Promise<ActionResponse<LocaleData[]>> {
        try {
            const data = await this.db.select().from(this.schemas.locales);
            return { success: true, data: data as LocaleData[] };
        } catch (error) {
            return { success: false, error };
        }
    }

    async create(
        locale: string,
        nativeName: string,
        englishName: string,
        isDefault?: boolean,
    ): Promise<ActionResponse<LocaleData>> {
        try {
            const existing = await this.db
                .select()
                .from(this.schemas.locales)
                .where(eq(this.schemas.locales.code, locale));
            if (existing.length > 0) {
                const error = new Error("Locale already exists");
                (error as any).code = "LOCALE_ALREADY_EXISTS";
                throw error;
            }

            const input = {
                code: locale,
                native_name: nativeName,
                english_name: englishName,
                is_default: isDefault || false,
            };

            if (this.provider === "pg" || this.provider === "sqlite") {
                const result = await this.db
                    .insert(this.schemas.locales)
                    .values(input)
                    .returning();
                return { success: true, data: result[0] as LocaleData };
            } else {
                await this.db.insert(this.schemas.locales).values(input);
                const result = await this.db
                    .select()
                    .from(this.schemas.locales)
                    .where(eq(this.schemas.locales.code, locale));
                return { success: true, data: result[0] as LocaleData };
            }
        } catch (error) {
            return { success: false, error };
        }
    }

    async delete(locale: string): Promise<ActionResponse<{ code: string }>> {
        try {
            await this.db
                .delete(this.schemas.locales)
                .where(eq(this.schemas.locales.code, locale));
            return { success: true, data: { code: locale } };
        } catch (error) {
            return { success: false, error };
        }
    }

    async getDefault(): Promise<ActionResponse<LocaleData>> {
        try {
            const result = await this.db
                .select()
                .from(this.schemas.locales)
                .where(eq(this.schemas.locales.is_default, true));
            return { success: true, data: result[0] as LocaleData };
        } catch (error) {
            return { success: false, error };
        }
    }

    async update(
        locale: string,
        nativeName: string,
        englishName: string,
        isDefault?: boolean,
    ): Promise<ActionResponse<LocaleData>> {
        try {
            if (isDefault) {
                await this.db
                    .update(this.schemas.locales)
                    .set({ is_default: false })
                    .where(eq(this.schemas.locales.is_default, true));
            }

            const updateData = {
                native_name: nativeName,
                english_name: englishName,
                ...(isDefault !== undefined ? { is_default: isDefault } : {}),
            };

            if (this.provider === "pg" || this.provider === "sqlite") {
                const result = await this.db
                    .update(this.schemas.locales)
                    .set(updateData)
                    .where(eq(this.schemas.locales.code, locale))
                    .returning();

                if (result.length === 0) {
                    const error = new Error("Locale does not exist");
                    (error as any).code = "LOCALE_NOT_FOUND";
                    throw error;
                }
                return { success: true, data: result[0] as LocaleData };
            } else {
                await this.db
                    .update(this.schemas.locales)
                    .set(updateData)
                    .where(eq(this.schemas.locales.code, locale));

                const result = await this.db
                    .select()
                    .from(this.schemas.locales)
                    .where(eq(this.schemas.locales.code, locale));
                if (result.length === 0) {
                    const error = new Error("Locale does not exist");
                    (error as any).code = "LOCALE_NOT_FOUND";
                    throw error;
                }
                return { success: true, data: result[0] as LocaleData };
            }
        } catch (error) {
            return { success: false, error: error as any };
        }
    }
}

class DrizzleTranslations {
    constructor(
        private db: any,
        private schemas: any,
        private provider: DrizzleProvider,
    ) {}

    async list(locale?: string): Promise<ActionResponse<TranslationData[]>> {
        try {
            if (locale) {
                const data = await this.db
                    .select()
                    .from(this.schemas.keys)
                    .where(eq(this.schemas.keys.locale_id, locale));
                return { success: true, data: data as TranslationData[] };
            } else {
                const data = await this.db.select().from(this.schemas.keys);
                return { success: true, data: data as TranslationData[] };
            }
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
            const localeCheck = await this.db
                .select()
                .from(this.schemas.locales)
                .where(eq(this.schemas.locales.code, locale));
            if (localeCheck.length === 0) {
                const error = new Error("Locale does not exist");
                (error as any).code = "LOCALE_NOT_FOUND";
                throw error;
            }

            const input = {
                key,
                value,
                locale_id: locale,
            };

            if (this.provider === "pg" || this.provider === "sqlite") {
                const result = await this.db
                    .insert(this.schemas.keys)
                    .values(input)
                    .returning();
                return { success: true, data: result[0] as TranslationData };
            } else {
                await this.db.insert(this.schemas.keys).values(input);
                const result = await this.db
                    .select()
                    .from(this.schemas.keys)
                    .where(
                        and(
                            eq(this.schemas.keys.key, key),
                            eq(this.schemas.keys.locale_id, locale),
                        ),
                    );
                return { success: true, data: result[0] as TranslationData };
            }
        } catch (error) {
            return { success: false, error: error as any };
        }
    }

    async delete(
        key: string,
        locale: string,
    ): Promise<ActionResponse<{ locale_id: string; key: string }>> {
        try {
            await this.db
                .delete(this.schemas.keys)
                .where(
                    and(
                        eq(this.schemas.keys.key, key),
                        eq(this.schemas.keys.locale_id, locale),
                    ),
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
            if (this.provider === "pg" || this.provider === "sqlite") {
                const result = await this.db
                    .update(this.schemas.keys)
                    .set({ value })
                    .where(
                        and(
                            eq(this.schemas.keys.key, key),
                            eq(this.schemas.keys.locale_id, locale),
                        ),
                    )
                    .returning();

                if (result.length === 0) {
                    const error = new Error("Translation does not exist");
                    (error as any).code = "TRANSLATION_NOT_FOUND";
                    throw error;
                }
                return { success: true, data: result[0] as TranslationData };
            } else {
                await this.db
                    .update(this.schemas.keys)
                    .set({ value })
                    .where(
                        and(
                            eq(this.schemas.keys.key, key),
                            eq(this.schemas.keys.locale_id, locale),
                        ),
                    );

                const result = await this.db
                    .select()
                    .from(this.schemas.keys)
                    .where(
                        and(
                            eq(this.schemas.keys.key, key),
                            eq(this.schemas.keys.locale_id, locale),
                        ),
                    );

                if (result.length === 0) {
                    const error = new Error("Translation does not exist");
                    (error as any).code = "TRANSLATION_NOT_FOUND";
                    throw error;
                }
                return { success: true, data: result[0] as TranslationData };
            }
        } catch (error) {
            return { success: false, error: error as any };
        }
    }
}

export class DrizzleAdapter implements DatabaseAdapter {
    public schemaNames: { keys: string; locales: string };
    public schemas: any;
    public locales: DrizzleLocales;
    public translations: DrizzleTranslations;

    constructor(
        private db: any,
        private config: DrizzleAdapterConfig,
    ) {
        this.schemaNames = config.schemaNames || {
            keys: "keys",
            locales: "locales",
        };

        let discoveredLocales: any = null;
        let discoveredTranslations: any = null;

        if (this.db && this.db._ && this.db._.fullSchema) {
            const schemaObj = this.db._.fullSchema;
            const schemaValues = Object.values(schemaObj);

            discoveredLocales = schemaValues.find((t: any) => {
                const name = t && (t as any)[Symbol.for("drizzle:Name")];
                return name === this.schemaNames.locales;
            });

            discoveredTranslations = schemaValues.find((t: any) => {
                const name = t && (t as any)[Symbol.for("drizzle:Name")];
                return name === this.schemaNames.keys;
            });
        }

        this.schemas = config.schemas || {
            locales: discoveredLocales,
            keys: discoveredTranslations,
        };

        if (!this.schemas.locales || !this.schemas.keys) {
            this.schemas = createFallbackSchemas(
                this.config.provider,
                this.schemaNames,
            );
        }

        this.locales = new DrizzleLocales(
            this.db,
            this.schemas,
            this.config.provider,
        );
        this.translations = new DrizzleTranslations(
            this.db,
            this.schemas,
            this.config.provider,
        );
    }

    async connect(): Promise<void> {
        // Drizzle instance typically is already connected, but we can do a simple ping
        try {
            if (
                this.config.provider === "pg" ||
                this.config.provider === "mysql"
            ) {
                await this.db.execute(sql`SELECT 1`);
            } else {
                await this.db.run(sql`SELECT 1`); // for some sqlite drivers, it might be run()
            }
        } catch {
            // ignore if it fails, some drivers execute diff logic
        }
    }

    getSchemaNames(): { keys: string; locales: string } {
        return this.schemaNames;
    }
}
