import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const CACHE_DIR = join(process.cwd(), 'tile-cache')
const PROGRESS_FILE = join(CACHE_DIR, '_progress.json')

interface PreloadProgress {
  scannedTiles: string[] // ["level/x/y", ...]
  completedTiles: string[]
  lastPosition: number // frame number
  totalFrames: number
  timestamp: number
}

// GET - read progress
export async function GET() {
  try {
    if (!existsSync(PROGRESS_FILE)) {
      return NextResponse.json({ progress: null })
    }
    const data = await readFile(PROGRESS_FILE, 'utf-8')
    return NextResponse.json({ progress: JSON.parse(data) })
  } catch {
    return NextResponse.json({ progress: null })
  }
}

// POST - save progress
export async function POST(request: NextRequest) {
  try {
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true })
    }

    const progress: PreloadProgress = await request.json()
    progress.timestamp = Date.now()

    await writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2))

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// DELETE - clear progress
export async function DELETE() {
  try {
    if (existsSync(PROGRESS_FILE)) {
      const { unlink } = await import('fs/promises')
      await unlink(PROGRESS_FILE)
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
