// Flight camera animator - handles the flying camera animation
// Uses Cubic Hermite Spline for smooth lon/lat path with zero-tangent override
// on pure vertical segments, and logarithmic interpolation for altitude.
import { FlightConfig, CameraPosition } from '@/animations/types'

interface Tangent {
  lon: number
  lat: number
  heading: number
  pitch: number
}

export class FlightAnimator {
  private config: FlightConfig
  private totalFrames: number
  private totalDuration: number
  private keyframes: CameraPosition[]
  private tangents: Tangent[]
  private segmentTimes: number[] // cumulative time for each keyframe

  constructor(config: FlightConfig) {
    this.config = config
    this.totalDuration = config.segments.reduce((sum, s) => sum + s.duration, 0)
    this.totalFrames = this.totalDuration * config.fps

    this.keyframes = [
      config.startPosition,
      ...config.segments.map(s => s.to),
    ]

    // Build cumulative time array (absolute seconds for each keyframe)
    this.segmentTimes = [0]
    let cumTime = 0
    for (const s of config.segments) {
      cumTime += s.duration
      this.segmentTimes.push(cumTime)
    }

    // Pre-compute tangents with vertical segment override
    this.tangents = this.computeTangents()
  }

  private computeTangents(): Tangent[] {
    const n = this.keyframes.length
    const tangents: Tangent[] = []

    for (let i = 0; i < n; i++) {
      const prev = i > 0 ? this.keyframes[i - 1] : this.keyframes[i]
      const next = i < n - 1 ? this.keyframes[i + 1] : this.keyframes[i]
      const tPrev = this.segmentTimes[Math.max(0, i - 1)]
      const tNext = this.segmentTimes[Math.min(n - 1, i + 1)]
      const dt = tNext - tPrev

      let t: Tangent
      if (dt > 0) {
        // Central difference (Catmull-Rom style)
        t = {
          lon: (next.lon - prev.lon) / dt,
          lat: (next.lat - prev.lat) / dt,
          heading: (next.heading - prev.heading) / dt,
          pitch: (next.pitch - prev.pitch) / dt,
        }
      } else {
        t = { lon: 0, lat: 0, heading: 0, pitch: 0 }
      }

      // Zero out lon/lat tangent if either adjacent segment is purely vertical
      const isVerticalWithPrev = i > 0
        && this.keyframes[i].lon === prev.lon
        && this.keyframes[i].lat === prev.lat
      const isVerticalWithNext = i < n - 1
        && this.keyframes[i].lon === next.lon
        && this.keyframes[i].lat === next.lat

      if (isVerticalWithPrev || isVerticalWithNext) {
        t.lon = 0
        t.lat = 0
      }

      tangents.push(t)
    }

    return tangents
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

  // Logarithmic interpolation for altitude — perceptually uniform zoom speed
  private logLerp(a: number, b: number, t: number): number {
    const logA = Math.log(a)
    const logB = Math.log(b)
    return Math.exp(logA + (logB - logA) * t)
  }

  // Cubic Hermite basis functions
  private h00(t: number) { return 2 * t * t * t - 3 * t * t + 1 }
  private h10(t: number) { return t * t * t - 2 * t * t + t }
  private h01(t: number) { return -2 * t * t * t + 3 * t * t }
  private h11(t: number) { return t * t * t - t * t }

  private hermite(p0: number, p1: number, m0: number, m1: number, t: number): number {
    return this.h00(t) * p0 + this.h10(t) * m0 + this.h01(t) * p1 + this.h11(t) * m1
  }

  getFramePosition(frameNum: number): CameraPosition & { segment: string } {
    const segments = this.config.segments
    const time = frameNum / this.config.fps
    const globalT = Math.min(time / this.totalDuration, 1)

    // Return exact start and end positions
    if (globalT <= 0.001) {
      return { ...this.keyframes[0], segment: segments[0]?.name || 'start' }
    }
    if (globalT >= 0.999) {
      return { ...this.keyframes[this.keyframes.length - 1], segment: 'end' }
    }

    // Find current segment
    const globalTime = globalT * this.totalDuration
    let idx = 0
    for (let i = 0; i < segments.length; i++) {
      if (globalTime >= this.segmentTimes[i] && globalTime <= this.segmentTimes[i + 1]) {
        idx = i
        break
      }
    }

    const p0 = this.keyframes[idx]
    const p1 = this.keyframes[idx + 1]
    const v0 = this.tangents[idx]
    const v1 = this.tangents[idx + 1]

    const T = this.segmentTimes[idx + 1] - this.segmentTimes[idx] // segment duration in seconds
    const t = (globalTime - this.segmentTimes[idx]) / T // local t [0, 1]

    // Scale tangents from velocity (per-second) to segment-local space
    const m0 = { lon: v0.lon * T, lat: v0.lat * T, heading: v0.heading * T, pitch: v0.pitch * T }
    const m1 = { lon: v1.lon * T, lat: v1.lat * T, heading: v1.heading * T, pitch: v1.pitch * T }

    return {
      lon: this.hermite(p0.lon, p1.lon, m0.lon, m1.lon, t),
      lat: this.hermite(p0.lat, p1.lat, m0.lat, m1.lat, t),
      alt: this.logLerp(p0.alt, p1.alt, t),
      heading: this.hermite(p0.heading, p1.heading, m0.heading, m1.heading, t),
      pitch: this.hermite(p0.pitch, p1.pitch, m0.pitch, m1.pitch, t),
      segment: segments[idx]?.name || 'end',
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
