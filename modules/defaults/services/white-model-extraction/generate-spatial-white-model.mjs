import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const WIDTH = 2400
const HEIGHT = 1350
const LEGACY_OUT = new URL('../../../../../public/images/spatial/mall-atrium-white-model-v7.png', import.meta.url)
const SYSTEM_VARIANT_OUTS = [
  ['default', LEGACY_OUT],
  ['atrium-focus', new URL('../../../../../public/images/spatial/mall-atrium-white-model-system-atrium.png', import.meta.url)],
  ['route-focus', new URL('../../../../../public/images/spatial/mall-atrium-white-model-system-route.png', import.meta.url)],
  ['mass-focus', new URL('../../../../../public/images/spatial/mall-atrium-white-model-system-mass.png', import.meta.url)],
]

const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4)

function color(hex, alpha = 1) {
  const value = hex.replace('#', '')
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    Math.round(alpha * 255),
  ]
}

const palette = {
  ambient: color('#7f98ad', 0.055),
  glass: color('#b9d7f2', 0.34),
  glassLine: color('#7fb0dc', 0.54),
  glassStrong: color('#9fc7ec', 0.42),
  glow: color('#eaf5fc', 0.48),
  line: color('#b9c9d6', 0.7),
  lineStrong: color('#9fb4c6', 0.78),
  lineSoft: color('#d5e2ec', 0.42),
  plant: color('#7fb99a', 0.46),
  plantDark: color('#5d9c7b', 0.42),
  seat: color('#c8d7e4', 0.44),
  shadow: color('#88a0b5', 0.1),
  shadowDeep: color('#6f879c', 0.18),
  side: color('#d7e2eb', 0.8),
  sideLight: color('#e6eef5', 0.82),
  sideDark: color('#c9d7e2', 0.8),
  sideDeep: color('#a9bdcf', 0.46),
  sideRim: color('#87a4ba', 0.26),
  slab: color('#f5f9fc', 0.98),
  slabEdge: color('#c0ceda', 0.72),
  top: color('#fbfdfe', 0.98),
  wall: color('#fdfefe', 0.98),
  warm: color('#d9c3a7', 0.22),
  warmStrong: color('#c7a372', 0.28),
}

function fade(c, alphaRatio) {
  return [c[0], c[1], c[2], Math.round(c[3] * alphaRatio)]
}

function x(value) {
  return Math.round(166 + value * 20.68)
}

function y(value) {
  return Math.round(116 + value * 10.92)
}

function blendPixel(px, py, c) {
  if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) return
  const index = (py * WIDTH + px) * 4
  const sourceAlpha = c[3] / 255
  const targetAlpha = pixels[index + 3] / 255
  const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha)
  if (outAlpha <= 0) return
  pixels[index] = Math.round((c[0] * sourceAlpha + pixels[index] * targetAlpha * (1 - sourceAlpha)) / outAlpha)
  pixels[index + 1] = Math.round((c[1] * sourceAlpha + pixels[index + 1] * targetAlpha * (1 - sourceAlpha)) / outAlpha)
  pixels[index + 2] = Math.round((c[2] * sourceAlpha + pixels[index + 2] * targetAlpha * (1 - sourceAlpha)) / outAlpha)
  pixels[index + 3] = Math.round(outAlpha * 255)
}

function fillRect(left, top, width, height, c) {
  const x0 = Math.max(0, Math.floor(left))
  const y0 = Math.max(0, Math.floor(top))
  const x1 = Math.min(WIDTH, Math.ceil(left + width))
  const y1 = Math.min(HEIGHT, Math.ceil(top + height))
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) blendPixel(px, py, c)
  }
}

function strokeRect(left, top, width, height, c, lineWidth = 2) {
  fillRect(left, top, width, lineWidth, c)
  fillRect(left, top + height - lineWidth, width, lineWidth, c)
  fillRect(left, top, lineWidth, height, c)
  fillRect(left + width - lineWidth, top, lineWidth, height, c)
}

function strokeLine(x0, y0, x1, y1, c, lineWidth = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    const px = x0 + (x1 - x0) * t
    const py = y0 + (y1 - y0) * t
    fillRect(px - lineWidth / 2, py - lineWidth / 2, lineWidth, lineWidth, c)
  }
}

function fillEllipse(cx, cy, rx, ry, c) {
  const x0 = Math.max(0, Math.floor(cx - rx))
  const y0 = Math.max(0, Math.floor(cy - ry))
  const x1 = Math.min(WIDTH, Math.ceil(cx + rx))
  const y1 = Math.min(HEIGHT, Math.ceil(cy + ry))
  for (let py = y0; py < y1; py += 1) {
    const ny = (py - cy) / ry
    for (let px = x0; px < x1; px += 1) {
      const nx = (px - cx) / rx
      if (nx * nx + ny * ny <= 1) blendPixel(px, py, c)
    }
  }
}

