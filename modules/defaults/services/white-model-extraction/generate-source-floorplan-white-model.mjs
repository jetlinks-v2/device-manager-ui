import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'

const SOURCE = new URL('../../../../../public/images/floorplans/lalaport-ebina-1f-floorMap.png', import.meta.url)
const OUT = new URL('../../../../../public/images/spatial/mall-atrium-white-model-source-derived.png', import.meta.url)
const WIDTH = 2400
const HEIGHT = 1350
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

function blendPixel(px, py, c) {
  if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) return
  const index = (Math.round(py) * WIDTH + Math.round(px)) * 4
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

function strokeLine(x0, y0, x1, y1, c, lineWidth = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    const px = x0 + (x1 - x0) * t
    const py = y0 + (y1 - y0) * t
    fillRect(px - lineWidth / 2, py - lineWidth / 2, lineWidth, lineWidth, c)
  }
}

function strokePolygon(points, c, lineWidth = 1) {
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    strokeLine(current[0], current[1], next[0], next[1], c, lineWidth)
  }
}

function fade(c, ratio) {
  return [c[0], c[1], c[2], Math.max(0, Math.min(255, Math.round(c[3] * ratio)))]
}

function readPng(path) {
  const buffer = readFileSync(path)
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('Source image is not a PNG')
  let offset = 8
  let width = 0
  let height = 0
  let colorType = 0
  const idat = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9]
      if (data[8] !== 8 || colorType !== 6 || data[12] !== 0) {
        throw new Error('Only 8-bit non-interlaced RGBA PNG is supported')
      }
    }
    if (type === 'IDAT') idat.push(data)
    if (type === 'IEND') break
    offset += length + 12
  }
  const inflated = inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const rgba = new Uint8ClampedArray(width * height * 4)
  let sourceOffset = 0
  for (let row = 0; row < height; row += 1) {
    const filter = inflated[sourceOffset]
    sourceOffset += 1
    const rowStart = row * stride
    for (let col = 0; col < stride; col += 1) {
      const raw = inflated[sourceOffset + col]
      const left = col >= 4 ? rgba[rowStart + col - 4] : 0
      const up = row > 0 ? rgba[rowStart + col - stride] : 0
      const upLeft = row > 0 && col >= 4 ? rgba[rowStart + col - stride - 4] : 0
      rgba[rowStart + col] = unfilter(raw, filter, left, up, upLeft)
    }
    sourceOffset += stride
  }
  return { width, height, rgba }
}

function unfilter(raw, filter, left, up, upLeft) {
  if (filter === 0) return raw
  if (filter === 1) return (raw + left) & 0xff
  if (filter === 2) return (raw + up) & 0xff
  if (filter === 3) return (raw + Math.floor((left + up) / 2)) & 0xff
  const p = left + up - upLeft
  const pa = Math.abs(p - left)
  const pb = Math.abs(p - up)
  const pc = Math.abs(p - upLeft)
  const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
  return (raw + predictor) & 0xff
}

