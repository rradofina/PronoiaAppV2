import { PrintSize } from '../types';

export interface PrintDimensions {
  width: number;
  height: number;
  dpi?: number;
  widthInches?: number;
  heightInches?: number;
}

/**
 * Get standard dimensions for a given print size
 * @param printSize - The print size (4R, 5R, A4)
 * @returns Dimensions object with width and height in pixels
 */
export function getPrintSizeDimensions(printSize: PrintSize | string): PrintDimensions {
  switch (printSize) {
    case 'A4':
      return { 
        width: 2480, 
        height: 3508, 
        dpi: 300,
        widthInches: 8.27,
        heightInches: 11.69
      };
    case '5R':
      return { 
        width: 1500, 
        height: 2100, 
        dpi: 300,
        widthInches: 5,
        heightInches: 7
      };
    case '4R':
    default:
      return { 
        width: 1200, 
        height: 1800, 
        dpi: 300,
        widthInches: 4,
        heightInches: 6
      };
  }
}

// REMOVED: Unused functions - getPrintSizeAspectRatio and dimensionsMatchPrintSize