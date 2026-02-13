export interface LocaleData {
    code: string;
    native_name: string;
    english_name: string;
    created_at?: string;
    updated_at?: string;
}

export interface TranslationData {
    locale_id: string;
    key: string;
    value: string;
}
