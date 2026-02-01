export interface Location {
  lat: number
  lon: number
  name: string
  nameZh?: string
  coords?: string
}

export interface AnimationSegment {
  name: string
  duration: number
  to: CameraPosition
}

export interface CameraPosition {
  lon: number
  lat: number
  alt: number
  heading: number
  pitch: number
}

export interface TileInfo {
  level: number
  x: number
  y: number
  count: number
}

export interface CacheStats {
  hits: number
  misses: number
  total: number
}

export const LOCATIONS: Record<string, Location> = {
  london: {
    lat: 51.5214,
    lon: -0.1448,
    name: '66 PORTLAND PLACE',
    coords: '51.5214°N, 0.1448°W',
  },
  shenzhen: {
    lat: 22.6815,
    lon: 113.839,
    name: 'SHENZHEN WORLD EXHIBITION CENTER',
    nameZh: '深圳国际会展中心',
    coords: '22.6815°N, 113.8390°E',
  },
  china: {
    lat: 35.8617,
    lon: 104.1954,
    name: 'CHINA',
    nameZh: '中国',
  },
}

export const ANIMATION_CONFIG = {
  fps: 60,
  // Starting position: London 66 Portland Place top-down view
  startPosition: {
    lon: LOCATIONS.london.lon,
    lat: LOCATIONS.london.lat,
    alt: 500,  // 500m top-down
    heading: 0,
    pitch: -90,
  } as CameraPosition,
  segments: [
    // Take off from London, continuous ascent
    { name: 'pullout-london', duration: 4, to: { lon: LOCATIONS.london.lon, lat: LOCATIONS.london.lat, alt: 2000000, heading: 0, pitch: -90 } },
    // Fly across Eurasia
    { name: 'rotate-to-china', duration: 6, to: { lon: 60, lat: 40, alt: 12000000, heading: 0, pitch: -90 } },
    // Approach China
    { name: 'approach-china', duration: 4, to: { lon: LOCATIONS.china.lon, lat: LOCATIONS.china.lat, alt: 6000000, heading: 0, pitch: -90 } },
    // Dive toward Shenzhen
    { name: 'approach-shenzhen', duration: 4, to: { lon: LOCATIONS.shenzhen.lon, lat: LOCATIONS.shenzhen.lat, alt: 300000, heading: 0, pitch: -90 } },
    // Land at Shenzhen World Exhibition Center top-down view
    { name: 'dive-shenzhen', duration: 4, to: { lon: LOCATIONS.shenzhen.lon, lat: LOCATIONS.shenzhen.lat, alt: 500, heading: 0, pitch: -90 } },
  ] as AnimationSegment[],
}
