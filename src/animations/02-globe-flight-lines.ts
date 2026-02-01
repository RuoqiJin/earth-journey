import { AnimationProject, LOCATIONS, GlobeLineConfig } from './types'

const config: GlobeLineConfig = {
  fps: 60,
  camera: {
    // View centered between the two locations
    lon: 50,  // Roughly between London and Shenzhen
    lat: 30,
    alt: 20000000,  // 20,000 km - full globe view
    rotationSpeed: 2,  // degrees per second, slow rotation
  },
  totalDuration: 15,  // 15 seconds total
  lines: [
    {
      from: LOCATIONS.shenzhen,
      to: LOCATIONS.london,
      duration: 8,
      color: '#fbbf24',  // Amber/gold
      arcHeight: 1.2,
      delay: 2,  // Start after 2 seconds
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
