import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir, readdir, rm, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const CACHE_DIR = join(process.cwd(), 'tile-cache')

// Ensure cache directory exists
async function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true })
  }
}

// GET /api/tile-cache?key=tile_5_10_15
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')

  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  }

  // Validate key format to prevent path traversal
  if (!/^tile_\d+_\d+_\d+$/.test(key)) {
    return NextResponse.json({ error: 'Invalid key format' }, { status: 400 })
  }

  const filePath = join(CACHE_DIR, `${key}.png`)

  try {
    const data = await readFile(filePath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

// POST /api/tile-cache - save tile
export async function POST(request: NextRequest) {
  await ensureCacheDir()

  const formData = await request.formData()
  const key = formData.get('key') as string
  const file = formData.get('file') as Blob

  if (!key || !file) {
    return NextResponse.json({ error: 'Missing key or file' }, { status: 400 })
  }

  // Validate key format
  if (!/^tile_\d+_\d+_\d+$/.test(key)) {
    return NextResponse.json({ error: 'Invalid key format' }, { status: 400 })
  }

  const filePath = join(CACHE_DIR, `${key}.png`)
  const buffer = Buffer.from(await file.arrayBuffer())

  await writeFile(filePath, buffer)

  return NextResponse.json({ success: true })
}

// DELETE /api/tile-cache - clear all cache
export async function DELETE() {
  try {
    if (existsSync(CACHE_DIR)) {
      const files = await readdir(CACHE_DIR)
      await Promise.all(
        files.map(file => rm(join(CACHE_DIR, file)))
      )
    }
    return NextResponse.json({ success: true, cleared: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// HEAD /api/tile-cache - get cache stats
export async function HEAD() {
  try {
    await ensureCacheDir()
    const files = await readdir(CACHE_DIR)
    const pngFiles = files.filter(f => f.endsWith('.png'))

    let totalSize = 0
    for (const file of pngFiles) {
      const s = await stat(join(CACHE_DIR, file))
      totalSize += s.size
    }

    return new NextResponse(null, {
      headers: {
        'X-Tile-Count': String(pngFiles.length),
        'X-Total-Size': String(totalSize),
      },
    })
  } catch {
    return new NextResponse(null, {
      headers: {
        'X-Tile-Count': '0',
        'X-Total-Size': '0',
      },
    })
  }
}
