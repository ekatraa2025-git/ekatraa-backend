import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)

function ffmpegBin(): string {
    return (process.env.FFMPEG_PATH || 'ffmpeg').trim() || 'ffmpeg'
}

async function normalizePng(buf: Buffer, tw: number, th: number): Promise<Buffer> {
    return sharp(buf)
        .resize(tw, th, { fit: 'cover' })
        .png()
        .toBuffer()
}

/**
 * H.264 MP4: gentle dissolve between two near-identical frames (no GIF palette banding).
 * Requires `ffmpeg` on PATH or FFMPEG_PATH. Throws if ffmpeg is missing or fails.
 */
export async function buildMp4FromPngBuffers(pngBuffers: Buffer[]): Promise<Buffer> {
    if (!pngBuffers.length) throw new Error('No frames for MP4')
    const firstMeta = await sharp(pngBuffers[0]).metadata()
    const tw = firstMeta.width || 768
    const th = firstMeta.height || 1024
    const dir = await mkdtemp(join(tmpdir(), 'einv-mp4-'))
    try {
        const a = await normalizePng(pngBuffers[0], tw, th)
        const b = await normalizePng(pngBuffers.length > 1 ? pngBuffers[1] : pngBuffers[0], tw, th)
        await writeFile(join(dir, '0.png'), a)
        await writeFile(join(dir, '1.png'), b)

        const scalePad = `scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2`
        const vf = [
            `[0:v]${scalePad},format=yuv420p,fps=24,setsar=1[v0]`,
            `[1:v]${scalePad},format=yuv420p,fps=24,setsar=1[v1]`,
            `[v0][v1]xfade=transition=dissolve:duration=1.25:offset=2.55,format=yuv420p[v]`,
        ].join(';')

        await execFileAsync(
            ffmpegBin(),
            [
                '-y',
                '-loop',
                '1',
                '-t',
                '4',
                '-i',
                '0.png',
                '-loop',
                '1',
                '-t',
                '4',
                '-i',
                '1.png',
                '-filter_complex',
                vf,
                '-map',
                '[v]',
                '-c:v',
                'libx264',
                '-crf',
                '20',
                '-preset',
                'medium',
                '-movflags',
                '+faststart',
                '-pix_fmt',
                'yuv420p',
                'out.mp4',
            ],
            { cwd: dir, timeout: 180_000, maxBuffer: 80 * 1024 * 1024 }
        )

        return await readFile(join(dir, 'out.mp4'))
    } finally {
        await rm(dir, { recursive: true, force: true })
    }
}
