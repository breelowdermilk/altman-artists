import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const projectRoot = path.resolve(process.cwd());
const srcDir = path.join(projectRoot, "src");
const peopleDir = path.join(srcDir, "assets", "people");

function usage() {
  return [
    "Usage:",
    "  node scripts/import-headshot.mjs --src <path> --slug <kebab-case> [options]",
    "",
    "Options:",
    "  --width <px>          Output width (default: 1200)",
    "  --height <px>         Output height (default: 1500)",
    "  --aspect <w:h>        Crop aspect ratio (default: 4:5)",
    "  --format <ext>        Output format: jpg|png (default: jpg)",
    "  --quality <0-100>     JPEG quality percent via sips formatOptions (default: 85)",
    "  --force               Overwrite existing output",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    src: "",
    slug: "",
    width: 1200,
    height: 1500,
    aspect: "4:5",
    format: "jpg",
    quality: 85,
    force: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--src") args.src = String(argv[++i] || "");
    else if (arg === "--slug") args.slug = String(argv[++i] || "");
    else if (arg === "--width") args.width = Number(argv[++i]);
    else if (arg === "--height") args.height = Number(argv[++i]);
    else if (arg === "--aspect") args.aspect = String(argv[++i] || "");
    else if (arg === "--format") args.format = String(argv[++i] || "");
    else if (arg === "--quality") args.quality = Number(argv[++i]);
    else throw new Error(`Unknown arg: ${arg}`);
  }

  return args;
}

function assertKebabCase(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Slug must be kebab-case (a-z0-9-): '${slug}'`);
  }
}

function parseAspect(value) {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid aspect ratio '${value}' (expected W:H like 4:5)`);
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(`Invalid aspect ratio '${value}'`);
  }
  return w / h;
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  if (res.status !== 0) {
    const err = res.stderr?.trim() || res.stdout?.trim() || `Exit ${res.status}`;
    throw new Error(`${cmd} failed: ${err}`);
  }
  return res.stdout || "";
}

function getImageSize(filePath) {
  const out = run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", "-1", filePath]);
  const widthMatch = /pixelWidth:\s*(\d+)/.exec(out);
  const heightMatch = /pixelHeight:\s*(\d+)/.exec(out);
  if (!widthMatch || !heightMatch) {
    throw new Error(`Could not read image size via sips: ${filePath}`);
  }
  return { width: Number(widthMatch[1]), height: Number(heightMatch[1]) };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  if (!args.src || !args.slug) {
    throw new Error(`Missing required args.\n\n${usage()}`);
  }

  assertKebabCase(args.slug);

  const format = args.format.toLowerCase();
  if (!["jpg", "jpeg", "png"].includes(format)) {
    throw new Error(`Unsupported --format '${args.format}' (use jpg or png)`);
  }

  const outExt = format === "jpeg" ? "jpg" : format;
  const outputWidth = Number(args.width);
  const outputHeight = Number(args.height);
  if (!Number.isFinite(outputWidth) || !Number.isFinite(outputHeight) || outputWidth <= 0 || outputHeight <= 0) {
    throw new Error(`Invalid --width/--height`);
  }

  const quality = Math.max(0, Math.min(100, Number(args.quality)));
  const targetAspect = parseAspect(args.aspect);

  const srcPath = path.resolve(projectRoot, args.src);
  await fs.access(srcPath);

  const destPath = path.join(peopleDir, `${args.slug}.${outExt}`);
  await fs.mkdir(path.dirname(destPath), { recursive: true });

  if (!args.force) {
    try {
      await fs.access(destPath);
      throw new Error(`Output already exists: ${path.relative(projectRoot, destPath)} (use --force to overwrite)`);
    } catch {
      // proceed
    }
  }

  const { width: inputWidth, height: inputHeight } = getImageSize(srcPath);
  const inputAspect = inputWidth / inputHeight;

  let cropWidth = inputWidth;
  let cropHeight = inputHeight;
  if (inputAspect > targetAspect) {
    cropWidth = Math.floor(inputHeight * targetAspect);
    cropHeight = inputHeight;
  } else if (inputAspect < targetAspect) {
    cropWidth = inputWidth;
    cropHeight = Math.floor(inputWidth / targetAspect);
  }

  cropWidth = Math.max(1, Math.min(inputWidth, cropWidth));
  cropHeight = Math.max(1, Math.min(inputHeight, cropHeight));

  const offsetX = Math.max(0, Math.floor((inputWidth - cropWidth) / 2));
  const offsetY = Math.max(0, Math.floor((inputHeight - cropHeight) / 2));

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "opera-headshot-"));
  try {
    const croppedPath = path.join(tmpDir, `cropped.${outExt}`);
    const resizedPath = path.join(tmpDir, `resized.${outExt}`);

    run("sips", [
      "-c",
      String(cropHeight),
      String(cropWidth),
      "--cropOffset",
      String(offsetY),
      String(offsetX),
      srcPath,
      "-o",
      croppedPath,
    ]);

    const sipsResizeArgs = ["-z", String(outputHeight), String(outputWidth), croppedPath];
    if (outExt === "jpg") {
      sipsResizeArgs.push("-s", "formatOptions", String(Math.round(quality)));
    }
    sipsResizeArgs.push("-o", resizedPath);
    run("sips", sipsResizeArgs);

    await fs.copyFile(resizedPath, destPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  process.stdout.write(`Wrote ${path.relative(projectRoot, destPath)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

