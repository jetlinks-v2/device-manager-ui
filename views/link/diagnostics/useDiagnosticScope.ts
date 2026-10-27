import { computed } from 'vue'
import { useProjectRouter } from '@jetlinks-web-core/hooks/useProjectRouter'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { getProjectCodeFromLocation } from '@jetlinks-web-core/utils/project-runtime'

/** 页面请求与浏览配置共用平台账号 / 项目边界，身份切换会使旧请求失效。 */
export function useDiagnosticScope() {
  const user = useUserStore(), { projectId } = useProjectRouter()
  return computed(() => ({ accountId: user.userInfo.id ?? '', projectId: getProjectCodeFromLocation() || projectId.value || '' }))
}
