import {dataSubscriptions} from '@device/assets/data-subscriptions'
import i18n from "@/locales";
const $t = i18n.global.t
export const subscriptionMode = {
    device: [
        {
            label: $t('DataSubscriptions.Detail.index.697323-10'),
            value: '_Self',
            desc: $t('DataSubscriptions.Detail.index.697323-11'),
            img: dataSubscriptions._selfImg,
        },
        {
            label: $t('DataSubscriptions.Detail.index.697323-12'),
            value: 'All',
            desc: $t('DataSubscriptions.Detail.index.697323-13'),
            img: dataSubscriptions.allImg,
        },
        {
            label: $t('DataSubscriptions.Detail.index.697323-14'),
            value: 'Org',
            desc: $t('DataSubscriptions.Detail.index.697323-15'),
            img: dataSubscriptions.orgImg,
        },
        {
            label: $t('DataSubscriptions.Detail.index.697323-16'),
            value: 'Product',
            desc: $t('DataSubscriptions.Detail.index.697323-17'),
            img: dataSubscriptions.productImg,
        },
    ],
    alarm: [
        {
            label: $t('DataSubscriptions.Detail.index.697323-12'),
            value: 'All',
            desc: $t('DataSubscriptions.Detail.index.697323-18'),
            img: dataSubscriptions.allImg
        },
        {
            label: $t('DataSubscriptions.Detail.index.697323-19'),
            value: 'AlarmType',
            desc: $t('DataSubscriptions.Detail.index.697323-20'),
            img: dataSubscriptions.productImg
        },
        {
            label: $t('DataSubscriptions.Detail.index.697323-21'),
            value: 'AlarmLevel',
            desc: $t('DataSubscriptions.Detail.index.697323-22'),
            img: dataSubscriptions.orgImg
        },
    ]
}

export const getSubscriptionModeDesc = (type: string, name: string, num: number) => {
    const obj = {
        '_Self': $t('DataSubscriptions.Detail.index.697323-23'),
        'DeviceAll': $t('DataSubscriptions.Detail.index.697323-24'),
        'AlarmAll': $t('DataSubscriptions.Detail.index.697323-25'),
        'Org': $t('DataSubscriptions.Detail.index.697323-26', [name, num]),
        'Product': $t('DataSubscriptions.Detail.index.697323-27', [name, num]),
        'AlarmType': $t('DataSubscriptions.Detail.index.697323-28', [name, num]),
        'AlarmLevel': $t('DataSubscriptions.Detail.index.697323-29', [name, num]),
    }

    return obj?.[type] || '--'
}
