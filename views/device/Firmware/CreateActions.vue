<template>
    <j-permission-button
        type="primary"
        hasPermission="device/Firmware:add"
        @click="emit('add')"
    >
        <template #icon><AIcon type="PlusOutlined" /></template>
        {{ $t('Firmware.index.858355-0') }}
    </j-permission-button>
</template>

<script setup lang="ts" name="FirmwareCreateActions">
const emit = defineEmits<{
    (event: 'add'): void;
}>();
</script>
