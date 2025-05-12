'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CyclingText from '@/components/CyclingText';

interface HomePageClientProps {
  introWords: string[];
}

// Animation variants for the container holding CyclingText
const cyclingContainerVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: {
    opacity: 0,
    transition: { duration: 0.8, ease: 'easeInOut' },
  },
};

// Variants for the temporary black background
const blackBgVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: {
    opacity: 0,
    transition: { duration: 1.2, ease: 'easeInOut', delay: 0.3 }, // Delay slightly after text fades
  },
};

export default function HomePageClient({ introWords }: HomePageClientProps) {
  const [showCyclingText, setShowCyclingText] = useState(true);

  const handleCycleComplete = () => {
    setShowCyclingText(false);
  };

  return (
    // This outer div will relatively position the black background and the text
    <div className="relative flex flex-col items-center justify-center min-h-screen w-full text-center px-4">
      <AnimatePresence>
        {showCyclingText && (
          // Temporary Black Background
          <motion.div
            key="temp-black-bg"
            className="absolute inset-0 w-full h-full bg-black z-20" // Higher z-index to be on top of page BG
            variants={blackBgVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCyclingText && (
          // Cycling Text Container - must have a higher z-index than the temporary black bg
          <motion.div
            key="cycling-text-container"
            variants={cyclingContainerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative z-30 text-4xl md:text-6xl lg:text-7xl font-bold mb-8" // Added relative and z-30
          >
            {introWords.length > 0 ? (
              <CyclingText 
                words={introWords} 
                intervalSeconds={1} 
                onCycleComplete={handleCycleComplete}
              />
            ) : (
              <p>Loading...</p> // Should ideally not be needed if passed from server
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content revealed after animation can be placed here */}
      {/* {!showCyclingText && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
           Your main content revealed after animation 
        </motion.div>
      )} */}
    </div>
  );
} 