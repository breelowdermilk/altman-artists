import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(process.cwd());
const dataDir = path.join(projectRoot, "data");
const srcDir = path.join(projectRoot, "src");

function usage() {
  return [
    "Usage:",
    "  node scripts/download-assets.mjs [--force] [--dry-run] [--only <slug>]...",
    "",
    "Downloads headshots defined by `photo.sourceUrl` into `src/assets/...` based on `photo.path`.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { force: false, dryRun: false, only: [] };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--only") {
      const slug = argv[i + 1];
      if (!slug) throw new Error("--only requires a slug");
      args.only.push(slug);
      i++;
    } else {
      throw new Error(`Unknown arg: ${arg}`);
    }
  }
  return args;
}

function assetDestFromPublicPath(publicPath) {
  const normalized = String(publicPath || "").trim();
  if (!normalized.startsWith("/assets/")) return null;
  const rel = normalized.replace(/^\/assets\//, "");
  const safe = path.posix.normalize(rel);
  if (safe.includes("..")) return null;
  return path.join(srcDir, "assets", ...safe.split("/"));
}

async function loadJson(filePath) {
  const data = await fs.readFile(filePath, "utf8");
  return JSON.parse(data);
}

function collectPeople({ artists, team }) {
  const all = [];

  if (artists != null && !Array.isArray(artists)) {
    throw new Error(`Expected data/artists.json to be an array, got: ${typeof artists}`);
  }
  if (team != null && !Array.isArray(team)) {
    throw new Error(`Expected data/team.json to be an array, got: ${typeof team}`);
  }

  for (const artist of artists || []) all.push({ type: "artist", ...artist });
  for (const member of team || []) all.push({ type: "team", ...member });

  const seen = new Set();
  for (const person of all) {
    if (!person.slug) throw new Error(`Missing slug for: ${JSON.stringify(person)}`);
    if (seen.has(person.slug)) throw new Error(`Duplicate slug across people: '${person.slug}'`);
    seen.add(person.slug);
  }

  return all;
}

async function downloadOne({ person, destPath, sourceUrl, force, dryRun }) {
  await fs.mkdir(path.dirname(destPath), { recursive: true });

  if (!force) {
    try {
      await fs.access(destPath);
      return { status: "skipped_exists" };
    } catch {
      // proceed
    }
  }

  if (dryRun) return { status: "dry_run" };

  const res = await fetch(sourceUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status}) for ${person.slug}: ${sourceUrl}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Non-image content-type for ${person.slug}: ${contentType || "(missing)"}`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, bytes);

  return { status: "downloaded", contentType, bytes: bytes.length };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const artistsData = await loadJson(path.join(dataDir, "artists.json"));
  const artists = Array.isArray(artistsData) ? artistsData : artistsData?.artists;
  let team = [];
  try {
    team = await loadJson(path.join(dataDir, "team.json"));
  } catch {
    team = [];
  }

  const people = collectPeople({ artists, team }).filter((person) => {
    if (!args.only.length) return true;
    return args.only.includes(person.slug);
  });

  const targets = people
    .map((person) => {
      const photo = person.photo || null;
      const sourceUrl = String(photo?.sourceUrl || "").trim();
      const destPath = assetDestFromPublicPath(photo?.path);
      return { person, photo, sourceUrl, destPath };
    })
    .filter((t) => t.sourceUrl && t.destPath);

  if (!targets.length) {
    console.log("No downloadable assets found (missing photo.sourceUrl or photo.path).");
    return;
  }

  for (const { person, sourceUrl, destPath } of targets) {
    process.stdout.write(`${person.slug} → ${path.relative(projectRoot, destPath)}\n`);
    const result = await downloadOne({ person, destPath, sourceUrl, force: args.force, dryRun: args.dryRun });
    if (result.status === "downloaded") {
      process.stdout.write(`  downloaded (${result.contentType}, ${result.bytes} bytes)\n`);
    } else if (result.status === "skipped_exists") {
      process.stdout.write("  skipped (exists)\n");
    } else if (result.status === "dry_run") {
      process.stdout.write("  dry-run\n");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