function softWorldShadow(wx, wy, ww, wh, offsetX, offsetY, spread, c) {
  const left = x(wx)
  const top = y(wy)
  const width = x(wx + ww) - left
  const height = y(wy + wh) - top
  for (let step = spread; step >= 1; step -= 1) {
    const ratio = step / spread
    const alpha = (1 - ratio) * 0.42 + 0.06
    fillRect(
      left + offsetX - step * 4,
      top + offsetY - step * 3,
      width + step * 8,
      height + step * 6,
      fade(c, alpha),
    )
  }
}

function fillPolygon(points, c) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]))))
  const maxY = Math.min(HEIGHT - 1, Math.ceil(Math.max(...points.map((point) => point[1]))))
  for (let py = minY; py <= maxY; py += 1) {
    const hits = []
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index]
      const b = points[(index + 1) % points.length]
      if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py)) {
        hits.push(a[0] + (py - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
      }
    }
    hits.sort((a, b) => a - b)
    for (let index = 0; index < hits.length; index += 2) {
      fillRect(hits[index], py, hits[index + 1] - hits[index], 1, c)
    }
  }
}

function fillWorldPolygon(points, c) {
  fillPolygon(points.map((point) => [x(point[0]), y(point[1])]), c)
}

function drawRaisedRect(wx, wy, ww, wh, options = {}) {
  const left = x(wx)
  const top = y(wy)
  const width = x(wx + ww) - left
  const height = y(wy + wh) - top
  const lift = options.lift ?? 12
  const depth = options.depth ?? lift
  const sideX = options.sideX ?? Math.max(3, depth * 0.46)
  const sideY = options.sideY ?? Math.max(5, depth * 0.72)
  const fill = options.fill ?? palette.top
  const edge = options.edge ?? palette.line
  const side = options.side ?? palette.side
  const sideDark = options.sideDark ?? palette.sideDark

  fillRect(left + sideX + 9, top + sideY + 12, width + sideX * 0.8, height + sideY * 0.8, fade(palette.shadowDeep, 0.42))
  fillPolygon(
    [
      [left, top + height],
      [left + width, top + height],
      [left + width + sideX, top + height + sideY],
      [left + sideX, top + height + sideY],
    ],
    side,
  )
  fillPolygon(
    [
      [left + width, top],
      [left + width, top + height],
      [left + width + sideX, top + height + sideY],
      [left + width + sideX, top + sideY],
    ],
    sideDark,
  )
  fillPolygon(
    [
      [left + 2, top + height - 2],
      [left + width - 2, top + height - 2],
      [left + width + sideX - 2, top + height + sideY - 2],
      [left + sideX + 2, top + height + sideY - 2],
    ],
    fade(palette.sideDeep, 0.56),
  )
  fillRect(left, top, width, height, fill)
  fillRect(left + 3, top + 3, width - 6, 5, color('#ffffff', 0.58))
  fillRect(left + 3, top + 9, width - 9, 2, color('#ffffff', 0.28))
  strokeRect(left, top, width, height, edge, options.lineWidth ?? 2)
  strokeLine(left + width, top, left + width + sideX, top + sideY, fade(edge, 0.72), options.lineWidth ?? 1)
  strokeLine(left + width, top + height, left + width + sideX, top + height + sideY, fade(edge, 0.64), options.lineWidth ?? 1)
  strokeLine(left, top + height, left + sideX, top + height + sideY, fade(edge, 0.54), options.lineWidth ?? 1)
}

function drawExtrudedBand(wx, wy, ww, wh, options = {}) {
  const left = x(wx)
  const top = y(wy)
  const width = x(wx + ww) - left
  const height = y(wy + wh) - top
  const sideX = options.sideX ?? 14
  const sideY = options.sideY ?? 28
  const side = options.side ?? palette.sideRim
  const edge = options.edge ?? palette.lineStrong

  fillPolygon(
    [
      [left, top + height],
      [left + width, top + height],
      [left + width + sideX, top + height + sideY],
      [left + sideX, top + height + sideY],
    ],
    side,
  )
  fillPolygon(
    [
      [left + width, top],
      [left + width, top + height],
      [left + width + sideX, top + height + sideY],
      [left + width + sideX, top + sideY],
    ],
    fade(side, 1.18),
  )
  strokeLine(left, top + height, left + width, top + height, fade(edge, 0.62), 2)
  strokeLine(left + width, top, left + width + sideX, top + sideY, fade(edge, 0.54), 1)
}

