import { AnimationProject, LOCATIONS, FlightConfig } from './types'

const config: FlightConfig = {
  fps: 60,
  startPosition: {
    lon: LOCATIONS.london.lon,
    lat: LOCATIONS.london.lat,
    alt: 500,
    heading: 0,
    pitch: -90,
  },
  segments: [
    // Take off from London, continuous ascent
    {
      name: 'pullout-london',
      duration: 4,
      to: { lon: LOCATIONS.london.lon, lat: LOCATIONS.london.lat, alt: 2000000, heading: 0, pitch: -90 },
    },
    // Fly across Eurasia
    {
      name: 'rotate-to-china',
      duration: 6,
      to: { lon: 60, lat: 40, alt: 12000000, heading: 0, pitch: -90 },
    },
    // Approach China
    {
      name: 'approach-china',
      duration: 4,
      to: { lon: LOCATIONS.china.lon, lat: LOCATIONS.china.lat, alt: 6000000, heading: 0, pitch: -90 },
    },
    // Dive toward Shenzhen
    {
      name: 'approach-shenzhen',
      duration: 4,
      to: { lon: LOCATIONS.shenzhen.lon, lat: LOCATIONS.shenzhen.lat, alt: 300000, heading: 0, pitch: -90 },
    },
    // Land at Shenzhen World Exhibition Center
    {
      name: 'dive-shenzhen',
      duration: 4,
      to: { lon: LOCATIONS.shenzhen.lon, lat: LOCATIONS.shenzhen.lat, alt: 500, heading: 0, pitch: -90 },
    },
  ],
}

export const animation: AnimationProject = {
  id: '01-london-to-shenzhen',
  name: 'London → Shenzhen Flight',
  nameZh: '伦敦飞深圳',
  description: 'Cinematic flight from RIBA London to Shenzhen World Exhibition Center',
  type: 'flight',
  config,
}
