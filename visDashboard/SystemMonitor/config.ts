import i18n from '@jetlinks-web-core/locales'
import type { DashboardWidgetDefaults } from '@jetlinks-web-core/components/DashBoardCanvas'

/** Stable types and widget IDs preserve personal layouts across monitor data updates. */
export function createMonitorConfig(type: string, titleKey: string, width: number): DashboardWidgetDefaults {
  return { type, name: i18n.global.t(titleKey),
    componentProps: { gridItem: { x: 0, y: 0, w: width, h: 13, minW: width === 12 ? 6 : 4, minH: 10 } } }
}
