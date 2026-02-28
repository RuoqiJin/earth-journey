import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFile, readFile, unlink, mkdir, readdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const tempDir = join(tmpdir(), 'earth-journey-convert')
  const id = randomUUID()

  try {
    await mkdir(tempDir, { recursive: true })

    const contentType = request.headers.get('content-type') || ''

    // Handle PNG frames (JSON body)
    if (contentType.includes('application/json')) {
      const { frames, filename, format, fps } = await request.json()

      if (!frames || !Array.isArray(frames) || frames.length === 0) {
        return NextResponse.json({ error: 'No frames provided' }, { status: 400 })
      }

      const frameDir = join(tempDir, id)
      await mkdir(frameDir, { recursive: true })

      // Write PNG frames to disk
      for (let i = 0; i < frames.length; i++) {
        const base64Data = frames[i].replace(/^data:image\/png;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const framePath = join(frameDir, `frame_${String(i).padStart(5, '0')}.png`)
        await writeFile(framePath, buffer)
      }

      const outputPath = join(tempDir, `${id}.mov`)

      // Convert PNG sequence to ProRes 4444 with alpha
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-framerate', String(fps || 60),
          '-i', join(frameDir, 'frame_%05d.png'),
          '-c:v', 'prores_ks',
          '-profile:v', '4444',
          '-pix_fmt', 'yuva444p10le',
          '-y',
          outputPath,
        ])

        let stderr = ''
        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString()
        })

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`))
          }
        })

        ffmpeg.on('error', reject)
      })

      const outputBuffer = await readFile(outputPath)

      // Cleanup
      const frameFiles = await readdir(frameDir)
      for (const file of frameFiles) {
        await unlink(join(frameDir, file)).catch(() => {})
      }
      await unlink(outputPath).catch(() => {})

      return new NextResponse(outputBuffer, {
        headers: {
          'Content-Type': 'video/quicktime',
          'Content-Disposition': `attachment; filename="${filename || 'video'}.mov"`,
        },
      })
    }

    // Handle WebM file (FormData)
    const formData = await request.formData()
    const file = formData.get('video') as File
    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
    }

    const filename = (formData.get('filename') as string) || 'video'
    const format = (formData.get('format') as string) || 'mp4'

    const inputPath = join(tempDir, `${id}.webm`)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(inputPath, buffer)

    let outputPath: string
    let ffmpegArgs: string[]
    let outputContentType: string
    let extension: string

    if (format === 'prores') {
      outputPath = join(tempDir, `${id}.mov`)
      ffmpegArgs = [
        '-i', inputPath,
        '-c:v', 'prores_ks',
        '-profile:v', '4444',
        '-pix_fmt', 'yuva444p10le',
        '-y',
        outputPath,
      ]
      outputContentType = 'video/quicktime'
      extension = 'mov'
    } else {
      outputPath = join(tempDir, `${id}.mp4`)
      ffmpegArgs = [
        '-i', inputPath,
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'fast',
        '-pix_fmt', 'yuv420p',
        '-y',
        outputPath,
      ]
      outputContentType = 'video/mp4'
      extension = 'mp4'
    }

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs)

      let stderr = ''
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`))
        }
      })

      ffmpeg.on('error', reject)
    })

    const outputBuffer = await readFile(outputPath)

    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': outputContentType,
        'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
      },
    })
  } catch (error) {
    console.error('Conversion error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Conversion failed' },
      { status: 500 }
    )
  }
}

// Route segment config for Next.js App Router
export const maxDuration = 300  // 5 minutes timeout
export const dynamic = 'force-dynamic'
