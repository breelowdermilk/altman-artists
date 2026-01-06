import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(process.cwd());
const dataDir = path.join(projectRoot, "data");
const srcDir = path.join(projectRoot, "src");
const distDir = path.join(projectRoot, "dist");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeBaseUrl(url) {
  const trimmed = String(url ?? "").trim();
  return trimmed.replace(/\/+$/, "");
}

function safeJoinUrl(baseUrl, pathname) {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return "";
  return `${base}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}

function operabaseSearchUrl(query) {
  return `https://www.operabase.com/search/en?q=${encodeURIComponent(query)}`;
}

function ensureTrailingSlash(p) {
  return p.endsWith("/") ? p : `${p}/`;
}

async function assetExistsInDist(urlPath) {
  if (!urlPath?.startsWith("/")) return false;
  const filePath = path.join(distDir, urlPath);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function artistLabel(artist) {
  return artist.discipline || artist.voiceType || "";
}

function normalizeForSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function renderContactStrip({ site }) {
  const email = site.contact?.email || "";
  return `<section class="contact">
  <h2>Get in Touch</h2>
  <p>For booking inquiries and general questions</p>
  ${email ? `<a class="btn" href="mailto:${escapeHtml(email)}">Contact Us</a>` : ""}
</section>`;
}

async function renderRosterSection({ site, artists, title, intro }) {
  const types = Array.from(
    new Set(
      artists
        .map((a) => artistLabel(a))
        .filter(Boolean)
        .map((t) => t.trim())
    )
  ).sort((a, b) => a.localeCompare(b));

  const cards = (await Promise.all(
    artists.map(async (artist) => {
      const href = `/artists/${artist.slug}/`;
      const type = artistLabel(artist);
      const searchable = normalizeForSearch([artist.name, type, artist.location].filter(Boolean).join(" "));
      const portraitPath = (await assetExistsInDist(artist.photo?.path)) ? artist.photo.path : "/assets/people/placeholder.svg";
      const portraitAlt = artist.photo?.alt || `Portrait of ${artist.name}`;

      return `<article class="artist-card" data-artist-card data-name="${escapeHtml(searchable)}" data-type="${escapeHtml(type)}">
  <a class="artist-card__media" href="${escapeHtml(href)}" aria-label="${escapeHtml(artist.name)}">
    <img src="${escapeHtml(portraitPath)}" alt="${escapeHtml(portraitAlt)}" loading="lazy" decoding="async" />
  </a>
  <div class="artist-card__body">
    <a href="${escapeHtml(href)}"><h3>${escapeHtml(artist.name)}</h3></a>
    <p class="meta">${escapeHtml([type, artist.location].filter(Boolean).join(" · "))}</p>
    ${artist.managementNotes ? `<p class="meta artist-card__note">${escapeHtml(artist.managementNotes)}</p>` : ""}
    <div class="tagrow">
      ${artist.operabaseUrl ? `<a class="tag" href="${escapeHtml(artist.operabaseUrl)}" target="_blank" rel="noopener noreferrer">Operabase profile</a>` : `<a class="tag" href="${escapeHtml(operabaseSearchUrl(artist.name))}" target="_blank" rel="noopener noreferrer">Operabase search</a>`}
      ${artist.website ? `<a class="tag" href="${escapeHtml(artist.website)}" target="_blank" rel="noopener noreferrer">Website</a>` : ""}
    </div>
  </div>
</article>`;
    })
  )).join("\n");

  return `<section class="roster" data-roster>
  ${title ? `<h2 class="section-title roster__title">${escapeHtml(title)}</h2>` : ""}
  ${intro ? `<p class="meta" style="margin-top: 0;">${escapeHtml(intro)}</p>` : ""}
  <div class="roster__controls" data-roster-controls>
    <label class="roster__field">
      <span class="visually-hidden">Search artists</span>
      <input id="roster-search" class="input" type="search" placeholder="Search artists" autocomplete="off" />
    </label>
    <label class="roster__field">
      <span class="visually-hidden">Filter by discipline</span>
      <select id="roster-filter" class="select">
        <option value="">All disciplines</option>
        ${types.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}
      </select>
    </label>
    <div class="roster__count meta"><span id="roster-count">${artists.length}</span> results</div>
  </div>
  <div class="artist-grid" aria-label="Artist roster">
    ${cards}
  </div>
  <div id="roster-empty" class="notice" style="display:none;">No artists match your search.</div>
</section>`;
}

async function renderFeaturedArtistsGrid({ site, artists }) {
  const featured = artists.slice(0, 9); // Show first 9 artists

  const artistLinks = featured.map(artist => {
    const type = artistLabel(artist);
    return `<a href="/artists/${escapeHtml(artist.slug)}/" class="artist">
  <h3>${escapeHtml(artist.name)}</h3>
  <span>${escapeHtml(type)}</span>
</a>`;
  }).join('\n');

  return `<section class="roster-featured">
  <div class="roster-header">
    <h2>Featured Artists</h2>
    <a href="/artists/">View All</a>
  </div>
  <div class="artists-grid">
    ${artistLinks}
  </div>
</section>`;
}

function renderLayout({ site, title, description, canonicalPath, content }) {
  const baseUrl = normalizeBaseUrl(site.baseUrl);
  const canonical = canonicalPath ? safeJoinUrl(baseUrl, canonicalPath) : "";
  const metaDescription = (description || site.description || "").trim();
  const fullTitle = title ? `${title} · ${site.agencyName}` : site.agencyName;
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="robots" content="index,follow" />
    ${metaDescription ? `<meta name="description" content="${escapeHtml(metaDescription)}" />` : ""}
    ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : ""}
    <meta property="og:site_name" content="${escapeHtml(site.agencyName)}" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    ${metaDescription ? `<meta property="og:description" content="${escapeHtml(metaDescription)}" />` : ""}
    ${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}" />` : ""}
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="preload" href="/assets/logo.svg" as="image" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/styles.css" />
    <script defer src="/assets/site.js"></script>
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>
    <header>
      <div class="container">
        <nav class="nav" aria-label="Primary">
          <a class="brand" href="/" data-nav>Altman Artists</a>
          <div class="navlinks">
            <a class="navlink" href="/artists/" data-nav>Artists</a>
            <a class="navlink" href="/about/" data-nav>About</a>
            <a class="navlink" href="/contact/" data-nav>Contact</a>
            <a class="navlink" href="${escapeHtml(site.links?.operabase || "https://www.operabase.com/")}" target="_blank" rel="noopener noreferrer">Operabase</a>
          </div>
        </nav>
      </div>
    </header>
    <main id="main">
      <div class="container">
        ${content}
      </div>
    </main>
    <footer>
      <div class="container">
        <div class="footerrow">
          <span>${escapeHtml(site.agencyName)}</span>
          <span>Artist Management</span>
        </div>
      </div>
    </footer>
  </body>
</html>`;
}

async function renderHome({ site, artists }) {
  const email = site.contact?.email || "";
  return renderLayout({
    site,
    title: "",
    description: site.description,
    canonicalPath: "/",
    content: `<section class="hero">
  <img src="/assets/logo.svg" alt="Altman Artists" class="hero-logo" />
</section>
${await renderFeaturedArtistsGrid({ site, artists })}
${renderContactStrip({ site })}`,
  });
}

async function renderArtistsIndex({ site, artists }) {
  return renderLayout({
    site,
    title: "Artists",
    description: `Roster of artists represented by ${site.agencyName}.`,
    canonicalPath: "/artists/",
    content: `<section class="page">
  <h1>Artists</h1>
  <p>Search the roster and filter by discipline/voice type.</p>
</section>
${await renderRosterSection({ site, artists, title: "", intro: "" })}
${renderContactStrip({ site })}`,
  });
}

function renderAbout({ site, team }) {
  const resolvedTeam = Array.isArray(team) ? team : Array.isArray(site.team) ? site.team : [];
  return renderLayout({
    site,
    title: "About",
    description: `About ${site.agencyName}.`,
    canonicalPath: "/about/",
    content: `<section class="page">
  <h1>About</h1>
  <p>${escapeHtml(site.description || "")}</p>
  ${
    resolvedTeam.length
      ? `<h2 class="section-title" style="margin-top: 22px;">Team</h2>
  <ul class="list">
    ${resolvedTeam.map((m) => `<li>${escapeHtml(m.name)}${m.title ? ` — ${escapeHtml(m.title)}` : ""}</li>`).join("")}
  </ul>`
      : ""
  }
</section>
${renderContactStrip({ site })}`,
  });
}

async function renderArtistPage({ site, artist }) {
  const operabaseLink = artist.operabaseUrl || operabaseSearchUrl(artist.name);
  const portraitPath = (await assetExistsInDist(artist.photo?.path)) ? artist.photo.path : "/assets/people/placeholder.svg";
  const portraitAlt = artist.photo?.alt || `Portrait of ${artist.name}`;

  return renderLayout({
    site,
    title: artist.name,
    description: `${artist.name}${artistLabel(artist) ? ` (${artistLabel(artist)})` : ""} — represented by ${site.agencyName}.`,
    canonicalPath: `/artists/${artist.slug}/`,
    content: `<section class="page">
  <h1>${escapeHtml(artist.name)}</h1>
  <p>${escapeHtml([artistLabel(artist), artist.location].filter(Boolean).join(" · "))}</p>
  ${artist.managementNotes ? `<p class="meta">${escapeHtml(artist.managementNotes)}</p>` : ""}
  <div class="profile">
    <figure class="portrait">
      <img src="${escapeHtml(portraitPath)}" alt="${escapeHtml(portraitAlt)}" loading="eager" />
      ${artist.photo?.credit || artist.photo?.sourceUrl ? `<figcaption class="caption">${escapeHtml(artist.photo?.credit || "")}${artist.photo?.sourceUrl ? ` · <a href="${escapeHtml(artist.photo.sourceUrl)}" target="_blank" rel="noopener noreferrer">Source</a>` : ""}</figcaption>` : ""}
    </figure>
    <div>
      <article class="panel">
        ${artist.bio ? `<p>${escapeHtml(artist.bio)}</p>` : `<p>${escapeHtml(site.description || "")}</p>`}
        ${
          Array.isArray(artist.repertoireHighlights) && artist.repertoireHighlights.length
            ? `<h2 style="margin: 18px 0 10px; font-size: 18px; font-family: var(--display);">Repertoire highlights</h2>
        <ul class="list">${artist.repertoireHighlights.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
            : ""
        }
      </article>
      <aside class="panel" style="margin-top: 14px;" aria-label="Artist links and details">
        <div class="kvs">
          ${artistLabel(artist) ? `<div class="kv"><strong>Discipline</strong><span>${escapeHtml(artistLabel(artist))}</span></div>` : ""}
          ${artist.location ? `<div class="kv"><strong>Based in</strong><span>${escapeHtml(artist.location)}</span></div>` : ""}
          <div class="kv"><strong>Operabase</strong><a href="${escapeHtml(operabaseLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(artist.operabaseUrl ? "View profile" : "Search")}</a></div>
          ${artist.website ? `<div class="kv"><strong>Website</strong><a href="${escapeHtml(artist.website)}" target="_blank" rel="noopener noreferrer">Open</a></div>` : ""}
        </div>
      </aside>
      <div class="notice">Need a full résumé or media links? <a href="/contact/">Contact us</a>.</div>
    </div>
  </div>
</section>`,
  });
}

