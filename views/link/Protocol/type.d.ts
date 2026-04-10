export interface FormDataType {
    type: string | array<string>;
    name: string;
    configuration: {
        location: string;
        pkgId?: string;
        pkgName?: string;
        pkgVersion?: string;
    };
    description: string;
}
