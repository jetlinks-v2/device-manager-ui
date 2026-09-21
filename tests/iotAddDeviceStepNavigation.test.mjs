import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('..', import.meta.url))
const drawerSource = readFileSync(resolve(directory, 'views/device/list/components/IotAddDeviceDrawer.vue'), 'utf8')
const footerSource = readFileSync(resolve(directory, 'views/device/list/components/IotAddDeviceModalFooter.vue'), 'utf8')
const hookSource = readFileSync(resolve(directory, 'views/device/list/hooks/useIotAddDeviceDrawer.ts'), 'utf8')

test('device configuration returns to source selection without overwriting entered basic fields', () => {
  assert.match(footerSource, /v-if="showClose"/)
  assert.match(drawerSource, /:show-close="isEditMode \|\| isCreating"/)
  assert.match(drawerSource, /:show-previous="!isEditMode && !isCreating"/)
  assert.match(drawerSource, /@previous="backToSource"/)
  assert.match(drawerSource, /function backToSource\(\) \{[\s\S]*preserveFormOnSourceSelection\.value = true[\s\S]*clearSelectedSource\(\)/)
  assert.doesNotMatch(drawerSource, /function backToSource\(\) \{[\s\S]*clearBasicFields\(\)/)
  assert.match(drawerSource, /selectProduct\(productId, preserveFormOnSourceSelection\.value\)/)
  assert.match(drawerSource, /selectTemplate\(templateId, preserveFormOnSourceSelection\.value\)/)
  assert.match(hookSource, /function selectProduct\(productId: string, preserveForm = false\)[\s\S]*if \(!preserveForm\) applySourceDefaults/)
  assert.match(hookSource, /function selectTemplate\(templateId: string, preserveForm = false\)[\s\S]*if \(!preserveForm\) applySourceDefaults/)
})
