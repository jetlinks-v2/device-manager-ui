export type CategoryItem = {
  id: string;
  name: string;
  level: number;
  key: string;
  parentId: string;
  path: string;
  sortIndex: number;
  description?: string;
  i18nMessages?: Record<string, Record<string, string>>;
  children?: Category[];
};
