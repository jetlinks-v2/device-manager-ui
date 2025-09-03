<template>
    <div class="value">
        <div
            v-if="value?.formatValue !== 0 && !value?.formatValue"
            class="otherValue"
        >
            --
        </div>
        <div v-else-if="_data.data?.valueType?.type === 'file'">
            <template v-if="data?.valueType?.bodyType === 'base64'">
                <div class="otherValue" v-if="!!_type">
                    <img :src="imgMap.get(_type)" @error="onError" />
                </div>
                <div v-else class="otherValue">
                    <img :src="imgMap.get('other')" />
                </div>
            </template>
            <div
                v-else-if="data?.valueType?.bodyType === $t('Detail.Table.181708-1')"
                class="otherValue"
            >
                <img :src="imgMap.get('other')" />
            </div>
            <template v-else>
                <template
                    v-if="
                        imgList.some((item) =>
                            value?.formatValue.includes(item),
                        )
                    "
                >
                    <div class="otherValue">
                        <img :src="value?.formatValue" @error="imgError" />
                    </div>
                </template>
                <template
                    v-else-if="
                        videoList.some((item) =>
                            value?.formatValue.includes(item),
                        )
                    "
                >
                    <div class="otherValue" >
                        <img :src="imgMap.get('video')" />
                    </div>
                </template>
                <template
                    v-else-if="
                        fileList.some((item) =>
                            value?.formatValue.includes(item),
                        )
                    "
                >
                    <div class="otherValue">
                        <img
                            :src="
                                imgMap.get(
                                    fileList
                                        .find((item) =>
                                            value?.formatValue.includes(item),
                                        )
                                        .slice(1),
                                )
                            "
                        />
                    </div>
                </template>
                <template v-else>
                    <div class="otherValue">
                        <img :src="imgMap.get('other')" />
                    </div>
                </template>
            </template>
        </div>
        <div v-else class="otherValue">
          <div style='width: 100%;white-space: normal;'>
            <j-ellipsis>
              {{ String(value?.formatValue) }}
            </j-ellipsis>
          </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { getType, imgMap, imgList, videoList, fileList } from '@device/views/device/Instance/Detail/Running/Property/index';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
const _data = defineProps({
    data: {
        type: Object,
        default: () => {},
    },
    value: {
        type: Object,
        default: () => {},
    },
});

const temp = ref<boolean>(false);

const _type = computed(() => {
  return getType(_data.value?.formatValue)
})

const onError = (e: any) => {
    e.target.src = imgMap.get('other');
};

const imgError = (e: any) => {
    e.target.src = imgMap.get('error');
    temp.value = true;
};
</script>

<style lang="less" scoped>
.value {
    display: flex;
    align-items: center;
    width: 100%;

    .otherValue {
        img {
            width: 20px;
        }
    }
}
</style>
