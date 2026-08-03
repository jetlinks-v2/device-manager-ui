import { deviceModelService } from './deviceModel.service'
import { deviceNavigationService } from './deviceNavigation.service'
import { devicePropertyService } from './deviceProperty.service'
import { deviceQueryService } from './deviceQuery.service'

export const deviceAnalysisService = {
  ...deviceQueryService,
  ...deviceModelService,
  ...devicePropertyService,
  ...deviceNavigationService,
}
