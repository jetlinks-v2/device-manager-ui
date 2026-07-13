<template>
    <a-space>
        <j-permission-button
            type="primary"
            hasPermission="device/Firmware:add"
            @click="emit('add')"
        >
            <template #icon><AIcon type="PlusOutlined" /></template>
            {{ $t('Firmware.index.858355-0') }}
        </j-permission-button>
        <j-permission-button
            hasPermission="device/Firmware:add"
            @click="emit('application-add')"
        >
            <template #icon><AIcon type="PlusOutlined" /></template>
            {{ $t('Firmware.index.858355-15') }}
        </j-permission-button>
    </a-space>
</template>

<script setup lang="ts" name="FirmwareCreateActions">
const emit = defineEmits<{
    (event: 'add'): void;
    (event: 'application-add'): void;
}>();
</script>
