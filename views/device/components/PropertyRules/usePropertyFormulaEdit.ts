import { onBeforeUnmount,ref,shallowRef } from 'vue'
import type { StructuredExpression } from '@jetlinks-web-core/components/Expression'

/** Formula edits stay local until Done; Cancel cannot remove or overwrite the configured rule. */
export function usePropertyFormulaEdit(model:()=>StructuredExpression,callbacks:{change:(value:StructuredExpression)=>void;invalid:(value:boolean)=>void;editing:(value:boolean)=>void;dirty?:(value:boolean)=>void}) {
  const editing=ref(false),invalid=ref(false),pending=shallowRef<StructuredExpression>()
  function start() {
    pending.value=JSON.parse(JSON.stringify(model()));invalid.value=false;editing.value=true
    callbacks.editing(true);callbacks.invalid(true);callbacks.dirty?.(false)
  }
  function update(value:StructuredExpression){pending.value=value;callbacks.dirty?.(JSON.stringify(value)!==JSON.stringify(model()))}
  function check(value:boolean){invalid.value=value;if(value)callbacks.dirty?.(true)}
  function close(){editing.value=false;pending.value=undefined;invalid.value=false;callbacks.invalid(false);callbacks.editing(false);callbacks.dirty?.(false)}
  function done(finish:()=>boolean){if(finish() && !invalid.value && pending.value){callbacks.change(pending.value);close()}}
  onBeforeUnmount(()=>{if(editing.value)close()})
  return {editing,invalid,pending,start,update,check,done,cancel:close}
}
