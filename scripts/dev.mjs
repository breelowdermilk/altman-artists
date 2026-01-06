import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "./build.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "..", "dist");
const projectDir = path.resolve(__dirname, "..");
const watchRoots = [path.join(projectDir, "data"), path.join(projectDir, "src"), path.join(projectDir, "scripts")];

const port = Number(process.env.PORT || 5173);

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
]);

function toFilePath(urlPath) {
  const clean = urlPath.split("?")[0].split("#")[0];
  const decoded = decodeURIComponent(clean);
  const normalized = path.posix.normalize(decoded);
  if (normalized.includes("..")) return null;
  if (normalized === "/") return path.join(distDir, "index.html");
  if (normalized.endsWith("/")) return path.join(distDir, normalized, "index.html");
  return path.join(distDir, normalized);
}

const clients = new Set();
function broadcastReload() {
  const payload = `event: reload\ndata: ${Date.now()}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

let rebuildTimer = null;
let rebuilding = false;
async function scheduleRebuild(reason) {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(async () => {
    if (rebuilding) return;
    rebuilding = true;
    try {
      await buildSite();
      // eslint-disable-next-line no-console
      console.log(`Rebuilt (${reason})`);
      broadcastReload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Rebuild failed:", err);
    } finally {
      rebuilding = false;
    }
  }, 120);
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url || "/";

  if (urlPath.startsWith("/__reload")) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write("retry: 500\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  const filePath = toFilePath(urlPath);
  if (!filePath) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME.get(ext) || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch {
    try {
      const notFound = await fs.readFile(path.join(distDir, "404.html"));
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(notFound);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  }
});

server.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Dev server error:", err);
  process.exitCode = 1;
});

server.listen({ port, host: "127.0.0.1" }, () => {
  // eslint-disable-next-line no-console
  console.log(`Serving ${distDir} on http://127.0.0.1:${port}`);
});

async function listFilesRecursive(dir) {
  const out = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...(await listFilesRecursive(p)));
      else out.push(p);
    }
  } catch {
    // ignore
  }
  return out;
}

async function computeWatchState() {
  const roots = await Promise.all(watchRoots.map((r) => listFilesRecursive(r)));
  const files = roots.flat().filter((f) => !f.endsWith(".DS_Store"));
  const state = new Map();

  await Promise.all(
    files.map(async (file) => {
      try {
        const st = await fs.stat(file);
        state.set(file, st.mtimeMs);
      } catch {
        // ignore
      }
    })
  );

  return state;
}

async function main() {
  await buildSite();

  let prev = await computeWatchState();
  setInterval(async () => {
    const next = await computeWatchState();
    if (next.size !== prev.size) {
      prev = next;
      scheduleRebuild("files-changed");
      return;
    }
    for (const [file, mtime] of next) {
      if (prev.get(file) !== mtime) {
        prev = next;
        scheduleRebuild(path.relative(projectDir, file));
        return;
      }
    }
  }, 650);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
