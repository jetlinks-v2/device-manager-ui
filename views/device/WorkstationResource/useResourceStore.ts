import { computed, ref } from 'vue'
import { queryAreaNoPaging } from './api/area'
import { queryWorkstationNoPaging } from './api/workstation'

// 缓存数据
const areaList = ref<Array<{ id: string; code: string; name: string }>>([])
const workstationList = ref<Array<{ id: string; code: string; name: string; areaId: string }>>([])
let initialized = false

export function useResourceStore() {
  const init = async () => {
    if (initialized) return
    await Promise.all([refreshAreaOptions(), refreshWorkstationOptions()])
    initialized = true
  }

  const refreshAreaOptions = async () => {
    try {
      const resp = await queryAreaNoPaging({ sorts: [{ name: 'code', order: 'asc' }] })
      areaList.value = (resp.result || []).map((item: any) => ({
        id: item.id,
        code: item.code || '',
        name: item.name || ''
      }))
    } catch { /* ignore */ }
  }

  const refreshWorkstationOptions = async () => {
    try {
      const resp = await queryWorkstationNoPaging({ sorts: [{ name: 'code', order: 'asc' }] })
      workstationList.value = (resp.result || []).map((item: any) => ({
        id: item.id,
        code: item.code || '',
        name: item.name || '',
        areaId: item.areaId || ''
      }))
    } catch { /* ignore */ }
  }

  // 下拉选项
  const areaOptions = computed(() =>
    areaList.value.map((item) => ({
      label: `${item.code}｜${item.name}`,
      value: item.id
    }))
  )

  const workstationOptions = computed(() =>
    workstationList.value.map((item) => ({
      label: `${item.code}｜${item.name}`,
      value: item.id
    }))
  )

  // 名称字典查询（从缓存中取）
  const getAreaName = (id: string) => areaList.value.find((item) => item.id === id)?.name || '-'
  const getAreaCode = (id: string) => areaList.value.find((item) => item.id === id)?.code || '-'
  const getWorkstationName = (id: string) => workstationList.value.find((item) => item.id === id)?.name || '-'
  const getWorkstationCode = (id: string) => workstationList.value.find((item) => item.id === id)?.code || '-'
  const getWorkstationAreaName = (id: string) => {
    const ws = workstationList.value.find((item) => item.id === id)
    return ws ? getAreaName(ws.areaId) : '-'
  }

  // 初始化
  init()

  return {
    areaOptions,
    workstationOptions,
    getAreaName,
    getAreaCode,
    getWorkstationName,
    getWorkstationCode,
    getWorkstationAreaName,
    refreshAreaOptions,
    refreshWorkstationOptions
  }
}
