import { deviceModelService } from './deviceModel.service'
import { deviceNavigationService } from './deviceNavigation.service'
import { devicePropertyService } from './deviceProperty.service'
import { deviceQueryService } from './deviceQuery.service'
import { devicePropertyRulesService } from './propertyRules/service'
import { deviceConnectionService } from './deviceConnection.service'

export const deviceAnalysisService = {
  ...deviceQueryService,
  ...deviceModelService,
  ...devicePropertyService,
  ...devicePropertyRulesService,
  ...deviceConnectionService,
  ...deviceNavigationService,
}
