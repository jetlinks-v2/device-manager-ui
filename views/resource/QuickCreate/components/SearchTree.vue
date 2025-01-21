<template>
    <div style="margin-top: 8px">
        <a-tree
            v-if="data.length"
            :fieldNames="{
                title: 'name',
                key: 'id',
                children: 'children',
            }"
            :tree-data="data"
            v-model:selectedKeys="selectedKeys"
            @select="select"
        >
        </a-tree>
        <div  v-else style="margin-top: 20%">
          <j-empty></j-empty>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    data: {
        type: Object,
        default: () => {},
    },
});
const emits = defineEmits(['select']);
const selectedKeys = ref();
const select = (selectedKeys) => {
    emits('select', selectedKeys[0]);
};
</script>
<style lang="less" scoped>
</style>
