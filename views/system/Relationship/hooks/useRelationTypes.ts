import { getObjectList_api } from '@device/api/system/relationship';

const beRelationTypesFilterKeys = ['user', 'device']

export const useRelationTypes = () => {
    //关联方列表
    const relationTypes = ref([]);
    //被关联方列表
    const beRelationTypes = ref([]);
    getObjectList_api().then(res => {
        relationTypes.value = res.result.filter(item => item.id === 'device');
        beRelationTypes.value = res.result.filter(item => beRelationTypesFilterKeys.includes(item.id));
    })
    return {
        relationTypes,
        beRelationTypes
    }
}
