<template>
    <div class="top">
        <j-permission-button :hasPermission="true" type="text" @click="copyText" :tooltip="{
            title: '复制',
        }">
                <AIcon type="CopyOutlined" />
        </j-permission-button>
        <j-permission-button :hasPermission="true" type="text" @click="getShadows" :tooltip="{
            title: '刷新',
        }">
                <AIcon type="ReloadOutlined" />
        </j-permission-button>
    </div>
    <JsonViewer :value="data" style="background-color: #fafafa" :expanded="true" :expandDepth="10" deep="4"></JsonViewer>
</template>

<script setup lang="ts" name="Shadow">
import 'vue3-json-viewer/dist/index.css';
import { JsonViewer } from 'vue3-json-viewer';
import { useInstanceStore } from '@/modules/device-manager-ui/store/instance';
import { onlyMessage } from '@/utils/comm';
import { getDeviceShadow } from '@/modules/device-manager-ui/api/instance';


const instanceStore = useInstanceStore();
const data = ref<Record<string, any>>({});

const getShadows = async()=>{
    const res:any = await getDeviceShadow(instanceStore.detail.id)
    if(res.status === 200){
      data.value = res.result
    }
}

const copyText = ()=>{
    if(navigator.clipboard){
        navigator.clipboard.writeText(JSON.stringify(data.value))
        onlyMessage('复制成功！');
    }else{
        const input = document.createElement('input');
        input.value = JSON.stringify(data.value);
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        onlyMessage('复制成功！');
    }
}

onMounted(()=>{
    getShadows()
})

</script>

<style scoped lang="less">
.top {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 6px;
}
</style>