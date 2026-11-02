import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMetricTestModule } from './metricTestModule.mjs'
const { metricReturnQuery, metricReferenceFromQuery, metricWorkspaceSelectionFromQuery, metricWorkspaceQuery, metricScopeKey, metricBusinessQuery } = await loadMetricTestModule('../views/device/metrics/metricLocation.ts')

test('non-first metric and output survive owner-specific return locations', () => {
  const reference = { configId: 'second-config', outputId: 'second-output' }
  for (const ownerType of ['device', 'product', 'deviceGroup', 'space']) {
    const context = { ownerType, ownerId: 'owner-2' }
    const query = metricReturnQuery({ projectId: 'project-1', q: 'existing-filter', scopeId: 'old-scope', floorPlanId: 'old-floor' }, context, reference)
    assert.deepEqual(metricReferenceFromQuery(query, context), reference)
    assert.equal(metricReferenceFromQuery(query, { ...context, ownerId: 'other-owner' }), undefined)
    assert.equal(query.projectId, 'project-1')
    assert.equal(query.q, 'existing-filter')
    if (ownerType === 'device') assert.equal(query.tab, 'metrics')
    if (ownerType === 'product') assert.equal(query.tab, 'Metrics')
    if (ownerType === 'deviceGroup') assert.deepEqual([query.scopeType, query.scopeId, query.metricView], ['group', 'owner-2', 'metrics'])
    if (ownerType === 'space') assert.deepEqual([query.spaceId, query.scopeId, query.floorPlanId, query.metricView], ['owner-2', undefined, undefined, 'metrics'])
  }
})

test('business return uses current detail B and does not revive initial A after close',()=>{
  const initial={metricOwnerType:'deviceGroup',metricOwnerId:'g',metricConfigId:'A',metricOutputId:'a',scopeType:'group',scopeId:'g'}
  const context={ownerType:'deviceGroup',ownerId:'g'}
  const current=metricBusinessQuery(initial,context,{configId:'B',outputId:'b'})
  assert.deepEqual(metricReferenceFromQuery(current,context),{configId:'B',outputId:'b'})
  const closed=metricBusinessQuery(initial,context)
  assert.equal(metricReferenceFromQuery(closed,context),undefined)
  assert.equal(closed.scopeId,'g')
})

test('workspace selection retains exact references for same owner and clears them on object change',()=>{
  const original={projectId:'p',metricOwnerType:'space',metricOwnerId:'a',metricConfigId:'second',metricOutputId:'output-2'}
  assert.deepEqual(metricWorkspaceSelectionFromQuery(original),{ownerType:'space',ownerId:'a'})
  assert.deepEqual(metricWorkspaceQuery(original,{ownerType:'space',ownerId:'a'}),original)
  assert.deepEqual(metricWorkspaceQuery(original,{ownerType:'space',ownerId:'b'}),{projectId:'p',metricOwnerType:'space',metricOwnerId:'b',metricConfigId:undefined,metricOutputId:undefined})
  assert.equal(metricWorkspaceSelectionFromQuery({metricOwnerType:['space'],metricOwnerId:'a'}),undefined)
  assert.deepEqual(metricWorkspaceSelectionFromQuery({metricOwnerType:'product',metricOwnerId:''}),{ownerType:'product',ownerId:''})
  assert.deepEqual(metricWorkspaceQuery(original),{projectId:'p',metricOwnerType:undefined,metricOwnerId:undefined,metricConfigId:undefined,metricOutputId:undefined})
})

test('selection persistence isolates user, project and tenant without storing labels',()=>{
  const first=metricScopeKey('u1','p1','t1')
  assert.notEqual(first,metricScopeKey('u2','p1','t1'))
  assert.notEqual(first,metricScopeKey('u1','p2','t1'))
  assert.notEqual(first,metricScopeKey('u1','p1','t2'))
  assert.equal(metricScopeKey('','p1','t1'),'')
  assert.equal(metricScopeKey('a:b','c','d'),metricScopeKey('a:b','c','d'))
  assert.notEqual(metricScopeKey('a:b','c','d'),metricScopeKey('a','b:c','d'))
})
