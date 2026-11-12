// Sharing cards: a slice of the comparison matrix, with the page's ADEs highlighted, so a shared
// link shows at a glance that it is a comparison and which ADE it is about.
// Social crawlers do not render SVG, and librsvg (inside sharp) cannot load web fonts, so text is
// drawn as glyph outlines from the site's own typefaces (static TTFs, OFL, in src/og/fonts).
import { openSync, type Font } from 'fontkit'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { cellFor, notices, productById, requirements, stats } from './data'
import { shortLabel } from './sheet'
import type { Product } from './types'

const load = (file: string) => openSync(resolve('src/og/fonts', file)) as Font
const fonts = { display: load('radio-canada-big-700.ttf'), displayRegular: load('radio-canada-big-400.ttf'), text: load('radio-canada-400.ttf'), textMedium: load('radio-canada-500.ttf') }
type FontName = keyof typeof fonts
// Outlines and layouts repeat across hundreds of cards, so each is computed once.
const outlines = new Map<string, string>(), layouts = new Map<string, ReturnType<Font['layout']>>()
const layout = (font: FontName, s: string) => { const key = `${font}\u0000${s}`; let run = layouts.get(key); if (!run) layouts.set(key, run = fonts[font].layout(s)); return run }
// The Sheet palette as plain values: librsvg reads neither custom properties nor oklch.
const C = { paper: '#f7f6f2', ink: '#12141f', ink2: '#3a3f52', muted: '#5d6273', mark: '#c8281e', field: '#1f3fbf', white: '#fffefb', pill: '#e4e1da' }

