'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CyclingTextProps {
  words: string[];
  intervalSeconds?: number;
  onCycleComplete?: () => void;
}

const wordVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },
};

export default function CyclingText({ words, intervalSeconds = 3, onCycleComplete }: CyclingTextProps) {
  const [index, setIndex] = useState(0);
  const hasCompletedCycle = useRef(false);

  useEffect(() => {
    if (words.length === 0) return;

    const interval = setInterval(() => {
      setIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % words.length;
        if (nextIndex === 0 && prevIndex === words.length - 1 && !hasCompletedCycle.current) {
          hasCompletedCycle.current = true;
          if (onCycleComplete) {
            setTimeout(onCycleComplete, (intervalSeconds * 1000) * 0.7);
          }
        }
        return nextIndex;
      });
    }, intervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [words, intervalSeconds, onCycleComplete]);

  return (
    <div className="inline-block overflow-hidden align-bottom h-auto">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={words[index]}
          variants={wordVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="inline-block"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
} 