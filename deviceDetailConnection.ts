import { reactive, type UnwrapRef } from 'vue'
import { useDeviceConnectionObservation } from './components/device-detail/useDeviceConnectionObservation'

export type DeviceConnectionSubject = Parameters<typeof useDeviceConnectionObservation>[0]
export type DeviceConnectionObservation = UnwrapRef<ReturnType<typeof useDeviceConnectionObservation>>

/** 同一详情的状态入口和紧凑指标共用一份采样状态，跨模块从注册表同步获取。 */
export function useDeviceConnectionHeader(subject: DeviceConnectionSubject): DeviceConnectionObservation {
  return reactive(useDeviceConnectionObservation(subject))
}
