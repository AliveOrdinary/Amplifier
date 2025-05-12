import Link from 'next/link';
import { getContactPageData } from '../lib/markdown';

export default function Footer(): React.ReactNode {
  const contactData = getContactPageData();
  return (
    <footer className="py-2 md:py-4">
      <div className=" mx-auto px-2 md:px-8">
        <div className="flex justify-end"> 
          <div>
            <ul className="space-y-2">
              <li>
                <Link href={contactData.socialMedia[1].url} className="text-gray-50 hover:text-gray-200 transition-colors">
                  Fb
                </Link>
              </li>
              <li>
                <Link href={contactData.socialMedia[0].url} className="text-gray-50 hover:text-gray-200 transition-colors">
                  In
                </Link>
              </li>
              <li>
                <Link href={contactData.socialMedia[2].url} className="text-gray-50 hover:text-gray-200 transition-colors">
                  Be
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="text-center ">
          <p className="text-xs text-gray-500">©2025 AliveOrdinary</p>
        </div>
      </div>
    </footer>
  );
} 