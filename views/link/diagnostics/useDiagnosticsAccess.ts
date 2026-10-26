import { computed } from 'vue'
import { useAuthStore } from '@jetlinks-web-core/store/auth'
import { useMenuStore } from '@jetlinks-web-core/store/menu'

/** 页面与动作使用同一权限来源；多个必要权限显式AND求值。 */
export function useDiagnosticsAccess() {
  const auth = useAuthStore()
  const menu = useMenuStore()
  return computed(() => {
    const enter = menu.hasMenu('link/RuntimeMonitor')
    const allowed = (button: string) => enter && auth.hasPermission(`link/RuntimeMonitor:${button}`)
    const monitor = allowed('monitor-query')
    const jfr = allowed('jfr')
    const diagnosticExport = allowed('diagnostic-export')
    // 入口、读取、执行与导出独立；具有实时采集权限不意味着可下载产物。
    return {
      enter, query: allowed('query'), monitor, threads: allowed('thread-dump'),
      // 设备会话查询与 MBean 统计分别授权；查询只按会话按钮，端点负责最终鉴权。
      sessions: allowed('session-query'),
      invoke: monitor && allowed('mbean-invoke'), logs: allowed('log-query'),
      exportLogs: allowed('log-query') && allowed('log-export'), jfr,
      exportJfr: jfr && diagnosticExport, diagnosticExport,
      heapDump: allowed('heap-dump'), heap: allowed('heap-dump') && diagnosticExport,
      trace: menu.hasMenu('link/Tracing') && auth.hasPermission('link/Tracing:query'),
    }
  })
}