function drawWall(wx, wy, ww, wh, strong = false) {
  softWorldShadow(wx, wy, ww, wh, strong ? 18 : 12, strong ? 26 : 18, strong ? 7 : 4, strong ? palette.shadowDeep : palette.shadow)
  drawRaisedRect(wx, wy, ww, wh, {
    fill: palette.wall,
    edge: strong ? palette.lineStrong : palette.line,
    lift: strong ? 34 : 22,
    depth: strong ? 38 : 24,
    side: strong ? palette.side : palette.sideLight,
    sideDark: strong ? palette.sideDeep : palette.side,
    lineWidth: strong ? 3 : 2,
  })
}

function drawRoomGrid(prefixX, prefixY, width, height, cols, rows, gapX, gapY) {
  const cellW = (width - gapX * (cols - 1)) / cols
  const cellH = (height - gapY * (rows - 1)) / rows
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const wx = prefixX + col * (cellW + gapX)
      const wy = prefixY + row * (cellH + gapY)
      drawRaisedRect(wx, wy, cellW, cellH, { lift: 13, depth: 14, fill: color('#f9fcfe', 0.94), edge: color('#c4d2de', 0.56) })
      if ((row + col) % 3 === 0) drawRaisedRect(wx + 0.8, wy + 1.2, Math.max(2.5, cellW * 0.48), 1.2, { lift: 6, depth: 7, fill: color('#edf5fb', 0.66), edge: color('#bdd4e8', 0.5) })
    }
  }
}

function drawLineDetails(wx, wy, ww, wh, count, c) {
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0 : index / (count - 1)
    const px = wx + ww * t
    const py = wy + wh * t
    if (ww >= wh) fillRect(x(px), y(wy), Math.max(18, (x(wx + ww / count) - x(wx)) * 0.54), Math.max(3, y(wy + wh) - y(wy)), c)
    else fillRect(x(wx), y(py), Math.max(3, x(wx + ww) - x(wx)), Math.max(18, (y(wy + wh / count) - y(wy)) * 0.54), c)
  }
}

function drawSlotDetails(wx, wy, ww, wh, cols, rows, c) {
  const gapX = ww / cols
  const gapY = wh / rows
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const px = wx + col * gapX + gapX * 0.22
      const py = wy + row * gapY + gapY * 0.24
      fillRect(x(px), y(py), Math.max(10, x(px + gapX * 0.48) - x(px)), Math.max(3, y(py + gapY * 0.1) - y(py)), c)
      if ((row + col) % 2 === 0) {
        fillRect(x(px), y(py + gapY * 0.42), Math.max(8, x(px + gapX * 0.38) - x(px)), Math.max(3, y(py + gapY * 0.08) - y(py)), fade(c, 0.7))
      }
    }
  }
}

function drawRaisedLine(wx, wy, ww, wh, tone = palette.lineSoft) {
  drawRaisedRect(wx, wy, ww, wh, {
    depth: 5,
    edge: fade(tone, 1.25),
    fill: fade(palette.top, 0.72),
    lift: 5,
    lineWidth: 1,
    side: fade(palette.sideLight, 0.68),
    sideDark: fade(palette.side, 0.58),
  })
}

function drawRetailBay(wx, wy, ww, wh, variant = 0) {
  const inset = 0.7
  fillRect(x(wx + inset), y(wy + inset), x(wx + ww - inset) - x(wx + inset), y(wy + wh - inset) - y(wy + inset), color('#ffffff', 0.18))
  const horizontal = ww >= wh
  const rows = horizontal ? 2 : 3
  const cols = horizontal ? 3 : 2
  const itemW = horizontal ? Math.max(1.8, ww / 5.6) : Math.max(1.6, ww / 3.8)
  const itemH = horizontal ? Math.max(0.65, wh / 9) : Math.max(0.85, wh / 8)
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const px = wx + 1.1 + col * ((ww - 2.2) / cols) + (variant % 2 ? 0.15 : 0)
      const py = wy + 1.2 + row * ((wh - 2.4) / rows)
      drawRaisedLine(px, py, itemW, itemH, row % 2 ? palette.warm : palette.lineSoft)
      if ((row + col + variant) % 3 === 0) {
        fillRect(x(px + itemW + 0.22), y(py + 0.14), Math.max(5, x(px + itemW + 0.8) - x(px + itemW + 0.22)), Math.max(3, y(py + itemH * 0.58) - y(py + 0.14)), fade(palette.warmStrong, 0.8))
      }
    }
  }
  if (variant % 2 === 0) {
    drawRaisedLine(wx + ww * 0.58, wy + wh * 0.58, Math.max(1.6, ww * 0.24), Math.max(0.8, wh * 0.08), palette.warmStrong)
  } else {
    drawRaisedLine(wx + ww * 0.2, wy + wh * 0.58, Math.max(1.6, ww * 0.24), Math.max(0.8, wh * 0.08), palette.lineSoft)
  }
}

