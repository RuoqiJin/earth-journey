// Flight camera animator - handles the flying camera animation
import { FlightConfig, CameraPosition } from '@/animations/types'

export class FlightAnimator {
  private config: FlightConfig
  private totalFrames: number
  private totalDuration: number

  constructor(config: FlightConfig) {
    this.config = config
    this.totalDuration = config.segments.reduce((sum, s) => sum + s.duration, 0)
    this.totalFrames = this.totalDuration * config.fps
  }

  getTotalFrames(): number {
    return this.totalFrames
  }

  getTotalDuration(): number {
    return this.totalDuration
  }

  getStartPosition(): CameraPosition {
    return this.config.startPosition
  }

  // Catmull-Rom spline interpolation
  private catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t
    const t3 = t2 * t
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    )
  }

  private catmullRomPosition(
    p0: CameraPosition,
    p1: CameraPosition,
    p2: CameraPosition,
    p3: CameraPosition,
    t: number
  ): CameraPosition {
    return {
      lon: this.catmullRom(p0.lon, p1.lon, p2.lon, p3.lon, t),
      lat: this.catmullRom(p0.lat, p1.lat, p2.lat, p3.lat, t),
      alt: this.catmullRom(p0.alt, p1.alt, p2.alt, p3.alt, t),
      heading: this.catmullRom(p0.heading, p1.heading, p2.heading, p3.heading, t),
      pitch: this.catmullRom(p0.pitch, p1.pitch, p2.pitch, p3.pitch, t),
    }
  }

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t)
  }

  private lerpPosition(p1: CameraPosition, p2: CameraPosition, t: number): CameraPosition {
    return {
      lon: p1.lon + (p2.lon - p1.lon) * t,
      lat: p1.lat + (p2.lat - p1.lat) * t,
      alt: p1.alt + (p2.alt - p1.alt) * t,
      heading: p1.heading + (p2.heading - p1.heading) * t,
      pitch: p1.pitch + (p2.pitch - p1.pitch) * t,
    }
  }

  getFramePosition(frameNum: number): CameraPosition & { segment: string } {
    const segments = this.config.segments
    const time = frameNum / this.config.fps
    const globalT = Math.min(time / this.totalDuration, 1)

    const keyframes: CameraPosition[] = [
      this.config.startPosition,
      ...segments.map(s => s.to)
    ]

    // Return exact start and end positions
    if (globalT <= 0.001) {
      return { ...keyframes[0], segment: segments[0]?.name || 'start' }
    }
    if (globalT >= 0.999) {
      return { ...keyframes[keyframes.length - 1], segment: 'end' }
    }

    // Apply easing at start and end
    let easedT: number
    if (globalT < 0.08) {
      easedT = this.smoothstep(globalT / 0.08) * 0.08
    } else if (globalT > 0.92) {
      easedT = 0.92 + this.smoothstep((globalT - 0.92) / 0.08) * 0.08
    } else {
      easedT = globalT
    }

    // Calculate cumulative time ratio
    const durations = segments.map(s => s.duration)
    const cumulativeT: number[] = [0]
    let cumSum = 0
    for (const d of durations) {
      cumSum += d / this.totalDuration
      cumulativeT.push(cumSum)
    }

    // Find current segment
    let segmentIndex = 0
    for (let i = 0; i < cumulativeT.length - 1; i++) {
      if (easedT >= cumulativeT[i] && easedT <= cumulativeT[i + 1]) {
        segmentIndex = i
        break
      }
    }

    const segStart = cumulativeT[segmentIndex]
    const segEnd = cumulativeT[segmentIndex + 1]
    const localT = segEnd > segStart ? (easedT - segStart) / (segEnd - segStart) : 0

    const p1 = keyframes[segmentIndex]
    const p2 = keyframes[segmentIndex + 1]

    // First and last two segments use linear interpolation
    const isFirstSegment = segmentIndex === 0
    const isLastTwoSegments = segmentIndex >= segments.length - 2

    if (isFirstSegment || isLastTwoSegments) {
      const pos = this.lerpPosition(p1, p2, localT)
      return { ...pos, segment: segments[segmentIndex]?.name || 'end' }
    }

    // Middle segments use Catmull-Rom spline
    const p0 = keyframes[Math.max(0, segmentIndex - 1)]
    const p3 = keyframes[Math.min(keyframes.length - 1, segmentIndex + 2)]
    const pos = this.catmullRomPosition(p0, p1, p2, p3, localT)

    return {
      ...pos,
      segment: segments[segmentIndex]?.name || 'end',
    }
  }

  // Calculate cloud opacity based on altitude
  getCloudOpacity(alt: number): number {
    if (alt >= 1000 && alt <= 15000) {
      if (alt < 3000) {
        return (alt - 1000) / 2000
      } else if (alt <= 6000) {
        return 1
      } else {
        return 1 - (alt - 6000) / 9000
      }
    }
    return 0
  }
}
