export const IOT_DEVICE_ANALYSIS_EXTENSION_KEY = 'iot/device-analysis'
export const IOT_DEVICE_ANALYSIS_PROVIDER_ID = 'iot:device-analysis'
export const IOT_DEVICE_ANALYSIS_CATEGORY = 'device'

export const IOT_DEVICE_STATES = ['online', 'offline', 'disabled'] as const
export const IOT_DEVICE_MODEL_SECTIONS = ['all', 'properties', 'events', 'functions', 'tags'] as const
export const IOT_DEVICE_PROPERTY_AGGREGATES = ['COUNT', 'DISTINCT_COUNT', 'AVG', 'MAX', 'MIN', 'FIRST', 'LAST'] as const
export const IOT_DEVICE_PROPERTY_ANALYSIS_MODES = ['statistics', 'ordered_path'] as const
export const IOT_DEVICE_PROPERTY_INTERVALS = ['1m', '1h', '1d', '1w', '1M'] as const
export const IOT_DEVICE_OPEN_DETAIL_TABS = ['overview', 'access', 'data', 'alarm', 'logs', 'advanced'] as const

export const IOT_DEVICE_MENU_ANCHORS = {
  overview: ['iot-user/device/overview', '/iot-user/device/overview'],
  list: ['access/device', '/access/device'],
  health: ['iot-user/device/health', '/iot-user/device/health'],
} as const
