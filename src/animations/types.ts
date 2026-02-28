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
  chengdu: {
    lat: 30.5728,
    lon: 104.0668,
    name: 'Chengdu',
    nameZh: '成都',
  },
  maryland: {
    lat: 39.0458,
    lon: -76.6413,
    name: 'Maryland, USA',
    nameZh: '马里兰州',
  },
  bangalore: {
    lat: 12.9716,
    lon: 77.5946,
    name: 'Bangalore',
    nameZh: '班加罗尔',
  },
  singapore: {
    lat: 1.3521,
    lon: 103.8198,
    name: 'Singapore',
    nameZh: '新加坡',
  },
  melbourne: {
    lat: -37.8136,
    lon: 144.9631,
    name: 'Melbourne',
    nameZh: '墨尔本',
  },
  newyork: {
    lat: 40.7128,
    lon: -74.0060,
    name: 'New York',
    nameZh: '纽约',
  },
  tokyo: {
    lat: 35.6762,
    lon: 139.6503,
    name: 'Tokyo',
    nameZh: '东京',
  },
  bangkok: {
    lat: 13.7563,
    lon: 100.5018,
    name: 'Bangkok',
    nameZh: '曼谷',
  },
  rotterdam: {
    lat: 51.9244,
    lon: 4.4777,
    name: 'Rotterdam',
    nameZh: '鹿特丹',
  },
  madrid: {
    lat: 40.4168,
    lon: -3.7038,
    name: 'Madrid',
    nameZh: '马德里',
  },
  seattle: {
    lat: 47.6062,
    lon: -122.3321,
    name: 'Seattle',
    nameZh: '西雅图',
  },
}
