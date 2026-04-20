import { defineAsyncComponent } from 'vue'
import { deviceAlarmRecordConfig } from './config'

const DeviceAlarmRecord = {
  name: 'deviceAlarmRecord',
  component: defineAsyncComponent(() => import('./DeviceAlarmRecord.vue'))
}

const DeviceAlarmRecordConfig = [
  {
    name: 'deviceAlarmRecord',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const DeviceAlarmRecordConfigProps = {
  ...deviceAlarmRecordConfig
}

export { DeviceAlarmRecord, DeviceAlarmRecordConfig, DeviceAlarmRecordConfigProps }
