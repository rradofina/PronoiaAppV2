// CLIPPING PREVENTION: Runtime monitoring and detection utilities for portrait tablets

interface ViewportInfo {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  isTablet: boolean;
  hasVirtualKeyboard: boolean;
  availableHeight: number;
}

interface ClippingRisk {
  level: 'none' | 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  recommendedAction: string;
  measurements: {
    viewportHeight: number;
    availableSpace: number;
    requestedHeight: number;
    overflow: number;
  };
}

/**
 * Get comprehensive viewport information for clipping detection
 */
export function getViewportInfo(): ViewportInfo {
  if (typeof window === 'undefined') {
    return {
      width: 1024,
      height: 1366,
      orientation: 'portrait',
      isTablet: true,
      hasVirtualKeyboard: false,
      availableHeight: 1366
    };
  }

  const width = window.visualViewport?.width || window.innerWidth;
  const height = window.visualViewport?.height || window.innerHeight;
  const screenHeight = window.screen?.height || height;
  
  // Detect if virtual keyboard is active (mobile/tablet)
  const hasVirtualKeyboard = screenHeight > height + 150;
  
  // Simple tablet detection based on screen size and touch capability
  const isTablet = (width >= 768 && width <= 1366) && 
                   ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  
  const orientation: 'portrait' | 'landscape' = width > height ? 'landscape' : 'portrait';
  
  return {
    width,
    height,
    orientation,
    isTablet,
    hasVirtualKeyboard,
    availableHeight: height
  };
}

/**
 * Assess clipping risk for a requested height
 */
export function assessClippingRisk(
  requestedHeight: number,
  options: {
    headerHeight?: number;
    contentHeight?: number;
    padding?: number;
  } = {}
): ClippingRisk {
  const { headerHeight = 140, contentHeight = 420, padding = 60 } = options;
  const viewport = getViewportInfo();
  
  const reservedSpace = headerHeight + contentHeight + padding;
  const availableSpace = Math.max(0, viewport.availableHeight - reservedSpace);
  const overflow = requestedHeight - availableSpace;
  
  let level: ClippingRisk['level'] = 'none';
  let reason = '';
  let recommendedAction = '';
  
  if (overflow <= 0) {
    level = 'none';
    reason = 'Requested height fits within available space';
    recommendedAction = 'Safe to proceed with requested height';
  } else if (overflow <= 20) {
    level = 'low';
    reason = `Minor overflow: ${overflow}px`;
    recommendedAction = 'Consider reducing height slightly or add scroll';
  } else if (overflow <= 50) {
    level = 'medium';
    reason = `Moderate overflow: ${overflow}px`;
    recommendedAction = 'Reduce height or implement scrolling';
  } else if (overflow <= 100) {
    level = 'high';
    reason = `Significant overflow: ${overflow}px`;
    recommendedAction = 'Use fallback height or keep collapsed';
  } else {
    level = 'critical';
    reason = `Critical overflow: ${overflow}px`;
    recommendedAction = 'Must use safe fallback height to prevent clipping';
  }
  
  // Special cases for portrait tablets
  if (viewport.orientation === 'portrait' && viewport.isTablet) {
    if (viewport.availableHeight < 900) {
      level = level === 'none' ? 'low' : level;
      reason += ' (Compact portrait tablet detected)';
    }
    
    if (viewport.hasVirtualKeyboard) {
      level = level === 'none' ? 'medium' : level;
      reason += ' (Virtual keyboard active)';
    }
  }
  
  return {
    level,
    reason,
    recommendedAction,
    measurements: {
      viewportHeight: viewport.availableHeight,
      availableSpace,
      requestedHeight,
      overflow: Math.max(0, overflow)
    }
  };
}

/**
 * Calculate safe height that won't cause clipping
 */
export function calculateSafeHeight(
  idealHeight: number,
  options: {
    headerHeight?: number;
    contentHeight?: number;
    padding?: number;
    maxHeight?: number;
  } = {}
): number {
  const { headerHeight = 140, contentHeight = 420, padding = 60, maxHeight = 280 } = options;
  const viewport = getViewportInfo();
  
  const reservedSpace = headerHeight + contentHeight + padding;
  const availableSpace = Math.max(96, viewport.availableHeight - reservedSpace); // Never below h-24
  
  // For portrait tablets, be more conservative
  let safetyFactor = 1.0;
  if (viewport.orientation === 'portrait' && viewport.isTablet) {
    safetyFactor = viewport.availableHeight < 1000 ? 0.8 : 0.9;
  }
  
  const adjustedAvailableSpace = availableSpace * safetyFactor;
  const safeHeight = Math.min(idealHeight, adjustedAvailableSpace, maxHeight);
  
  return Math.max(96, Math.round(safeHeight)); // Ensure minimum of h-24
}

/**
 * Development utility: Show clipping warnings (remove in production)
 */
export function showClippingWarning(risk: ClippingRisk): void {
  if (process.env.NODE_ENV === 'production') return;
  
  if (risk.level === 'high' || risk.level === 'critical') {
    console.warn('🚨 CLIPPING RISK DETECTED:', {
      level: risk.level.toUpperCase(),
      reason: risk.reason,
      action: risk.recommendedAction,
      measurements: risk.measurements,
      viewport: getViewportInfo()
    });
    
    // Show visual warning in development
    const warningId = 'clipping-warning-indicator';
    let warningElement = document.getElementById(warningId);
    
    if (!warningElement) {
      warningElement = document.createElement('div');
      warningElement.id = warningId;
      warningElement.className = 'clipping-warning';
      document.body.appendChild(warningElement);
    }
    
    warningElement.textContent = `⚠️ CLIPPING RISK: ${risk.level.toUpperCase()} - ${risk.measurements.overflow}px overflow`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      warningElement?.remove();
    }, 5000);
  }
}

/**
 * Development utility: Add viewport debugging info to element
 */
export function addViewportDebugInfo(element: HTMLElement): void {
  if (process.env.NODE_ENV === 'production') return;
  
  const viewport = getViewportInfo();
  const debugInfo = `${viewport.width}x${viewport.height} ${viewport.orientation} ${viewport.isTablet ? 'tablet' : 'desktop'}${viewport.hasVirtualKeyboard ? ' +kb' : ''}`;
  
  element.classList.add('viewport-debug');
  element.setAttribute('data-viewport-info', debugInfo);
}