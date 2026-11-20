import { ref, reactive } from 'vue'

type GroupActiveType = {
    value?: string | number
    label?: string
    len?: number
    effective?: number
    inherited?: boolean
}


export const useGroup = (openGroup: boolean = false) => {

    const groupOptions = ref<Array<GroupActiveType>>([])
    const groupActive = reactive<GroupActiveType>({
        value: undefined,
        label: undefined
    })

    /**
     * 更新当前选择的分组id
     * @param key
     * @param name
     */
    const updateGroupActive = (key: string | number, name: string) => {
        if (openGroup) {
            groupActive.value = key
            groupActive.label = name
        }

    }

    const addGroup = (val: GroupActiveType) => {
        if (openGroup) {
            groupOptions.value.push({ effective: 0, len: 0, inherited: false, ...val })
        }
    }

    const removeGroup = (index: number) => {
        if (openGroup) {
            groupOptions.value.splice(index, 1)
        }
    }

    const updateGroupOptions = (options: Array<GroupActiveType> = []) => {
        if (openGroup) {
            groupOptions.value = options
        }
    }

    return {
        groupOptions,
        groupActive,
        updateGroupActive,
        addGroup,
        removeGroup,
        updateGroupOptions
    }
}
