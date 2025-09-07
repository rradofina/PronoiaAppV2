import React from 'react';

interface GapData {
  hasGaps: boolean;
  gapCount: number;
  gaps: { left: number; right: number; top: number; bottom: number };
  significantGaps: { left: boolean; right: boolean; top: boolean; bottom: boolean };
}

interface Movement {
  action: string;
  movements: {
    horizontal: string;
    vertical: string;
  };
  newCenterX?: number;
  newCenterY?: number;
}

interface PhotoTransform {
  photoScale: number;
  photoCenterX: number;
  photoCenterY: number;
}

interface UsePhotoDebugProps {
  debug: boolean;
  currentTransform: PhotoTransform;
  interactive: boolean;
  isDragging: boolean;
  isTouching: boolean;
  isSnapping: boolean;
  calculateMathematicalGaps: () => {
    gaps: { left: number; right: number; top: number; bottom: number };
    photoEdges: { left: number; right: number; top: number; bottom: number };
    photoSize: { width: number; height: number };
  };
  calculateGapBasedMovement: (gapData: GapData) => Movement | null;
  hasRecentUserInteraction: () => boolean;
  lastUserInteraction: number;
  interactionType: string;
}

export function usePhotoDebug({
  debug,
  currentTransform,
  interactive,
  isDragging,
  isTouching,
  isSnapping,
  calculateMathematicalGaps,
  calculateGapBasedMovement,
  hasRecentUserInteraction,
  lastUserInteraction,
  interactionType
}: UsePhotoDebugProps) {
  if (!debug) {
    return { debugInfo: null, gapIndicator: null };
  }

  // Add error handling to prevent silent failures
  let gapData: GapData;
  let movement: Movement | null = null;
  let errorMessage: string | null = null;

  try {
    if (process.env.NODE_ENV === 'development') console.log('🔧 usePhotoDebug - Using mathematical gap calculation...');
    
    // Use mathematical calculation instead of DOM-based detectGaps
    const mathGaps = calculateMathematicalGaps();
    
    // Convert mathematical gaps to GapData format
    const GAP_THRESHOLD = 0; // Detect any gap amount
    const hasLeftGap = mathGaps.gaps.left > GAP_THRESHOLD;
    const hasRightGap = mathGaps.gaps.right > GAP_THRESHOLD;
    const hasTopGap = mathGaps.gaps.top > GAP_THRESHOLD;
    const hasBottomGap = mathGaps.gaps.bottom > GAP_THRESHOLD;
    const gapCount = [hasLeftGap, hasRightGap, hasTopGap, hasBottomGap].filter(Boolean).length;
    
    gapData = {
      hasGaps: gapCount > 0,
      gapCount: gapCount,
      gaps: mathGaps.gaps,
      significantGaps: {
        left: hasLeftGap,
        right: hasRightGap,
        top: hasTopGap,
        bottom: hasBottomGap
      }
    };
    
    if (process.env.NODE_ENV === 'development') console.log('🔧 usePhotoDebug - Mathematical gap data:', gapData);
    movement = gapData.hasGaps ? calculateGapBasedMovement(gapData) : null;
  } catch (error) {
    console.error('❌ usePhotoDebug - Error in mathematical gap detection:', error);
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Fallback gap data
    gapData = {
      hasGaps: false,
      gapCount: 0,
      gaps: { left: 0, right: 0, top: 0, bottom: 0 },
      significantGaps: { left: false, right: false, top: false, bottom: false }
    };
  }

  const debugInfo = (
    <div className="fixed top-4 left-4 bg-black bg-opacity-95 text-white text-xs p-3 rounded z-[9999] pointer-events-none max-w-sm shadow-lg border border-gray-600">
      <div className="font-bold mb-2">Gap-Based Auto-Snap Debug</div>
      
      {errorMessage && (
        <div className="mb-2 p-2 bg-red-900 border border-red-600 rounded">
          <div className="text-red-200 font-semibold">Error:</div>
          <div className="text-red-300">{errorMessage}</div>
        </div>
      )}
      
      <div>Scale: {currentTransform.photoScale.toFixed(2)}</div>
      <div>Center X: {currentTransform.photoCenterX.toFixed(3)}</div>
      <div>Center Y: {currentTransform.photoCenterY.toFixed(3)}</div>
      <div>Interactive: {interactive ? 'Yes' : 'No'}</div>
      <div>Dragging: {isDragging ? 'Yes' : 'No'}</div>
      <div>Touching: {isTouching ? 'Yes' : 'No'}</div>
      <div>Snapping: {isSnapping ? 'Yes' : 'No'}</div>
      
      {/* Gap Detection section hidden per user request */}
      {/* <div className="mt-2 border-t border-gray-600 pt-2">
        <div className="font-semibold">Gap Detection:</div>
        {errorMessage ? (
          <div className="text-red-300">Gap detection failed</div>
        ) : (
          <>
            <div>Gap Count: {gapData.gapCount}</div>
            <div>L:{gapData.gaps.left.toFixed(1)} R:{gapData.gaps.right.toFixed(1)}</div>
            <div>T:{gapData.gaps.top.toFixed(1)} B:{gapData.gaps.bottom.toFixed(1)}</div>
            <div className="text-xs text-gray-300">
              Significant: {Object.entries(gapData.significantGaps).filter(([_, hasGap]) => hasGap).map(([side]) => side).join(', ') || 'none'}
            </div>
          </>
        )}
      </div> */}
      
      <div className="mt-2 border-t border-gray-600 pt-2">
        <div className="font-semibold">Action Plan:</div>
        <div className="text-xs">
          {gapData.gapCount >= 3 ? 'Reset to default (3+ gaps)' :
           gapData.gapCount === 2 ? 'Move by both gap amounts' :
           gapData.gapCount === 1 ? 'Move by single gap amount' : 'No action needed'}
        </div>
        {movement && movement.action !== 'none' && (
          <>
            <div className="text-xs text-yellow-300">H: {movement.movements.horizontal}</div>
            <div className="text-xs text-yellow-300">V: {movement.movements.vertical}</div>
            {movement.movements.horizontal.includes('post-snap override') && (
              <div className="text-xs text-red-300">⚠️ Post-snap validation triggered</div>
            )}
          </>
        )}
      </div>
      
      <div className="mt-2 border-t border-gray-600 pt-2">
        <div className="font-semibold">Status:</div>
        <div className="text-xs">Recent Interaction: {hasRecentUserInteraction() ? `${interactionType} (${((Date.now() - lastUserInteraction) / 1000).toFixed(1)}s ago)` : 'No'}</div>
        <div className="text-xs">Will Apply: {gapData.hasGaps ? 'Yes' : 'No'}</div>
      </div>
      
      <div className="mt-2 text-xs text-green-300">Mode: User-Specified Gap Movement</div>
    </div>
  );

  // Gap indicator hidden per user request
  const gapIndicator = null;

  return { debugInfo, gapIndicator };
}