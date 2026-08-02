export interface FormDataType {
    type: string | Array<string>;
    name: string;
    configuration: {
        location: string;
        pkgId?: string;
        pkgName?: string;
        pkgVersion?: string;
    };
    description: string;
    i18nMessages?: Record<string, Record<string, string>>;
}
