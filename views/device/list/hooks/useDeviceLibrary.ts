import { deviceLibraryService } from '../services/device-library/device-library.service'

export type {
  DeviceAccessMode,
  DeviceCategory,
  DeviceDataKind,
  DeviceDataPoint,
  DeviceIndustry,
  DeviceMaintainSource,
  DeviceModelSupport,
  DeviceNormalRange,
  DeviceScenario,
  DeviceTemplate,
  FaultCodeEntry,
  FaultCodeSeverity,
  KnowledgeEntry,
} from '../services/device-library/types'

export function useDeviceLibrary() {
  const devices = deviceLibraryService.subscribeTemplates()

  async function load() {
    return deviceLibraryService.listTemplates()
  }

  async function findDevice(id: string) {
    const found = await deviceLibraryService.getTemplate(id)
    return found.ok ? found.data : undefined
  }

  async function loadProjectDevices(projectId: string) {
    return deviceLibraryService.listProjectTemplates(projectId)
  }

  void load()

  return {
    devices,
    findDevice,
    load,
    loadProjectDevices,
  }
}
