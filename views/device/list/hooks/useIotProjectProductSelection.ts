import type { IotDeviceProductTemplate } from '@device-manager-ui/api/device'

const PROJECT_PRODUCT_STORAGE_PREFIX = 'jetlinks:iot:add-device-products:'

function projectProductStorageKey(projectId: string) {
  return `${PROJECT_PRODUCT_STORAGE_PREFIX}${projectId}`
}

function readProjectProductIds(projectId: string) {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(projectProductStorageKey(projectId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function writeProjectProductIds(projectId: string, ids: string[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(projectProductStorageKey(projectId), JSON.stringify([...new Set(ids)]))
  } catch {
    // localStorage 不可用时保持本次页面内选择，不阻塞 MVP 流程。
  }
}

export function resolvePersistedProjectProducts(projectId: string, products: IotDeviceProductTemplate[]) {
  const idSet = new Set(readProjectProductIds(projectId))
  return products.filter((product) => idSet.has(product.id))
}

export function appendPersistedProjectProduct(
  projectId: string,
  currentProducts: IotDeviceProductTemplate[],
  product: IotDeviceProductTemplate,
) {
  const nextProducts = currentProducts.some((item) => item.id === product.id)
    ? currentProducts
    : [product, ...currentProducts]

  writeProjectProductIds(projectId, nextProducts.map((item) => item.id))

  return nextProducts
}
