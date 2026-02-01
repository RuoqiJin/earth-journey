// Tile cache client - communicates with /api/tile-cache

export interface CacheInfo {
  count: number
  size: number
}

export interface PreloadProgress {
  scannedTiles: string[]
  completedTiles: string[]
  lastPosition: number
  totalFrames: number
  timestamp: number
}

export async function getTileFromCache(key: string): Promise<Blob | null> {
  try {
    const res = await fetch(`/api/tile-cache?key=${encodeURIComponent(key)}`)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

export async function saveTileToCache(key: string, blob: Blob): Promise<boolean> {
  try {
    const formData = new FormData()
    formData.append('key', key)
    formData.append('file', blob)

    const res = await fetch('/api/tile-cache', {
      method: 'POST',
      body: formData,
    })
    return res.ok
  } catch {
    return false
  }
}

export async function getCacheInfo(): Promise<CacheInfo> {
  try {
    const res = await fetch('/api/tile-cache', { method: 'HEAD' })
    return {
      count: parseInt(res.headers.get('X-Tile-Count') || '0', 10),
      size: parseInt(res.headers.get('X-Total-Size') || '0', 10),
    }
  } catch {
    return { count: 0, size: 0 }
  }
}

export async function clearCache(): Promise<boolean> {
  try {
    const res = await fetch('/api/tile-cache', { method: 'DELETE' })
    return res.ok
  } catch {
    return false
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Progress management
export async function getPreloadProgress(): Promise<PreloadProgress | null> {
  try {
    const res = await fetch('/api/tile-cache/progress')
    const data = await res.json()
    return data.progress
  } catch {
    return null
  }
}

export async function savePreloadProgress(progress: Omit<PreloadProgress, 'timestamp'>): Promise<boolean> {
  try {
    const res = await fetch('/api/tile-cache/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function clearPreloadProgress(): Promise<boolean> {
  try {
    const res = await fetch('/api/tile-cache/progress', { method: 'DELETE' })
    return res.ok
  } catch {
    return false
  }
}
