'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface AboutPageClientProps {
  introText: string;
  story: string;
}

export default function AboutPageClient({ introText, story }: AboutPageClientProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start start', 'end end'],
  });

  const introOpacity = useTransform(scrollYProgress, [0, 0.3, 0.5], [1, 1, 0]);
  const introScale = useTransform(scrollYProgress, [0, 0.5], [1, 2.5]);
  const introY = useTransform(scrollYProgress, [0, 0.5], ['0%', '5%']);

  const storyOpacity = useTransform(scrollYProgress, [0.4, 0.6, 0.8], [0, 1, 1]);
  const storyY = useTransform(scrollYProgress, [0.4, 0.8], ['50px', '0px']);
  const storyScale = useTransform(scrollYProgress, [0.4, 0.8], [0.5, 1.5]);

  return (
    <section ref={targetRef} className="relative min-h-[200vh]">
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">
        
        {/* Intro Text Block */}
        <motion.div 
          style={{
            opacity: introOpacity,
            scale: introScale,
            y: introY,
          }}
          className="absolute inset-0 flex items-center justify-center px-4 md:px-8"
        >
          <h1 className="text-5xl md:text-7xl lg:text-9xl font-bold text-center leading-tight">
            {introText}
          </h1>
        </motion.div>

        {/* Story Text Block */}
        <motion.div 
          style={{
            opacity: storyOpacity,
            y: storyY,
            scale: storyScale,
          }}
          className="absolute inset-0 flex items-center justify-center px-4 md:px-8"
        >
          <div className="text-center max-w-2xl md:max-w-3xl">
            <p className="text-xl md:text-2xl lg:text-3xl leading-relaxed">
              {story}
            </p>
          </div>
        </motion.div>

      </div>
    </section>
  );
} 