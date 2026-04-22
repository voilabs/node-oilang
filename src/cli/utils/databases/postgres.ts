import { GeneratedFileInfo } from "./shared.js";

export function buildPostgreSqlFileInfo(schemaNames: {
    locales: string;
    keys: string;
}): GeneratedFileInfo {
    const content =
        `
CREATE TABLE IF NOT EXISTS ${schemaNames.locales} (
    code VARCHAR(10) PRIMARY KEY,
    native_name VARCHAR(255) NOT NULL,
    english_name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ${schemaNames.keys} (
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    locale_id VARCHAR(10) NOT NULL,
    PRIMARY KEY (key, locale_id),
    FOREIGN KEY (locale_id) REFERENCES ${schemaNames.locales}(code) ON DELETE CASCADE
);
`.trim() + "\n";

    return { content, name: "oilang-schema.sql" };
}
