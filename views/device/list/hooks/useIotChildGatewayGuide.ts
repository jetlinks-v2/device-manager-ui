import { computed, type Ref } from 'vue'
import { Modal } from 'ant-design-vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import {
  encodeConditionFilterQuery,
  type ConditionFilterField,
  type ConditionFilterTerm,
} from '@jetlinks-web-core/components/ConditionFilter'
import { normalizeDeviceTypeValue } from '@device-manager-ui/api/device'
import { buildIotDeviceDetailPath, buildIotDeviceListPath } from './useIotDeviceRouting'

type Translate = (key: string) => string

export function useIotChildGatewayGuide(
  projectId: Ref<string>,
  route: RouteLocationNormalizedLoaded,
  router: Router,
  $t: Translate,
) {
  const gatewayDeviceFilterFields = computed<ConditionFilterField[]>(() => [
    {
      dataIndex: 'deviceType',
      title: $t('IotDeviceList.filter.type'),
      search: {
        type: 'select',
        defaultTermType: 'eq',
        options: [
          { label: $t('IotDeviceList.deviceType.gateway'), value: 'gateway' },
        ],
      },
    },
  ])

  function goToCreatedDeviceAccess(deviceId: string) {
    void router.push(buildIotDeviceDetailPath(projectId.value, deviceId, {
      tab: 'access',
      sub: 'connection',
    }, route))
  }

  function isChildDeviceType(value?: unknown) {
    return normalizeDeviceTypeValue(value) === 'childrenDevice'
  }

  function openChildGatewayGuide() {
    Modal.confirm({
      title: $t('IotDeviceList.gatewayGuide.title'),
      content: $t('IotDeviceList.gatewayGuide.content'),
      okText: $t('IotDeviceList.gatewayGuide.ok'),
      cancelText: $t('IotDeviceList.gatewayGuide.cancel'),
      onOk: () => goToGatewayDeviceList(),
    })
  }

  function openCreatedDeviceAccessGuide(deviceId: string) {
    Modal.confirm({
      title: $t('IotDeviceList.createdGuide.title'),
      content: $t('IotDeviceList.createdGuide.content'),
      okText: $t('IotDeviceList.createdGuide.ok'),
      cancelText: $t('IotDeviceList.createdGuide.cancel'),
      onOk: () => goToCreatedDeviceAccess(deviceId),
    })
  }

  function goToGatewayDeviceList() {
    const terms: ConditionFilterTerm[] = [
      { column: 'deviceType', termType: 'eq', value: 'gateway' },
    ]
    const q = encodeConditionFilterQuery(terms, gatewayDeviceFilterFields.value)
    // 子设备只能在网关详情中挂载，列表跳转必须携带后端 deviceType 查询条件。
    void router.push({
      path: buildIotDeviceListPath(projectId.value, route),
      query: q ? { q } : {},
    })
  }

  return {
    goToCreatedDeviceAccess,
    isChildDeviceType,
    openChildGatewayGuide,
    openCreatedDeviceAccessGuide,
  }
}
