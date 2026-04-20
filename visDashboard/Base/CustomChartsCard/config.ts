export const customChartsCardConfig = {
  name: '图表卡片',
  type: 'customChartsCard',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 4,
      h: 5,
      minW: 3,
      minH: 5
    },
    customChartsCard: {
      topTitle: '当前在线',
      bottomTitle: '昨日在线',
      tooltip: '',
      hoverTip: true,
      hoverTitle: '在线数',
      color: '#D3ADF7'
    }
  },
  dataSourceProps: {
    sourceId: '',
    type: 'string',
    defaultValue: {
      _param_1: 0,
      _param_2: 0,
      xData: [0],
      yData: [0]
    },
    mapping: {
      _param_1: '',
      _param_2: '',
      xData: '',
      yData: ''
    }
  }
}