function drawOfficeBay(wx, wy, ww, wh, variant = 0) {
  const deskRows = Math.max(1, Math.floor(wh / 5.2))
  const deskCols = Math.max(1, Math.floor(ww / 4.5))
  for (let row = 0; row < deskRows; row += 1) {
    for (let col = 0; col < deskCols; col += 1) {
      const px = wx + 1.1 + col * (ww / deskCols)
      const py = wy + 1.2 + row * (wh / deskRows)
      drawRaisedLine(px, py, Math.min(2.4, ww / deskCols - 1), 0.7, palette.lineSoft)
      fillEllipse(x(px + 1.1), y(py + 1.2), 5, 3, fade(palette.seat, 0.72))
      if ((row + col + variant) % 2 === 0) {
        fillRect(x(px + 0.4), y(py + 0.18), 10, 3, fade(palette.glassStrong, 0.54))
      }
    }
  }
}

function drawServiceBay(wx, wy, ww, wh) {
  drawRaisedLine(wx + 1.1, wy + 1.2, ww - 2.2, 0.8, palette.lineSoft)
  drawRaisedLine(wx + 1.1, wy + wh - 2.1, ww - 2.2, 0.8, palette.lineSoft)
  for (let index = 0; index < Math.max(2, Math.floor(wh / 5)); index += 1) {
    drawRaisedLine(wx + 1.2, wy + 2.4 + index * 4.1, Math.max(1.8, ww * 0.36), 0.72, palette.warm)
  }
}

function drawPlant(wx, wy, scale = 1) {
  fillEllipse(x(wx) + 8, y(wy) + 4, 14 * scale, 12 * scale, palette.plant)
  fillEllipse(x(wx) - 8, y(wy) + 2, 13 * scale, 11 * scale, palette.plant)
  fillEllipse(x(wx), y(wy) - 8, 15 * scale, 13 * scale, palette.plantDark)
}

function drawColumn(wx, wy) {
  fillEllipse(x(wx) + 7, y(wy) + 11, 16, 9, color('#91a9bc', 0.18))
  fillEllipse(x(wx) + 5, y(wy) + 8, 13, 8, color('#b8c9d8', 0.42))
  fillRect(x(wx) - 8, y(wy) - 3, 16, 12, color('#e9f1f6', 0.62))
  fillEllipse(x(wx), y(wy) - 3, 15, 9, color('#d5e0ea', 0.58))
  fillEllipse(x(wx), y(wy) - 6, 10, 7, color('#fbfdfe', 0.96))
}

function drawGlass(wx, wy, ww, wh) {
  const left = x(wx)
  const top = y(wy)
  const width = x(wx + ww) - left
  const height = Math.max(4, y(wy + wh) - top)
  fillRect(left, top, width, height, palette.glass)
  fillRect(left, top, width, Math.max(2, height * 0.3), color('#ffffff', 0.28))
  strokeRect(left, top, width, height, palette.glassLine, 1)
  const panelCount = Math.max(2, Math.floor((ww >= wh ? width : height) / 76))
  for (let index = 1; index < panelCount; index += 1) {
    if (ww >= wh) fillRect(left + width * index / panelCount, top, 2, height, fade(palette.glassLine, 0.62))
    else fillRect(left, top + height * index / panelCount, width, 2, fade(palette.glassLine, 0.62))
  }
}

function drawGlassHighlight(wx, wy, ww, wh) {
  const left = x(wx)
  const top = y(wy)
  const width = Math.max(4, x(wx + ww) - left)
  const height = Math.max(4, y(wy + wh) - top)
  fillRect(left, top, width, height, fade(palette.glow, 0.58))
  fillRect(left, top, width, Math.max(2, height * 0.24), color('#ffffff', 0.32))
  strokeRect(left, top, width, height, fade(palette.glassLine, 0.78), 1)
}

function drawDeckRim(wx, wy, ww, wh) {
  drawExtrudedBand(wx, wy, ww, wh, {
    edge: palette.lineStrong,
    side: color('#9ab3c6', 0.28),
    sideX: 18,
    sideY: 34,
  })
  fillRect(x(wx), y(wy), x(wx + ww) - x(wx), Math.max(2, y(wy + wh) - y(wy)), color('#ffffff', 0.22))
}

