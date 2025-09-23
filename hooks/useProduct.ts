import {useRequest} from "@jetlinks-web/hooks";
import {queryNoPagingPost} from "../api/product";

export const useProduct = (params = {}, immediate = true) => {
    const productList = ref<any[]>([])

    const {reload} = useRequest(queryNoPagingPost, {
        defaultParams: {
            paging: false,
            sorts: [{name: 'createTime', order: 'desc'}],
            ...params
        },
        immediate: immediate,
        onSuccess(resp) {
            if (resp.success) {
                productList.value = resp.result.map((i: any) => {
                    return {
                        ...i,
                        value: i.id,
                        label: i.name,
                    }
                })
            }
        }
    })

    return {
        productList,
        reload
    }
};
