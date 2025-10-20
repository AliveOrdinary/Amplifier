import Layout from '@/components/Layout';
import BriefingClient from '@/components/briefing/BriefingClient';

export const metadata = {
  title: 'Visual Briefing | amplifier.studio',
  description: 'Share your aesthetic preferences and let AI curate a visual gallery for your brand.',
};

export default function BriefingPage() {
  return (
    <Layout>
      <div className="pt-20">
        <BriefingClient />
      </div>
    </Layout>
  );
}