function drawBase() {
  fillEllipse(x(52) + 84, y(56) + 92, 1020, 330, palette.ambient)
  fillEllipse(x(51) + 64, y(54) + 76, 900, 270, palette.shadow)
  fillRect(x(3.6) + 42, y(3.4) + 52, x(92) - x(3.6), y(88) - y(3.4), palette.shadowDeep)
  drawRaisedRect(2.5, 2.2, 93, 90, {
    depth: 44,
    edge: palette.slabEdge,
    fill: palette.slab,
    lift: 42,
    lineWidth: 3,
    side: color('#d6e1ea', 0.86),
    sideDark: color('#b8cad9', 0.66),
  })
  fillRect(x(5.4), y(5.6), x(92.6) - x(5.4), y(88.6) - y(5.6), color('#f8fbfd', 0.78))
  strokeRect(x(5.4), y(5.6), x(92.6) - x(5.4), y(88.6) - y(5.6), color('#d4e0ea', 0.54), 2)
}

function drawAtrium() {
  fillEllipse(x(50) + 34, y(47) + 36, 410, 226, color('#8aa2b6', 0.11))
  fillEllipse(x(50) + 12, y(47) + 12, 430, 238, color('#c5d6e4', 0.16))
  fillEllipse(x(50) - 10, y(47) - 18, 360, 170, color('#ffffff', 0.2))
  fillEllipse(x(50), y(47), 390, 210, color('#eaf3f9', 0.62))
  fillEllipse(x(50), y(47), 298, 148, color('#f7fbfd', 0.92))
  fillEllipse(x(50), y(47), 230, 104, color('#f4f9fc', 0.92))
  fillEllipse(x(50) - 4, y(47) - 5, 176, 76, color('#ffffff', 0.44))
  fillPolygon([[x(35), y(37)], [x(66), y(37)], [x(71), y(63)], [x(39), y(64)]], color('#dce8f1', 0.22))
  drawRaisedRect(39, 41, 23, 4.6, { depth: 11, lift: 10, fill: color('#f4f9fc', 0.92), edge: color('#cfdeea', 0.58) })
  drawRaisedRect(38, 51.5, 25, 4.8, { depth: 11, lift: 10, fill: color('#f4f9fc', 0.92), edge: color('#cfdeea', 0.58) })
  drawRaisedRect(41.2, 33.8, 18, 2.4, { depth: 9, lift: 8, fill: color('#edf5fb', 0.72), edge: color('#bad3e9', 0.54) })
  drawRaisedRect(41.8, 58.6, 17, 2.4, { depth: 9, lift: 8, fill: color('#edf5fb', 0.72), edge: color('#bad3e9', 0.54) })
  drawGlass(34.8, 31.3, 30.2, 0.65)
  drawGlass(34.4, 61.3, 30.6, 0.65)
  drawGlass(31.8, 35.2, 0.45, 21.5)
  drawGlass(67.2, 35.2, 0.45, 21.5)
  drawGlassHighlight(36.2, 32.4, 27.4, 0.34)
  drawGlassHighlight(35.8, 60.4, 28.2, 0.34)
  drawLineDetails(41.2, 44.8, 17.2, 0.18, 7, color('#9fc3df', 0.32))
  drawLineDetails(40.2, 52.4, 17.6, 0.18, 7, color('#9fc3df', 0.28))
  drawRaisedLine(37.5, 38.4, 7.8, 0.72, palette.seat)
  drawRaisedLine(56, 38.4, 7.2, 0.72, palette.seat)
  drawRaisedLine(37.2, 55.8, 8.4, 0.72, palette.seat)
  drawRaisedLine(56.5, 55.8, 7.6, 0.72, palette.seat)
  drawRetailBay(47.2, 34.2, 8.2, 3.1, 4)
  drawRetailBay(44.5, 57.8, 10.2, 2.9, 5)
}

function drawCorridors() {
  fillRect(x(11), y(28), x(88) - x(11), y(34.5) - y(28), color('#eef6fb', 0.6))
  fillRect(x(11), y(63), x(88) - x(11), y(69.5) - y(63), color('#eef6fb', 0.6))
  fillRect(x(29), y(33), x(34) - x(29), y(63) - y(33), color('#eef6fb', 0.52))
  fillRect(x(66), y(34), x(72) - x(66), y(63) - y(34), color('#eef6fb', 0.52))
  drawLineDetails(18, 32.7, 64, 0.25, 11, color('#c9d9e6', 0.42))
  drawLineDetails(18, 66.2, 64, 0.25, 11, color('#c9d9e6', 0.42))
  drawLineDetails(31.5, 36, 0.25, 22, 5, color('#c9d9e6', 0.34))
  drawLineDetails(68.5, 36, 0.25, 22, 5, color('#c9d9e6', 0.34))
}

