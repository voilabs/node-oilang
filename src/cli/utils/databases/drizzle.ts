import { GeneratedFileInfo } from "./shared.js";

export function buildDrizzleFileInfo(
    provider: "pg" | "mysql" | "sqlite",
    schemaNames: { locales: string; keys: string },
): GeneratedFileInfo {
    if (provider === "pg") {
        return {
            name: "oilang-schema.ts",
            content: `import { pgTable, varchar, boolean, timestamp, text, primaryKey } from "drizzle-orm/pg-core";

export const locales = pgTable("${schemaNames.locales}", {
    code: varchar("code", { length: 10 }).primaryKey(),
    native_name: varchar("native_name", { length: 255 }).notNull(),
    english_name: varchar("english_name", { length: 255 }).notNull(),
    is_default: boolean("is_default").default(false),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
});

export const keys = pgTable("${schemaNames.keys}", {
    key: varchar("key", { length: 255 }).notNull(),
    value: text("value").notNull(),
    locale_id: varchar("locale_id", { length: 10 }).notNull().references(() => locales.code, { onDelete: "cascade" }),
}, (t) => [
    primaryKey({ columns: [t.key, t.locale_id] }),
]);
`,
        };
    }

    if (provider === "mysql") {
        return {
            name: "oilang-schema.ts",
            content: `import { mysqlTable, varchar, boolean, timestamp, text, primaryKey } from "drizzle-orm/mysql-core";

export const locales = mysqlTable("${schemaNames.locales}", {
    code: varchar("code", { length: 10 }).primaryKey(),
    native_name: varchar("native_name", { length: 255 }).notNull(),
    english_name: varchar("english_name", { length: 255 }).notNull(),
    is_default: boolean("is_default").default(false),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
});

export const keys = mysqlTable("${schemaNames.keys}", {
    key: varchar("key", { length: 255 }).notNull(),
    value: text("value").notNull(),
    locale_id: varchar("locale_id", { length: 10 }).notNull().references(() => locales.code, { onDelete: "cascade" }),
}, (t) => [
    primaryKey({ columns: [t.key, t.locale_id] }),
]);
`,
        };
    }

    return {
        name: "oilang-schema.ts",
        content: `import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const locales = sqliteTable("${schemaNames.locales}", {
    code: text("code").primaryKey(),
    native_name: text("native_name").notNull(),
    english_name: text("english_name").notNull(),
    is_default: integer("is_default", { mode: "boolean" }).default(false),
    created_at: text("created_at").default(sql\`(CURRENT_TIMESTAMP)\`),
    updated_at: text("updated_at").default(sql\`(CURRENT_TIMESTAMP)\`),
});

export const keys = sqliteTable("${schemaNames.keys}", {
    key: text("key").notNull(),
    value: text("value").notNull(),
    locale_id: text("locale_id").notNull().references(() => locales.code, { onDelete: "cascade" }),
}, (t) => [
    primaryKey({ columns: [t.key, t.locale_id] }),
]);
`,
    };
}
