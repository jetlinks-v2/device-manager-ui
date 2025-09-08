<template>
    <a-modal
        :open="true"
        :title="t('DeviceRelationship.RelationshipEditModal.789342-0')"
        width="600px"
        @cancel="handleCancel"
        @ok="handleOk"
        :confirm-loading="loading"
    >
        <a-form
            ref="formRef"
            :model="formData"
            layout="vertical"
            class="relationship-form"
        >
            <a-form-item :label="t('DeviceRelationship.RelationshipEditModal.789342-1')" name="owner">
                <a-select
                    v-model:value="formData.owner"
                    :placeholder="t('DeviceRelationship.RelationshipEditModal.789342-2')"
                    allow-clear
                >
                    <a-select-option value="张珊强">张珊强</a-select-option>
                    <a-select-option value="李四">李四</a-select-option>
                    <a-select-option value="王五">王五</a-select-option>
                </a-select>
            </a-form-item>

            <a-form-item label="父子级关系" name="parentChild">
                <a-select
                    v-model:value="formData.parentChild"
                    :placeholder="t('DeviceRelationship.RelationshipEditModal.789342-2')"
                    allow-clear
                >
                    <a-select-option value="parent">父设备</a-select-option>
                    <a-select-option value="child">子设备</a-select-option>
                </a-select>
            </a-form-item>

            <a-form-item label="网关接入关系" name="gateway">
                <a-select
                    v-model:value="formData.gateway"
                    :placeholder="t('DeviceRelationship.RelationshipEditModal.789342-2')"
                    allow-clear
                >
                    <a-select-option value="gateway1">网关1</a-select-option>
                    <a-select-option value="gateway2">网关2</a-select-option>
                </a-select>
            </a-form-item>

            <a-form-item label="上下游归属关系设备" name="upstream">
                <a-select
                    v-model:value="formData.upstream"
                    :placeholder="t('DeviceRelationship.RelationshipEditModal.789342-2')"
                    allow-clear
                >
                    <a-select-option value="device1">设备1</a-select-option>
                    <a-select-option value="device2">设备2</a-select-option>
                </a-select>
            </a-form-item>

            <a-form-item label="逆向设备关系" name="reverse">
                <a-select
                    v-model:value="formData.reverse"
                    :placeholder="t('DeviceRelationship.RelationshipEditModal.789342-2')"
                    allow-clear
                >
                    <a-select-option value="reverse1">逆向关系1</a-select-option>
                    <a-select-option value="reverse2">逆向关系2</a-select-option>
                </a-select>
            </a-form-item>
        </a-form>
    </a-modal>
</template>

<script lang="ts" setup>
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits(['close', 'save'])

const loading = ref(false)
const formRef = ref()

const formData = reactive({
    owner: '张珊强',
    parentChild: '',
    gateway: '',
    upstream: '',
    reverse: ''
})

const handleCancel = () => {
    emit('close')
}

const handleOk = async () => {
    try {
        await formRef.value?.validate()
        loading.value = true

        // 模拟保存请求
        await new Promise(resolve => setTimeout(resolve, 1000))

        emit('save', formData)
        loading.value = false
    } catch (error) {
        loading.value = false
        console.error(t('DeviceRelationship.RelationshipEditModal.789342-3'), error)
    }
}
</script>

<style lang="less" scoped>
.relationship-form {
    padding-top: 16px;
}
</style>
