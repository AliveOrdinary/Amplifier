'use client';
import Link from 'next/link';
import { useState, useEffect, Fragment, useRef, useCallback } from 'react';

interface NavigationItem {
  text: string;
  url: string;
}

interface HeaderProps {
  navigation: NavigationItem[];
}

export default function Header({ navigation }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 50;
      setIsScrolled(scrolled);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Disable body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Infinite scroll logic
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const itemBlockHeight = el.scrollHeight / 3; // Assuming 3 blocks of items
    if (itemBlockHeight === 0) return;

    const currentScrollTop = el.scrollTop;
    const tolerance = 5; // Small pixel tolerance to trigger jump before hitting exact edge

    // If scrolled near the top of the first block
    if (currentScrollTop <= tolerance) {
      el.scrollTop = currentScrollTop + itemBlockHeight; // Jump to corresponding position in the second block
    }
    // If scrolled near the bottom of the third block
    else if (currentScrollTop + el.clientHeight >= el.scrollHeight - tolerance) {
      el.scrollTop = currentScrollTop - itemBlockHeight; // Jump to corresponding position in the second block
    }
  }, []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (isMenuOpen && scrollElement) {
      const initScroll = () => {
        // Ensure scrollHeight is populated and greater than 0
        if (scrollElement.scrollHeight > 0) {
          const itemBlockHeight = scrollElement.scrollHeight / 3;
          scrollElement.scrollTop = itemBlockHeight; // Start at the top of the second block
        }
      };

      // Delay initialization slightly to ensure scrollHeight is calculated after render
      const timerId = setTimeout(initScroll, 50);

      scrollElement.addEventListener('scroll', handleScroll);

      return () => {
        clearTimeout(timerId);
        scrollElement.removeEventListener('scroll', handleScroll);
      };
    }
  }, [isMenuOpen, navigation, handleScroll]); // Re-run if menu state or items change

  return (
    <header className={`md:py-4 py-2 md:px-4 px-2 fixed top-0 w-full z-50 transition-all duration-300 
      ${isMenuOpen ? 'bg-[#000000] shadow-md' : isScrolled ? 'bg-[#000000] shadow-md' : 'bg-transparent'}
    `}>
      <div className="mx-auto flex items-center justify-center relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`flex items-center justify-center w-12 h-12 z-50 absolute left-2 md:left-4 top-1/2 -translate-y-1/2`}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {!isMenuOpen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="square"          
            >
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="15" y2="12"></line>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="square"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          )}
        </button>

        <Link href="/" className="text-2xl font-rightserif font-book flex items-center">
          <span>amplifier.</span>
        </Link>

        {isMenuOpen && (
          <div
            ref={scrollRef}
            className="fixed inset-0 bg-[#000000] z-10 pt-8 px-8 flex flex-col overflow-y-auto mt-12"
          >
            <nav>
              <ul className="flex flex-col items-start text-center space-y-10 text-5xl sm:text-9xl font-montreal font-book py-10">
                {[...Array(3)].map((_, repetitionIndex) => (
                  <Fragment key={`repetition-${repetitionIndex}`}>
                    {navigation.map((item, itemIndex) => (
                      <li key={`nav-${repetitionIndex}-${item.url}-${itemIndex}`}>
                        <Link
                          href={item.url}
                          className="text-gray-200 hover:text-white inline-block py-2"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {item.text}
                        </Link>
                      </li>
                    ))}
                    <li key={`connect-${repetitionIndex}`}>
                      <a
                        href="mailto:eldhosekuriyan@gmail.com"
                        className="text-gray-200 hover:text-white inline-block py-2"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Let&apos;s connect <span className="text-yellow-400">👋</span>
                      </a>
                    </li>
                  </Fragment>
                ))}
              </ul>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
} 