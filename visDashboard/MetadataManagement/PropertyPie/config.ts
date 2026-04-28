export const propertyPieConfig = {
  name: '属性环形图',
  type: 'propertyPie',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 3,
      h: 7,
      // minW: 4,
      // minH: 3
    },
    propertyPie: {
      title: 'Doughnut',
      titleColor: 'rgba(0, 0, 0, 0.88)',
      titleFontSize: 16,
      totalLabel: 'Total',
      totalLabelColor: 'rgba(0, 0, 0, 0.45)',
      totalLabelFontSize: 14,
      totalValueColor: 'rgba(0, 0, 0, 0.88)',
      totalValueFontSize: 34,
      emptyColor: '#d9d9d9',
      ringWidth: 16,
      deviceId: '',
      deviceName: '',
      propertyIds: [],
      propertyNames: []
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
