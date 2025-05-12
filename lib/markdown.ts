import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

const contentDirectory = path.join(process.cwd(), 'content');

interface GlobalData {
  siteTitle: string;
  siteDescription: string;
  navigation: Array<{ text: string; url: string }>;
  footerText: string;
  logo?: string;
}

interface ProjectData {
  title: string;
  slug: string;
  featuredImage: string;
  featuredVideo?: string;
  shortSummary: string;
  mainSummary: string;
  year: number;
  services: string[];
  projectImages: Array<{ image: string; caption?: string }>;
  projectVideos?: Array<{ video: string; caption?: string }>;
  featured: boolean;
  order: number;
  content?: string;
}

interface HomePageData {
  title: string;
  introText: string;
  whatIDo?: string;
  featuredProjectsHeading: string;
  content?: string;
}


interface AboutPageData {
  title: string;
  introText: string;
  story: string;
  content?: string;
}

interface ContactPageData {
  title: string;
  email: string;
  phone?: string;
  socialMedia: Array<{ platform: string; url: string }>;
  content?: string;
}

export function getGlobalData(): GlobalData {
  const fullPath = path.join(contentDirectory, 'global/info.md');
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data } = matter(fileContents);
  
  return data as GlobalData;
}

export function getPageData(pageName: string): HomePageData | AboutPageData | ContactPageData {
  const fullPath = path.join(contentDirectory, `pages/${pageName}.md`);
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  
  return {
    ...data,
    content
  } as HomePageData | AboutPageData | ContactPageData;
}

export function getHomePageData(): HomePageData {
  return getPageData('home') as HomePageData;
}

export function getAboutPageData(): AboutPageData {
  return getPageData('about') as AboutPageData;
}

export function getContactPageData(): ContactPageData {
  return getPageData('contact') as ContactPageData;
}

export async function getMarkdownContent(content: string) {
  const processedContent = await remark()
    .use(html)
    .process(content);
  
  return processedContent.toString();
}

export function getAllProjects(): ProjectData[] {
  const projectsDirectory = path.join(contentDirectory, 'projects');
  
  // Check if directory exists
  if (!fs.existsSync(projectsDirectory)) {
    return [];
  }
  
  const fileNames = fs.readdirSync(projectsDirectory);
  
  const allProjectsData = fileNames.map(fileName => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(projectsDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data } = matter(fileContents);
    
    return {
      slug,
      ...data
    } as ProjectData;
  });
  
  // Sort by order field
  return allProjectsData.sort((a: ProjectData, b: ProjectData) => {
    if (a.order > b.order) {
      return 1;
    } else {
      return -1;
    }
  });
}

export function getProjectData(slug: string): ProjectData {
  const fullPath = path.join(contentDirectory, `projects/${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  
  return {
    slug,
    content,
    ...data
  } as ProjectData;
}

export function getFeaturedProjects(): ProjectData[] {
  const allProjects = getAllProjects();
  return allProjects.filter((project: ProjectData) => project.featured);
} 