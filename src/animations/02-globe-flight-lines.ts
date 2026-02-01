import { AnimationProject, LOCATIONS, GlobeLineConfig } from './types'

const config: GlobeLineConfig = {
  fps: 60,
  camera: {
    lon: 50,
    lat: 30,
    alt: 20000000,
    rotationSpeed: 2,
    // Camera follows the flight line (full globe view)
    followLine: true,
    followAlt: 25000000,  // 25000 km - full globe visible
    followPitch: -90,     // Looking straight down at Earth
  },
  totalDuration: 12,  // 12 seconds total
  lines: [
    {
      from: LOCATIONS.shenzhen,
      to: LOCATIONS.london,
      duration: 10,
      color: '#fbbf24',
      arcHeight: 1.2,
      delay: 1,  // Start after 1 second
    },
  ],
  markers: [
    LOCATIONS.london,
    LOCATIONS.shenzhen,
  ],
}

export const animation: AnimationProject = {
  id: '02-globe-flight-lines',
  name: 'Globe: Shenzhen → London Line',
  nameZh: '全景飞线：深圳到伦敦',
  description: 'Rotating globe view with animated flight line from Shenzhen to London',
  type: 'globe-lines',
  config,
}
