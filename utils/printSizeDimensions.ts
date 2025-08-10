import { PrintSize } from '../types';

export interface PrintDimensions {
  width: number;
  height: number;
  dpi?: number;
}

/**
 * Get standard dimensions for a given print size
 * @param printSize - The print size (4R, 5R, A4)
 * @returns Dimensions object with width and height in pixels
 */
export function getPrintSizeDimensions(printSize: PrintSize | string): PrintDimensions {
  switch (printSize) {
    case 'A4':
      return { width: 2480, height: 3508, dpi: 300 };
    case '5R':
      return { width: 1500, height: 2100, dpi: 300 };
    case '4R':
    default:
      return { width: 1200, height: 1800, dpi: 300 };
  }
}

/**
 * Get aspect ratio string for CSS
 * @param printSize - The print size (4R, 5R, A4)
 * @returns Aspect ratio string for CSS (e.g., "1200/1800")
 */
export function getPrintSizeAspectRatio(printSize: PrintSize | string): string {
  const dimensions = getPrintSizeDimensions(printSize);
  return `${dimensions.width}/${dimensions.height}`;
}

/**
 * Check if dimensions match a specific print size
 * @param dimensions - Dimensions to check
 * @param printSize - Print size to compare against
 * @param tolerance - Tolerance in pixels (default 10)
 * @returns true if dimensions match the print size
 */
export function dimensionsMatchPrintSize(
  dimensions: PrintDimensions,
  printSize: PrintSize | string,
  tolerance: number = 10
): boolean {
  const expected = getPrintSizeDimensions(printSize);
  return (
    Math.abs(dimensions.width - expected.width) <= tolerance &&
    Math.abs(dimensions.height - expected.height) <= tolerance
  );
}