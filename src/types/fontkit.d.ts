// The parts of fontkit the sharing cards use (src/lib/og.ts).
declare module 'fontkit' {
  interface Glyph { id: number; path: { toSVG(): string } }
  interface GlyphPosition { xAdvance: number; xOffset: number; yOffset: number }
  export interface Font { unitsPerEm: number; layout(text: string): { glyphs: Glyph[]; positions: GlyphPosition[]; advanceWidth: number } }
  export function openSync(path: string): Font
}
