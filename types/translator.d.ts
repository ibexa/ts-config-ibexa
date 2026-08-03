export interface Translator {
    locale: string;
    fallback: string;
    placeHolderPrefix: string;
    placeHolderSuffix: string;
    defaultDomain: string;
    pluralSeparator: string;

    add(id: string, message: string, domain?: string, locale?: string): this;
    trans(id: string, parameters?: Record<string, unknown>, domain?: string, locale?: string): string;
    transChoice(id: string, number: number, parameters?: Record<string, unknown>, domain?: string, locale?: string): string;
    fromJSON(data: string | object): this;
    reset(): void;
}