interface TextOptions { font?: FontName; fill?: string; anchor?: 'start' | 'end'; tracking?: number; opacity?: number; rotate?: number }
export function measure(s: string, size: number, font: FontName = 'text', tracking = 0) {
  const f = fonts[font], run = layout(font, s)
  return run.advanceWidth * size / f.unitsPerEm + tracking * Math.max(0, run.glyphs.length - 1)
}
function text(s: string, x: number, y: number, size: number, o: TextOptions = {}) {
  const name = o.font || 'text', f = fonts[name], k = size / f.unitsPerEm, run = layout(name, s), step = (o.tracking || 0) / k
  if (o.anchor === 'end') x -= measure(s, size, o.font, o.tracking)
  let pen = 0, glyphs = ''
  run.glyphs.forEach((g, i) => {
    const key = `${name}\u0000${g.id}`, p = run.positions[i]
    let d = outlines.get(key)
    if (d === undefined) outlines.set(key, d = g.path.toSVG())
    if (d) glyphs += `<path transform="translate(${(pen + p.xOffset).toFixed(1)} ${p.yOffset})" d="${d}"/>`
    pen += p.xAdvance + step
  })
  const g = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(5)} ${(-k).toFixed(5)})" fill="${o.fill || C.ink}"${o.opacity != null ? ` opacity="${o.opacity}"` : ''}>${glyphs}</g>`
  return o.rotate ? `<g transform="rotate(${o.rotate} ${x.toFixed(1)} ${y.toFixed(1)})">${g}</g>` : g
}
function wrap(s: string, x: number, y: number, maxWidth: number, size: number, lineHeight: number, o: TextOptions = {}) {
  const lines: string[] = []
  for (const word of s.split(' ')) {
    const last = lines.at(-1)
    if (last !== undefined && measure(`${last} ${word}`, size, o.font, o.tracking) <= maxWidth) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return { svg: lines.map((l, i) => text(l, x, y + i * lineHeight, size, o)).join(''), y: y + (lines.length - 1) * lineHeight }
}
const fit = (s: string, size: number, maxWidth: number, font: FontName) => {
  if (measure(s, size, font) <= maxWidth) return s
  while (s.length > 1 && measure(`${s}…`, size, font) > maxWidth) s = s.slice(0, -1)
  return `${s.trimEnd()}…`
}

// The wordmark: the two-column mark, "ADE" bold over "comparison".
const mark = (x: number, y: number) => `<rect x="${x}" y="${y}" width="20" height="44" fill="${C.mark}"/><rect x="${x + 24}" y="${y}" width="20" height="44" fill="${C.field}"/>`
  + text('ADE', x + 56, y + 19, 21, { font: 'display' }) + text('comparison', x + 56, y + 41, 21, { font: 'displayRegular' })
// The page address, so the card says which page it is.
function address(x: number, y: number, path: string, maxWidth = 460) {
  const host = 'adecomparison.com'
  path = fit(path, 20, maxWidth - 40 - measure(host, 20, 'textMedium'), 'text')
  const w = measure(host, 20, 'textMedium') + measure(path, 20) + 40
  return `<rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="40" rx="20" fill="${C.pill}"/>` + text(host, x + 20, y + 27, 20, { font: 'textMedium' }) + text(path, x + 20 + measure(host, 20, 'textMedium'), y + 27, 20, { fill: C.ink2 })
}

// Well-known ADEs and the filters people pick most. A page's own ADE replaces a row when it is not among them.
const ROWS = ['claude-code', 'codex', 'cursor', 'github-copilot', 'antigravity', 'devin', 'amp', 'cline', 'conductor', 'warp', 'zed', 'opencode', 'jules', 'kiro', 'factory', 'emdash']
const COLUMNS = ['desktop-os:macos', 'desktop-os:windows', 'desktop-os:linux', 'phone-client:ios', 'web-client', 'cli', 'isolation:worktree', 'isolation:container', 'parallel-runs', 'coordinator', 'unattended-triggers', 'self-hosting', 'free-tier', 'byo-subscription']
  .map(key => requirements.find(r => r.key === key)!).filter(Boolean)
// Short enough that the last rotated header stays on the card.
const columnLabels: Record<string, string> = { 'byo-subscription': 'Uses my plan', 'isolation:worktree': 'Worktrees', 'coordinator': 'Lead agent' }
function rowsFor(focus: string[]) {
  const ids = ROWS.filter(id => productById.has(id))
  focus.filter(id => !ids.includes(id)).forEach((id, i) => ids.splice(5 + i, 1, id))
  return ids.map(id => productById.get(id)!)
}
function matrix(focus: string[], x0 = 560, y0 = 186) {
  const nameWidth = 170, cell = 30, rowHeight = 24, cx0 = x0 + nameWidth
  let s = COLUMNS.map((r, j) => text(columnLabels[r.key] || shortLabel(r.key), cx0 + j * cell + 18, y0 - 12, 15, { fill: C.muted, rotate: -55 })).join('')
  rowsFor(focus).forEach((p: Product, i) => {
    const y = y0 + i * rowHeight, on = !focus.length || focus.includes(p.id), opacity = on ? 1 : .28
    if (focus.includes(p.id)) s += `<rect x="${x0 - 14}" y="${y - 2}" width="${nameWidth + COLUMNS.length * cell + 24}" height="${rowHeight + 2}" fill="${C.white}"/><rect x="${x0 - 14}" y="${y - 2}" width="5" height="${rowHeight + 2}" fill="${C.mark}"/>`
    s += text(fit(p.name.replace(/^(Google|OpenAI|GitHub) /, ''), 16, nameWidth - 12, 'text'), x0, y + 17, 16, { font: focus.includes(p.id) ? 'textMedium' : 'text', opacity })
    COLUMNS.forEach((r, j) => {
      const v = cellFor(p, r).value, cx = cx0 + j * cell + 12, cy = y + 11
      s += v === 'yes' ? `<circle cx="${cx}" cy="${cy}" r="7.5" fill="${C.field}" opacity="${opacity}"/>`
        : v === 'no' ? `<path d="M${cx - 5} ${cy - 5}l10 10m0-10l-10 10" stroke="${C.mark}" stroke-width="2.6" opacity="${opacity}"/>`
        : `<circle cx="${cx}" cy="${cy}" r="2.6" fill="${C.muted}" opacity="${(opacity * .7).toFixed(2)}"/>`
    })
  })
  const lx = cx0, ly = 600
  return s + `<circle cx="${lx + 7}" cy="${ly - 6}" r="7" fill="${C.field}"/>` + text('yes', lx + 22, ly, 17, { fill: C.ink2 })
    + `<path d="M${lx + 72} ${ly - 11}l10 10m0-10l-10 10" stroke="${C.mark}" stroke-width="2.6"/>` + text('no', lx + 92, ly, 17, { fill: C.ink2 })
    + `<circle cx="${lx + 132}" cy="${ly - 6}" r="2.6" fill="${C.muted}"/>` + text('not stated', lx + 142, ly, 17, { fill: C.ink2 })
}

const others = () => stats.researched - 1
function title(s: string, maxWidth = 460) {
  // One line as large as fits, down to 64px; longer names wrap onto two lines at 64px.
  // A single long word (claude_codex_bridge) keeps shrinking until it fits.
  for (let size = 130; size >= 64; size -= 6) if (measure(s, size, 'display', -size * .035) <= maxWidth) return { svg: text(s, 64, 290, size, { font: 'display', tracking: -size * .035 }), y: 290 }
  const words = s.split(' ')
  if (words.length > 1 && words.every(w => measure(w, 64, 'display', -2) <= maxWidth)) return wrap(s, 64, 236, maxWidth, 64, 70, { font: 'display', tracking: -2 })
  let size = 64
  while (size > 28 && words.some(w => measure(w, size, 'display', -size * .03) > maxWidth)) size -= 2
  return wrap(s, 64, 290, maxWidth, size, size * 1.1, { font: 'display', tracking: -size * .03 })
}
const card = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${C.paper}"/>${mark(64, 56)}${body}</svg>`

export function siteCard() {
  const head = wrap(`Compare ${stats.researched} agent development environments`, 64, 214, 470, 54, 62, { font: 'display', tracking: -1.8 })
  return card(head.svg + wrap('Feature by feature, with a source for every answer.', 64, Math.max(head.y + 74, 440), 400, 24, 34, { fill: C.ink2 }).svg
    + text('adecomparison.com', 64, 590, 22, { font: 'display' }) + matrix([]))
}
export function productCard(p: Product) {
  const head = title(p.name), closing = notices.some(n => n.productId === p.id)
  const note = closing ? `Has a published shutdown notice. Compared with ${others()} other ADEs, with sources.` : `Compared with ${others()} other agent development environments, feature by feature.`
  return card(head.svg + wrap(note, 64, head.y + 70, 420, 26, 36, { fill: C.ink2 }).svg + address(64, 556, `/ade/${p.id}`) + matrix([p.id]))
}
export function pairCard(slug: string, products: Product[]) {
  const head = wrap(products.map(p => p.name).join(' vs '), 64, 214, 460, 58, 64, { font: 'display', tracking: -1.8 })
  return card(head.svg + wrap('Side by side, feature by feature, with a source for every answer.', 64, head.y + 66, 420, 24, 34, { fill: C.ink2 }).svg
    + address(64, 556, `/compare/${slug}`) + matrix(products.map(p => p.id)))
}
// 32 flat colours cover the palette and its antialiased edges; a fast quantizer keeps the build quick.
export const png = async (svg: string) => new Uint8Array(await sharp(Buffer.from(svg)).png({ palette: true, colours: 32, dither: 0, effort: 1 }).toBuffer())
