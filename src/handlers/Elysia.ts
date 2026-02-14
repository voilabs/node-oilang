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

export const elysiaHandler = (oilang: OILang, options?: Options): Elysia => {
    return new Elysia({ name: "oilang" }).group("/oilang", (app) => {
        app.group("/locales", (localesApp) => {
            localesApp.get("/", async (app) => {
                const { error, data } = await oilang.locales.list();
                if (error) {
                    return response(false, "Failed to fetch locales", error);
                }
                return response(true, "Locales fetched successfully", data);
            });

            localesApp.post(
                "/",
                async ({ body }) => {
                    const { error, data } = await oilang.locales.create(
                        body.locale,
                        body.native_name,
                        body.english_name,
                    );
                    if (error) {
                        return response(
                            false,
                            "Failed to create locale",
                            error,
                        );
                    }
                    return response(true, "Locale created successfully", data);
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
                "/:localeCode",
                async ({ body, params }) => {
                    const { localeCode } = params;
                    const { error, data } = await oilang.locales.update(
                        localeCode,
                        body.native_name,
                        body.english_name,
                    );
                    if (error) {
                        return response(
                            false,
                            "Failed to update locale",
                            error,
                        );
                    }
                    return response(true, "Locale updated successfully", data);
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
                "/:locale",
                async ({ params }) => {
                    const { error, data } = await oilang.locales.delete(
                        params.locale,
                    );
                    if (error) {
                        return response(
                            false,
                            "Failed to delete locale",
                            error,
                        );
                    }
                    return response(true, "Locale deleted successfully", data);
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
            translationsApp.get(
                "/:locale",
                async ({ params, query }) => {
                    const { format } = query;
                    const { error, data } = await oilang.translations.list(
                        params.locale,
                    );
                    if (error) {
                        return response(
                            false,
                            "Failed to fetch translations",
                            error,
                        );
                    }
                    if (format === "true") {
                        const result = Object.entries(data).reduce(
                            (acc, [fullKey, value]) => {
                                const keys = fullKey.split(".");
                                let current = acc;

                                keys.forEach((key, index) => {
                                    // If we're at the last part of the key, assign the value
                                    if (index === keys.length - 1) {
                                        current[key] = value;
                                    } else {
                                        // Otherwise, keep nesting
                                        current[key] = current[key] || {};
                                        current = current[key];
                                    }
                                });

                                return acc;
                            },
                            {} as Record<string, any>,
                        );

                        return response(
                            true,
                            "Translations fetched successfully",
                            result,
                        );
                    }
                    return response(
                        true,
                        "Translations fetched successfully",
                        data,
                    );
                },
                {
                    params: t.Object({
                        locale: t.String(),
                    }),
                    query: t.Object({
                        format: t.Optional(t.String()),
                    }),
                },
            );

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

        app.post(
            "/refresh",
            async () => {
                await oilang.refreshCache();
                return response(true, "Cache refreshed successfully", {});
            },
            {
                beforeHandle: options?.onAuthHandle,
            },
        );

        return app;
    });
};
