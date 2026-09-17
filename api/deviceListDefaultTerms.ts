export type IotDeviceListQueryTerm = {
  column?: string
  termType?: string
  value?: unknown
  type?: string
  terms?: IotDeviceListQueryTerm[]
}

export function withIotDeviceListDefaultTerms<T extends IotDeviceListQueryTerm>(terms: T[] = []): Array<T | IotDeviceListQueryTerm> {
  return terms
}
