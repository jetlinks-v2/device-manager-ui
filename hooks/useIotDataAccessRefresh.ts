/**
 * 当前项目成员切换后，物联中心需要按新的 dataAccess 重新拉 service 数据。
 * 数据过滤在 adapter 层完成，这里只刷新当前页面持有的 view-model。
 */

import { watch, type Ref } from 'vue'

import { projectIdentityService } from '@device-manager-ui/modules/defaults/services/projectIdentity.service'

export function useIotDataAccessRefresh(
  projectId: Ref<string>,
  refresh: () => Promise<void> | void,
) {
  const identitySettings = projectIdentityService.subscribeSettings()
  let lastIdentityKey = identitySettings.value?.projectId === projectId.value
    ? `${identitySettings.value.projectId}:${identitySettings.value.activeMemberId}`
    : ''

  watch(
    () => ({
      projectId: identitySettings.value?.projectId ?? '',
      activeMemberId: identitySettings.value?.activeMemberId ?? '',
    }),
    async (next, prev) => {
      if (!next.activeMemberId || next.projectId !== projectId.value) return
      const nextIdentityKey = `${next.projectId}:${next.activeMemberId}`
      const prevIdentityKey = `${prev.projectId}:${prev.activeMemberId}`
      if (!lastIdentityKey) {
        lastIdentityKey = nextIdentityKey
        return
      }
      if (nextIdentityKey === lastIdentityKey || nextIdentityKey === prevIdentityKey) return
      lastIdentityKey = nextIdentityKey
      await refresh()
    },
    { flush: 'post' },
  )
}

