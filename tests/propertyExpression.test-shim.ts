export { expressionReferences } from '../../../jetlinks-web-core/src/components/Expression/display'
import type { ExpressionEvaluation,ExpressionEvaluationRequest } from '../../../jetlinks-web-core/src/components/Expression/types'
let evaluator:(request:ExpressionEvaluationRequest)=>Promise<ExpressionEvaluation>
export function setExpressionEvaluator(value:typeof evaluator){evaluator=value}
export function evaluateExpression(request:ExpressionEvaluationRequest){return evaluator(request)}
