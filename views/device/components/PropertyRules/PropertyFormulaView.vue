<template><MathExpressionView :node="expression.root" :context="context" compact><span>{{ text }}</span></MathExpressionView></template>
<script setup lang="ts">
import { computed } from 'vue'
import { MathExpressionView,expressionText,type ExpressionEditorContext,type StructuredExpression } from '@jetlinks-web-core/components/Expression'
import type { ThingModelProperty } from '../../alarm/types'
import { usePropertyExpression } from './usePropertyExpression'
const props=defineProps<{expression:StructuredExpression;property:ThingModelProperty;context?:ExpressionEditorContext}>()
const context=props.context ? computed(()=>props.context!) : usePropertyExpression(()=>props.property).context
const text=computed(()=>expressionText(props.expression,node=>context.value.references.find(item=>item.id === node.id)?.label || node.id))
</script>
