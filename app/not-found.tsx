import Link from 'next/link';
import Layout from '../components/Layout';

export default function NotFound() {
  return (
    <Layout>
      <div className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto text-center">
            <h1 className="text-3xl mb-4">Page Not Found</h1>
            <p className="text-xl mb-8">
              The page you are looking for doesn&apos;t exist or has been moved.
            </p>
            <Link 
              href="/"
              className="inline-block text-lg hover:underline"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
} 