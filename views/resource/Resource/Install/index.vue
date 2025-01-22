<template>
  <a-modal
      title="安装资源"
      visible
      @cancel="emits('close')"
      :maskClosable="false"
      :width="1000"
      :footer="null"
  >
    <InstallIng
        v-if="taskList.length"
        :taskList="taskList"
        :resourceVersionMap="resourceVersionMap"
        :source="source"
        @refresh="getTaskList"
    />
    <List
        v-else-if="source === 'cloud'"
        :source="source"
        ref="listRef"
        v-model:value="fileList"
        :resourceVersionMap="resourceVersionMap"
        :errMessage="errMessage"
        @cancel="emits('close')"
        @refresh="getTaskList"
    />
    <template v-else>
      <Init v-model:source="source" v-model:value="fileList" :resourceVersionMap="resourceVersionMap"
            @close="emits('close')" @refresh="getTaskList" @getByCloudError="getByCloudError"/>
    </template>
  </a-modal>
</template>

<script setup>
import Init from './components/Init.vue';
import List from './components/List.vue';
import InstallIng from './components/InstallIng.vue';
import {
  queryTaskListNoPaging,
  _queryTemplateNoPaging,
} from '@device/api/resource/resource';

const emits = defineEmits(['close']);
const source = ref('');
const listRef = ref()
const fileList = ref([]);
const taskList = ref([]);

const getTaskList = async () => {
  const resp = await queryTaskListNoPaging({
    terms: [
      {
        column: 'state',
        termType: 'not',
        value: 'success',
      },
    ],
  });
  if (resp.success) {
    taskList.value = resp.result;
  }
};

const resourceVersionMap = ref(new Map());
const errMessage = ref('');

const getVersion = async (ids) => {
  const params = {
    paging: false,
    terms: [
      {
        terms: [
          {
            type: 'or',
            value: ids,
            termType: 'in',
            column: 'id',
          },
        ],
      },
    ],
  };
  const res = await _queryTemplateNoPaging(params);
  if (res.success) {
    res.result.forEach((i) => {
      resourceVersionMap.value.set(i.id, i.version);
    });
    listRef.value?.compareVersion()
  }
};

const getByCloudError = (err)=>{
  errMessage.value = err
}

watch(
    () => [fileList.value, taskList.value],
    () => {
      let resourceIds = []
      if (taskList.value.length) {
         taskList.value.forEach((i) => {
           const _id = i.resourceDetails?.id || i.resourceDetails?.releaseDetail?.resourcesId
           _id && resourceIds.push(_id);
        })
        source.value = taskList.value[0]?.type?.value;
      } else {
        fileList.value?.forEach((i) => {
           i.resourcesId && resourceIds.push(i.resourcesId) || i.id && resourceIds.push(i.id);
        });
      }
      resourceVersionMap.value.clear();
      if(resourceIds.length) {
        getVersion(resourceIds);
      }else{
        nextTick(()=>{
          listRef.value?.compareVersion()
        })
      }
    }, {
      deep: true
    }
);

onMounted(() => {
  getTaskList();
});
</script>
<style lang="less" scoped></style>
