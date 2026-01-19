# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static website for an opera agency roster built with Node.js and vanilla JavaScript. Zero build dependencies beyond Node's built-in modules. All rendering is done server-side at build time.

## Development Commands

### Build and Preview
- **Build site:** `node scripts/build.mjs`
- **Dev server with hot reload:** `node scripts/dev.mjs` (serves on http://127.0.0.1:5173)
- **Port override:** `PORT=3000 node scripts/dev.mjs`

### Asset Management
- **Download headshots from URLs:** `node scripts/download-assets.mjs`
  - Uses `photo.sourceUrl` from data files
  - Add `--force` to overwrite existing files
  - Add `--only <slug>` to download specific person
- **Import local headshots:** `node scripts/import-headshot.mjs --src <path> --slug <slug>`
  - Crops to 4:5 aspect ratio (center crop)
  - Resizes to 1200×1500px by default
  - Uses macOS `sips` command

## Architecture

### Data-Driven Rendering

All content lives in `data/` as JSON:
- `data/site.json` - Site-wide config (agency name, contact info, base URL)
- `data/artists.json` - Artist roster (array of artist objects)
- `data/team.json` - Team members (agency staff)

### Build Process (scripts/build.mjs)

1. **Load data** from JSON files
2. **Validate artists** - enforce kebab-case slugs, check for duplicates
3. **Clear dist/** directory
4. **Render pages** - all HTML generated via template functions (no templating engine)
5. **Copy assets** - CSS, JS, images, favicon from `src/assets/` to `dist/assets/`
6. **Generate SEO files** - sitemap.xml, robots.txt, .nojekyll (for GitHub Pages)

All pages use a single `renderLayout()` function that handles:
- HTML escaping via `escapeHtml()`
- Base path handling for subpath deployments (`BASE_PATH` env var)
- Meta tags, canonical URLs, Open Graph tags

### URL Structure

- `/` - Home page (featured artists grid)
- `/artists/` - Full roster with search/filter
- `/artists/<slug>/` - Individual artist page
- `/artists/bios/` - Full biographies page (static HTML)
- `/contact/` - Contact/team page
- `/about/` - About page (currently unused)

### Static Pages

Static HTML pages can be added to `src/` and will be copied to `dist/` during build:
- `src/artists/bios/` → `dist/artists/bios/` (artist biographies with headshots)
- `src/admin/` → `dist/admin/` (admin interface if exists)

To add a new static page, create the folder in `src/` with an `index.html` and add a copy block in `scripts/build.mjs` following the existing pattern.

### Base Path Handling

Supports deployment to subdirectories (e.g., GitHub Pages at `/REPO/`):
- `BASE_PATH` env var sets URL prefix (e.g., `/altman-artists`)
- `BASE_URL` env var sets canonical domain
- `withBase(site, urlPath)` helper prepends base path to all internal links
- Used in GitHub Actions workflow for repo Pages sites

### Client-Side Features

**Roster filtering** (src/assets/site.js):
- Search by artist name (normalized, diacritic-insensitive)
- Filter by discipline/voice type dropdown
- Real-time results count
- Uses `data-artist-card`, `data-name`, `data-type` attributes

**Dev server hot reload:**
- SSE endpoint at `/__reload`
- File watching with 650ms debounced rebuild
- Watches `data/`, `src/`, `scripts/` directories

### Photo Management

Artists and team members have `photo` objects:
```json
{
  "path": "/assets/people/firstname-lastname.png",
  "alt": "Portrait of Name",
  "credit": "Photographer",
  "sourceUrl": "https://..."
}
```

- `path` is the public URL path (must start with `/assets/`)
- `sourceUrl` is used by `download-assets.mjs` to fetch remote images
- Photos are copied during build from `src/assets/people/` to `dist/assets/people/`
- Missing photos fall back to `/assets/people/placeholder.svg`

### Artist Data Structure

Required fields:
- `slug` - kebab-case identifier (validated)
- `name` - display name

Optional fields:
- `voiceType` or `discipline` - shown as label (e.g., "Soprano", "Director")
- `location` - city/region
- `bio` - paragraph text
- `repertoireHighlights` - array of strings
- `managementNotes` - internal note displayed on roster cards
- `operabaseUrl` - direct link to Operabase profile
- `website` - artist's personal site

### Operabase Integration

- If `operabaseUrl` is provided, link directly to profile
- Otherwise, generate search URL via `operabaseSearchUrl(artist.name)`
- Search URLs use pattern: `https://www.operabase.com/search/en?q=<encoded-name>`

## Deployment

### Netlify (Production)
- **Deploy command:** `netlify deploy --prod --dir=dist`
- Site is hosted at https://altmanartists.com
- Netlify project: `altman-artists`
- Admin: https://app.netlify.com/projects/altman-artists

**Important:** The GitHub Pages workflow exists but Netlify is the actual production host. Always use `netlify deploy --prod` for production deployments.

### Build for Deployment
- Build command: `node scripts/build.mjs`
- Output directory: `dist/`

## Important Constraints

- **No npm install needed** - uses only Node.js built-in modules
- **Slugs must be kebab-case** - enforced by validation in build script
- **No external templating** - all HTML is string concatenation with proper escaping
- **macOS-specific headshot import** - `import-headshot.mjs` uses `sips` command (macOS only)
