import i18n from '@jetlinks-web-core/locales'
import type { ObjectPresentation } from '@jetlinks-web-core/types/object-presentation'

// Navigation is loaded on demand because the menu itself loads module declarations.
const openPage = async (
  code: string,
  options: { params?: Record<string, unknown>; query?: Record<string, unknown> }
) => {
  const { useMenuStore } = await import('@jetlinks-web-core/store/menu')
  useMenuStore().jumpPage(code, options)
}
const deviceDetails = ['iot-user-device-list/Detail', 'iot-user/device/list/Detail', 'device/Instance/Detail']
const openDevice = async (id: string, showData = false) => {
  const { useMenuStore } = await import('@jetlinks-web-core/store/menu')
  const menu = useMenuStore()
  const code = deviceDetails.find((candidate) => menu.getMenu(candidate)) || deviceDetails[0]
  menu.jumpPage(code, {
    params: { id },
    query: showData ? { tab: code === 'device/Instance/Detail' ? 'Running' : 'data' } : undefined
  })
}
const openProductDevices = async (productId: string) => {
  const [{ encodeConditionFilterQuery }, { getDeviceListFilterFields }] = await Promise.all([
    import('@jetlinks-web-core/components/ConditionFilter'),
    import('./deviceListFilter')
  ])
  return openPage('iot-user-device-list', {
    query: {
      type: 'all',
      q: encodeConditionFilterQuery(
        [{ column: 'productId', termType: 'eq', value: productId }],
        getDeviceListFilterFields()
      )
    }
  })
}

const enumValue = (value: unknown) => {
  const row = value as { value?: string; text?: string } | undefined
  return { id: typeof value === 'string' ? value : row?.value, text: row?.text }
}

/** Object information belongs to device management, independent of the graph consumer. */
export default {
  device: {
    typeId: 'device',
    open: (object) => openDevice(object.id),
    fields: [
      {
        key: 'state',
        label: () => i18n.global.t('ObjectPresentation.state'),
        property: 'state',
        order: 10,
        display: 'status',
        open: (object) => openDevice(object.id, true),
        format: (value) => {
          const state = enumValue(value)
          return {
            text:
              state.id && ['online', 'offline', 'notActive'].includes(state.id)
                ? i18n.global.t(`ObjectPresentation.${state.id}`)
                : state.text || '—',
            tone: state.id === 'online' ? 'success' : state.id === 'offline' ? 'warning' : 'neutral'
          }
        }
      }
    ]
  },
  product: {
    typeId: 'product',
    open: (object) => openPage('device/Product/Detail', { params: { id: object.id } }),
    fields: [
      {
        key: 'state',
        label: () => i18n.global.t('ObjectPresentation.state'),
        property: 'state',
        order: 0,
        display: 'status',
        format: (value) => ({
          text:
            value === 1 || value === '1'
              ? i18n.global.t('ObjectPresentation.enabled')
              : value === 0 || value === '0'
              ? i18n.global.t('ObjectPresentation.disabled')
              : '—',
          tone: value === 1 || value === '1' ? 'success' : 'neutral'
        })
      },
      {
        key: 'deviceType',
        icon: 'HddOutlined',
        label: () => i18n.global.t('ObjectPresentation.deviceType'),
        property: 'deviceType',
        order: 10,
        display: 'text',
        format: (value) => {
          const type = enumValue(value)
          return {
            text:
              type.id && ['device', 'childrenDevice', 'gateway'].includes(type.id)
                ? i18n.global.t(`ObjectPresentation.${type.id}`)
                : type.text || '—'
          }
        }
      },
      {
        key: 'deviceCount',
        label: () => i18n.global.t('ObjectPresentation.deviceCount'),
        order: 20,
        display: 'metric',
        icon: 'HddOutlined',
        query: { capability: 'deviceSummary', subjectKey: 'productId', valueKey: 'deviceCount' },
        open: (object) => openProductDevices(object.id)
      }
    ]
  }
} satisfies Record<string, ObjectPresentation>
