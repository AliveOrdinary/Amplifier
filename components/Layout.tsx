import { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';
import { getGlobalData } from '../lib/markdown';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const globalData = getGlobalData();
  
  return (
    <div className="w-full min-h-screen flex flex-col">
      <Header 
        navigation={globalData.navigation} 
      />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
} 