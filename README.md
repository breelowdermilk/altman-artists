# Opera Agent Website

A high-performance, static website for an opera agency.

## Features
- **Fast & Secure:** Built as a static site (JAMstack architecture).
- **Admin Panel (CMS):** A non-technical user can log in at `/admin` to add, remove, or edit artists without touching code.
- **Search Optimized:** Automated SEO, sitemap, and robots.txt generation.
- **Operabase Integration:** Automated linking to artist profiles.

## Project Structure
- `data/`: JSON files containing site configuration and the artist roster.
- `src/admin/`: Configuration for the Decap CMS admin dashboard.
- `src/assets/`: Styles, scripts, and images (artist portraits).
- `scripts/`: Build and development scripts.
- `dist/`: The generated website (ready for deployment).

## For Non-Technical Users (Management)
When the site is deployed (e.g., to Netlify), you can manage the roster by going to `your-site-url.com/admin`. 

From there, you can:
1. Log in securely.
2. View the "Artist Roster".
3. Click "New Artist" or edit existing ones.
4. Upload photos directly from your computer.
5. Click "Publish" to automatically rebuild the website with the new information.

## For Developers

### Local Development
1. **Install dependencies:** `npm install`
2. **Start the CMS proxy:** `npx decap-server` (This allows the local admin panel to save changes to your files).
3. **Start the dev server:** `npm run dev`
4. **Access the Admin Panel:** `http://localhost:3000/admin/`

### Deployment
The site is designed to be hosted on any static provider (Netlify, Vercel, GitHub Pages).
- **Build command:** `npm run build`
- **Publish directory:** `dist/`

### Data Structure
The `data/artists.json` file is the "database". It is managed by the CMS, but can also be edited manually. Ensure all artist slugs remain in `kebab-case`.


Static, data-driven website for an opera agent roster (artist pages + Operabase links), with no external build dependencies.

## Quick start

- Build: `node scripts/build.mjs`
- Preview locally: `node scripts/dev.mjs`

## Edit content

- Site-wide settings: `data/site.json`
- Artists (one page per artist): `data/artists.json`
- Team (contact/about): `data/team.json`

## Download headshots

- Add image URLs to `photo.sourceUrl` in `data/artists.json` / `data/team.json`, then run: `node scripts/download-assets.mjs`

## Import local headshots

If you have a headshot file locally (not a URL), you can crop+resize it into `src/assets/people/`:

- Example (Szymon): `node scripts/import-headshot.mjs --src /path/to/IMG_9487.jpeg --slug szymon-komasa`
- Example (Summer): `node scripts/import-headshot.mjs --src /path/to/summer-hasan.jpg --slug summer-hassan`

## Deploy

Upload the `dist/` folder to any static host (Netlify, Vercel static, GitHub Pages, S3, etc.).
