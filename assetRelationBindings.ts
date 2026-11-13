import { createAssetRelationBinding } from '@jetlinks-web-core/utils/asset-relation-binding'

/** 仅接入设备直接字段的组织归属；组织选择器仍由身份模块注册。 */
export const deviceAssetRelationBindings = {
  device: [createAssetRelationBinding({
    source: 'direct', dimensionType: 'org', relation: 'owner', multiple: false
  })]
}