function sample(image, sx, sy) {
  const px = Math.max(0, Math.min(image.width - 1, Math.round(sx)))
  const py = Math.max(0, Math.min(image.height - 1, Math.round(sy)))
  const index = (py * image.width + px) * 4
  return [
    image.rgba[index],
    image.rgba[index + 1],
    image.rgba[index + 2],
    image.rgba[index + 3],
  ]
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

const FLOOR_CROP = { x: 88, y: 268, w: 1596, h: 838 }
const VIEW = {
  tl: [405, 180],
  tr: [1695, 205],
  br: [1645, 980],
  bl: [555, 1048],
  sideX: 48,
  sideY: 66,
}
const whiteModelPalette = {
  ambient: color('#70899d', 0.09),
  ambientSoft: color('#8ea7b9', 0.06),
  edge: color('#9eb2c3', 0.72),
  edgeSoft: color('#c9d8e3', 0.48),
  glass: color('#a7cbe7', 0.16),
  glassLine: color('#89b7dc', 0.42),
  glassSoft: color('#dff1fb', 0.36),
  highlight: color('#ffffff', 0.58),
  inkTrace: color('#9ab4c8', 0.16),
  slab: color('#fbfdfe', 0.99),
  slabSide: color('#d7e3ec', 0.86),
  slabSideDeep: color('#bdcedd', 0.74),
  shadow: color('#70889b', 0.11),
  shadowDeep: color('#5f768a', 0.18),
  top: color('#fcfdfe', 0.98),
  wall: color('#f7fbfd', 0.98),
  wallSide: color('#d4e2ec', 0.82),
  wallSideDeep: color('#b9ccdc', 0.72),
  warmSide: color('#d9c8ad', 0.52),
}

function projectPoint(u, v, offsetX = 0, offsetY = 0) {
  const [tlx, tly] = VIEW.tl
  const [trx, try_] = VIEW.tr
  const [brx, bry] = VIEW.br
  const [blx, bly] = VIEW.bl
  const topX = tlx + (trx - tlx) * u
  const topY = tly + (try_ - tly) * u
  const bottomX = blx + (brx - blx) * u
  const bottomY = bly + (bry - bly) * u
  return [
    topX + (bottomX - topX) * v + offsetX,
    topY + (bottomY - topY) * v + offsetY,
  ]
}

function projectRect(u0, v0, u1, v1) {
  return [
    projectPoint(u0, v0),
    projectPoint(u1, v0),
    projectPoint(u1, v1),
    projectPoint(u0, v1),
  ]
}

function drawProjectedShadow(points, offsetX, offsetY, spread, alphaRatio) {
  for (let step = spread; step >= 1; step -= 1) {
    const ratio = step / spread
    const shadowPoints = points.map(([px, py]) => [
      px + offsetX + step * 2,
      py + offsetY + step * 2,
    ])
    fillPolygon(shadowPoints, fade(whiteModelPalette.shadowDeep, alphaRatio * (1 - ratio * 0.76)))
  }
}

function drawExtrudedQuad(points, options = {}) {
  const height = options.height ?? 22
  const sideX = options.sideX ?? VIEW.sideX * (0.22 + height / 110)
  const sideY = options.sideY ?? VIEW.sideY * (0.22 + height / 110)
  const offset = points.map(([px, py]) => [px + sideX, py + sideY])
  const topFill = options.topFill ?? whiteModelPalette.top
  const sideFill = options.sideFill ?? whiteModelPalette.wallSide
  const sideDeep = options.sideDeep ?? whiteModelPalette.wallSideDeep
  const edge = options.edge ?? whiteModelPalette.edge
  const lineWidth = options.lineWidth ?? 1.6

  drawProjectedShadow(points, sideX * 0.62, sideY * 0.76, Math.max(3, Math.round(height / 6)), 0.9)
  fillPolygon([points[3], points[2], offset[2], offset[3]], sideFill)
  fillPolygon([points[1], points[2], offset[2], offset[1]], sideDeep)
  fillPolygon(points, topFill)
  strokePolygon(points, edge, lineWidth)
  strokeLine(points[1][0], points[1][1], offset[1][0], offset[1][1], fade(edge, 0.7), 1)
  strokeLine(points[2][0], points[2][1], offset[2][0], offset[2][1], fade(edge, 0.72), 1)
  strokeLine(points[3][0], points[3][1], offset[3][0], offset[3][1], fade(edge, 0.58), 1)
  fillPolygon(
    points.map(([px, py], index) => {
      const next = points[(index + 1) % points.length]
      return [px + (next[0] - px) * 0.035, py + (next[1] - py) * 0.035]
    }),
    fade(whiteModelPalette.highlight, 0.16),
  )
}

function sourceSignal(image, sx, sy) {
  const [r, g, b, a] = sample(image, sx, sy)
  if (a < 20) return null
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const saturation = (max - min) / 255
  const luma = 0.299 * r + 0.587 * g + 0.114 * b
  const ink = Math.max(0, (244 - luma) / 244)
  const signal = Math.max(saturation * 1.16, ink * 0.86)
  if (signal < 0.055) return null
  return { r, g, b, luma, saturation, signal }
}

function analyzeFloorPlanGrid(image) {
  const cols = 76
  const rows = 42
  const cells = []
  for (let row = 0; row < rows; row += 1) {
    const line = []
    for (let col = 0; col < cols; col += 1) {
      let signalTotal = 0
      let warmTotal = 0
      let coolTotal = 0
      let darkTotal = 0
      let hits = 0
      const samples = 5
      for (let syIndex = 0; syIndex < samples; syIndex += 1) {
        for (let sxIndex = 0; sxIndex < samples; sxIndex += 1) {
          const sx = FLOOR_CROP.x + (col + (sxIndex + 0.5) / samples) / cols * FLOOR_CROP.w
          const sy = FLOOR_CROP.y + (row + (syIndex + 0.5) / samples) / rows * FLOOR_CROP.h
          const signal = sourceSignal(image, sx, sy)
          if (!signal) continue
          signalTotal += signal.signal
          warmTotal += signal.r > signal.b + 18 && signal.r > signal.g + 5 ? 1 : 0
          coolTotal += signal.b > signal.r + 8 || signal.g > signal.r + 8 ? 1 : 0
          darkTotal += signal.luma < 118 ? 1 : 0
          hits += 1
        }
      }
      const density = hits / (samples * samples)
      const weight = hits ? signalTotal / hits : 0
      line.push({
        active: density > 0.2 && weight > 0.1,
        col,
        row,
        density,
        weight,
        tone: warmTotal > coolTotal ? 'warm' : darkTotal > hits * 0.45 ? 'dark' : 'cool',
      })
    }
    cells.push(line)
  }
  return { cells, cols, rows }
}

function createFeatureBlocks(image) {
  const { cells, cols, rows } = analyzeFloorPlanGrid(image)
  const used = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false))
  const blocks = []

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = cells[row][col]
      if (!cell.active || used[row][col]) continue

      let width = 1
      while (
        col + width < cols
        && cells[row][col + width].active
        && !used[row][col + width]
        && width < 12
      ) {
        width += 1
      }

      let height = 1
      while (row + height < rows && height < 9) {
        let rowHits = 0
        for (let cx = col; cx < col + width; cx += 1) {
          if (cells[row + height][cx].active && !used[row + height][cx]) rowHits += 1
        }
        if (rowHits < Math.max(1, Math.ceil(width * 0.72))) break
        height += 1
      }

      let density = 0
      let weight = 0
      const toneVotes = { cool: 0, dark: 0, warm: 0 }
      for (let ry = row; ry < row + height; ry += 1) {
        for (let cx = col; cx < col + width; cx += 1) {
          used[ry][cx] = true
          density += cells[ry][cx].density
          weight += cells[ry][cx].weight
          toneVotes[cells[ry][cx].tone] += 1
        }
      }
      const area = width * height
      density /= area
      weight /= area
      if (area < 2 && density < 0.42) continue

      const tone = Object.entries(toneVotes).sort((a, b) => b[1] - a[1])[0][0]
      blocks.push({
        area,
        density,
        height: Math.min(26, 9 + Math.sqrt(area) * 1.8 + weight * 10),
        tone,
        u0: Math.max(0.02, col / cols),
        v0: Math.max(0.02, row / rows),
        u1: Math.min(0.98, (col + width) / cols),
        v1: Math.min(0.98, (row + height) / rows),
        weight,
      })
    }
  }

  const selected = blocks
    .filter((block) => block.area >= 2 || block.weight > 0.35)
    .sort((a, b) => b.area * b.weight - a.area * a.weight)
    .slice(0, 72)

  return selected.sort((a, b) => (a.v0 + a.v1) - (b.v0 + b.v1))
}

