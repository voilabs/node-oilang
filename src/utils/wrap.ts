export const wrap = (locales: Record<string, string>) => {
    return Object.entries(locales)
        .map(([locale, value]) => `<${locale}>${value}</${locale}>`)
        .join("");
};
