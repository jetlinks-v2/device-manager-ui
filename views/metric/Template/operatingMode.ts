/** Example codes only: copy the real source declaration before binding a business operating mode. */
export const operatingModeType = {
  type: 'enum', valueType: { type: 'int' },
  elements: [{ value: 0, text: '空载' }, { value: 1, text: '带载' }],
}
export function operatingModeMessages(path: string) {
  return { [`${path}.enum.0`]: { zh: '空载', en: 'Unloaded' }, [`${path}.enum.1`]: { zh: '带载', en: 'Loaded' } }
}
export const operatingModeNotes = {
  zh: '运行工况须绑定真实业务状态，如PLC运行模式或业务对象声明的状态事件；示例0空载、1带载，配置时应采用实际来源的类型与编码。工况改变后只使用当前连续工况内的样本。没有工况来源时，清除算法的分段来源并移除此输入，不用固定文本伪装业务状态。',
  en: 'Bind an actual business state, such as a PLC mode or a declared business-state event. Example codes 0 unloaded and 1 loaded must be replaced by the real source type and codes. Only samples in the current contiguous mode participate. If no mode source exists, clear the calculator context and remove this input rather than inventing a constant text state.',
}
