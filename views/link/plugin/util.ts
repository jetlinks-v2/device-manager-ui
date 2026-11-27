import i18n from "@jetlinks-web-core/locales";
export const TypeMap: Partial<Record<string, string>> = {
  'deviceGateway': i18n.global.t('plugin.util.039029-0'),
  'collector': i18n.global.t('plugin.util.039029-1'),
  'data_collector': i18n.global.t('plugin.util.039029-1'),
  'ruleEngine':i18n.global.t('plugin.util.039029-2'),
  'standalone':i18n.global.t('plugin.util.039029-3'),
  'media':i18n.global.t('plugin.util.039029-4'),
  'ai': 'AI'
}

export const getPluginTypeLabel = (type?: string) => {
  if (!type) {
    return i18n.global.t('comm.table.empty')
  }
  return TypeMap[type] || type
}

const typeIcons: Partial<Record<string, string>> = {
  deviceGateway: 'ApiOutlined',
  collector: 'DatabaseOutlined',
  data_collector: 'DatabaseOutlined',
  ruleEngine: 'BranchesOutlined',
  standalone: 'AppstoreOutlined',
  media: 'VideoCameraOutlined',
  ai: 'RobotOutlined',
}

export const getPluginTypeIcon = (type?: string) => type && typeIcons[type] || 'ApiOutlined'
