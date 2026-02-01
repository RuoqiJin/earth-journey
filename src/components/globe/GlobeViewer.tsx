'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  animations,
  getDefaultAnimation,
  type AnimationProject,
  type FlightConfig,
  type GlobeLineConfig,
  type Location,
  LOCATIONS,
} from '@/animations'
import { FlightAnimator, GlobeLineAnimator } from './animators'
import styles from './GlobeViewer.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Cesium: any
  }
}

const CESIUM_TOKEN = process.env.NEXT_PUBLIC_CESIUM_TOKEN || ''

export default function GlobeViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const initedRef = useRef(false)
  const flightLineEntityRef = useRef<any>(null)

  // Animation state
  const [currentAnimation, setCurrentAnimation] = useState<AnimationProject>(getDefaultAnimation())
  const [status, setStatus] = useState('Loading Cesium...')
  const [isReady, setIsReady] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [altitude, setAltitude] = useState('--')
  const [cloudOpacity, setCloudOpacity] = useState(0)

  // Recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const isPausedRef = useRef(false)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  // Create animator based on type
  const getAnimator = useCallback(() => {
    if (currentAnimation.type === 'flight') {
      return new FlightAnimator(currentAnimation.config as FlightConfig)
    } else {
      return new GlobeLineAnimator(currentAnimation.config as GlobeLineConfig)
    }
  }, [currentAnimation])

  // Load Cesium
  useEffect(() => {
    if (initedRef.current || viewerRef.current) return
    initedRef.current = true

    async function loadCesiumScript(): Promise<void> {
      if (window.Cesium) return

      if (!document.querySelector('link[href*="cesium"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Widgets/widgets.css'
        document.head.appendChild(link)
      }

      return new Promise((resolve, reject) => {
        if (document.querySelector('script[src*="Cesium.js"]')) {
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
        Cesium.Ion.defaultAccessToken = CESIUM_TOKEN

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
          imageryProvider: false,
          terrainProvider: Cesium.createWorldTerrain(),
          skyBox: new Cesium.SkyBox({
            sources: {
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

        // Add base imagery
        Cesium.IonImageryProvider.fromAssetId(2).then((provider: any) => {
          viewer.imageryLayers.addImageryProvider(provider)
        }).catch(() => {
          viewer.imageryLayers.addImageryProvider(
            Cesium.createTileMapServiceImageryProvider({
              url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
            })
          )
        })

        // Night lights
        Cesium.IonImageryProvider.fromAssetId(3812).then((nightProvider: any) => {
          const nightLayer = viewer.imageryLayers.addImageryProvider(nightProvider)
          nightLayer.dayAlpha = 0.0
          nightLayer.nightAlpha = 1.0
          nightLayer.brightness = 2.0
        }).catch(() => {})

        // Cloud layer
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
              times: new Cesium.TimeIntervalCollection([
                new Cesium.TimeInterval({
                  start: Cesium.JulianDate.fromIso8601('2024-01-01'),
                  stop: Cesium.JulianDate.fromIso8601('2025-12-31'),
                  data: '2024-06-20',
                }),
              ]),
            })
          )
          cloudLayer.alpha = 0.4
          cloudLayer.brightness = 1.2
        } catch {}

        viewerRef.current = viewer

        // Globe settings
        viewer.scene.globe.enableLighting = false
        viewer.scene.globe.tileCacheSize = 5000
        viewer.scene.globe.maximumScreenSpaceError = 1.5
        viewer.scene.globe.preloadAncestors = true
        viewer.scene.skyAtmosphere.hueShift = 0
        viewer.scene.skyAtmosphere.saturationShift = 0.1
        viewer.scene.skyAtmosphere.brightnessShift = 0.05
        viewer.scene.globe.showGroundAtmosphere = true
        viewer.clock.currentTime = Cesium.JulianDate.fromIso8601('2024-06-21T18:00:00Z')
        viewer.clock.shouldAnimate = false
        viewer.scene.globe.preloadSiblings = true

        // Add markers and borders
        addMarkers(Cesium, viewer)
        loadCountryBorders(Cesium, viewer)

        // Set initial position
        const animator = new FlightAnimator(getDefaultAnimation().config as FlightConfig)
        const start = animator.getStartPosition()
        setCameraPosition(viewer, Cesium, start.lon, start.lat, start.alt, start.heading, start.pitch)

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
  }, [])

  // Update camera when animation changes
  useEffect(() => {
    if (!viewerRef.current || !window.Cesium || !isReady) return

    const animator = getAnimator()
    const start = animator.getStartPosition()
    setCameraPosition(viewerRef.current, window.Cesium, start.lon, start.lat, start.alt, start.heading, start.pitch)

    // Clear any existing flight lines
    if (flightLineEntityRef.current) {
      viewerRef.current.entities.remove(flightLineEntityRef.current)
      flightLineEntityRef.current = null
    }
  }, [currentAnimation, isReady, getAnimator])

  function setCameraPosition(viewer: any, Cesium: any, lon: number, lat: number, alt: number, heading: number, pitch: number) {
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
      orientation: {
        heading: Cesium.Math.toRadians(heading),
        pitch: Cesium.Math.toRadians(pitch),
        roll: 0,
      },
    })
  }

  function formatAltitude(alt: number): string {
    if (alt > 1000000) return (alt / 1000000).toFixed(1) + 'M km'
    if (alt > 1000) return (alt / 1000).toFixed(1) + ' km'
    return alt.toFixed(0) + ' m'
  }

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

    // Location markers
    addLocationMarker(Cesium, viewer, LOCATIONS.london, '#fbbf24', 'RIBA 英国皇家建筑师学会\n66 Portland Place, London')
    addLocationMarker(Cesium, viewer, LOCATIONS.shenzhen, '#fbbf24', '深圳国际会展中心\nShenzhen World Exhibition & Convention Center')
  }

  function addLocationMarker(Cesium: any, viewer: any, loc: Location, color: string, label: string) {
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat, 50),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString(color),
        outlineColor: Cesium.Color.fromCssColorString('#f59e0b'),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: label,
        font: '13px sans-serif',
        fillColor: Cesium.Color.fromCssColorString(color),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -24),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

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

  // Update flight line entity
  function updateFlightLine(Cesium: any, viewer: any, lineStates: ReturnType<GlobeLineAnimator['getLineStates']>) {
    // Remove existing line
    if (flightLineEntityRef.current) {
      viewer.entities.remove(flightLineEntityRef.current)
      flightLineEntityRef.current = null
    }

    if (lineStates.length === 0) return

    for (const state of lineStates) {
      if (state.progress <= 0) continue

      const points = GlobeLineAnimator.generateArcPoints(
        state.from,
        state.to,
        state.progress,
        state.arcHeight,
        100
      )

      if (points.length < 2) continue

      const positions = points.map(p =>
        Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt + 50000) // Lift above ground
      )

      flightLineEntityRef.current = viewer.entities.add({
        polyline: {
          positions,
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.fromCssColorString(state.color),
          }),
        },
      })
    }
  }

  // Run animation
  const runAnimation = useCallback(async (record: boolean) => {
    if (!viewerRef.current || !window.Cesium) return

    const viewer = viewerRef.current
    const Cesium = window.Cesium
    const animator = getAnimator()
    const totalFrames = animator.getTotalFrames()
    const fps = currentAnimation.type === 'flight'
      ? (currentAnimation.config as FlightConfig).fps
      : (currentAnimation.config as GlobeLineConfig).fps

    isPausedRef.current = false
    setIsPaused(false)

    if (record) {
      setIsRecording(true)
      recordedChunksRef.current = []
      setStatus('Setting up 1920x1080...')

      const container = containerRef.current!
      container.style.width = '1920px'
      container.style.height = '1080px'
      viewer.resize()
      await new Promise(r => setTimeout(r, 500))

      setStatus('Recording...')

      const canvas = viewer.scene.canvas
      const stream = canvas.captureStream(fps)
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 50000000,
      })

      mediaRecorderRef.current.ondataavailable = (e: BlobEvent) => {
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
    const startPos = animator.getStartPosition()
    setCameraPosition(viewer, Cesium, startPos.lon, startPos.lat, startPos.alt, startPos.heading, startPos.pitch)
    viewer.scene.render()

    // Animation loop
    for (let frame = 0; frame < totalFrames; frame++) {
      setCurrentFrame(frame)

      while (isPausedRef.current) {
        await new Promise(r => setTimeout(r, 100))
      }

      if (currentAnimation.type === 'flight') {
        const flightAnimator = animator as FlightAnimator
        const pos = flightAnimator.getFramePosition(frame)
        setCameraPosition(viewer, Cesium, pos.lon, pos.lat, pos.alt, pos.heading, pos.pitch)

        // Cloud effect
        const opacity = flightAnimator.getCloudOpacity(pos.alt)
        setCloudOpacity(opacity)
      } else {
        const globeAnimator = animator as GlobeLineAnimator
        const pos = globeAnimator.getFramePosition(frame)
        setCameraPosition(viewer, Cesium, pos.lon, pos.lat, pos.alt, pos.heading, pos.pitch)

        // Update flight lines
        const lineStates = globeAnimator.getLineStates(frame)
        updateFlightLine(Cesium, viewer, lineStates)

        setCloudOpacity(0)
      }

      setProgress((frame / totalFrames) * 100)
      viewer.scene.render()

      await new Promise(r => setTimeout(r, 1000 / fps))
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

    setCloudOpacity(0)
    setProgress(100)
  }, [currentAnimation, getAnimator])

  const downloadVideo = useCallback(async () => {
    if (recordedChunksRef.current.length === 0) return

    setStatus('Preparing video...')

    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentAnimation.id}.webm`
    a.click()
    URL.revokeObjectURL(url)

    setStatus('Video downloaded!')
  }, [currentAnimation.id])

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

  const handleAnimationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const anim = animations.find(a => a.id === e.target.value)
    if (anim) {
      setCurrentAnimation(anim)
      setProgress(0)
      setCurrentFrame(0)
    }
  }

  // Seek to specific frame (for timeline scrubbing)
  const seekToFrame = useCallback((frame: number) => {
    if (!viewerRef.current || !window.Cesium) return

    const viewer = viewerRef.current
    const Cesium = window.Cesium
    const animator = getAnimator()
    const totalFrames = animator.getTotalFrames()

    const clampedFrame = Math.max(0, Math.min(frame, totalFrames - 1))
    setCurrentFrame(clampedFrame)
    setProgress((clampedFrame / totalFrames) * 100)

    if (currentAnimation.type === 'flight') {
      const flightAnimator = animator as FlightAnimator
      const pos = flightAnimator.getFramePosition(clampedFrame)
      setCameraPosition(viewer, Cesium, pos.lon, pos.lat, pos.alt, pos.heading, pos.pitch)
      setCloudOpacity(flightAnimator.getCloudOpacity(pos.alt))
    } else {
      const globeAnimator = animator as GlobeLineAnimator
      const pos = globeAnimator.getFramePosition(clampedFrame)
      setCameraPosition(viewer, Cesium, pos.lon, pos.lat, pos.alt, pos.heading, pos.pitch)
      const lineStates = globeAnimator.getLineStates(clampedFrame)
      updateFlightLine(Cesium, viewer, lineStates)
      setCloudOpacity(0)
    }

    viewer.scene.render()
    setStatus(`Frame ${clampedFrame + 1} / ${totalFrames}`)
  }, [currentAnimation, getAnimator])

  // Handle progress bar click/drag
  const handleProgressBarInteraction = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!progressBarRef.current || isRecording) return

    const rect = progressBarRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const percentage = x / rect.width
    const animator = getAnimator()
    const frame = Math.floor(percentage * animator.getTotalFrames())
    seekToFrame(frame)
  }, [isRecording, getAnimator, seekToFrame])

  const handleProgressBarMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isRecording) return
    isDraggingRef.current = true
    handleProgressBarInteraction(e)

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        handleProgressBarInteraction(e)
      }
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [isRecording, handleProgressBarInteraction])

  const isAnimating = isPreview || isRecording
  const animator = getAnimator()
  const totalFrames = animator.getTotalFrames()

  return (
    <div className={styles.container}>
      <div className={styles.nebulaBackground} />
      <div ref={containerRef} className={styles.cesiumContainer} />
      <div className={styles.cloudLayer} style={{ opacity: cloudOpacity }} />
      <div className={styles.earthGlow} />

      <div className={styles.panel}>
        <h3>ANIMATION RECORDER</h3>

        {/* Animation selector */}
        <div className={styles.selector}>
          <select
            value={currentAnimation.id}
            onChange={handleAnimationChange}
            disabled={isAnimating}
          >
            {animations.map(a => (
              <option key={a.id} value={a.id}>
                {a.nameZh || a.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.info}>
          {currentAnimation.description}<br />
          Output: 1920x1080 @ 60fps
        </div>
        <div className={`${styles.status} ${isRecording ? styles.recording : ''}`}>
          {status}
        </div>

        <button onClick={() => runAnimation(false)} disabled={!isReady || isAnimating}>
          PREVIEW
        </button>

        <button onClick={togglePause} disabled={!isAnimating}>
          {isPaused ? 'RESUME' : 'PAUSE'}
        </button>

        <button onClick={() => runAnimation(true)} disabled={!isReady || isAnimating} className={styles.primary}>
          START RECORDING
        </button>

        <button onClick={downloadVideo} disabled={recordedChunksRef.current.length === 0 || isRecording}>
          DOWNLOAD VIDEO
        </button>

        <div
          ref={progressBarRef}
          className={`${styles.progress} ${!isRecording ? styles.interactive : ''}`}
          onMouseDown={handleProgressBarMouseDown}
        >
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          <div className={styles.progressHandle} style={{ left: `${progress}%` }} />
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
