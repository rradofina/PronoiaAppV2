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
  detectGaps: () => GapData;
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
  detectGaps,
  calculateGapBasedMovement,
  hasRecentUserInteraction,
  lastUserInteraction,
  interactionType
}: UsePhotoDebugProps) {
  if (!debug) {
    return { debugInfo: null, gapIndicator: null };
  }

  const gapData = detectGaps();
  const movement = gapData.hasGaps ? calculateGapBasedMovement(gapData) : null;

  const debugInfo = (
    <div className="fixed top-4 left-4 bg-black bg-opacity-95 text-white text-xs p-3 rounded z-[9999] pointer-events-none max-w-sm shadow-lg border border-gray-600">
      <div className="font-bold mb-2">Gap-Based Auto-Snap Debug</div>
      <div>Scale: {currentTransform.photoScale.toFixed(2)}</div>
      <div>Center X: {currentTransform.photoCenterX.toFixed(3)}</div>
      <div>Center Y: {currentTransform.photoCenterY.toFixed(3)}</div>
      <div>Interactive: {interactive ? 'Yes' : 'No'}</div>
      <div>Dragging: {isDragging ? 'Yes' : 'No'}</div>
      <div>Touching: {isTouching ? 'Yes' : 'No'}</div>
      <div>Snapping: {isSnapping ? 'Yes' : 'No'}</div>
      
      <div className="mt-2 border-t border-gray-600 pt-2">
        <div className="font-semibold">Gap Detection:</div>
        <div>Gap Count: {gapData.gapCount}</div>
        <div>L:{gapData.gaps.left} R:{gapData.gaps.right}</div>
        <div>T:{gapData.gaps.top} B:{gapData.gaps.bottom}</div>
        <div className="text-xs text-gray-300">
          Significant: {Object.entries(gapData.significantGaps).filter(([_, hasGap]) => hasGap).map(([side]) => side).join(', ') || 'none'}
        </div>
      </div>
      
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

  const gapIndicator = gapData.hasGaps ? (
    <div className="absolute inset-0 pointer-events-none z-40">
      <div className="absolute top-2 left-2 bg-yellow-600 text-white text-xs px-2 py-1 rounded">
        {gapData.gapCount} gap{gapData.gapCount > 1 ? 's' : ''}
      </div>
    </div>
  ) : null;

  return { debugInfo, gapIndicator };
}