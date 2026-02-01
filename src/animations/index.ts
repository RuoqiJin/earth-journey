import { AnimationProject } from './types'
import { animation as londonToShenzhen } from './01-london-to-shenzhen'
import { animation as globeFlightLines } from './02-globe-flight-lines'

export * from './types'

export const animations: AnimationProject[] = [
  londonToShenzhen,
  globeFlightLines,
]

export function getAnimation(id: string): AnimationProject | undefined {
  return animations.find(a => a.id === id)
}

export function getDefaultAnimation(): AnimationProject {
  return animations[0]
}
