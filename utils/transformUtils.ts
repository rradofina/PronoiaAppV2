import { PhotoTransform } from '../types';

export function createPhotoTransform(
  photoScale: number = 1.0,
  photoCenterX: number = 0.5,
  photoCenterY: number = 0.5
): PhotoTransform {
  return {
    photoScale,
    photoCenterX,
    photoCenterY,
    version: 'photo-centric' as const
  };
}

// REMOVED: Unused function - createContainerTransform