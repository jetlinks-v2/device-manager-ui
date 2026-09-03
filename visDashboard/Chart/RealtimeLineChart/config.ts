export const realtimeLineChartConfig = {
  name: '实时数据折线图',
  type: 'realtimeLineChart',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 6,
      h: 6,
      minW: 3,
      minH: 4
    },
    realtimeLineChart: {
      showLegend: true,
      legendPosition: 'top',
      showSplitLine: true,
      smooth: true,
      showSymbol: false,
      showAreaStyle: true
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
