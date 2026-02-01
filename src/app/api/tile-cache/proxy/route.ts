import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const CACHE_DIR = join(process.cwd(), 'tile-cache', 'tiles')

// Ensure cache directory exists
async function ensureCacheDir(subdir?: string) {
  const dir = subdir ? join(CACHE_DIR, subdir) : CACHE_DIR
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  return dir
}

// GET /api/tile-cache/proxy?url=...&level=...&x=...&y=...
// Proxy and cache tiles
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  const level = request.nextUrl.searchParams.get('level')
  const x = request.nextUrl.searchParams.get('x')
  const y = request.nextUrl.searchParams.get('y')

  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  // Generate cache key
  const cacheKey = level && x && y
    ? `${level}_${x}_${y}`
    : Buffer.from(url).toString('base64url').slice(0, 64)

  const levelDir = level || 'other'
  await ensureCacheDir(levelDir)

  // Determine file extension
  const ext = url.includes('.jpg') || url.includes('jpeg') ? 'jpg' : 'png'
  const filePath = join(CACHE_DIR, levelDir, `${cacheKey}.${ext}`)

  // Check cache
  if (existsSync(filePath)) {
    try {
      const data = await readFile(filePath)
      return new NextResponse(data, {
        headers: {
          'Content-Type': ext === 'jpg' ? 'image/jpeg' : 'image/png',
          'Cache-Control': 'public, max-age=31536000',
          'X-Cache': 'HIT',
        },
      })
    } catch {
      // Cache read failed, continue to fetch from source
    }
  }

  // Fetch from source
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TileCache/1.0)',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch tile: ${response.status}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('Content-Type') || 'image/png'
    const buffer = Buffer.from(await response.arrayBuffer())

    // Save to cache
    try {
      await writeFile(filePath, buffer)
    } catch (err) {
      console.warn('Failed to cache tile:', err)
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: `Fetch error: ${error}` },
      { status: 500 }
    )
  }
}
