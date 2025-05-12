import Layout from '../../components/Layout';
import { getAboutPageData } from '../../lib/markdown';
import AboutPageClient from '../../components/AboutPageClient'; // Import the new client component

export default function About() {
  const aboutData = getAboutPageData(); // Fetch data server-side
  const { introText, story } = aboutData;

  return (
    <Layout>
      {/* Render the client component, passing data as props */}
      <AboutPageClient introText={introText} story={story} />
    </Layout>
  );
} 