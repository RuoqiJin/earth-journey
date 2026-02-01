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
import { themes, getThemeById, getDefaultTheme, type ThemeConfig } from '@/themes'
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
  const flightLineEntityRef = useRef<any>(null)
	  const flightLineGlowEntityRef = useRef<any>(null)
	  const flightLinePositionsRef = useRef<any[]>([])

  // Animation state - restore from localStorage
  const [currentAnimation, setCurrentAnimation] = useState<AnimationProject>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('earth-journey-animation')
      if (saved) {
        const found = animations.find(a => a.id === saved)
        if (found) return found
      }
    }
    return getDefaultAnimation()
  })

  // Theme state - restore from localStorage
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('earth-journey-theme')
      if (saved) {
        return getThemeById(saved)
      }
    }
    return getDefaultTheme()
  })
  const [themeKey, setThemeKey] = useState(0) // Force re-init on theme change

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

  // Load Cesium - re-init when theme changes
  useEffect(() => {
    // Track if this effect instance is still valid (for React Strict Mode)
    let isCancelled = false

    const theme = currentTheme

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

        // Create viewer with theme-based settings
        const viewerOptions: any = {
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
          scene3DOnly: true,
          requestRenderMode: false,
        }

        // Theme-based skybox
        if (theme.showSkyBox) {
          viewerOptions.skyBox = new Cesium.SkyBox({
            sources: {
              positiveX: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg',
              negativeX: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg',
              positiveY: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_py.jpg',
              negativeY: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_my.jpg',
              positiveZ: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg',
              negativeZ: 'https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg',
            },
          })
          viewerOptions.skyAtmosphere = new Cesium.SkyAtmosphere()
        } else {
          viewerOptions.skyBox = false
          viewerOptions.skyAtmosphere = false
        }

        const viewer = new Cesium.Viewer(containerRef.current, viewerOptions)

        // Check if effect was cancelled during async operations (React Strict Mode)
        if (isCancelled) {
          viewer.destroy()
          return
        }

        // Set background color for light theme
        if (!theme.showSkyBox) {
          viewer.scene.backgroundColor = Cesium.Color.fromCssColorString(theme.background)
        }

        // Add base imagery or solid color
        if (theme.globeBaseColor) {
          // Use solid color globe - no satellite imagery
          viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(theme.globeBaseColor)
          viewer.scene.globe.showGroundAtmosphere = false
        } else {
          // Use satellite imagery
          Cesium.IonImageryProvider.fromAssetId(2).then((provider: any) => {
            viewer.imageryLayers.addImageryProvider(provider)
          }).catch(() => {
            viewer.imageryLayers.addImageryProvider(
              Cesium.createTileMapServiceImageryProvider({
                url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
              })
            )
          })
        }

        // Night lights (theme-based)
        if (theme.showNightLights) {
          Cesium.IonImageryProvider.fromAssetId(3812).then((nightProvider: any) => {
            const nightLayer = viewer.imageryLayers.addImageryProvider(nightProvider)
            nightLayer.dayAlpha = 0.0
            nightLayer.nightAlpha = 1.0
            nightLayer.brightness = 2.0
          }).catch(() => {})
        }

        // Cloud layer (theme-based)
        if (theme.showClouds) {
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
        }

        viewerRef.current = viewer

        // Globe settings
	        viewer.scene.globe.enableLighting = false
	        // Prevent polylines/labels from disappearing due to terrain LOD precision.
	        // Still respects the "opposite side of globe" occlusion.
	        viewer.scene.globe.depthTestAgainstTerrain = false
	        viewer.scene.globe.tileCacheSize = 5000
	        viewer.scene.globe.maximumScreenSpaceError = 1.5
	        viewer.scene.globe.preloadAncestors = true

        // Atmosphere settings (theme-based)
        if (theme.showAtmosphere && viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.hueShift = 0
          viewer.scene.skyAtmosphere.saturationShift = 0.1
          viewer.scene.skyAtmosphere.brightnessShift = 0.05
          viewer.scene.globe.showGroundAtmosphere = true
        } else {
          viewer.scene.globe.showGroundAtmosphere = false
        }

        viewer.clock.currentTime = Cesium.JulianDate.fromIso8601('2024-06-21T18:00:00Z')
        viewer.clock.shouldAnimate = false
        viewer.scene.globe.preloadSiblings = true

        // Add markers and borders (with theme)
        addMarkers(Cesium, viewer, theme)
        loadCountryBorders(Cesium, viewer, theme)

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

    // Cleanup function for React Strict Mode
    return () => {
      isCancelled = true
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
      flightLineEntityRef.current = null
      flightLineGlowEntityRef.current = null
      flightLinePositionsRef.current = []
    }
  }, [themeKey, currentTheme])

  // Update camera when animation changes
  useEffect(() => {
    if (!viewerRef.current || !window.Cesium || !isReady) return

    const animator = getAnimator()
    const start = animator.getStartPosition()
    setCameraPosition(viewerRef.current, window.Cesium, start.lon, start.lat, start.alt, start.heading, start.pitch)

    // Clear any existing flight lines
    if (flightLineGlowEntityRef.current) {
      viewerRef.current.entities.remove(flightLineGlowEntityRef.current)
      flightLineGlowEntityRef.current = null
    }
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

  function addMarkers(Cesium: any, viewer: any, theme: ThemeConfig) {
    // UK Label
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(-2.5, 54.5, 10000),
      label: {
        text: 'UNITED KINGDOM',
        font: '14px monospace',
        fillColor: Cesium.Color.fromCssColorString(theme.label.color),
        outlineColor: Cesium.Color.fromCssColorString(theme.label.outlineColor),
        outlineWidth: theme.label.outlineWidth,
        style: theme.label.outlineWidth > 0 ? Cesium.LabelStyle.FILL_AND_OUTLINE : Cesium.LabelStyle.FILL,
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
        fillColor: Cesium.Color.fromCssColorString(theme.label.color),
        outlineColor: Cesium.Color.fromCssColorString(theme.label.outlineColor),
        outlineWidth: theme.label.outlineWidth,
        style: theme.label.outlineWidth > 0 ? Cesium.LabelStyle.FILL_AND_OUTLINE : Cesium.LabelStyle.FILL,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1000000, 1.5, 15000000, 0.4),
      },
    })

    // Location markers
    addLocationMarker(Cesium, viewer, LOCATIONS.london, theme, 'RIBA 英国皇家建筑师学会\n66 Portland Place, London')
    addLocationMarker(Cesium, viewer, LOCATIONS.shenzhen, theme, '深圳国际会展中心\nShenzhen World Exhibition & Convention Center')
  }

  function addLocationMarker(Cesium: any, viewer: any, loc: Location, theme: ThemeConfig, label: string) {
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat, 50),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString(theme.marker.color),
        outlineColor: Cesium.Color.fromCssColorString(theme.marker.outlineColor),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: label,
        font: '13px sans-serif',
        fillColor: Cesium.Color.fromCssColorString(theme.label.color),
        outlineColor: Cesium.Color.fromCssColorString(theme.label.outlineColor),
        outlineWidth: theme.label.outlineWidth,
        style: theme.label.outlineWidth > 0 ? Cesium.LabelStyle.FILL_AND_OUTLINE : Cesium.LabelStyle.FILL,
        pixelOffset: new Cesium.Cartesian2(0, -24),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  async function loadCountryBorders(Cesium: any, viewer: any, theme: ThemeConfig) {
    try {
      const urls = [
        // Country borders between land areas (no coastline)
        'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_boundary_lines_land.geojson',
        // Coastlines so the white globe has visible land/ocean outlines
        'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_coastline.geojson',
      ]

      const datasets = await Promise.all(
        urls.map(async url => {
          const res = await fetch(url)
          return res.json()
        })
      )

      const material = Cesium.Color.fromCssColorString(theme.border.color).withAlpha(theme.border.alpha)
      // For solid color globe, clampToGround doesn't work - need altitude offset
      const useSolidGlobe = !!theme.globeBaseColor

      for (const data of datasets) {
        for (const feature of data.features) {
          const processLine = (coords: number[][]) => {
            let positions
            if (useSolidGlobe) {
              // Add small altitude to render above solid color globe
              const flatCoords: number[] = []
              for (const coord of coords) {
                flatCoords.push(coord[0], coord[1], 1000) // 1km altitude
              }
              positions = Cesium.Cartesian3.fromDegreesArrayHeights(flatCoords)
            } else {
              positions = Cesium.Cartesian3.fromDegreesArray(coords.flat())
            }

            viewer.entities.add({
              polyline: {
                positions,
                width: theme.border.width,
                material,
                clampToGround: !useSolidGlobe,
                zIndex: useSolidGlobe ? undefined : 10,
              },
            })
          }

          if (feature.geometry.type === 'LineString') {
            processLine(feature.geometry.coordinates)
          } else if (feature.geometry.type === 'MultiLineString') {
            feature.geometry.coordinates.forEach(processLine)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load borders:', err)
    }
  }

  // Update flight line entity - use CallbackProperty for dynamic updates
  function updateFlightLine(Cesium: any, viewer: any, lineStates: ReturnType<GlobeLineAnimator['getLineStates']>, theme: ThemeConfig) {
    if (lineStates.length === 0 || !lineStates[0] || lineStates[0].progress <= 0) {
      // Clear positions to hide line
      flightLinePositionsRef.current = []
      return
    }

    const state = lineStates[0]
    const points = GlobeLineAnimator.generateArcPoints(
      state.from,
      state.to,
      state.progress,
      state.arcHeight,
      100
    )

    if (points.length < 2) {
      flightLinePositionsRef.current = []
      return
    }

    // Update positions ref (will be read by CallbackProperty)
    // Add higher altitude offset to keep line above Earth surface
    flightLinePositionsRef.current = points.map(p =>
      Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt + 100000)
    )

    // Create entities with CallbackProperty if not exists
    // Layer 1: Glow (underneath, wider) - only if theme shows glow
    if (theme.line.showGlow && !flightLineGlowEntityRef.current) {
      flightLineGlowEntityRef.current = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            return flightLinePositionsRef.current
          }, false),
          width: theme.line.glowWidth,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.4,
            taperPower: 0.2,
            color: Cesium.Color.fromCssColorString(theme.line.glowColor).withAlpha(theme.line.glowAlpha),
          }),
        },
      })
    }
    // Layer 2: Core line (on top, thinner)
    if (!flightLineEntityRef.current) {
      flightLineEntityRef.current = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            return flightLinePositionsRef.current
          }, false),
          width: theme.line.coreWidth,
          material: Cesium.Color.fromCssColorString(theme.line.coreColor),
        },
      })
    }
  }

  // Convert WebM to MP4 and download
  const convertAndDownload = useCallback(async () => {
    if (recordedChunksRef.current.length === 0) return

    setStatus('Converting to MP4...')

    try {
      const webmBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
      const formData = new FormData()
      formData.append('video', webmBlob, `${currentAnimation.id}.webm`)
      formData.append('filename', currentAnimation.id)

      const response = await fetch('/api/convert-video', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Conversion failed')
      }

      const mp4Blob = await response.blob()
      const url = URL.createObjectURL(mp4Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentAnimation.id}.mp4`
      a.click()
      URL.revokeObjectURL(url)

      recordedChunksRef.current = []
      setStatus('MP4 downloaded!')
    } catch (error) {
      console.error('Conversion error:', error)
      setStatus(`Error: ${error instanceof Error ? error.message : 'Conversion failed'}`)
    }
  }, [currentAnimation.id])

  // Run animation
  const runAnimation = useCallback(async (record: boolean) => {
    if (!viewerRef.current || !window.Cesium) {
      setStatus('Error: Viewer not ready')
      return
    }

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

    // Pre-animation: slow rotation before main animation (1 second)
    const preFrames = fps
    const preRotationSpeed = 3 // degrees per second
    for (let i = 0; i < preFrames; i++) {
      // Start from offset and ease into start position
      const rotationOffset = ((preFrames - i) / fps) * preRotationSpeed
      setCameraPosition(
        viewer, Cesium,
        startPos.lon - rotationOffset,
        startPos.lat,
        startPos.alt,
        startPos.heading,
        startPos.pitch
      )
      viewer.scene.render()
      await new Promise(r => setTimeout(r, 1000 / fps))
    }

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
        updateFlightLine(Cesium, viewer, lineStates, currentTheme)

        setCloudOpacity(0)
      }

      setProgress((frame / totalFrames) * 100)
      viewer.scene.render()

      await new Promise(r => setTimeout(r, 1000 / fps))
    }

    // Post-animation: continue slow rotation (1 second)
    const endPos = animator.getFramePosition(totalFrames - 1)
    const postFrames = fps
    const postRotationSpeed = 3 // degrees per second
    for (let i = 0; i < postFrames; i++) {
      const rotationOffset = (i / fps) * postRotationSpeed
      setCameraPosition(
        viewer, Cesium,
        endPos.lon + rotationOffset,
        endPos.lat,
        endPos.alt,
        endPos.heading,
        endPos.pitch
      )
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

      // Auto convert and download
      setTimeout(() => {
        convertAndDownload()
      }, 100)
    } else {
      setIsPreview(false)
      setStatus('Preview complete')
    }

    setCloudOpacity(0)
    setProgress(100)
  }, [currentAnimation, getAnimator, convertAndDownload, currentTheme])

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
      localStorage.setItem('earth-journey-animation', anim.id)
    }
  }

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const theme = getThemeById(e.target.value)
    setCurrentTheme(theme)
    localStorage.setItem('earth-journey-theme', theme.id)
    // Force Cesium re-initialization
    setThemeKey(prev => prev + 1)
    setIsReady(false)
    setProgress(0)
    setCurrentFrame(0)
    setStatus('Switching theme...')
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
      updateFlightLine(Cesium, viewer, lineStates, currentTheme)
      setCloudOpacity(0)
    }

    viewer.scene.render()
    setStatus(`Frame ${clampedFrame + 1} / ${totalFrames}`)
  }, [currentAnimation, getAnimator, currentTheme])

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
    <div className={styles.container} style={{ background: currentTheme.background }}>
      {currentTheme.showNebula && <div className={styles.nebulaBackground} />}
      {currentTheme.showGlobeGlow && (
        <div
          className={styles.globeGlow}
          style={{
            boxShadow: currentTheme.globeGlowColor
              ? `0 0 60px 30px ${currentTheme.globeGlowColor}4d, 0 0 100px 60px ${currentTheme.globeGlowColor}33, 0 0 140px 90px ${currentTheme.globeGlowColor}1a`
              : undefined,
          }}
        />
      )}
      <div ref={containerRef} className={styles.cesiumContainer} key={themeKey} />
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

        {/* Theme selector */}
        <div className={styles.selector}>
          <select
            value={currentTheme.id}
            onChange={handleThemeChange}
            disabled={isAnimating}
          >
            {themes.map(t => (
              <option key={t.id} value={t.id}>
                {t.nameZh || t.name}
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

      {currentTheme.showVignette && <div className={styles.vignette} />}
    </div>
  )
}
