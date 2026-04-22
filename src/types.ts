export interface LocaleData {
    code: string;
    native_name: string;
    english_name: string;
    is_default: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface TranslationData {
    locale_id: string;
    key: string;
    value: string;
}

export type ActionResponse<T> =
    | { success: true; data: T }
    | { success: false; error: any };

export interface DatabaseAdapter {
    locales: {
        list(): Promise<ActionResponse<LocaleData[]>>;
        create(
            locale: string,
            nativeName: string,
            englishName: string,
            isDefault?: boolean,
        ): Promise<ActionResponse<LocaleData>>;
        delete(locale: string): Promise<ActionResponse<{ code: string }>>;
        getDefault(): Promise<ActionResponse<LocaleData>>;
        update(
            locale: string,
            nativeName: string,
            englishName: string,
            isDefault?: boolean,
        ): Promise<ActionResponse<LocaleData>>;
    };
    translations: {
        list(locale?: string): Promise<ActionResponse<TranslationData[]>>;
        create(
            key: string,
            value: string,
            locale: string,
        ): Promise<ActionResponse<TranslationData>>;
        delete(
            key: string,
            locale: string,
        ): Promise<ActionResponse<{ locale_id: string; key: string }>>;
        update(
            key: string,
            value: string,
            locale: string,
        ): Promise<ActionResponse<TranslationData>>;
    };
    connect(): Promise<void>;
    getSchemaNames(): { keys: string; locales: string };
}
