'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  LOCATIONS,
  ANIMATION_CONFIG,
  type CameraPosition,
} from './types'
import styles from './GlobeViewer.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Cesium: any
  }
}

// Get Cesium token from environment variable
const CESIUM_TOKEN = process.env.NEXT_PUBLIC_CESIUM_TOKEN || ''

export default function GlobeViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const initedRef = useRef(false) // Prevent Strict Mode double initialization

  const [status, setStatus] = useState('Loading Cesium...')
  const [isReady, setIsReady] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [altitude, setAltitude] = useState('--')
  const [cloudOpacity, setCloudOpacity] = useState(0) // Cloud layer opacity

  // Recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const isPausedRef = useRef(false)

  const totalDuration = ANIMATION_CONFIG.segments.reduce((sum, s) => sum + s.duration, 0)
  const totalFrames = totalDuration * ANIMATION_CONFIG.fps

  // Load Cesium from CDN
  useEffect(() => {
    // Prevent Strict Mode double initialization
    if (initedRef.current || viewerRef.current) return
    initedRef.current = true

    async function loadCesiumScript(): Promise<void> {
      // Check if already loaded
      if (window.Cesium) return

      // Add CSS
      if (!document.querySelector('link[href*="cesium"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Widgets/widgets.css'
        document.head.appendChild(link)
      }

      // Add script
      return new Promise((resolve, reject) => {
        if (document.querySelector('script[src*="Cesium.js"]')) {
          // Wait for it to load
          const checkInterval = setInterval(() => {
            if (window.Cesium) {
              clearInterval(checkInterval)
              resolve()
            }
          }, 100)
          return
        }

        const script = document.createElement('script')
        script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Cesium.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load Cesium'))
        document.head.appendChild(script)
      })
    }

    async function init() {
      try {
        if (!CESIUM_TOKEN) {
          setStatus('Error: Missing NEXT_PUBLIC_CESIUM_TOKEN')
          return
        }

        await loadCesiumScript()

        if (!containerRef.current) return

        const Cesium = window.Cesium

        // Set token
        Cesium.Ion.defaultAccessToken = CESIUM_TOKEN

        // Create viewer with cinematic settings
        const viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          timeline: false,
          homeButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          geocoder: false,
          infoBox: false,
          selectionIndicator: false,
          creditContainer: document.createElement('div'),
          imageryProvider: false, // Disable default layer, add manually later
          terrainProvider: Cesium.createWorldTerrain(),
          // Deep space nebula background
          skyBox: new Cesium.SkyBox({
            sources: {
              // Use Tycho star map (Cesium default)
              positiveX: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg',
              negativeX: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg',
              positiveY: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_py.jpg',
              negativeY: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_my.jpg',
              positiveZ: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg',
              negativeZ: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg',
            },
          }),
          skyAtmosphere: new Cesium.SkyAtmosphere(),
          scene3DOnly: true,
          requestRenderMode: false,
        })

        // Add Bing Maps satellite layer
        console.log('Adding base imagery layer...')
        Cesium.IonImageryProvider.fromAssetId(2).then((provider: any) => {
          console.log('Provider created, adding to viewer...')
          viewer.imageryLayers.addImageryProvider(provider)
          console.log('Base imagery layer added successfully')
        }).catch((err: any) => {
          console.error('Failed to load Cesium Ion imagery:', err)
          console.log('Falling back to TileMapService...')
          // Fallback: use Cesium default Natural Earth layer
          viewer.imageryLayers.addImageryProvider(
            Cesium.createTileMapServiceImageryProvider({
              url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
            })
          )
        })

        // Try to add night lights layer (NASA Black Marble)
        Cesium.IonImageryProvider.fromAssetId(3812).then((nightProvider: any) => {
          const nightLayer = viewer.imageryLayers.addImageryProvider(nightProvider)
          nightLayer.dayAlpha = 0.0
          nightLayer.nightAlpha = 1.0
          nightLayer.brightness = 2.0
          console.log('Night layer loaded successfully')
        }).catch((err: any) => {
          console.warn('Night layer not available (requires Cesium Ion subscription):', err.message)
        })

        // Add cloud layer (NASA GIBS MODIS)
        try {
          const cloudLayer = viewer.imageryLayers.addImageryProvider(
            new Cesium.WebMapTileServiceImageryProvider({
              url: 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg',
              layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
              style: 'default',
              format: 'image/jpeg',
              tileMatrixSetID: '250m',
              maximumLevel: 8,
              credit: 'NASA GIBS',
              // Use recent date
              times: new Cesium.TimeIntervalCollection([
                new Cesium.TimeInterval({
                  start: Cesium.JulianDate.fromIso8601('2024-01-01'),
                  stop: Cesium.JulianDate.fromIso8601('2025-12-31'),
                  data: '2024-06-20', // Fixed date
                }),
              ]),
            })
          )
          // Cloud layer semi-transparent overlay
          cloudLayer.alpha = 0.4
          cloudLayer.brightness = 1.2
          console.log('Cloud layer loaded')
        } catch (err) {
          console.warn('Cloud layer not available:', err)
        }

        viewerRef.current = viewer

        // Configure globe - cinematic effects
        viewer.scene.globe.enableLighting = false // Disable day/night terminator
        viewer.scene.globe.tileCacheSize = 5000
        viewer.scene.globe.maximumScreenSpaceError = 1.5
        viewer.scene.globe.preloadAncestors = true

        // ====== Atmosphere effects - moderate blue edge glow ======
        viewer.scene.skyAtmosphere.hueShift = 0
        viewer.scene.skyAtmosphere.saturationShift = 0.1
        viewer.scene.skyAtmosphere.brightnessShift = 0.05

        // Earth atmosphere glow - keep default, slightly enhanced
        viewer.scene.globe.showGroundAtmosphere = true

        // Set time - UK at dusk position (day/night boundary)
        // UTC 18:00 is approximately dusk time in UK
        viewer.clock.currentTime = Cesium.JulianDate.fromIso8601('2024-06-21T18:00:00Z')
        viewer.clock.shouldAnimate = false // Stop time flow
        viewer.scene.globe.preloadSiblings = true

        // Add markers and borders
        addMarkers(Cesium, viewer)
        loadCountryBorders(Cesium, viewer)

        // Set initial position - London starting point top-down view
        const start = ANIMATION_CONFIG.startPosition
        setCameraPosition(
          viewer,
          Cesium,
          start.lon,
          start.lat,
          start.alt,
          start.heading,
          start.pitch
        )

        // Update altitude on tick
        viewer.clock.onTick.addEventListener(() => {
          const alt = viewer.camera.positionCartographic.height
          setAltitude(formatAltitude(alt))
        })

        setStatus('Ready')
        setIsReady(true)
      } catch (err) {
        console.error('Failed to initialize Cesium:', err)
        setStatus(`Error: ${err}`)
      }
    }

    init()

    // Strict Mode cleanup - don't destroy viewer
    // Will be cleaned up automatically when navigating away
  }, [])

  // Set camera position
  function setCameraPosition(
    viewer: any,
    Cesium: any,
    lon: number,
    lat: number,
    alt: number,
    heading: number,
    pitch: number
  ) {
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
      orientation: {
        heading: Cesium.Math.toRadians(heading),
        pitch: Cesium.Math.toRadians(pitch),
        roll: 0,
      },
    })
  }

  // Format altitude
  function formatAltitude(alt: number): string {
    if (alt > 1000000) return (alt / 1000000).toFixed(1) + 'M km'
    if (alt > 1000) return (alt / 1000).toFixed(1) + ' km'
    return alt.toFixed(0) + ' m'
  }

  // Add markers
  function addMarkers(Cesium: any, viewer: any) {
    // UK Label
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(-2.5, 54.5, 10000),
      label: {
        text: 'UNITED KINGDOM',
        font: '14px monospace',
        fillColor: Cesium.Color.fromCssColorString('#fbbf24'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1000000, 1.5, 15000000, 0.4),
      },
    })

    // China Label
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(104, 36, 10000),
      label: {
        text: '中国\nCHINA',
        font: '16px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#f87171'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1000000, 1.5, 15000000, 0.4),
      },
    })

    // London marker - fixed size, no zoom scaling
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(LOCATIONS.london.lon, LOCATIONS.london.lat, 50),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#fbbf24'),
        outlineColor: Cesium.Color.fromCssColorString('#f59e0b'),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: 'RIBA Royal Institute of British Architects\n66 Portland Place, London',
        font: '13px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -24),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    // Shenzhen marker - fixed size, no zoom scaling
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(LOCATIONS.shenzhen.lon, LOCATIONS.shenzhen.lat, 50),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#fbbf24'),
        outlineColor: Cesium.Color.fromCssColorString('#f59e0b'),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: '深圳国际会展中心\nShenzhen World Exhibition & Convention Center',
        font: '13px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#fbbf24'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -24),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  // Load country borders
  async function loadCountryBorders(Cesium: any, viewer: any) {
    try {
      const res = await fetch(
        'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_boundary_lines_land.geojson'
      )
      const data = await res.json()

      for (const feature of data.features) {
        const processLine = (coords: number[][]) => {
          const positions = Cesium.Cartesian3.fromDegreesArray(coords.flat())
          viewer.entities.add({
            polyline: {
              positions,
              width: 1.5,
              material: Cesium.Color.WHITE.withAlpha(0.5),
            },
          })
        }

        if (feature.geometry.type === 'LineString') {
          processLine(feature.geometry.coordinates)
        } else if (feature.geometry.type === 'MultiLineString') {
          feature.geometry.coordinates.forEach(processLine)
        }
      }
    } catch (err) {
      console.error('Failed to load borders:', err)
    }
  }

  // Catmull-Rom spline interpolation - smooth through all control points
  function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t
    const t3 = t2 * t
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    )
  }

  // Catmull-Rom interpolation for CameraPosition
  function catmullRomPosition(
    p0: CameraPosition,
    p1: CameraPosition,
    p2: CameraPosition,
    p3: CameraPosition,
    t: number
  ): CameraPosition {
    return {
      lon: catmullRom(p0.lon, p1.lon, p2.lon, p3.lon, t),
      lat: catmullRom(p0.lat, p1.lat, p2.lat, p3.lat, t),
      alt: catmullRom(p0.alt, p1.alt, p2.alt, p3.alt, t),
      heading: catmullRom(p0.heading, p1.heading, p2.heading, p3.heading, t),
      pitch: catmullRom(p0.pitch, p1.pitch, p2.pitch, p3.pitch, t),
    }
  }

  // Smoothstep easing
  function smoothstep(t: number): number {
    return t * t * (3 - 2 * t)
  }

  // Linear interpolation
  function lerpPosition(p1: CameraPosition, p2: CameraPosition, t: number): CameraPosition {
    return {
      lon: p1.lon + (p2.lon - p1.lon) * t,
      lat: p1.lat + (p2.lat - p1.lat) * t,
      alt: p1.alt + (p2.alt - p1.alt) * t,
      heading: p1.heading + (p2.heading - p1.heading) * t,
      pitch: p1.pitch + (p2.pitch - p1.pitch) * t,
    }
  }

  // Get frame position - takeoff/landing linear, middle curved
  function getFramePosition(frameNum: number): CameraPosition & { segment: string } {
    const segments = ANIMATION_CONFIG.segments
    const totalDur = segments.reduce((sum, s) => sum + s.duration, 0)
    const time = frameNum / ANIMATION_CONFIG.fps

    // Global progress 0-1
    const globalT = Math.min(time / totalDur, 1)

    // Collect all keyframes
    const keyframes: CameraPosition[] = [
      ANIMATION_CONFIG.startPosition,
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
      easedT = smoothstep(globalT / 0.08) * 0.08
    } else if (globalT > 0.92) {
      easedT = 0.92 + smoothstep((globalT - 0.92) / 0.08) * 0.08
    } else {
      easedT = globalT
    }

    // Calculate cumulative time ratio for each keyframe
    const durations = segments.map(s => s.duration)
    const cumulativeT: number[] = [0]
    let cumSum = 0
    for (const d of durations) {
      cumSum += d / totalDur
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

    // Calculate local t within segment
    const segStart = cumulativeT[segmentIndex]
    const segEnd = cumulativeT[segmentIndex + 1]
    const localT = segEnd > segStart ? (easedT - segStart) / (segEnd - segStart) : 0

    const p1 = keyframes[segmentIndex]
    const p2 = keyframes[segmentIndex + 1]

    // First segment (takeoff) and last two segments (landing) use linear interpolation - vertical motion doesn't need curves
    const isFirstSegment = segmentIndex === 0
    const isLastTwoSegments = segmentIndex >= segments.length - 2

    if (isFirstSegment || isLastTwoSegments) {
      // Straight vertical takeoff/landing
      const pos = lerpPosition(p1, p2, localT)
      return { ...pos, segment: segments[segmentIndex]?.name || 'end' }
    }

    // Middle segments (flying over Earth) use Catmull-Rom spline curves
    const p0 = keyframes[Math.max(0, segmentIndex - 1)]
    const p3 = keyframes[Math.min(keyframes.length - 1, segmentIndex + 2)]

    const pos = catmullRomPosition(p0, p1, p2, p3, localT)

    return {
      ...pos,
      segment: segments[segmentIndex]?.name || 'end',
    }
  }

  // Run animation
  const runAnimation = useCallback(async (record: boolean) => {
    if (!viewerRef.current || !window.Cesium) return

    const viewer = viewerRef.current
    const Cesium = window.Cesium

    isPausedRef.current = false
    setIsPaused(false)

    if (record) {
      setIsRecording(true)
      recordedChunksRef.current = []

      setStatus('Setting up 1920x1080...')

      // Set fixed recording size
      const container = containerRef.current!
      container.style.width = '1920px'
      container.style.height = '1080px'
      viewer.resize()
      await new Promise(r => setTimeout(r, 500))

      setStatus('Recording...')

      // Setup MediaRecorder
      const canvas = viewer.scene.canvas
      const stream = canvas.captureStream(ANIMATION_CONFIG.fps)
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 50000000,
      })

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data)
        }
      }

      mediaRecorderRef.current.start()
    } else {
      setIsPreview(true)
      setStatus('Previewing...')
    }

    // Set initial position
    const startPos = getFramePosition(0)
    setCameraPosition(viewer, Cesium, startPos.lon, startPos.lat, startPos.alt, startPos.heading, startPos.pitch)
    viewer.scene.render()

    // Animation loop
    for (let frame = 0; frame < totalFrames; frame++) {
      setCurrentFrame(frame)

      // Wait while paused
      while (isPausedRef.current) {
        await new Promise(r => setTimeout(r, 100))
      }

      const pos = getFramePosition(frame)
      setCameraPosition(viewer, Cesium, pos.lon, pos.lat, pos.alt, pos.heading, pos.pitch)

      // Cloud effect: show cloud layer at 1000m - 15000m altitude
      // Cloud is densest at 3000m - 6000m
      const alt = pos.alt
      let opacity = 0
      if (alt >= 1000 && alt <= 15000) {
        if (alt < 3000) {
          // 1000-3000m: fade in
          opacity = (alt - 1000) / 2000
        } else if (alt <= 6000) {
          // 3000-6000m: densest
          opacity = 1
        } else {
          // 6000-15000m: fade out
          opacity = 1 - (alt - 6000) / 9000
        }
      }
      setCloudOpacity(opacity)

      setProgress((frame / totalFrames) * 100)

      viewer.scene.render()

      await new Promise(r => setTimeout(r, 1000 / ANIMATION_CONFIG.fps))
    }

    if (record) {
      mediaRecorderRef.current?.stop()
      await new Promise<void>(r => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.onstop = () => r()
        } else {
          r()
        }
      })

      // Restore size
      const container = containerRef.current!
      container.style.width = '100%'
      container.style.height = '100%'
      viewer.resize()

      setIsRecording(false)
      setStatus('Recording complete! Click download.')
    } else {
      setIsPreview(false)
      setStatus('Preview complete')
    }

    setCloudOpacity(0) // Reset cloud layer
    setProgress(100)
  }, [totalFrames])

  // Download video
  const downloadVideo = useCallback(async () => {
    if (recordedChunksRef.current.length === 0) return

    setStatus('Preparing video...')

    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'earth-journey-london-to-shenzhen.webm'
    a.click()
    URL.revokeObjectURL(url)

    setStatus('Video downloaded!')
  }, [])

  // Toggle pause
  const togglePause = useCallback(() => {
    isPausedRef.current = !isPausedRef.current
    setIsPaused(isPausedRef.current)

    if (isPausedRef.current) {
      setStatus(`Paused at frame ${currentFrame + 1}`)
      mediaRecorderRef.current?.pause()
    } else {
      setStatus(isRecording ? 'Recording...' : 'Previewing...')
      mediaRecorderRef.current?.resume()
    }
  }, [currentFrame, isRecording])

  const isAnimating = isPreview || isRecording

  return (
    <div className={styles.container}>
      {/* Deep space nebula background layer */}
      <div className={styles.nebulaBackground} />

      <div ref={containerRef} className={styles.cesiumContainer} />

      {/* Cloud traversal effect */}
      <div
        className={styles.cloudLayer}
        style={{ opacity: cloudOpacity }}
      />

      {/* Earth atmospheric glow enhancement layer */}
      <div className={styles.earthGlow} />

      <div className={styles.panel}>
        <h3>ANIMATION RECORDER</h3>
        <div className={styles.info}>
          London → Earth → China → Shenzhen<br />
          Output: 1920x1080 @ 60fps
        </div>
        <div className={`${styles.status} ${isRecording ? styles.recording : ''}`}>
          {status}
        </div>

        <button
          onClick={() => runAnimation(false)}
          disabled={!isReady || isAnimating}
        >
          PREVIEW
        </button>

        <button
          onClick={togglePause}
          disabled={!isAnimating}
        >
          {isPaused ? 'RESUME' : 'PAUSE'}
        </button>

        <button
          onClick={() => runAnimation(true)}
          disabled={!isReady || isAnimating}
          className={styles.primary}
        >
          START RECORDING
        </button>

        <button
          onClick={downloadVideo}
          disabled={recordedChunksRef.current.length === 0 || isRecording}
        >
          DOWNLOAD VIDEO
        </button>

        <div className={styles.progress}>
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className={styles.altitude}>
        <span className={styles.altValue}>{altitude}</span>
        ALTITUDE
      </div>

      {isAnimating && (
        <div className={styles.frameCounter}>
          Frame: {currentFrame + 1} / {totalFrames}
        </div>
      )}

      <div className={styles.vignette} />
    </div>
  )
}
