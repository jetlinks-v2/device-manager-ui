import { deviceProduct } from '@visualization-dashboard-ui/assets/dashboard'

import i18n from '@jetlinks-web-core/locales'

export const DashboardComponents = [
  {
    id: 'Component',
    name: i18n.global.t('designer.utils.100058-0'),
    icon: 'FundOutlined',
    isContentSlot: false,
    children: [
      {
        id: 'dashboardBase',
        name: '通用',
        type: 'dashboardBase',
        children: [
          {
            id: 'customImageCard',
            icon: deviceProduct,
            name: '数量',
            type: 'customImageCard',
            pageType: 'dashboard'
          },
          {
            id: 'customChartsCard',
            icon: deviceProduct,
            name: '图表',
            type: 'customChartsCard',
            pageType: 'dashboard'
          }
        ]
      },
      {
        id: 'dashboardDeviceManagement',
        name: '设备管理',
        type: 'dashboardSystem',
        children: [
          {
            id: 'productCountCard',
            icon: deviceProduct,
            name: '产品数量',
            type: 'productCountCard',
            pageType: 'dashboard'
          },
          {
            id: 'deviceCountCard',
            icon: deviceProduct,
            name: '设备数量',
            type: 'deviceCountCard',
            pageType: 'dashboard'
          },
          {
            id: 'onlineChartStatus',
            icon: deviceProduct,
            name: '当前在线',
            type: 'onlineChartStatus',
            pageType: 'dashboard'
          },
          {
            id: 'messageQuantityChart',
            icon: deviceProduct,
            name: '今日设备消息量',
            type: 'messageQuantityChart',
            pageType: 'dashboard'
          },
          {
            id: 'productMessage',
            icon: deviceProduct,
            name: '设备消息',
            type: 'productMessage',
            pageType: 'dashboard'
          }
        ]
      },
      {
        id: 'Control',
        name: '控制',
        type: 'Control',
        children: [
          {
            id: 'Control_switchList',
            icon: deviceProduct,
            name: '开关量控制列表',
            type: 'switchList',
            pageType: 'dashboard'
          },
          {
            id: 'Control_switchOne',
            icon: deviceProduct,
            name: '开关量控制1',
            type: 'switchOne',
            pageType: 'dashboard'
          },
          {
            id: 'Control_switchTwo',
            icon: deviceProduct,
            name: '开关量控制2',
            type: 'switchTwo',
            pageType: 'dashboard'
          },
          {
            id: 'Control_enumeration',
            icon: deviceProduct,
            name: '枚举控制',
            type: 'enumeration',
            pageType: 'dashboard'
          }
        ]
      },
      {
        id: 'Information',
        name: '信息',
        type: 'Information',
        children: [
          {
            id: 'Information_switchSignalLight',
            icon: deviceProduct,
            name: '开关量信号灯',
            type: 'switchSignalLight',
            pageType: 'dashboard'
          },
          {
            id: 'Information_switchStatusOne',
            icon: deviceProduct,
            name: '开关量状态1',
            type: 'switchStatusOne',
            pageType: 'dashboard'
          },
          {
            id: 'Information_numericalInfoOne',
            icon: deviceProduct,
            name: '数值信息1',
            type: 'numericalInfoOne',
            pageType: 'dashboard'
          }
        ]
      },
      {
        id: 'List',
        name: '列表',
        type: 'List',
        children: [
          {
            id: 'List_deviceList',
            icon: deviceProduct,
            name: '设备列表',
            type: 'deviceList',
            pageType: 'dashboard'
          },
          {
            id: 'List_deviceCard',
            icon: deviceProduct,
            name: '设备卡片',
            type: 'deviceCard',
            pageType: 'dashboard'
          },
          {
            id: 'List_deviceAlarmRecord',
            icon: deviceProduct,
            name: '设备告警记录',
            type: 'deviceAlarmRecord',
            pageType: 'dashboard'
          },
          {
            id: 'List_numericalListOne',
            icon: deviceProduct,
            name: '数值列表1',
            type: 'numericalListOne',
            pageType: 'dashboard'
          }
        ]
      },
      {
        id: 'dashboardGauge',
        name: '表盘',
        type: 'dashboardSystem',
        children: [
          {
            id: 'gauge1',
            icon: deviceProduct,
            name: '温度辐射表盘',
            type: 'gauge1',
            pageType: 'dashboard'
          },
          {
            id: 'gauge2',
            icon: deviceProduct,
            name: '温度刻度表',
            type: 'gauge2',
            pageType: 'dashboard'
          },
          {
            id: 'gauge3',
            icon: deviceProduct,
            name: '速度仪表盘',
            type: 'gauge3',
            pageType: 'dashboard'
          },
          {
            id: 'gauge4',
            icon: deviceProduct,
            name: '径向表盘',
            type: 'gauge4',
            pageType: 'dashboard'
          },
          {
            id: 'gaugeCompass',
            icon: deviceProduct,
            name: '指南针',
            type: 'gaugeCompass',
            pageType: 'dashboard'
          }
        ]
      },
      {
        id: 'dashboardChart',
        name: '图表',
        type: 'dashboardSystem',
        children: [
          {
            id: 'historyLineChart',
            icon: deviceProduct,
            name: '历史数据折线图',
            type: 'historyLineChart',
            pageType: 'dashboard'
          },
          {
            id: 'realtimeLineChart',
            icon: deviceProduct,
            name: '实时数据折线图',
            type: 'realtimeLineChart',
            pageType: 'dashboard'
          }
        ]
      },
      {
        id: 'MultiMedia',
        name: '视频',
        type: 'dashboardSystem',
        children: [
          {
            id: 'deviceVideo',
            icon: deviceProduct,
            name: '视频设备',
            type: 'deviceVideo',
            pageType: 'dashboard'
          }
        ]
      },
      {
        id: 'Map',
        name: '地图',
        type: 'dashboardSystem',
        children: [
          {
            id: 'aMap',
            icon: deviceProduct,
            name: '高德地图',
            type: 'aMap',
            pageType: 'dashboard'
          }
        ]
      }
    ]
  }
]