function drawBaseSlab() {
  fillEllipse(1190, 800, 910, 330, whiteModelPalette.ambient)
  fillEllipse(1208, 816, 720, 230, whiteModelPalette.ambientSoft)
  const top = projectRect(0, 0, 1, 1)
  const side = top.map(([px, py]) => [px + VIEW.sideX, py + VIEW.sideY])
  fillPolygon([top[3], top[2], side[2], side[3]], whiteModelPalette.slabSide)
  fillPolygon([top[1], top[2], side[2], side[1]], whiteModelPalette.slabSideDeep)
  fillPolygon(top, whiteModelPalette.slab)
  strokePolygon(top, whiteModelPalette.edge, 2.4)
  strokeLine(top[1][0], top[1][1], side[1][0], side[1][1], fade(whiteModelPalette.edge, 0.64), 1.4)
  strokeLine(top[2][0], top[2][1], side[2][0], side[2][1], fade(whiteModelPalette.edge, 0.68), 1.4)
  strokeLine(top[3][0], top[3][1], side[3][0], side[3][1], fade(whiteModelPalette.edge, 0.54), 1.1)
}

function drawSourceTrace(image) {
  for (let row = 0; row <= 64; row += 1) {
    for (let col = 0; col <= 112; col += 1) {
      const u = col / 112
      const v = row / 64
      const sx = FLOOR_CROP.x + u * FLOOR_CROP.w
      const sy = FLOOR_CROP.y + v * FLOOR_CROP.h
      const signal = sourceSignal(image, sx, sy)
      if (!signal || signal.signal < 0.18) continue
      const [px, py] = projectPoint(u, v)
      const alpha = Math.min(0.3, signal.signal * 0.22)
      fillRect(px, py, 2, 2, color('#8fafc7', alpha))
    }
  }
}

