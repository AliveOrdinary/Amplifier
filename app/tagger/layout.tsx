'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/tagger/SignOutButton'

const navItems = [
  { label: 'Tag', href: '/tagger' },
  { label: 'Gallery', href: '/tagger/gallery' },
  { label: 'Vocabulary', href: '/tagger/vocabulary' },
  { label: 'Config', href: '/tagger/vocabulary-config' },
  { label: 'Analytics', href: '/tagger/ai-analytics' },
  { label: 'Dashboard', href: '/tagger/dashboard' },
]

export default function TaggerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/tagger/login') {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="sticky top-0 z-40 bg-gray-950 border-b border-gray-800">
        <div className="container mx-auto px-4 flex items-center justify-between h-12">
          <div className="flex items-center gap-8">
            <span className="text-lg font-semibold text-white">Tagger</span>
            <div className="flex items-center gap-1">
              {navItems.map(item => {
                const isActive = item.href === '/tagger'
                  ? pathname === '/tagger'
                  : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-3 text-sm transition-colors border-b-2 ${
                      isActive
                        ? 'text-white border-blue-500'
                        : 'text-gray-400 border-transparent hover:text-gray-200'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
          <SignOutButton />
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
