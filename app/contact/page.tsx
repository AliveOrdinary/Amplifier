import Link from 'next/link';
import Layout from '../../components/Layout';
import { getContactPageData } from '../../lib/markdown';

export default function Contact() {
  const contactData = getContactPageData();
  
  return (
    <Layout>
      <section className="px-2 md:px-4">
        <div className=" mx-auto ">
          <div className=" mx-auto">
            
            <div className="bg-white">
              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-6">Get in Touch</h2>
                <p className="text-gray-600 mb-4">
                  I&apos;m always open to discussing new projects, creative ideas or opportunities to be part of your vision.
                </p>
              </div>
              
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-4">Contact Information</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <span className="text-gray-700 font-medium">Email:</span>
                    <a 
                      href={`mailto:${contactData.email}`} 
                      className="text-blue-600 hover:underline"
                    >
                      {contactData.email}
                    </a>
                  </li>
                  {contactData.phone && (
                    <li className="flex items-center gap-2">
                      <span className="text-gray-700 font-medium">Phone:</span>
                      <a 
                        href={`tel:${contactData.phone}`} 
                        className="text-blue-600 hover:underline"
                      >
                        {contactData.phone}
                      </a>
                    </li>
                  )}
                </ul>
              </div>
              
              {contactData.socialMedia && contactData.socialMedia.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Connect with Me</h3>
                  <ul className="flex flex-wrap gap-4">
                    {contactData.socialMedia.map((social, index) => (
                      <li key={index}>
                        <Link
                          href={social.url}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-block px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                        >
                          {social.platform}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
} 