function drawRibbonSegment(start, end, width, fill, edge, options = {}) {
  const [x0, y0] = projectPoint(start[0], start[1])
  const [x1, y1] = projectPoint(end[0], end[1])
  const dx = x1 - x0
  const dy = y1 - y0
  const length = Math.max(1, Math.hypot(dx, dy))
  const nx = -dy / length
  const ny = dx / length
  const half = width / 2
  const points = [
    [x0 + nx * half, y0 + ny * half],
    [x1 + nx * half, y1 + ny * half],
    [x1 - nx * half, y1 - ny * half],
    [x0 - nx * half, y0 - ny * half],
  ]
  if (options.shadow) fillPolygon(points.map(([px, py]) => [px + 10, py + 14]), fade(whiteModelPalette.shadow, 0.6))
  fillPolygon(points, fill)
  strokeLine(x0 + nx * half, y0 + ny * half, x1 + nx * half, y1 + ny * half, edge, options.lineWidth ?? 1.5)
  strokeLine(x0 - nx * half, y0 - ny * half, x1 - nx * half, y1 - ny * half, edge, options.lineWidth ?? 1.5)
  if (options.centerLine) strokeLine(x0, y0, x1, y1, fade(edge, 0.42), 1)
}

function drawRibbonPath(points, width, fill, edge, options = {}) {
  for (let index = 0; index < points.length - 1; index += 1) {
    drawRibbonSegment(points[index], points[index + 1], width, fill, edge, options)
  }
}

function drawAtriumCore() {
  const outer = [
    projectPoint(0.39, 0.39),
    projectPoint(0.58, 0.35),
    projectPoint(0.70, 0.46),
    projectPoint(0.63, 0.61),
    projectPoint(0.43, 0.65),
    projectPoint(0.34, 0.52),
  ]
  const inner = [
    projectPoint(0.45, 0.44),
    projectPoint(0.58, 0.42),
    projectPoint(0.64, 0.50),
    projectPoint(0.58, 0.57),
    projectPoint(0.46, 0.58),
    projectPoint(0.40, 0.51),
  ]
  fillPolygon(outer.map(([px, py]) => [px + 14, py + 18]), fade(whiteModelPalette.shadowDeep, 0.32))
  fillPolygon(outer, color('#f8fcfe', 0.8))
  strokePolygon(outer, fade(whiteModelPalette.glassLine, 0.6), 2)
  fillPolygon(inner, color('#eff7fb', 0.58))
  strokePolygon(inner, whiteModelPalette.glassLine, 2.2)
  for (let index = 0; index < inner.length; index += 1) {
    const current = inner[index]
    const next = inner[(index + 1) % inner.length]
    strokeLine(current[0] + 4, current[1] + 6, next[0] + 4, next[1] + 6, fade(whiteModelPalette.edgeSoft, 0.58), 1.2)
  }
}

function drawPrimarySpatialVoids() {
  const fill = color('#f7fbfd', 0.72)
  const edge = fade(whiteModelPalette.glassLine, 0.7)
  const bands = [
    [[0.13, 0.48], [0.31, 0.42], [0.50, 0.38], [0.75, 0.42], [0.88, 0.49]],
    [[0.16, 0.67], [0.36, 0.64], [0.56, 0.66], [0.82, 0.60], [0.93, 0.57]],
    [[0.50, 0.22], [0.50, 0.38], [0.50, 0.58], [0.51, 0.84]],
  ]
  for (const band of bands) {
    drawRibbonPath(band, 34, fill, edge, { centerLine: true, lineWidth: 1.6, shadow: true })
    drawRibbonPath(band, 15, whiteModelPalette.glassSoft, fade(edge, 0.52), { lineWidth: 1 })
  }
  drawAtriumCore()
}

function drawFeatureBlocks(blocks) {
  for (const block of blocks) {
    const padU = 0.002
    const padV = 0.0025
    const points = projectRect(
      block.u0 + padU,
      block.v0 + padV,
      block.u1 - padU,
      block.v1 - padV,
    )
    const topFill = block.tone === 'dark'
      ? color('#f3f7fa', 0.98)
      : block.tone === 'warm'
        ? color('#fbfaf7', 0.98)
        : whiteModelPalette.wall
    const sideFill = block.tone === 'warm' ? whiteModelPalette.warmSide : whiteModelPalette.wallSide
    const sideDeep = block.tone === 'dark' ? color('#aabac8', 0.76) : whiteModelPalette.wallSideDeep
    drawExtrudedQuad(points, {
      edge: block.weight > 0.32 ? whiteModelPalette.edge : whiteModelPalette.edgeSoft,
      height: block.height,
      lineWidth: block.area > 8 ? 1.8 : 1.2,
      sideDeep,
      sideFill,
      topFill,
    })
  }
}

function renderSourceDerivedWhiteModel(image) {
  fillRect(0, 0, WIDTH, HEIGHT, color('#ffffff', 1))
  drawBaseSlab()
  drawSourceTrace(image)
  drawPrimarySpatialVoids()
  drawFeatureBlocks(createFeatureBlocks(image))
  drawPrimarySpatialVoids()
}

const sourceImage = readPng(fileURLToPath(SOURCE))
renderSourceDerivedWhiteModel(sourceImage)
writePng(fileURLToPath(OUT))
console.log(`Generated ${fileURLToPath(OUT)}`)

