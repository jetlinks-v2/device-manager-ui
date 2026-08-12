export const propertyLineConfig = {
  name: '属性聚合折线图',
  type: 'propertyLine',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 5,
      h: 10
    },
    propertyLine: {
      title: 'Line chart',
      titleColor: 'rgba(0, 0, 0, 0.88)',
      titleFontSize: 18,
      legendFontSize: 16,
      timePeriod: 'today',
      cycle: '*',
      aggregation: 'AVG',
      deviceId: '',
      deviceName: '',
      propertyIds: [],
      propertyNames: []
    }
  }
}
