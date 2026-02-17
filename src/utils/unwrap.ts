export const unwrap = (
    string: string,
    locale: string,
    fallbackLocale: string = "en-US",
) => {
    const regex = new RegExp(`<${locale}>(.*?)</${locale}>`);
    const match = string.match(regex);
    if (match) return match[1];
    const fallbackRegex = new RegExp(
        `<${fallbackLocale}>(.*?)</${fallbackLocale}>`,
    );
    const fallbackMatch = string.match(fallbackRegex);
    return fallbackMatch ? fallbackMatch[1] : string;
};

export const unwrapObject = (string: string) => {
    const regex = /<([a-zA-Z-]+)>(.*?)<\/([a-zA-Z-]+)>/g;
    const matches = string.matchAll(regex);
    const result: Record<string, string> = {};
    for (const match of matches) {
        result[match[1]] = match[2];
    }
    return result;
};
