import {useInstanceStore} from "@device-manager-ui/store/instance";

export const useDeviceDetail = () => {
    const instanceStore = useInstanceStore();
    return inject('runtime-device-detail', ref(instanceStore.detail))
}