async function renderContact({ site, team }) {
  const email = site.contact?.email || "";
  const phone = site.contact?.phone || "";
  const location = site.contact?.location || "";
  const resolvedTeam = Array.isArray(team) ? team : Array.isArray(site.team) ? site.team : [];

  return renderLayout({
    site,
    title: "Contact",
    description: `Contact ${site.agencyName} for bookings and inquiries.`,
    canonicalPath: "/contact/",
    content: `<section class="page">
  <h1>Contact</h1>
  <p>For engagements, availability, and general inquiries, reach out directly.</p>
  <div class="split">
    <article class="panel">
      <h2 style="margin: 0 0 10px; font-size: 18px;">Message</h2>
      <p class="meta">This site is static. The quickest way to connect is email.</p>
      ${email ? `<p><a class="cta" href="mailto:${escapeHtml(email)}"><span>Email ${escapeHtml(site.contact?.name || "us")}</span><small>${escapeHtml(email)}</small></a></p>` : ""}
      <div class="notice fine">If you want a contact form, connect this page to a form provider (Netlify Forms, Formspree, etc.).</div>
    </article>
    <aside class="panel">
      ${
        resolvedTeam.length
          ? `<div class="team" aria-label="Team">
  ${(await Promise.all(
    resolvedTeam.map(async (member) => {
      const portraitPath = (await assetExistsInDist(member.photo?.path)) ? member.photo.path : "/assets/people/placeholder.svg";
      const portraitAlt = member.photo?.alt || `Portrait of ${member.name}`;
      return `<div class="teamrow">
  <img class="teamimg" src="${escapeHtml(portraitPath)}" alt="${escapeHtml(portraitAlt)}" loading="lazy" decoding="async" />
  <div>
    <div style="font-weight: 650;">${escapeHtml(member.name)}</div>
    <div class="fine">${escapeHtml(member.title || "")}</div>
  </div>
</div>`;
    })
  )).join("\n")}
</div>`
          : ""
      }
      <div class="kvs">
        ${
          resolvedTeam.length
            ? `<div class="kv"><strong>Team</strong><span>${resolvedTeam
                .map((m) => `${escapeHtml(m.name)}${m.title ? ` — ${escapeHtml(m.title)}` : ""}`)
                .join("<br/>")}</span></div>`
            : ""
        }
        ${email ? `<div class="kv"><strong>Email</strong><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>` : ""}
        ${phone ? `<div class="kv"><strong>Phone</strong><a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}">${escapeHtml(phone)}</a></div>` : ""}
        ${location ? `<div class="kv"><strong>Location</strong><span>${escapeHtml(location)}</span></div>` : ""}
      </div>
    </aside>
  </div>
</section>`,
  });
}

function renderNotFound({ site }) {
  return renderLayout({
    site,
    title: "Page not found",
    description: site.description,
    canonicalPath: "",
    content: `<section class="page">
  <h1>Page not found</h1>
  <p>The page you’re looking for doesn’t exist. Try the roster.</p>
  <p><a class="cta" href="/artists/"><span>View artists</span><small>/artists/</small></a></p>
</section>`,
  });
}

function renderRobots({ site }) {
  const baseUrl = normalizeBaseUrl(site.baseUrl);
  const sitemap = baseUrl ? `${baseUrl}/sitemap.xml` : "/sitemap.xml";
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`;
}

function renderSitemap({ site, artists }) {
  const baseUrl = normalizeBaseUrl(site.baseUrl);
  if (!baseUrl) return "";

  const urls = [
    "/",
    "/artists/",
    "/about/",
    ...artists.map((a) => `/artists/${a.slug}/`),
    "/contact/",
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((p) => `  <url><loc>${escapeHtml(safeJoinUrl(baseUrl, ensureTrailingSlash(p)))}</loc></url>\n`)
      .join("") +
    `</urlset>\n`;
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const from = path.join(src, entry.name);
      const to = path.join(dest, entry.name);
      if (entry.isDirectory()) return copyDir(from, to);
      await fs.copyFile(from, to);
    })
  );
}

