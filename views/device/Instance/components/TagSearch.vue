<template>
    <a-input @click="show" v-model:value="presentation"> </a-input>
    <a-modal v-if="showTagSearch" title="筛选条件" visible @cancel="showTagSearch = false" @ok="submitSearch">
        <a-form layout="vertical">
            <a-form-item label="设备标签:">
                <a-row :gutter="16" v-for="(i,index) in searchValue" style="margin-bottom: 10px;">
                    <a-col :span="10">
                        <a-input placeholder="请输入标签key" v-model:value="i.key"></a-input>
                    </a-col>
                    <a-col :span="10">
                        <a-input placeholder="请输入标签value" v-model:value="i.value"></a-input>
                    </a-col>
                    <a-col :span="4">
                        <a-button type="link">
                            <template #icon><AIcon type="MinusCircleOutlined" @click="deletePair(index)"/></template>
                        </a-button>
                    </a-col>
                </a-row>
            </a-form-item>
            <a-button type="link" @click="addPair">
              添加
            </a-button>
        </a-form>
    </a-modal>
</template>

<script lang="ts" setup>
const emit =  defineEmits(['change','update:value'])
const showTagSearch = ref(false);
const presentation = ref('');
const searchValue = ref([{
  key:'',
  value:''
}]);
const show = () => {
    showTagSearch.value = true;
};
const addPair = () =>{
    searchValue.value.push({
      key:'',
      value:''
    })
}
const deletePair = (index:number) =>{
    searchValue.value.splice(index,1)
}
const submitSearch = () => {
    searchValue.value.forEach((item:any,index:number)=>{
      presentation.value = index === 0 ? item.key + '=' + item.value :presentation.value + ';' + item.key + '=' + item.value
    })
    emit('update:value',searchValue)
    emit('change')
    showTagSearch.value = false
}
</script>
<style lang="less" scoped></style>
