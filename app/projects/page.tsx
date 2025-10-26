import Layout from '../../components/Layout';
import ProjectCard from '../../components/ProjectCard';
import { getAllProjects } from '../../lib/markdown';

export default function Projects() {
  const projects = getAllProjects();
  
  return (
    <Layout>
      <section className="py-2 md:py-4">
        <div className="mx-auto px-2 md:px-4">
          
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
              {projects.map((project) => (
                <ProjectCard
                  key={project.slug}
                  title={project.title}
                  slug={project.slug}
                  featuredImage={project.featuredImage}
                  featuredVideo={project.featuredVideo}
                  shortSummary={project.shortSummary}
                  year={project.year}
                  services={project.services}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-gray-600">No projects found.</p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
} 