/**
 * 获取仪表盘默认组件列表
 * @param options.groupIds - 可选，按 group ID 过滤。不传则返回全量（向后兼容）
 *   可选 ID: 'dashboardBase','dashboardDeviceManagement',
 *           'Control','Information','List','dashboardGauge','dashboardChart','MultiMedia','Map'
 */
export const getDashboardComponents = (options?: { groupIds?: string[] }) => {
  if (!options?.groupIds?.length) {
    return DashboardComponents
  }

  const allowedIds = new Set(options.groupIds)
  return DashboardComponents.map((section) => ({
    ...section,
    children: (section.children || []).filter((group: any) => allowedIds.has(group.id))
  })).filter((section) => section.children.length > 0)
}

/**
 * 全局扫描并获取扩展模块的仪表盘组件列表
 * @param options.moduleFilter - 指定扫描的模块名列表
 */
const _extensionCache = new Map<string, any[]>()

export const getExtensionDashboardComponents = (options?: { moduleFilter?: string[] }) => {
  const cacheKey = options?.moduleFilter?.slice().sort().join(',') ?? '__all__'
  if (_extensionCache.has(cacheKey)) return _extensionCache.get(cacheKey)!

  const manifests = import.meta.glob('../../../*/visDashboard/*/manifest.json', { eager: true })
  const configs = import.meta.glob('../../../*/visDashboard/*/*/config.ts', { eager: true })
  const images: any = import.meta.glob('../../../*/visDashboard/*/*/*.png', { eager: true })

  const groupMap = new Map()
  const moduleFilter = options?.moduleFilter?.length ? new Set(options.moduleFilter) : null

  // 1. 初始化分组
  Object.keys(manifests).forEach((path) => {
    // 相对路径匹配示例: ../../../sentinel-manager-ui/visDashboard/...
    const match = path.match(/^\.\.\/\.\.\/\.\.\/([^/]+)\/visDashboard/)
    if (!match) return
    const mName = match[1]

    // 过滤模块
    if (moduleFilter && !moduleFilter.has(mName)) return

    const manifest: any = (manifests[path] as any).default || manifests[path]
    const pathParts = path.split('/')
    const groupDir = pathParts[pathParts.length - 2] // 分组目录名

    // 唯一标识应包含模块名以防冲突
    const groupKey = `${mName}_${groupDir}`
    // 动态生成类型标识: sentinel-manager-ui -> sentinelExtension
    const extensionType = `${mName.split('-')[0]}Extension`

    groupMap.set(groupKey, {
      id: manifest.id || groupDir,
      name: manifest.name || groupDir,
      type: extensionType,
      children: []
    })
    console.log('mName', mName)
  })

  // 2. 填充组件
  Object.keys(configs).forEach((path) => {
    const match = path.match(/^\.\.\/\.\.\/\.\.\/([^/]+)\/visDashboard/)
    if (!match) return
    const mName = match[1]

    if (moduleFilter && !moduleFilter.has(mName)) return

    const pathParts = path.split('/')
    const groupDir = pathParts[pathParts.length - 3]
    const groupKey = `${mName}_${groupDir}`

    if (groupMap.has(groupKey)) {
      const configModule: any = configs[path]
      const configKey = Object.keys(configModule).find((key) => key !== 'default') || 'default'
      const config = configModule[configKey]

      if (config && config.type) {
        const imagePath = path.replace('config.ts', `${config.type}.png`)
        const icon = images[imagePath]?.default || images[imagePath] || ''

        groupMap.get(groupKey).children.push({
          ...config,
          id: config.type,
          icon: icon,
          pageType: 'dashboard'
        })
      }
    }
  })

  const result = Array.from(groupMap.values()).filter((g) => g.children.length > 0)
  _extensionCache.set(cacheKey, result)
  return result
}
