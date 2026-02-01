import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const tempDir = join(tmpdir(), 'earth-journey-convert')
  const id = randomUUID()
  const inputPath = join(tempDir, `${id}.webm`)
  const outputPath = join(tempDir, `${id}.mp4`)

  try {
    // Ensure temp directory exists
    await mkdir(tempDir, { recursive: true })

    // Get WebM data from request
    const formData = await request.formData()
    const file = formData.get('video') as File
    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
    }

    const filename = (formData.get('filename') as string) || 'video'

    // Write WebM to temp file
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(inputPath, buffer)

    // Convert with FFmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'fast',
        '-pix_fmt', 'yuv420p',
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

    // Read converted MP4
    const mp4Buffer = await readFile(outputPath)

    // Cleanup temp files
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})

    // Return MP4
    return new NextResponse(mp4Buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}.mp4"`,
      },
    })
  } catch (error) {
    console.error('Conversion error:', error)

    // Cleanup on error
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Conversion failed' },
      { status: 500 }
    )
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