function drawRooms() {
  drawRoomGrid(9, 10, 49, 16, 7, 2, 1.4, 2.2)
  drawRoomGrid(61, 10, 27, 17, 4, 2, 1.7, 2.2)
  drawRoomGrid(9.5, 72, 49, 16, 7, 2, 1.4, 2.2)
  drawRoomGrid(62, 69, 27, 20, 4, 3, 1.6, 2.1)
  drawRoomGrid(9, 36, 18, 27, 2, 4, 1.8, 1.9)
  drawRoomGrid(75, 38, 16, 22, 2, 3, 1.7, 2.2)
  drawRaisedRect(74, 32, 8.4, 7.8, { depth: 20, lift: 18, fill: color('#fbfdfe', 0.96), edge: palette.lineStrong })
  drawRaisedRect(83.8, 33, 5.8, 9.6, { depth: 18, lift: 16, fill: color('#fbfdfe', 0.92), edge: palette.line })
  drawRaisedRect(72.5, 73, 13, 6.4, { depth: 17, lift: 15, fill: color('#fbfdfe', 0.94), edge: palette.line })
  drawRaisedRect(16, 54, 9, 7.2, { depth: 16, lift: 14, fill: color('#fbfdfe', 0.92), edge: palette.line })
  drawSlotDetails(12, 11.5, 38, 11, 8, 2, color('#b7c9d8', 0.24))
  drawSlotDetails(62, 11.5, 22, 12, 4, 2, color('#b7c9d8', 0.2))
  drawSlotDetails(12, 74, 38, 11, 8, 2, color('#b7c9d8', 0.22))
  drawSlotDetails(63, 70.8, 22, 14, 4, 3, color('#b7c9d8', 0.18))
  drawSlotDetails(76, 39.6, 12, 15, 2, 4, color('#b7c9d8', 0.18))
  drawSlotDetails(10.5, 39, 13, 18, 2, 4, color('#b7c9d8', 0.18))
  drawRetailBay(9.5, 10.6, 6.2, 5.2, 0)
  drawRetailBay(16.9, 10.8, 6.1, 5.1, 1)
  drawRetailBay(24.2, 10.7, 6.1, 5.2, 2)
  drawRetailBay(31.6, 10.7, 6.1, 5.2, 3)
  drawRetailBay(39, 10.7, 6.2, 5.2, 4)
  drawRetailBay(46.4, 10.8, 6, 5.1, 5)
  drawOfficeBay(62.1, 11, 6, 5.4, 1)
  drawOfficeBay(69, 11, 6, 5.4, 2)
  drawOfficeBay(76, 11, 6, 5.4, 3)
  drawRetailBay(10, 73.2, 6.2, 5.4, 6)
  drawRetailBay(17.3, 73.2, 6.2, 5.4, 7)
  drawRetailBay(24.7, 73.2, 6.2, 5.4, 8)
  drawRetailBay(32.1, 73.2, 6.2, 5.4, 9)
  drawRetailBay(39.4, 73.2, 6.2, 5.4, 10)
  drawRetailBay(46.8, 73.2, 5.9, 5.4, 11)
  drawOfficeBay(63, 70.5, 6, 5.5, 4)
  drawOfficeBay(70, 70.5, 6, 5.5, 5)
  drawOfficeBay(77, 70.5, 6, 5.5, 6)
  drawServiceBay(10.2, 38.2, 6.4, 8.3)
  drawServiceBay(17.4, 38.2, 6.4, 8.3)
  drawOfficeBay(76, 39.7, 5.4, 7.2, 7)
  drawOfficeBay(83, 39.7, 5.4, 7.2, 8)
}

function drawWalls() {
  drawWall(6.2, 6.2, 86, 2.9, true)
  drawWall(6.2, 88.2, 86, 3.1, true)
  drawWall(5.2, 7.8, 3.2, 80.5, true)
  drawWall(91.6, 7.8, 3.1, 80.5, true)
  drawWall(9.5, 26, 63, 2.2, true)
  drawWall(9.5, 64.8, 64, 2.2, true)
  drawWall(27.2, 34, 2.2, 26, true)
  drawWall(70.2, 35.2, 2.2, 24.6, true)
  drawWall(58, 9.6, 2.1, 18, false)
  drawWall(58.8, 70, 2.1, 19.5, false)
  drawWall(31.7, 31.4, 36, 1.2, false)
  drawWall(31.7, 61.7, 36, 1.2, false)
  drawWall(31.2, 34.2, 1.2, 24.6, false)
  drawWall(67.5, 34.2, 1.2, 24.6, false)
  drawDeckRim(6.2, 88.8, 86, 1.15)
  drawDeckRim(91.8, 8.4, 1.1, 79.6)
  drawExtrudedBand(9.5, 64.8, 64, 1.2, { side: color('#9cb5c8', 0.24), sideX: 13, sideY: 24 })
  drawExtrudedBand(70.2, 35.2, 1.15, 24.6, { side: color('#9cb5c8', 0.22), sideX: 13, sideY: 24 })
  drawExtrudedBand(27.2, 34, 1.15, 26, { side: color('#9cb5c8', 0.2), sideX: 12, sideY: 22 })
}

