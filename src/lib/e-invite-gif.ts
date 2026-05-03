import sharp from 'sharp'
import { createRequire } from 'module'

type OmggifCtor = new (
    buf: Uint8Array,
    width: number,
    height: number,
    gopts?: { loop?: number | null; palette?: number[] | null; background?: number }
) => {
    addFrame: (
        x: number,
        y: number,
        w: number,
        h: number,
        indexedPixels: Uint8Array,
        opts?: { palette?: number[]; delay?: number }
    ) => number
    end: () => number
}

const require = createRequire(import.meta.url)
// Vendored MIT omggif (deanm/omggif) — avoids fragile npm installs in CI.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GifWriter } = require('./vendor-omggif.js') as { GifWriter: OmggifCtor }

/** RGB 0xRRGGBB palette length must be power of 2 in [2, 256]. */
function padPaletteRgb(pal: number[]): number[] {
    const out = pal.slice()
    if (out.length < 2) {
        while (out.length < 2) out.push(0)
    }
    let target = 2
    while (target < out.length && target < 256) target <<= 1
    target = Math.min(256, target)
    while (out.length < target) out.push(0)
    return out
}

function quantizeToPalette(rgba: Uint8ClampedArray, width: number, height: number): {
    palette: number[]
    indices: Uint8Array
} {
    const map = new Map<number, number>()
    const palette: number[] = []
    const pixels = width * height
    const indices = new Uint8Array(pixels)

    for (let i = 0; i < pixels; i++) {
        const o = i * 4
        const r = rgba[o] >> 3
        const g = rgba[o + 1] >> 3
        const b = rgba[o + 2] >> 3
        const key = (r << 10) | (g << 5) | b

        let idx = map.get(key)
        if (idx === undefined) {
            if (palette.length >= 256) {
                idx = 0
            } else {
                idx = palette.length
                map.set(key, idx)
                const rr = r << 3
                const gg = g << 3
                const bb = b << 3
                palette.push((rr << 16) | (gg << 8) | bb)
            }
        }
        indices[i] = idx
    }

    return { palette: padPaletteRgb(palette), indices }
}

async function pngToQuantized(buf: Buffer, width: number, height: number) {
    const { data, info } = await sharp(buf)
        .resize(width, height, { fit: 'cover' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
    const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
    return quantizeToPalette(rgba, info.width, info.height)
}

/** Two PNG buffers → single animated GIF (short loop). */
export async function buildGifFromPngBuffers(pngBuffers: Buffer[]): Promise<Buffer> {
    if (!pngBuffers.length) throw new Error('No frames for GIF')
    const firstMeta = await sharp(pngBuffers[0]).metadata()
    const tw = firstMeta.width || 768
    const th = firstMeta.height || 1024

    const q0 = await pngToQuantized(pngBuffers[0], tw, th)
    const q1 =
        pngBuffers.length > 1
            ? await pngToQuantized(pngBuffers[1], tw, th)
            : q0

    const scratch = new Uint8Array(8 * 1024 * 1024)
    const gw = new GifWriter(scratch, tw, th, { loop: 0 })
    gw.addFrame(0, 0, tw, th, q0.indices, { palette: q0.palette, delay: 12 })
    gw.addFrame(0, 0, tw, th, q1.indices, { palette: q1.palette, delay: 14 })
    const end = gw.end()
    return Buffer.from(scratch.slice(0, end))
}
