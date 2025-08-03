import React from 'react';
import { createPortal } from 'react-dom';

interface DebugPortalProps {
  children: React.ReactNode;
}

export default function DebugPortal({ children }: DebugPortalProps) {
  // Only render on client side to avoid hydration mismatch
  if (typeof window === 'undefined') {
    return null;
  }

  // Render debug UI at document body level to escape all container constraints
  return createPortal(children, document.body);
}