import { executeCommand } from '../../api/dashboardRuntime'
import { onlyMessage } from '@jetlinks-web/utils'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { storeToRefs } from 'pinia'

export function useControl() {
  const { useProjectStore } = moduleRegistry.getResource('visualization-manager-ui', 'stores')
  const projectStore = useProjectStore()
  const { currentProjectInfo } = storeToRefs(projectStore)

  /**
   * 执行设备功能调用
   * @param record 数据项记录
   * @param value 开关状态值（true/false）
   */
  const executeFunction = async (record: any, value: any) => {
    if (!record.config?.function?.isChecked) return
    // console.log(value,'record',record);

    const params: any = {
      deviceId: record.deviceId,
      functionId: undefined,
      inputs: []
    }

    const _function = record.config?.function

    if (value) {
      // 开关开启时的功能调用
      params.functionId = _function.openFunctionId
      params.inputs = _function.openFunctionKey
        ? [
            {
              name: _function.openFunctionKey,
              value: _function.openFunctionValue
            }
          ]
        : []
    } else {
      // 开关关闭时的功能调用
      params.functionId = _function.closeFunctionId
      params.inputs = _function.closeFunctionKey
        ? [
            {
              name: _function.closeFunctionKey,
              value: _function.closeFunctionValue
            }
          ]
        : []
    }

    const res = await executeCommand('deviceService:device', 'FunctionInvoke', currentProjectInfo.value.projectId, {
      message: params
    })

    if (res.success) {
      onlyMessage('操作成功')
    }
  }
  /**
   * 设置属性
   * @param record 数据项记录
   * @param value 属性值
   */
  const executeProperties = async (record: any, value: any) => {
    const res = await executeCommand('deviceService:device', 'WriteProperty', currentProjectInfo.value.projectId, {
      message: {
        deviceId: record.deviceId,
        properties: {
          [record.mappingId]: value
        }
      }
    })

    if (res.success) {
      onlyMessage('操作成功')
    }
  }

  return { executeFunction, executeProperties }
}
