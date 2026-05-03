/**
 * Build a looping GIF from 2+ PNG (or JPEG) buffers using sharp + gifenc.
 */
export async function composeGifFromImageBuffers(buffers: Buffer[]): Promise<Buffer> {
    if (!buffers.length) throw new Error('No frames for GIF')
    const sharpMod = await import('sharp')
    const sharp = sharpMod.default
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc')

    const TARGET_W = 512
    const TARGET_H = 640

    const frames = buffers.length >= 2 ? buffers : [buffers[0], buffers[0]]
    const rgbaFrames: { data: Uint8ClampedArray; width: number; height: number }[] = []

    for (const buf of frames) {
        const { data, info } = await sharp(buf)
            .resize(TARGET_W, TARGET_H, { fit: 'cover' })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })

        rgbaFrames.push({
            data: new Uint8ClampedArray(data),
            width: info.width,
            height: info.height,
        })
    }

    const w = rgbaFrames[0].width
    const h = rgbaFrames[0].height
    for (const f of rgbaFrames) {
        if (f.width !== w || f.height !== h) {
            throw new Error('GIF frame size mismatch after resize')
        }
    }

    const gif = GIFEncoder()
    for (const frame of rgbaFrames) {
        const palette = quantize(frame.data, 256)
        const index = applyPalette(frame.data, palette)
        gif.writeFrame(index, w, h, { palette, delay: 90 })
    }

    return Buffer.from(gif.finish())
}
