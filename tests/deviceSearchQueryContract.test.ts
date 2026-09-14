import assert from 'node:assert/strict'

import {
  createDeviceKeywordQueryTerm,
  DEVICE_FUZZY_TERM_TYPE,
  prepareDeviceQueryTerm,
} from '../api/deviceQueryTerms.ts'

const keyword = createDeviceKeywordQueryTerm(' jt808 ')
assert.deepEqual(keyword.terms?.map(term => term.column), [
  'name',
  'id',
  'productName',
  'productId$product-info',
  'productId$product-info',
])
assert.equal(keyword.terms?.some(term => term.column === 'identifier'), false)
assert.deepEqual(keyword.terms?.slice(0, 3).map(term => term.termType), [
  DEVICE_FUZZY_TERM_TYPE,
  DEVICE_FUZZY_TERM_TYPE,
  DEVICE_FUZZY_TERM_TYPE,
])
assert.deepEqual(keyword.terms?.slice(0, 3).map(term => term.value), [
  '%jt808%',
  '%jt808%',
  '%jt808%',
])

for (const productTerm of keyword.terms?.slice(3) ?? []) {
  const [nested] = productTerm.value as Array<{ termType: string; value: string }>
  assert.equal(nested.termType, DEVICE_FUZZY_TERM_TYPE)
  assert.equal(nested.value, '%jt808%')
}

const legacyKeyword = prepareDeviceQueryTerm({
  column: 'name',
  termType: 'like',
  value: 'Jt808',
})
assert.equal(legacyKeyword.terms?.length, 5)
assert.equal(legacyKeyword.terms?.[0]?.termType, DEVICE_FUZZY_TERM_TYPE)
assert.equal(legacyKeyword.terms?.[0]?.value, '%Jt808%')

const explicitGroup = prepareDeviceQueryTerm({
  terms: [
    { column: 'name', termType: DEVICE_FUZZY_TERM_TYPE, value: 'JT808' },
    { column: 'id', termType: DEVICE_FUZZY_TERM_TYPE, value: 'JT808', type: 'or' },
  ],
})
assert.equal(explicitGroup.terms?.length, 2)
assert.deepEqual(explicitGroup.terms?.map(term => term.value), ['%JT808%', '%JT808%'])

assert.deepEqual(prepareDeviceQueryTerm({
  column: 'id',
  termType: 'eq',
  value: 'JT808',
}), {
  column: 'id',
  termType: 'eq',
  value: 'JT808',
})
