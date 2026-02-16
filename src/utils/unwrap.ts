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
