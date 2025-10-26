import Layout from '../components/Layout';
import { getHomePageData } from '../lib/markdown';
import HomePageClient from '@/components/HomePageClient';

export default function HomePage() {
  const homeData = getHomePageData();
  const { introText } = homeData;
  const introWords = introText.split(' ').filter(word => word.trim() !== '');

  return (
    <Layout>
      <section className="relative min-h-screen flex flex-col justify-center items-center ">
        <div 
          className="absolute inset-0 w-full h-full z-0 bg-[url('/home-background.jpg')] bg-cover bg-center"
          aria-hidden="true"
        />
        
        <div 
          className="absolute inset-0 w-full h-full bg-black opacity-50 z-0"
          aria-hidden="true"
        />

        <div className="relative z-10 w-full">
          <HomePageClient introWords={introWords} />
        </div>
      </section>
    </Layout>
  );
}
