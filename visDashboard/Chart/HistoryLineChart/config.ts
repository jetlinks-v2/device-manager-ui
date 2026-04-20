export const historyLineChartConfig = {
  name: '历史数据折线图',
  type: 'historyLineChart',
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
    historyLineChart: {
      showLegend: true,
      legendPosition: 'top',
      showSplitLine: true,
      smooth: true,
      showAreaStyle: false,
      lineColor: '#5470c6'
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