function validateArtists(artists) {
  const seen = new Set();
  for (const artist of artists) {
    if (!artist?.slug || !artist?.name) {
      throw new Error(`Each artist must have 'slug' and 'name'. Bad entry: ${JSON.stringify(artist)}`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(artist.slug)) {
      throw new Error(`Artist slug must be kebab-case (a-z0-9-): '${artist.slug}'`);
    }
    if (seen.has(artist.slug)) throw new Error(`Duplicate artist slug: '${artist.slug}'`);
    seen.add(artist.slug);
  }
}

export async function buildSite() {
  const site = JSON.parse(await fs.readFile(path.join(dataDir, "site.json"), "utf8"));
  const artistsData = JSON.parse(await fs.readFile(path.join(dataDir, "artists.json"), "utf8"));
  const artists = Array.isArray(artistsData)
    ? artistsData
    : Array.isArray(artistsData?.artists)
      ? artistsData.artists
      : [];

  let team = Array.isArray(site.team) ? site.team : [];
  try {
    team = JSON.parse(await fs.readFile(path.join(dataDir, "team.json"), "utf8"));
  } catch {
    // ignore
  }
  validateArtists(artists);

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(path.join(distDir, "assets"), { recursive: true });
  await fs.mkdir(path.join(distDir, "artists"), { recursive: true });
  await fs.mkdir(path.join(distDir, "about"), { recursive: true });
  await fs.mkdir(path.join(distDir, "contact"), { recursive: true });

  await copyDir(path.join(srcDir, "assets"), path.join(distDir, "assets"));
  
  // Copy admin if it exists
  try {
    await copyDir(path.join(srcDir, "admin"), path.join(distDir, "admin"));
    // Ensure admin isn't styled like the public site.
    try {
      await fs.rm(path.join(distDir, "admin", "index.html"), { force: true });
    } catch {
      // ignore
    }
  } catch (e) {
    // It's okay if admin doesn't exist yet
  }

  await fs.writeFile(path.join(distDir, "index.html"), await renderHome({ site, artists }), "utf8");
  await fs.mkdir(path.join(distDir, "artists"), { recursive: true });
  await fs.writeFile(path.join(distDir, "artists", "index.html"), await renderArtistsIndex({ site, artists }), "utf8");
  await fs.writeFile(path.join(distDir, "about", "index.html"), renderAbout({ site, team }), "utf8");

  for (const artist of artists) {
    const artistDir = path.join(distDir, "artists", artist.slug);
    await fs.mkdir(artistDir, { recursive: true });
    await fs.writeFile(path.join(artistDir, "index.html"), await renderArtistPage({ site, artist }), "utf8");
  }

  await fs.writeFile(path.join(distDir, "contact", "index.html"), await renderContact({ site, team }), "utf8");
  await fs.writeFile(path.join(distDir, "404.html"), renderNotFound({ site }), "utf8");
  await fs.writeFile(path.join(distDir, "robots.txt"), renderRobots({ site }), "utf8");

  const sitemap = renderSitemap({ site, artists });
  if (sitemap) await fs.writeFile(path.join(distDir, "sitemap.xml"), sitemap, "utf8");
}

const isCli = import.meta.url === pathToFileURL(path.resolve(process.argv[1] || "")).href;
if (isCli) {
  buildSite().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
