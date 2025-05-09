<template>
    <div class="step-container" ref="domRef">
        <h5 class="title">
            <span style="margin-right: 12px">{{ props.cardTitle }}</span>
            <a-tooltip placement="top">
                <template #title>
                    <span>{{ props.tooltip }}</span>
                </template>
                <AIcon type="QuestionCircleOutlined" style="padding-top: 8px;font-size: 14px;color: #666;" />
            </a-tooltip>
        </h5>

        <div class="box-list">
            <div class="list-item" v-for="item in props.dataList">
              <div class="item-content">
                <div class="box-top" @click="jumpPage(item)">
                    <img :src="item.iconUrl" alt="" />
                    <span class="top-title">{{ item.title }}</span>
                </div>
                <div class="box-details">{{ item.details }}</div>
              </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import {onMounted, PropType} from 'vue';
import { recommendList } from '../typing';
import { useMenuStore } from '@/store';
import { onlyMessage } from '@jetlinks-web/utils';
import { useI18n } from 'vue-i18n'
import {home} from "../../../assets";

const { t: $t } = useI18n()
const { jumpPage: _jumpPage } = useMenuStore();
const domRef = ref()

const props = defineProps({
    cardTitle: String,
    tooltip: String,
    dataList: Array as PropType<recommendList[]>,
});

// 跳转页面
const jumpPage = (row: recommendList) => {
    if (row.auth === false) {
        return onlyMessage($t('components.StepCard.926510-0'), 'warning');
    }
    row.onClick ? row.onClick(row) : _jumpPage(row.linkUrl, {params: row.params});
};

const setCssProperty = () => {
  if (domRef.value) {
    domRef.value?.style.setProperty('--home-arrow-1', `url(${home.arrow1})`)
  }
}

onMounted(() => {
  setCssProperty()
})

</script>

<style lang="less" scoped>

.step-container {
    width: 100%;
    padding: 24px 14px;
    background-color: #fff;
    .title {
        position: relative;
        z-index: 2;
        display: flex;
        margin-bottom: 12px;
        padding-left: 18px;
        font-weight: 700;
        font-size: 18px;

        &::before {
            position: absolute;
            top: 50%;
            left: 0;
            width: 8px;
            height: 8px;
            background-color: #1d39c4;
            border: 1px solid #b4c0da;
            transform: translateY(-50%);
            content: ' ';
        }
    }

    .box-list {
        // grid-template-columns: repeat(5, 1fr);
        // display: grid;
        // grid-column-gap: 66px;
        display: flex;
        gap: 66px;

        .list-item {
            flex: 1;
            position: relative;
            .item-content {
              display: flex;
              flex-direction: column;
              height: 100%;
              &:hover {
               box-shadow: @shadow-1-down;
              }
            }
            .box-top {
                position: relative;
                padding: 16px 24px;
                background-color: #f8f9fd;
                color: #333;
                font-weight: 700;
                font-size: 14px;
                cursor: pointer;

                img {
                    position: absolute;
                    top: 0;
                    right: 0;
                    z-index: 1;
                    height: 100%;
                }
                span {
                  position: relative;
                  z-index: 2;
                }
            }
            .box-details {
                padding: 24px;
                border: 1px solid #e5edf4;
                border-top: none;
                flex: 1 1 auto;
            }

            &:not(:last-child)::after {
                position: absolute;
                top: 50%;
                right: -60px;
                width: 60px;
                height: 40px;
                transform: translateY(-50%);
                content: ' ';
                background: var(--home-arrow-1) no-repeat 50%;
            }
        }
    }
}

@media (min-width: @screen-md-min) {
  .step-container {
    .box-list {
      .list-item {
        .box-top {
          font-size: 12px;
          padding: 12px 18px;
        }
        .box-details {
          padding: 12px;
        }
      }
    }
  }
}
</style>
