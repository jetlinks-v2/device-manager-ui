import {useRequest} from "@jetlinks-web/hooks";
import {queryNoPagingPost} from "../api/instance";

export const useDevice = (params = {}, immediate = true) => {
    const deviceList = ref<any[]>([])

    const {reload} = useRequest(queryNoPagingPost, {
        defaultParams: {
            paging: false,
            sorts: [{name: 'createTime', order: 'desc'}],
            ...params
        },
        immediate: immediate,
        onSuccess(resp) {
            if (resp.success) {
                deviceList.value = resp.result.map((i: any) => {
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
        deviceList,
        reload
    }
};
