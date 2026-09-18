import type { Component } from 'vue'

/**
 * 产品选择后由业务模块接管的创建面板。
 *
 * 设备模块只根据产品接入方式选择面板，不了解业务模块的字段、校验或保存接口。
 */
export type DeviceCreationExtension = {
  id: string
  matches: (accessProvider?: string) => boolean
  component: Component
}
