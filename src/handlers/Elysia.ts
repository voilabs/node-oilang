import { OILang } from "../index";
import Elysia, { t } from "elysia";

type Options = {
    onAuthHandle?: Elysia["onBeforeHandle"];
};

const response = (success: boolean, message: string, data: any) => {
    return {
        success,
        message,
        data,
        __oilang: true,
    };
};

export const elysiaHandler = (oilang: OILang, options?: Options) => {
    return new Elysia({ name: "oilang" }).group("/oilang", (app) => {
        app.group("/locales", (localesApp) => {
            localesApp.get("/", async (app) => {
                const locales = await oilang.locales.list();
                return response(true, "Locales fetched successfully", locales);
            });

            localesApp.post(
                "/locales",
                async ({ body }) => {
                    const translations = await oilang.locales.create(
                        body.locale,
                        body.native_name,
                        body.english_name,
                    );
                    return response(
                        true,
                        "Locale created successfully",
                        translations,
                    );
                },
                {
                    beforeHandle: options?.onAuthHandle,
                    body: t.Object({
                        locale: t.String(),
                        native_name: t.String(),
                        english_name: t.String(),
                    }),
                },
            );

            localesApp.put(
                "/locales/:localeCode",
                async ({ body, params }) => {
                    const { localeCode } = params;
                    const translations = await oilang.locales.update(
                        localeCode,
                        body.native_name,
                        body.english_name,
                    );
                    return response(
                        true,
                        "Locale updated successfully",
                        translations,
                    );
                },
                {
                    beforeHandle: options?.onAuthHandle,
                    body: t.Object({
                        native_name: t.String(),
                        english_name: t.String(),
                    }),
                },
            );

            localesApp.delete(
                "/locales/:locale",
                async ({ params }) => {
                    const translations = await oilang.locales.delete(
                        params.locale,
                    );
                    return response(
                        true,
                        "Locale deleted successfully",
                        translations,
                    );
                },
                {
                    beforeHandle: options?.onAuthHandle,
                    params: t.Object({
                        locale: t.String(),
                    }),
                },
            );

            return localesApp;
        });

        app.group("/translations", (translationsApp) => {
            translationsApp.get("/:locale", async ({ params, query }) => {
                const translations = await oilang.translations.list(
                    params.locale,
                );
                return response(
                    true,
                    "Translations fetched successfully",
                    translations,
                );
            });

            translationsApp.post(
                "/:locale",
                async ({ params, body }) => {
                    const { translations } = body;
                    for (const t of translations) {
                        await oilang.translations.create(params.locale, {
                            key: t.key,
                            value: t.value,
                        });
                    }

                    return response(
                        true,
                        "Translations updated successfully",
                        {},
                    );
                },
                {
                    beforeHandle: options?.onAuthHandle,
                    body: t.Object({
                        translations: t.Array(
                            t.Object({
                                key: t.String(),
                                value: t.String(),
                            }),
                        ),
                    }),
                },
            );

            translationsApp.put(
                "/:locale",
                async ({ params, request, body }) => {
                    const { translations } = body;
                    for (const t of translations) {
                        await oilang.translations.update(
                            params.locale,
                            t.key,
                            t.value,
                        );
                    }

                    return response(
                        true,
                        "Translations updated successfully",
                        {},
                    );
                },
                {
                    beforeHandle: options?.onAuthHandle,
                    body: t.Object({
                        translations: t.Array(
                            t.Object({
                                key: t.String(),
                                value: t.String(),
                            }),
                        ),
                    }),
                },
            );

            translationsApp.delete(
                "/:locale",
                async ({ params, request, body }) => {
                    const { translations } = body;
                    for (const t of translations) {
                        await oilang.translations.delete(params.locale, t.key);
                    }

                    return response(
                        true,
                        "Translations deleted successfully",
                        {},
                    );
                },
                {
                    beforeHandle: options?.onAuthHandle,
                    body: t.Object({
                        translations: t.Array(
                            t.Object({
                                key: t.String(),
                            }),
                        ),
                    }),
                },
            );

            return translationsApp;
        });

        return app;
    });
};
