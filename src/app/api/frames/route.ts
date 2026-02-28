import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, unlink, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'

const SESSIONS_DIR = join(tmpdir(), 'earth-journey-frames')

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''

  // Frame upload (FormData with binary PNG)
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const sessionId = formData.get('sessionId') as string
    const frameNum = parseInt(formData.get('frameNum') as string)
    const frame = formData.get('frame') as File

    if (!sessionId || isNaN(frameNum) || !frame) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const frameDir = join(SESSIONS_DIR, sessionId)
    const buffer = Buffer.from(await frame.arrayBuffer())
    const framePath = join(frameDir, `frame_${String(frameNum).padStart(5, '0')}.png`)
    await writeFile(framePath, buffer)

    return NextResponse.json({ ok: true })
  }

  // JSON actions: init / finalize
  const body = await request.json()

  if (body.action === 'init') {
    const sessionId = randomUUID()
    const frameDir = join(SESSIONS_DIR, sessionId)
    await mkdir(frameDir, { recursive: true })
    return NextResponse.json({ sessionId })
  }

  if (body.action === 'finalize') {
    const { sessionId, fps, transparent, filename } = body
    const frameDir = join(SESSIONS_DIR, sessionId)

    const isTransparent = transparent === true
    const outputExt = isTransparent ? 'mov' : 'mp4'
    const outputPath = join(SESSIONS_DIR, `${sessionId}.${outputExt}`)

    const ffmpegArgs = isTransparent
      ? [
          '-framerate', String(fps || 60),
          '-i', join(frameDir, 'frame_%05d.png'),
          '-c:v', 'prores_ks',
          '-profile:v', '4444',
          '-pix_fmt', 'yuva444p10le',
          '-y', outputPath,
        ]
      : [
          '-framerate', String(fps || 60),
          '-i', join(frameDir, 'frame_%05d.png'),
          '-c:v', 'libx264',
          '-crf', '18',
          '-preset', 'slow',
          '-pix_fmt', 'yuv420p',
          '-y', outputPath,
        ]

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs)
      let stderr = ''
      ffmpeg.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
      ffmpeg.on('close', (code: number) => {
        if (code === 0) resolve()
        else reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-500)}`))
      })
      ffmpeg.on('error', reject)
    })

    const outputBuffer = await readFile(outputPath)

    // Cleanup frames + output
    await rm(frameDir, { recursive: true, force: true }).catch(() => {})
    await unlink(outputPath).catch(() => {})

    const outputContentType = isTransparent ? 'video/quicktime' : 'video/mp4'
    const outputFilename = filename || 'recording'

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': outputContentType,
        'Content-Disposition': `attachment; filename="${outputFilename}.${outputExt}"`,
      },
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export const maxDuration = 300
export const dynamic = 'force-dynamic'
