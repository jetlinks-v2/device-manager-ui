<template>
    <div v-for="items in dataSource" :key="items.type" class="card-items">
        <div class="card-items-container">
            <TitleComponent :data="items.title" style='font-size: 16px;'></TitleComponent>
            <a-row :gutter="[24, 24]">
                <a-col :span="12" v-for="item in items.list" :key="item.id">
                    <div class="provider">
                        <div
                            class="card-content-bg1"
                            :style="{
                                background: getBackgroundColor(),
                            }"
                        ></div>
                        <div
                            class="card-content-bg2"
                            :style="{
                                background: getBackgroundColor(),
                            }"
                        ></div>
                        <div class="box">
                            <div class="left">
                                <div class="images">
                                    <img :src="BackMap.get(item.id)" />
                                </div>
                                <div class="context">
                                    <div class="title">
                                        {{ item.name }}
                                    </div>
                                    <div class="desc">
                                        <j-ellipsis :lineClamp="2">
                                          {{ item.description || '' }}
                                        </j-ellipsis>
                                    </div>
                                </div>
                            </div>
                            <div class="right">
                                <a-button type="primary" @click="click(item)">
                                  {{$t('provider.index.8501947-0')}}
                                </a-button>
                            </div>
                        </div>
                    </div>
                </a-col>
            </a-row>
        </div>
    </div>
</template>

<script lang="ts" setup name="AccessConfigProvider">
import { BackMap } from '../../data';

const props = defineProps({
    dataSource: {
        type: Object,
        default: () => {},
    },
});

const emit = defineEmits(['onClick']);

const getBackgroundColor = () => {
    return `linear-gradient(
                188.4deg,
                rgba(9, 46, 231, 0.03) 22.94%,
                rgba(9, 46, 231, 0) 94.62%
            )`;
};

const click = (value: object) => {
    emit('onClick', value);
};
</script>

<style lang="less" scoped>
.card-items {
    margin-bottom: 24px;
    background-color: #fff;
    padding: 24px;

    .card-items-container {
    }
}
.provider {
    position: relative;
    width: 100%;
    padding: 24px;
    // background: url('/public/images/access/background.png') no-repeat;
    background-size: 100% 100%;
    border: 1px solid #e6e6e6;
    overflow: hidden;

    &::before {
        position: absolute;
        top: 0;
        left: 40px;
        display: block;
        width: 15%;
        min-width: 64px;
        height: 2px;
        background-image: url('/images/access/rectangle.png');
        background-repeat: no-repeat;
        background-size: 100% 100%;
        content: ' ';
    }

    &:hover {
        box-shadow: 0 0 24px rgba(#000, 0.1);
    }
}
.card-content-bg1 {
    position: absolute;
    right: -5%;
    height: 100%;
    width: 44.65%;
    top: 0;
    background: linear-gradient(
        188.4deg,
        rgba(229, 0, 18, 0.03) 22.94%,
        rgba(229, 0, 18, 0) 94.62%
    );
    transform: skewX(-15deg);
}

.card-content-bg2 {
    position: absolute;
    right: -5%;
    height: 100%;
    width: calc(44.65% + 34px);
    top: 0;
    background: linear-gradient(
        188.4deg,
        rgba(229, 0, 18, 0.03) 22.94%,
        rgba(229, 0, 18, 0) 94.62%
    );
    transform: skewX(-15deg);
}

.box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    .left {
        display: flex;
        width: calc(100% - 100px);
        .images {
            width: 80px;
            height: 80px;

            img {
                width: 80px;
                height: 80px;
            }
        }

        .context {
            width: calc(100% - 88px);
            margin: 8px;
            margin-left: 24px;

            .title {
                font-style: normal;
                font-weight: 800;
                font-size: 18px;
                line-height: 22px;
                color: rgba(0, 0, 0, 0.85);
                opacity: 0.85;
            }

            .desc {
                width: 100%;
                margin-top: 24px;
                font-style: normal;
                font-weight: 400;
                font-size: 12px;
                color: #666666;
                height: 40px;
            }
        }
    }
    .right {
        width: 70px;
    }
}
</style>
