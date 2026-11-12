// Record the pre-existing shortcut callback error separately from passing compatibility cases.
const assert = require('node:assert/strict');
const { runCase } = require('./save-contract.cjs');
async function main() {
  const errors = [];
  const collect = error => errors.push(error.message);
  process.on('unhandledRejection', collect);
  try {
    const before = await runCase('Media/GB28181', 'gb28181-2016', false, { query: { save: 'true', sourceId: 'fixture-source' } }, true);
    const after = await runCase('Media/GB28181', 'gb28181-2016', false, { query: { save: 'true', sourceId: 'fixture-source' } }, false);
    assert.deepEqual(after, before);
    assert.deepEqual(errors, ['rsp is not defined', 'rsp is not defined']);
    console.log('已在改造前后复现既有缺陷：GB28181 快捷创建成功后 onBack(rsp) 引用未定义变量。普通新增/编辑不受此分支影响；本次保持原行为，未作为通过项。');
  } finally { process.off('unhandledRejection', collect); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
