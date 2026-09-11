import type { ProductItem } from "../views/device/Product/typings";
import { defineStore } from "pinia";
import { detail as queryProductDetail, queryDetailList, getDeviceNumber } from '../api/product'
import {encodeQuery} from "@jetlinks-web-core/utils";

export const useProductStore = defineStore({
  id: 'product',
  state: () => ({
    current: {} as ProductItem,
    detail: {} as ProductItem,
    tabActiveKey: 'Info'
  }),
  actions: {
    setCurrent(current: ProductItem) {
      this.current = current
      this.detail = current
    },
    async getDetail(id: string) {
      // 聚合详情提供 features，产品直查补齐品牌、型号及其 i18n 前缀字段。
      const [productResp, detailResp] = await Promise.all([
        queryProductDetail(id),
        queryDetailList({
        "pageSize":1,
        "terms":[
          {
            "column": "id",
            "value": id
          }
        ]
        }),
      ])
      if (detailResp.status === 200) {
        const obj = detailResp.result?.data?.[0] || {}
        const product = productResp.status === 200 ? productResp.result || {} : {}
        this.current = {
          ...this.current, ...obj, ...product,
        }
        this.detail = { ...obj, ...product }
      }
    },
    async refresh(id: string) {
      await this.getDetail(id)
      const res = await getDeviceNumber(encodeQuery({ terms: { productId: id } }))
      if (res.status === 200) {
        this.current.count = res.result
      }
    },
    setTabActiveKey(key: string) {
      this.tabActiveKey = key
    },
    reSet() {
      this.current = {} as ProductItem
      this.detail = {} as ProductItem
    }
  }
})
