import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedTemplateRevealProps {
  show: boolean;
  children: React.ReactNode;
  delay?: number;
}

const containerVariants = {
  hidden: { 
    opacity: 0, 
    height: 0,
    overflow: 'hidden'
  },
  visible: {
    opacity: 1,
    height: 'auto',
    overflow: 'visible',
    transition: {
      duration: 0.5,
      ease: [0.04, 0.62, 0.23, 0.98] as [number, number, number, number],
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  },
  exit: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
    transition: {
      duration: 0.3,
      ease: 'easeInOut' as const
    }
  }
};

const itemVariants = {
  hidden: { 
    opacity: 0, 
    y: 30,
    scale: 0.9
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.04, 0.62, 0.23, 0.98] as [number, number, number, number]
    }
  }
};

export default function AnimatedTemplateReveal({ show, children, delay = 0 }: AnimatedTemplateRevealProps) {
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          key="template-reveal"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ willChange: 'height, opacity' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Individual template item animation wrapper
export function AnimatedTemplateItem({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  return (
    <motion.div
      variants={itemVariants}
      custom={index}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}