function drawFixtures() {
  drawLineDetails(12, 16, 36, 0.8, 6, color('#d3b996', 0.25))
  drawLineDetails(13, 21.5, 35, 0.8, 6, color('#d3b996', 0.22))
  drawLineDetails(13, 76, 36, 0.8, 6, color('#d3b996', 0.22))
  drawLineDetails(66, 17, 16, 0.8, 4, palette.warm)
  drawRaisedRect(41, 44.2, 18, 3.1, { depth: 8, lift: 7, fill: color('#edf4fa', 0.78), edge: color('#c0d8ed', 0.52) })
  drawRaisedRect(39.5, 50, 19, 3.1, { depth: 8, lift: 7, fill: color('#edf4fa', 0.78), edge: color('#c0d8ed', 0.52) })
  for (let i = 0; i < 10; i += 1) drawColumn(13 + i * 7.7, 31.4)
  for (let i = 0; i < 10; i += 1) drawColumn(13 + i * 7.7, 64.5)
  for (let i = 0; i < 5; i += 1) drawColumn(31.4, 38 + i * 5.1)
  for (let i = 0; i < 5; i += 1) drawColumn(69, 38 + i * 5.1)
  drawPlant(10, 63, 1.3)
  drawPlant(18, 30, 1.05)
  drawPlant(58, 18, 1.05)
  drawPlant(84, 57, 1.08)
  drawPlant(78, 69, 1.05)
  drawPlant(59, 78, 1.1)
  drawPlant(89, 74, 0.95)
  drawPlant(39, 55, 0.8)
  drawPlant(63, 39, 0.82)
  drawPlant(46, 36, 0.7)
  drawPlant(52, 58, 0.72)
  drawGlassHighlight(29.5, 29.5, 38.2, 0.28)
  drawGlassHighlight(29.5, 66.8, 39.2, 0.28)
  drawRaisedLine(47.8, 46.2, 7.4, 0.52, palette.glassStrong)
  drawRaisedLine(45.8, 48.2, 8.2, 0.48, palette.glassStrong)
  drawRaisedLine(47.2, 50.3, 7.7, 0.52, palette.glassStrong)
}

