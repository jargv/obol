import { num } from 'obol'

export type Vec3 = {
  x: num.f32
  y: num.f32
  z: num.f32
}

enum CoordinateSpace {
  Local,
  Global,
}

declare class Widget {
  constructor(size: number)
  animate(speed: number, ccw: boolean): boolean
}

function placeWidget(space: CoordinateSpace, pos: Vec3)
