// Flight trail overlay — animated trail line + airplane icon from point A to B
// Independent of camera animation, controlled by progress (0~1)
import { Location } from '@/animations/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TrailConfig {
  from: Location
  to: Location
  arcHeight: number       // Arc height multiplier (1.0 = default)
  numPoints: number       // Number of points on the arc
  lineColor: string       // Trail line color (CSS)
  lineWidth: number       // Trail line width in pixels
  glowColor: string       // Glow layer color
  glowWidth: number       // Glow layer width
  airplaneScale: number   // Billboard scale
  airplaneImage: string   // URL to airplane icon (nose pointing UP)
}

export const DEFAULT_TRAIL_CONFIG: TrailConfig = {
  from: { lat: 51.5214, lon: -0.1448, name: 'London' },
  to: { lat: 22.6815, lon: 113.839, name: 'Shenzhen' },
  arcHeight: 1.0,
  numPoints: 200,
  lineColor: '#ffffff',
  lineWidth: 2,
  glowColor: '#C1272D',
  glowWidth: 8,
  airplaneScale: 1.2,
  airplaneImage: '/airplane.svg',
}

export class FlightTrailOverlay {
  private viewer: any
  private Cesium: any
  private config: TrailConfig

  // Pre-computed full arc in Cartesian3
  private allPoints: any[] = []
  // Lon/lat/alt for each point (for heading calculation)
  private arcGeo: { lon: number; lat: number; alt: number }[] = []

  private progress = 0
  private trailEntity: any = null
  private glowEntity: any = null
  private airplaneEntity: any = null
  private trailPositions: any[] = []

  constructor(viewer: any, Cesium: any, config: Partial<TrailConfig> = {}) {
    this.viewer = viewer
    this.Cesium = Cesium
    this.config = { ...DEFAULT_TRAIL_CONFIG, ...config }

    this.generateArc()
    this.initEntities()
  }

  // Generate great circle arc points with parabolic altitude
  private generateArc() {
    const { from, to, arcHeight, numPoints } = this.config
    const Cesium = this.Cesium

    // Distance for height calculation
    const R = 6371 // km
    const dLat = (to.lat - from.lat) * Math.PI / 180
    const dLon = (to.lon - from.lon) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const maxAlt = distKm * 0.12 * arcHeight * 1000 // meters

    this.arcGeo = []
    this.allPoints = []

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints

      // Spherical interpolation for lon/lat (simple lerp is fine for display)
      const lon = from.lon + (to.lon - from.lon) * t
      const lat = from.lat + (to.lat - from.lat) * t

      // Parabolic arc height
      const alt = 4 * t * (1 - t) * maxAlt

      this.arcGeo.push({ lon, lat, alt })
      this.allPoints.push(Cesium.Cartesian3.fromDegrees(lon, lat, alt))
    }
  }

  private initEntities() {
    const Cesium = this.Cesium
    const viewer = this.viewer

    // Glow layer (wider, semi-transparent)
    this.glowEntity = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => this.trailPositions, false),
        width: this.config.glowWidth,
        material: Cesium.Color.fromCssColorString(this.config.glowColor).withAlpha(0.6),
        depthFailMaterial: Cesium.Color.fromCssColorString(this.config.glowColor).withAlpha(0.3),
      },
    })

    // Core trail line
    this.trailEntity = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => this.trailPositions, false),
        width: this.config.lineWidth,
        material: Cesium.Color.fromCssColorString(this.config.lineColor),
        depthFailMaterial: Cesium.Color.fromCssColorString(this.config.lineColor).withAlpha(0.5),
      },
    })

    // Airplane billboard + origin label on same entity
    const nameEn = this.config.from.name.toUpperCase()
    const nameCn = this.config.from.nameZh || ''
    const originLabel = nameCn ? `${nameEn}\n${nameCn}` : nameEn
    this.airplaneEntity = viewer.entities.add({
      position: new Cesium.CallbackProperty(() => {
        if (this.trailPositions.length === 0) return this.allPoints[0]
        return this.trailPositions[this.trailPositions.length - 1]
      }, false),
      billboard: {
        image: this.config.airplaneImage,
        scale: this.config.airplaneScale,
        alignedAxis: new Cesium.CallbackProperty(() => this.getFlightDirection(), false),
        scaleByDistance: new Cesium.NearFarScalar(1000, 2.0, 13000000, 0.4),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: originLabel,
        font: 'bold 14px "Helvetica Neue", Helvetica, Arial, sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL,
        showBackground: true,
        backgroundColor: new Cesium.Color(0.54, 0.11, 0.13, 0.85), // #8A1C20
        backgroundPadding: new Cesium.Cartesian2(10, 6),
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, 28),
        disableDepthTestDistance: Number.POSITIVE_INFINITY, // always render above polylines
        scaleByDistance: new Cesium.NearFarScalar(1000, 1.2, 13000000, 0.5),
      },
    })
  }

  // Calculate flight direction vector for airplane heading
  private getFlightDirection(): any {
    const Cesium = this.Cesium
    const p = Math.max(0, Math.min(this.progress, 1))
    const totalSeg = this.allPoints.length - 1
    const idx = Math.min(Math.floor(p * totalSeg), totalSeg - 1)

    const p1 = this.allPoints[idx]
    const p2 = this.allPoints[Math.min(idx + 1, totalSeg)]

    const dir = new Cesium.Cartesian3()
    Cesium.Cartesian3.subtract(p2, p1, dir)

    if (Cesium.Cartesian3.magnitude(dir) < 0.001) {
      return Cesium.Cartesian3.UNIT_Z
    }

    Cesium.Cartesian3.normalize(dir, dir)
    return dir
  }

  // Update progress (0~1), call each frame
  setProgress(p: number) {
    this.progress = Math.max(0, Math.min(p, 1))

    const Cesium = this.Cesium
    const totalSeg = this.allPoints.length - 1
    const exactIdx = this.progress * totalSeg
    const floorIdx = Math.floor(exactIdx)
    const lerpT = exactIdx - floorIdx

    if (this.progress <= 0) {
      this.trailPositions = []
      return
    }

    // Slice points up to current + lerp the tip
    const positions = this.allPoints.slice(0, floorIdx + 1)

    if (floorIdx < totalSeg) {
      const tip = new Cesium.Cartesian3()
      Cesium.Cartesian3.lerp(
        this.allPoints[floorIdx],
        this.allPoints[floorIdx + 1],
        lerpT,
        tip
      )
      positions.push(tip)
    }

    this.trailPositions = positions
  }

  // Show/hide airplane billboard
  setAirplaneVisible(visible: boolean) {
    if (this.airplaneEntity) this.airplaneEntity.show = visible
  }

  // Clean up all entities
  destroy() {
    if (this.glowEntity) {
      this.viewer.entities.remove(this.glowEntity)
      this.glowEntity = null
    }
    if (this.trailEntity) {
      this.viewer.entities.remove(this.trailEntity)
      this.trailEntity = null
    }
    if (this.airplaneEntity) {
      this.viewer.entities.remove(this.airplaneEntity)
      this.airplaneEntity = null
    }
    this.trailPositions = []
  }
}
