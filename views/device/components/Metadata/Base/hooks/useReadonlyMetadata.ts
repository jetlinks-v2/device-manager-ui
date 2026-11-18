import { useI18n } from 'vue-i18n'
import { getTypeMap } from '../../../../../../components/Metadata/components/Type/data'
import { EventLevel } from '../../../../data'
import type { MetadataItem, MetadataType } from '../../../../Product/typings'

/** 沿用物模型表格，只将只读场景中的编辑单元格替换为文本。 */
export function useReadonlyMetadata(type: () => MetadataType | undefined) {
  const { t } = useI18n()

  function readonlyValue(record: MetadataItem, field: string): string {
    const value = record[field]
    switch (field) {
      case 'valueType':
      case 'output':
        return (getTypeMap() as Record<string, string>)[value?.type] || value?.type || '-'
      case 'inputs':
        return value?.map((item: { name?: string; id?: string }) => item.name || item.id).filter(Boolean).join(', ') || '-'
      case 'async':
        return t(value ? 'DetailModal.FunctionModal.475375-4' : 'DetailModal.FunctionModal.475375-5')
      case 'expands':
        if (type() === 'events') {
          return EventLevel.find(item => item.value === value?.level)?.label || '-'
        }
        const sources: Record<string, string> = {
          device: t('DetailModal.PropertiesModal.254343-15'),
          manual: t('DetailModal.PropertiesModal.254343-16'),
          rule: t('DetailModal.PropertiesModal.254343-17'),
        }
        return sources[value?.source] || '-'
      default:
        return value === undefined || value === null || value === '' ? '-' : String(value)
    }
  }

  return { readonlyValue }
}