function drawSystemVariantOverlay(variant) {
  if (variant === 'atrium-focus') {
    fillEllipse(x(50) + 18, y(47) + 22, 500, 270, color('#7f98ad', 0.1))
    fillEllipse(x(50), y(47), 430, 212, color('#f8fcfe', 0.74))
    fillEllipse(x(50), y(47), 292, 126, color('#ffffff', 0.78))
    drawGlass(28.5, 30.8, 42, 0.9)
    drawGlass(28.5, 63.8, 42, 0.9)
    drawGlass(27.4, 34.4, 0.7, 27.6)
    drawGlass(72, 34.4, 0.7, 27.6)
    drawWall(35, 38, 7.2, 17.5, true)
    drawWall(58.8, 38, 7.2, 17.5, true)
    drawRaisedRect(43.3, 43.2, 14.4, 3.1, {
      depth: 10,
      edge: color('#9bbad5', 0.62),
      fill: color('#edf7fc', 0.86),
      lift: 9,
    })
    drawRaisedRect(42, 51.2, 16.6, 3.1, {
      depth: 10,
      edge: color('#9bbad5', 0.62),
      fill: color('#edf7fc', 0.86),
      lift: 9,
    })
    for (let index = 0; index < 7; index += 1) drawColumn(38 + index * 4, 34.5)
    for (let index = 0; index < 7; index += 1) drawColumn(38 + index * 4, 61.2)
    drawPlant(43, 39, 1.22)
    drawPlant(57, 55, 1.18)
    return
  }

  if (variant === 'route-focus') {
    fillWorldPolygon([[9, 31], [33, 31], [33, 38], [15, 38], [15, 58], [33, 58], [33, 66], [9, 66]], color('#e8f2f8', 0.72))
    fillWorldPolygon([[67, 31], [91, 31], [91, 38], [74, 38], [74, 58], [91, 58], [91, 66], [67, 66]], color('#e8f2f8', 0.72))
    fillWorldPolygon([[33, 35], [68, 35], [68, 41], [55, 41], [55, 56], [68, 56], [68, 62], [33, 62], [33, 56], [45, 56], [45, 41], [33, 41]], color('#f9fcfe', 0.74))
    drawDeckRim(11, 31, 22, 1.15)
    drawDeckRim(68, 31, 22, 1.15)
    drawDeckRim(11, 65, 22, 1.15)
    drawDeckRim(68, 65, 22, 1.15)
    drawWall(43.2, 36.2, 2, 23, true)
    drawWall(55.5, 36.2, 2, 23, true)
    drawRaisedRect(15.8, 41, 10, 9, { depth: 18, edge: palette.lineStrong, fill: color('#fbfdfe', 0.97), lift: 17 })
    drawRaisedRect(76, 41, 10, 9, { depth: 18, edge: palette.lineStrong, fill: color('#fbfdfe', 0.97), lift: 17 })
    drawLineDetails(18, 35.3, 64, 0.32, 9, color('#8fb6d6', 0.3))
    drawLineDetails(18, 61.6, 64, 0.32, 9, color('#8fb6d6', 0.3))
    drawPlant(23, 52, 1.15)
    drawPlant(78, 53, 1.15)
    return
  }

  if (variant === 'mass-focus') {
    drawWall(8.8, 18.5, 36, 3.2, true)
    drawWall(55.2, 18.5, 34, 3.2, true)
    drawWall(8.8, 75.2, 36, 3.2, true)
    drawWall(55.2, 75.2, 34, 3.2, true)
    drawWall(19.5, 22, 3, 18, true)
    drawWall(78.5, 22, 3, 18, true)
    drawWall(19.5, 57, 3, 18, true)
    drawWall(78.5, 57, 3, 18, true)
    drawRaisedRect(24, 23.2, 16, 9.4, { depth: 24, edge: palette.lineStrong, fill: color('#fbfdfe', 0.98), lift: 22 })
    drawRaisedRect(61, 23.2, 15, 9.4, { depth: 24, edge: palette.lineStrong, fill: color('#fbfdfe', 0.98), lift: 22 })
    drawRaisedRect(24, 64.6, 16, 9.4, { depth: 24, edge: palette.lineStrong, fill: color('#fbfdfe', 0.98), lift: 22 })
    drawRaisedRect(61, 64.6, 15, 9.4, { depth: 24, edge: palette.lineStrong, fill: color('#fbfdfe', 0.98), lift: 22 })
    drawGlassHighlight(22.5, 34.2, 18, 0.52)
    drawGlassHighlight(59.8, 34.2, 17, 0.52)
    drawGlassHighlight(22.5, 63.1, 18, 0.52)
    drawGlassHighlight(59.8, 63.1, 17, 0.52)
    for (let index = 0; index < 5; index += 1) drawColumn(24 + index * 4, 40)
    for (let index = 0; index < 5; index += 1) drawColumn(61 + index * 4, 40)
    for (let index = 0; index < 5; index += 1) drawColumn(24 + index * 4, 58)
    for (let index = 0; index < 5; index += 1) drawColumn(61 + index * 4, 58)
  }
}

function renderWhiteModel(variant, outputUrl) {
  pixels.fill(0)
  drawBase()
  drawCorridors()
  drawAtrium()
  drawRooms()
  drawWalls()
  drawFixtures()
  drawSystemVariantOverlay(variant)
  writePng(fileURLToPath(outputUrl))
  console.log(`Generated ${fileURLToPath(outputUrl).replace(`${dirname(fileURLToPath(import.meta.url))}/../`, '')}`)
}

function writePng(path) {
  const raw = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT)
  for (let row = 0; row < HEIGHT; row += 1) {
    const source = row * WIDTH * 4
    const target = row * (WIDTH * 4 + 1)
    raw[target] = 0
    Buffer.from(pixels.buffer, source, WIDTH * 4).copy(raw, target + 1)
  }
  const chunks = [
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr()),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]
  writeFileSync(path, Buffer.concat(chunks))
}

function ihdr() {
  const buffer = Buffer.alloc(13)
  buffer.writeUInt32BE(WIDTH, 0)
  buffer.writeUInt32BE(HEIGHT, 4)
  buffer[8] = 8
  buffer[9] = 6
  return buffer
}

function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0)
  return Buffer.concat([length, name, data, crc])
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

for (const [variant, outputUrl] of SYSTEM_VARIANT_OUTS) {
  renderWhiteModel(variant, outputUrl)
}

