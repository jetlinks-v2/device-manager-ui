import type { StructuredExpression,ExpressionNode } from '@jetlinks-web-core/components/Expression'
import { expressionText } from '@jetlinks-web-core/components/Expression/utils'

export interface CorrectionStep { operator:'add'|'subtract'|'multiply'|'divide'; value:string|null }
export type CorrectionSteps = [CorrectionStep,CorrectionStep]
export interface CorrectionDraft {
  scale:string|null; offset?:string|null
  correction?:StructuredExpression
  correctionMode?:'simple'|'formula'
  correctionSteps?:CorrectionSteps
  correctionInvalid?:boolean
  correctionPending?:boolean
}
export const currentValue:ExpressionNode={type:'reference',id:'value',path:[]}
/** Only immutable metadata from this property/message; no cross-property order dependencies. */
export const correctionReferences=[
  {id:'value',type:'double',icon:'NumberOutlined'},
  {id:'propertyTime',type:'long',icon:'FieldTimeOutlined'},
  {id:'messageTime',type:'long',icon:'ClockCircleOutlined'},
  {id:'sourceTime',type:'long',icon:'HistoryOutlined'},
  {id:'propertyState',type:'string',icon:'SafetyCertificateOutlined'},
  {id:'propertyId',type:'string',icon:'TagOutlined'},
  {id:'thingId',type:'string',icon:'HddOutlined'},
] as const
const scalar=(value:unknown):value is string=>typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value))
const literal=(value:string):ExpressionNode=>({type:'literal',valueType:'decimal',value})
const operators=['add','subtract','multiply','divide'] as const

/** Only one or two left-associated scalar operations can return to the compact controls. */
export function readCorrectionSteps(expression:StructuredExpression):CorrectionSteps|undefined {
  let node=expression.root
  const steps:CorrectionStep[]=[]
  while(node.type === 'binary' && steps.length<2 && operators.includes(node.operator as CorrectionStep['operator'])
    && node.right.type === 'literal' && !['string','boolean','null'].includes(node.right.valueType) && scalar(String(node.right.value))) {
    steps.unshift({operator:node.operator as CorrectionStep['operator'],value:String(node.right.value)})
    node=node.left
  }
  if(node.type !== 'reference' || node.id !== 'value' || node.path.length)return
  if(!steps.length)steps.push({operator:'multiply',value:'1'})
  if(steps.length === 1)steps.push({operator:'add',value:'0'})
  return steps as CorrectionSteps
}

export function buildCorrectionSteps(steps:CorrectionSteps):StructuredExpression|undefined {
  let root:ExpressionNode=currentValue
  for(const step of steps) {
    if(!scalar(step.value) || step.operator === 'divide' && Number(step.value) === 0)return
    root={type:'binary',operator:step.operator,left:root,right:literal(step.value)}
  }
  return {version:1,root}
}

/** Legacy calibration already has exactly the same two-operation order. */
export function legacyCorrectionSteps(draft:CorrectionDraft):CorrectionSteps {
  return [{operator:'multiply',value:draft.scale},{operator:'add',value:draft.offset ?? '0'}]
}

export function correctionIsFormula(draft:CorrectionDraft):boolean {
  return draft.correctionMode ? draft.correctionMode === 'formula' : Boolean(draft.correction && !readCorrectionSteps(draft.correction))
}

/** Unchanged legacy scale/calibration stays in its original provider until the user edits it. */
export function correctionTree(draft:CorrectionDraft):StructuredExpression {
  if(draft.correction)return draft.correction
  if(draft.correctionMode === 'simple' && draft.correctionSteps) return buildCorrectionSteps(draft.correctionSteps) || {version:1,root:currentValue}
  const tree=buildCorrectionSteps(legacyCorrectionSteps(draft))
  if(tree)return tree
  return {version:1,root:{type:'binary',operator:'add',left:{type:'binary',operator:'multiply',left:currentValue,right:literal(draft.scale || '1')},right:literal(draft.offset || '0')}}
}

export function readCorrection(expression?:StructuredExpression,editorMode?:unknown):Partial<CorrectionDraft> {
  if(!expression)return {}
  const steps=readCorrectionSteps(expression)
  return {correction:expression,correctionMode:editorMode === 'formula' || !steps ? 'formula' : 'simple',correctionSteps:steps,correctionInvalid:false}
}

/** Mode switching preserves the current structured formula, including unsaved decimal text. */
export function setCorrectionMode(draft:CorrectionDraft,mode:'simple'|'formula',reset=false) {
  if(draft.correctionInvalid && !reset)return
  const tree=reset ? buildCorrectionSteps([{operator:'multiply',value:'1'},{operator:'add',value:'0'}])! : correctionTree(draft),steps=readCorrectionSteps(tree)
  if(mode === 'simple' && !steps)return
  draft.correction=tree;draft.correctionSteps=steps;draft.correctionMode=mode;draft.correctionInvalid=false
}

export function correctionSummary(draft:CorrectionDraft,label:string,referenceLabel?:(id:string)=>string):string {
  return expressionText(correctionTree(draft),node=>node.id === 'value' ? label : referenceLabel?.(node.id) ?? node.id)
}

/** Unknown versions or references remain read-only instead of losing configuration on save. */
export function isCorrectionExpression(value:unknown):value is StructuredExpression {
  if(!value || typeof value !== 'object')return false
  const expression=value as StructuredExpression
  if(expression.version !== 1 || !expression.root)return false
  let count=0
  const valid=(node:ExpressionNode,depth=0):boolean=>{
    if(!node || depth>24 || ++count>128)return false
    const child=(item:ExpressionNode)=>valid(item,depth+1)
    switch(node.type) {
      case 'reference':return correctionReferences.some(item=>item.id === node.id) && Array.isArray(node.path) && node.path.length === 0
      case 'literal':return ['int','long','bigint','decimal','double'].includes(node.valueType) ? scalar(String(node.value)) : node.valueType === 'boolean' ? typeof node.value === 'boolean' : node.valueType === 'string' ? typeof node.value === 'string' : node.valueType === 'null' && node.value === null
      case 'unary':return ['positive','negate','not'].includes(node.operator) && child(node.operand)
      case 'binary':return ['add','subtract','multiply','divide','mod','eq','ne','gt','ge','lt','le'].includes(node.operator) && child(node.left) && child(node.right)
      case 'logical':return ['and','or'].includes(node.operator) && Array.isArray(node.operands) && node.operands.length>=2 && node.operands.every(child)
      case 'conditional':return child(node.condition) && child(node.whenTrue) && child(node.whenFalse)
      case 'call':return typeof node.function === 'string' && Array.isArray(node.arguments) && node.arguments.every(child)
      default:return false
    }
  }
  return valid(expression.root)
}
