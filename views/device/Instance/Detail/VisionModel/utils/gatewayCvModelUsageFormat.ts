import type {
  AiModelUsedSource,
  EdgeGatewayModelUsageResponse,
} from '../gatewayCvModel.types'
import { textValue } from './gatewayCvModelFormat'

export function toUsageCameras(sources: AiModelUsedSource[]): EdgeGatewayModelUsageResponse['cameras'] {
  const cameraMap = new Map<string, NonNullable<EdgeGatewayModelUsageResponse['cameras']>[number]>()
  sources.forEach((source, index) => {
    const camera = {
      deviceId: textValue(source.deviceId),
      channelId: textValue(source.channelId, source.sourceId, source.id),
      deviceName: textValue(source.deviceName, source.channelName, source.sourceName, source.name),
      online: Boolean(source.online),
    }
    if (!camera.deviceId && !camera.channelId && !camera.deviceName) return

    // 任务详情可能按多个任务返回同一设备通道，覆盖摄像头按设备通道合并。
    const key = textValue(camera.deviceId, '') + '|' + textValue(camera.channelId, camera.deviceName, index)
    const existed = cameraMap.get(key)
    cameraMap.set(key, {
      ...camera,
      deviceName: textValue(existed?.deviceName, camera.deviceName),
      online: Boolean(existed?.online || camera.online),
    })
  })

  return Array.from(cameraMap.values())
}

export function toUsageTasks(sources: AiModelUsedSource[]): EdgeGatewayModelUsageResponse['tasks'] {
  const taskMap = new Map<string, NonNullable<EdgeGatewayModelUsageResponse['tasks']>[number]>()
  sources.forEach((source, index) => {
    const tasks = normalizeSourceTasks(source, index)

    tasks.forEach((task, taskIndex) => {
      const taskId = textValue(task.taskId, task.id, `source-${index}-task-${taskIndex}`)
      const taskName = textValue(task.taskName, task.name)
      if (!taskId || (!taskName && taskId.startsWith('source-'))) return

      taskMap.set(taskId, {
        taskId,
        taskName,
        sceneName: textValue(source.sourceName, source.name),
      })
    })
  })

  return Array.from(taskMap.values())
}

function normalizeSourceTasks(source: AiModelUsedSource, index: number) {
  if (Array.isArray(source.tasks) && source.tasks.length) {
    return source.tasks
  }

  return [
    {
      taskId: textValue(source.taskId, `source-${index}`),
      taskName: textValue(source.taskName),
    },
  ]
}
