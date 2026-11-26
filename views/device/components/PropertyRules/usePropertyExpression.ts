import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useExpressionFunctions,type ExpressionEditorContext } from '@jetlinks-web-core/components/Expression'
import { correctionReferences } from './correction'
import type { ThingModelProperty } from '../../alarm/types'
import { propertyExpressionFunctions } from '../../../../api/propertyPreprocessorTrial'

/** Editing and example evaluation declare the same property/message context. */
export function usePropertyExpression(property:()=>ThingModelProperty,disabled:()=>boolean=()=>false) {
  const {t}=useI18n()
  const {functions,error,refresh}=useExpressionFunctions(propertyExpressionFunctions)
  const context=computed<ExpressionEditorContext>(()=>({
    references:correctionReferences.map(item=>({...item,path:[],label:t('PropertyRules.correction.'+item.id),description:t('PropertyRules.correction.'+item.id+'Hint'),schema:item.id === 'value' ? {...property().valueType} : {type:item.type}})),
    functions:functions.value,resultTypes:['number','null'],disabled:disabled(),
  }))
  return {context,error,refresh}
}
