<template>
    <a-modal
        visible
        :centered="true"
        @cancel="emits('close')"
        :maskClosable="false"
        :width="1000"
        :footer="null"
        :closable="false"
    >
        <template #title>
            <div class="header">
                <div @click="emits('close')">
                    <AIcon
                        type="ArrowLeftOutlined"
                        style="font-size: 18px; margin-bottom: 12px"
                    />
                    返回
                </div>
                <div class="title">受影响的产品</div>
            </div>
        </template>
        <pro-search :columns="columns" type="simple" @search="handleSearch" />
        <a-divider style="margin: 0" />
        <div class="content">
            <j-pro-table
                ref="actionRef"
                mode="CARD"
                :columns="columns"
                :params="params"
                :request="
                    (e) =>
                        type === 'metadata'
                            ? _queryProduct(_id, e)
                            : _queryProtocol(_id, e)
                "
                :gridColumns="[2]"
                :bodyStyle="{
                    paddingRight: 0,
                    paddingLeft: 0,
                }"
            >
                <template #card="slotProps">
                    <CardBox
                        :value="slotProps"
                        :status="String(slotProps.state)"
                        :statusText="slotProps.state === 1 ? '正常' : '禁用'"
                        :statusNames="{ '1': 'processing', '0': 'error' }"
                    >
                        <template #img>
                            <slot name="img">
                                <img
                                    :width="80"
                                    :height="80"
                                    :src="
                                        slotProps.photoUrl ||
                                        device.deviceProduct
                                    "
                                />
                            </slot>
                        </template>
                        <template #content>
                            <div style="width: calc(100% - 100px)">
                                <Ellipsis>
                                    <span
                                        style="
                                            font-size: 16px;
                                            font-weight: 600;
                                        "
                                    >
                                        {{ slotProps.name }}
                                    </span>
                                </Ellipsis>
                            </div>
                            <a-row>
                                <a-col :span="12">
                                    <div class="card-item-content-text">
                                        设备类型
                                    </div>
                                    <Ellipsis>{{
                                        slotProps.deviceType?.text
                                    }}</Ellipsis>
                                </a-col>
                                <a-col :span="12">
                                    <div class="card-item-content-text">
                                        接入方式
                                    </div>
                                    <Ellipsis>{{
                                        slotProps?.accessName || '未接入'
                                    }}</Ellipsis>
                                </a-col>
                            </a-row>
                        </template>
                    </CardBox>
                </template>
            </j-pro-table>
        </div>
    </a-modal>
</template>

<script setup lang="ts" name="Product">
import { queryTree } from '@device/api/device/category';
import { getTreeData_api } from '@/api/system/department';
import { _queryProduct, _queryProtocol } from '@device/api/resource/resource';
import { device } from '@device/assets/device/index.ts'

const emits = defineEmits(['close']);
const props = defineProps({
    type: {
        type: String,
        default: 'metadata',
    },
});

const route = useRoute();
const _id = route.params?.id;
const params = ref({});
const handleSearch = (p: any) => {
    params.value = p;
};

const columns = [
    {
        title: 'ID',
        dataIndex: 'id',
        width: 300,
        ellipsis: true,
        fixed: 'left',
        search: {
            type: 'string',
        },
    },
    {
        title: '名称',
        dataIndex: 'name',
        width: 200,
        ellipsis: true,
        search: {
            type: 'string',
            first: true,
        },
    },
    {
        title: '设备类型',
        dataIndex: 'deviceType',
        width: 150,
        search: {
            type: 'select',
            options: [
                { label: '直连设备', value: 'device' },
                { label: '网关子设备', value: 'childrenDevice' },
                { label: '网关设备', value: 'gateway' },
            ],
        },
    },
    {
        title: '状态',
        dataIndex: 'state',
        width: '90px',
        search: {
            type: 'select',
            options: [
                { label: '禁用', value: 0 },
                { label: '正常', value: 1 },
            ],
        },
    },
    {
        title: '说明',
        dataIndex: 'describe',
        ellipsis: true,
        width: 300,
    },
];
</script>

<style lang="less" scoped>
.header {
    display: flex;
    .title {
        width: 90%;
        text-align: center;
    }
}
.content {
    height: 70vh;
    padding: 0 10px;
}
</style>
