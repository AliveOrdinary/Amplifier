# Portfolio Website with Next.js and Netlify CMS

A portfolio website for a graphic designer built with Next.js and Netlify CMS.

## Features

- Responsive design for all devices
- Netlify CMS for content management
- Fast page loading with Next.js
- High-quality image optimization
- Markdown support

## Setup

### Prerequisites

- Node.js (v16 or newer)
- npm or yarn

### Installation

1. Clone this repository
```bash
git clone https://github.com/yourusername/portfolio.git
cd portfolio
```

2. Install dependencies
```bash
npm install
```

3. Run the development server
```bash
npm run dev
```

4. Open http://localhost:3000 in your browser

## Content Management

The website uses Netlify CMS for content management. The CMS can be accessed at `/admin` once the site is deployed to Netlify.

### Setting up Netlify CMS

1. Deploy the site to Netlify
2. Enable Identity service in your Netlify site dashboard
3. Enable Git Gateway in your Netlify site dashboard
4. Set up invite-only access or open registration as per your preference

## Project Structure

- `app/` - Next.js app router pages and layouts
- `components/` - React components
- `content/` - Markdown content managed by Netlify CMS
- `lib/` - Utility functions
- `public/` - Static assets and Netlify CMS admin files

## Deployment

This site is configured for easy deployment on Netlify:

1. Push your code to a GitHub repository
2. Connect the repository to Netlify
3. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `out`

## License

This project is licensed under the MIT License.
