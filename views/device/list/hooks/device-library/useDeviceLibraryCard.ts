import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizeDeviceTypeValue, type IotDeviceProductTemplate } from '@device-manager-ui/api/device'
import type { CardSummaryData } from '@jetlinks-web-core/components'

interface DeviceLibraryCardProps {
  template: IotDeviceProductTemplate
  selected: boolean
  disabled: boolean
}

const categoryIcons: Record<string, string> = {
  video: 'VideoCameraOutlined',
  meter: 'DashboardOutlined',
  sensor: 'AppstoreOutlined',
  industrial: 'ClusterOutlined',
  integration: 'ApiOutlined',
}

/** 将设备库和项目产品的展示字段适配为统一摘要卡，不执行请求或修改外部状态。 */
export function useDeviceLibraryCard(props: DeviceLibraryCardProps) {
  const { t } = useI18n()
  // 优先使用平铺标签，兼容仅返回分组标签的产品，并去除重复值。
  const tags = computed(() => {
    const groupedTags = props.template.tagGroups?.flatMap((group) => group.values ?? []) ?? []
    const values = props.template.tags?.length ? props.template.tags : groupedTags
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
  })
  const visibleTags = computed(() => tags.value.slice(0, 3))
  const hiddenTagCount = computed(() => Math.max(tags.value.length - visibleTags.value.length, 0))
  const tagTooltip = computed(() => tags.value.join('、'))
  const cardData = computed<CardSummaryData>(() => ({
    title: props.template.name,
    subtitle: t('IotDeviceList.deviceType.' + normalizeDeviceTypeValue(props.template.deviceType)),
    description: props.template.summary || t('IotDeviceList.add.noTemplateDesc'),
    avatar: {
      src: props.template.photoUrl?.trim() || undefined,
      // Avatar 图片加载失败时使用分类图标作为回退。
      icon: categoryIcons[props.template.category] || categoryIcons.integration,
      alt: t('IotDeviceList.iconAlt', { name: props.template.name }),
    },
    status: props.selected
      ? { text: t('IotDeviceList.add.selected'), tone: 'info' }
      : props.disabled
        ? { text: t('IotDeviceList.add.unselectableTemplate'), tone: 'default' }
        : undefined,
  }))

  return { cardData, visibleTags, hiddenTagCount, tagTooltip }
}
