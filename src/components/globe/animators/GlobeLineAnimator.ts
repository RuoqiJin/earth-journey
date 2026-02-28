// Globe with animated flight lines
import { GlobeLineConfig, CameraPosition, Location } from '@/animations/types'

export interface LineState {
  from: Location
  to: Location
  progress: number  // 0-1
  color: string
  arcHeight: number
}

export class GlobeLineAnimator {
  private config: GlobeLineConfig
  private totalFrames: number

  constructor(config: GlobeLineConfig) {
    this.config = config
    this.totalFrames = config.totalDuration * config.fps
  }

  getTotalFrames(): number {
    return this.totalFrames
  }

  getTotalDuration(): number {
    return this.config.totalDuration
  }

  getStartPosition(): CameraPosition {
    if (this.config.camera.followLine && this.config.lines.length > 0) {
      const line = this.config.lines[0]
      return {
        lon: line.from.lon,
        lat: line.from.lat,
        alt: this.config.camera.followAlt || 5000000,
        heading: 0,
        pitch: this.config.camera.followPitch || -60,
      }
    }
    return {
      lon: this.config.camera.lon,
      lat: this.config.camera.lat,
      alt: this.config.camera.alt,
      heading: 0,
      pitch: -90,
    }
  }

  getMarkers(): Location[] {
    return this.config.markers
  }

  // Get camera position at frame (follow line or slow rotation)
  getFramePosition(frameNum: number): CameraPosition {
    const time = frameNum / this.config.fps

    // Camera follow mode
    if (this.config.camera.followLine && this.config.lines.length > 0) {
      const line = this.config.lines[0]
      const delay = line.delay || 0
      const lineStartTime = delay
      const lineEndTime = delay + line.duration

      let progress: number
      if (time < lineStartTime) {
        progress = 0
      } else if (time >= lineEndTime) {
        progress = 1
      } else {
        progress = (time - lineStartTime) / line.duration
        // Use linear for constant speed animation
        progress = this.linear(progress)
      }

      // Interpolate camera position along the line
      const lon = line.from.lon + (line.to.lon - line.from.lon) * progress
      const lat = line.from.lat + (line.to.lat - line.from.lat) * progress

      return {
        lon,
        lat,
        alt: this.config.camera.followAlt || 5000000,
        heading: 0,
        pitch: this.config.camera.followPitch || -60,
      }
    }

    // Default rotation mode
    const rotationOffset = time * this.config.camera.rotationSpeed
    return {
      lon: this.config.camera.lon + rotationOffset,
      lat: this.config.camera.lat,
      alt: this.config.camera.alt,
      heading: 0,
      pitch: -90,
    }
  }


  // Get all line states at current frame
  getLineStates(frameNum: number): LineState[] {
    const time = frameNum / this.config.fps
    const states: LineState[] = []

    for (const line of this.config.lines) {
      const delay = line.delay || 0
      const lineStartTime = delay
      const lineEndTime = delay + line.duration

      if (time < lineStartTime) {
        // Line hasn't started yet
        continue
      }

      let progress: number
      if (time >= lineEndTime) {
        progress = 1
      } else {
        progress = (time - lineStartTime) / line.duration
        // Use linear for constant speed
        progress = this.linear(progress)
      }

      states.push({
        from: line.from,
        to: line.to,
        progress,
        color: line.color,
        arcHeight: line.arcHeight,
      })
    }

    return states
  }

  // Linear - constant speed
  private linear(t: number): number {
    return t
  }

  // Smooth start and end, constant middle
  private easeInOutSine(t: number): number {
    return -(Math.cos(Math.PI * t) - 1) / 2
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
  }

  // Generate arc points between two locations
  static generateArcPoints(
    from: Location,
    to: Location,
    progress: number,
    arcHeight: number,
    numPoints: number = 100
  ): { lon: number; lat: number; alt: number }[] {
    const points: { lon: number; lat: number; alt: number }[] = []
    const actualPoints = Math.max(2, Math.floor(numPoints * progress))

    for (let i = 0; i <= actualPoints; i++) {
      const t = i / numPoints

      // Interpolate position
      const lon = from.lon + (to.lon - from.lon) * t
      const lat = from.lat + (to.lat - from.lat) * t

      // Calculate arc height (parabolic)
      // Maximum height at t=0.5
      const heightFactor = 4 * t * (1 - t)
      const distance = GlobeLineAnimator.getDistanceKm(from, to)
      const maxHeight = distance * 0.15 * arcHeight * 1000  // Convert to meters
      const alt = heightFactor * maxHeight

      points.push({ lon, lat, alt })
    }

    return points
  }

  // Calculate distance between two points in km (Haversine formula)
  static getDistanceKm(from: Location, to: Location): number {
    const R = 6371 // Earth's radius in km
    const dLat = (to.lat - from.lat) * Math.PI / 180
    const dLon = (to.lon - from.lon) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }
}
