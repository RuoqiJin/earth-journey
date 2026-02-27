// Animation project types

export interface Location {
  lat: number
  lon: number
  name: string
  nameZh?: string
  coords?: string
}

export interface CameraPosition {
  lon: number
  lat: number
  alt: number
  heading: number
  pitch: number
}

// ============ Flight Animation (Type 1) ============
export interface FlightSegment {
  name: string
  duration: number
  to: CameraPosition
}

export interface FlightConfig {
  fps: number
  startPosition: CameraPosition
  segments: FlightSegment[]
}

// ============ Globe Lines Animation (Type 2) ============
export interface FlightLine {
  from: Location
  to: Location
  duration: number
  color: string
  arcHeight: number  // Arc height multiplier (1.0 = default)
  delay?: number     // Delay before this line starts (seconds)
}

export interface GlobeLineConfig {
  fps: number
  camera: {
    lon: number
    lat: number
    alt: number
    rotationSpeed: number  // degrees per second
    followLine?: boolean   // Camera follows the line
    followAlt?: number     // Altitude when following
    followPitch?: number   // Pitch angle when following (-90 = looking down)
  }
  totalDuration: number
  lines: FlightLine[]
  markers: Location[]
}

// ============ Animation Project ============
export type AnimationType = 'flight' | 'globe-lines'

export interface AnimationProject {
  id: string
  name: string
  nameZh?: string
  description: string
  type: AnimationType
  config: FlightConfig | GlobeLineConfig
}

// Common locations
export const LOCATIONS: Record<string, Location> = {
  london: {
    lat: 51.5214,
    lon: -0.1448,
    name: 'RIBA, 66 Portland Place',
    nameZh: '英国皇家建筑师学会',
    coords: '51.5214°N, 0.1448°W',
  },
  shenzhen: {
    lat: 22.6815,
    lon: 113.839,
    name: 'Shenzhen World Exhibition Center',
    nameZh: '深圳国际会展中心',
    coords: '22.6815°N, 113.8390°E',
  },
  china: {
    lat: 35.8617,
    lon: 104.1954,
    name: 'China',
    nameZh: '中国',
  },
  hongkong: {
    lat: 22.3193,
    lon: 114.1694,
    name: 'Hong Kong',
    nameZh: '香港',
  },
  beijing: {
    lat: 39.9042,
    lon: 116.4074,
    name: 'Beijing',
    nameZh: '北京',
  },
  shanghai: {
    lat: 31.2304,
    lon: 121.4737,
    name: 'Shanghai',
    nameZh: '上海',
  },
}
