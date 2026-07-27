#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INBOX = path.join(ROOT, "assets/photos/inbox");
const WEB = path.join(ROOT, "assets/photos/web");
const GALLERY_PATH = path.join(ROOT, "assets/photos/gallery.json");
const PAGE_PATH = path.join(ROOT, "photography.html");
const MAX_EDGE = 2560;
const SIZES = ["full", "left", "inset", "full", "right", "inset"];
const IMAGE_RE = /\.(jpe?g|png|webp|tif|tiff|heic)$/i;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function which(bin) {
  try {
    return execFileSync("which", [bin], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const magick = which("magick");
if (!magick) die("ImageMagick (`magick`) not found. Install it first.");

mkdirSync(INBOX, { recursive: true });
mkdirSync(WEB, { recursive: true });

function identify(file, format) {
  try {
    return execFileSync(
      magick,
      ["identify", "-quiet", "-format", format, file],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
  } catch {
    return "";
  }
}

function convert(src, dest) {
  execFileSync(
    magick,
    [
      src,
      "-auto-orient",
      `-resize`,
      `${MAX_EDGE}x${MAX_EDGE}>`,
      "-strip",
      "-interlace",
      "Plane",
      "-quality",
      "82",
      dest,
    ],
    { stdio: "inherit" }
  );
}

function formatDate(raw) {
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!m) return "";
  const month = MONTHS[Number(m[2]) - 1] || m[2];
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

function isoDate(raw) {
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function formatCamera(make, model) {
  const cleaned = (model || "")
    .replace(/^NIKON\s+/i, "Nikon ")
    .replace(/^FUJIFILM\s+/i, "Fujifilm ")
    .replace(/^Canon\s+/i, "Canon ")
    .trim();
  if (cleaned) return cleaned;
  return (make || "").trim();
}

function parseRational(raw) {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const den = Number(m[2]);
    if (!den) return null;
    return Number(m[1]) / den;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formatAperture(raw) {
  const n = parseRational(raw);
  if (n == null || n <= 0) return "";
  const rounded = Math.round(n * 10) / 10;
  return `f/${Number.isInteger(rounded) ? rounded : rounded}`;
}

function formatShutter(raw) {
  const n = parseRational(raw);
  if (n == null || n <= 0) return "";
  if (n >= 1) {
    const rounded = Math.round(n * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded}s`;
  }
  const denom = Math.round(1 / n);
  return denom > 0 ? `1/${denom}` : "";
}

function formatIso(raw) {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return "";
  return `ISO ${Math.round(n)}`;
}

function formatFocal(raw) {
  const n = parseRational(raw);
  if (n == null || n <= 0) return "";
  const rounded = Math.round(n);
  return `${rounded}mm`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadGallery() {
  if (!existsSync(GALLERY_PATH)) return { photos: [] };
  return JSON.parse(readFileSync(GALLERY_PATH, "utf8"));
}

const gallery = loadGallery();
const byId = new Map(gallery.photos.map((p) => [p.id, p]));

const inboxFiles = existsSync(INBOX)
  ? readdirSync(INBOX).filter((f) => IMAGE_RE.test(f) && !f.startsWith("."))
  : [];

let converted = 0;
for (const name of inboxFiles) {
  const id = path.parse(name).name;
  const src = path.join(INBOX, name);
  const dest = path.join(WEB, `${id}.jpg`);
  const needs =
    !existsSync(dest) || statSync(src).mtimeMs > statSync(dest).mtimeMs;
  if (needs) {
    console.log(`convert  ${name}`);
    convert(src, dest);
    converted += 1;
  }
}

const webFiles = readdirSync(WEB)
  .filter((f) => /\.jpg$/i.test(f) && !f.startsWith("."))
  .sort();

if (!webFiles.length) {
  die(`No photos in ${path.relative(ROOT, WEB)}. Drop files into assets/photos/inbox/ first.`);
}

const built = new Map();
for (const file of webFiles) {
  const id = path.parse(file).name;
  const webPath = path.join(WEB, file);
  const inboxMatch = inboxFiles.find(
    (f) => path.parse(f).name.toLowerCase() === id.toLowerCase()
  );
  const metaSrc = inboxMatch ? path.join(INBOX, inboxMatch) : webPath;

  const webDims = identify(webPath, "%w %h").split(/\s+/);
  const dateRaw = identify(metaSrc, "%[EXIF:DateTimeOriginal]");
  const make = identify(metaSrc, "%[EXIF:Make]");
  const model = identify(metaSrc, "%[EXIF:Model]");
  const aperture = formatAperture(identify(metaSrc, "%[EXIF:FNumber]"));
  const shutter = formatShutter(identify(metaSrc, "%[EXIF:ExposureTime]"));
  const iso = formatIso(identify(metaSrc, "%[EXIF:PhotographicSensitivity]"));
  const focal = formatFocal(identify(metaSrc, "%[EXIF:FocalLength]"));

  const prev = byId.get(id) || {};
  const width = Number(webDims[0]) || 0;
  const height = Number(webDims[1]) || 0;
  const portrait = height > width;

  built.set(id, {
    id,
    title: prev.title || "Untitled",
    alt: prev.alt || "Photograph",
    location: prev.location || "",
    size: prev.size || "",
    date: formatDate(dateRaw),
    taken: isoDate(dateRaw),
    camera: formatCamera(make, model),
    aperture,
    shutter,
    iso,
    focal,
    width,
    height,
    sortKey: dateRaw || id,
    portrait,
  });
}

const entries = [];
for (const prev of gallery.photos) {
  if (built.has(prev.id)) entries.push(built.get(prev.id));
}
const known = new Set(entries.map((p) => p.id));
const newcomers = [...built.values()]
  .filter((p) => !known.has(p.id))
  .sort((a, b) => {
    if (a.sortKey < b.sortKey) return -1;
    if (a.sortKey > b.sortKey) return 1;
    return a.id.localeCompare(b.id);
  });
for (const photo of newcomers) entries.push(photo);

entries.forEach((photo, index) => {
  if (!photo.size) {
    photo.size = photo.portrait ? "left" : SIZES[index % SIZES.length];
  }
});

const saved = {
  photos: entries.map(({ id, title, alt, location, size }) => ({
    id,
    title,
    alt,
    location,
    size,
  })),
};
writeFileSync(GALLERY_PATH, JSON.stringify(saved, null, 2) + "\n");

function contextLine(photo) {
  return [photo.date, photo.camera, photo.location].filter(Boolean).join(" · ");
}

function techLine(photo) {
  return [photo.aperture, photo.shutter, photo.iso, photo.focal]
    .filter(Boolean)
    .join(" · ");
}

function figureHtml(photo, eager, index) {
  const src = `assets/photos/web/${photo.id}.jpg`;
  const context = contextLine(photo);
  const tech = techLine(photo);
  const hasTitle = photo.title && photo.title !== "Untitled";
  const label = hasTitle ? `Enlarge: ${photo.title}` : "Enlarge photograph";
  const titleHtml = hasTitle
    ? `<span class="caption-title">${escapeHtml(photo.title)}</span>`
    : "";
  const contextHtml = context
    ? `<span class="caption-context">${escapeHtml(context)}</span>`
    : "";
  const techHtml = tech
    ? `<span class="caption-tech">${escapeHtml(tech)}</span>`
    : "";
  let tile = "land";
  if (photo.portrait) tile = "portrait";
  else if (index % 3 === 1) tile = "tall";
  const takenAttr = photo.taken
    ? ` data-taken="${escapeHtml(photo.taken)}"`
    : "";
  return `        <figure class="photo-figure" data-size="${escapeHtml(photo.size)}" data-tile="${tile}"${takenAttr}>
          <button
            type="button"
            class="photo-button"
            aria-label="${escapeHtml(label)}"
          >
            <img
              src="${escapeHtml(src)}"
              alt="${escapeHtml(photo.alt)}"
              width="${photo.width}"
              height="${photo.height}"
              loading="${eager ? "eager" : "lazy"}"
              decoding="async"
            />
          </button>
          <figcaption class="photo-caption">
            ${titleHtml}
            ${contextHtml}
            ${techHtml}
          </figcaption>
        </figure>`;
}

const first = entries[0];
const figures = entries
  .map((p, i) => figureHtml(p, i === 0, i))
  .join("\n\n");

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Photography — Samir Mohammed</title>
    <meta
      name="description"
      content="Photographs by Samir Mohammed — landscapes and places."
    />
    <link rel="icon" href="favicon.ico" sizes="any" />
    <link rel="stylesheet" href="assets/styles.css" />
    <link rel="stylesheet" href="assets/photography.css" />
    <script src="assets/vercel-insights.js" defer></script>
    <script src="assets/photography.js" defer></script>
  </head>
  <body class="page-photography" data-view="masonry">
    <main>
      <header class="photo-header">
        <div class="photo-header-top">
          <a class="home-link" href="index.html">Home</a>
          <div class="gallery-controls">
            <div class="sort-toggle" role="group" aria-label="Sort photographs">
              <button type="button" data-sort="newest" aria-pressed="true">Newest</button>
              <button type="button" data-sort="oldest" aria-pressed="false">Oldest</button>
              <button type="button" data-sort="shuffle" aria-pressed="false">Shuffle</button>
            </div>
            <div class="view-toggle" role="group" aria-label="Gallery layout">
              <button type="button" data-view="masonry" aria-pressed="true" aria-label="Masonry layout" title="Masonry">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="1" y="1" width="6" height="9" rx="0.5" />
                  <rect x="9" y="1" width="6" height="5" rx="0.5" />
                  <rect x="9" y="8" width="6" height="7" rx="0.5" />
                  <rect x="1" y="12" width="6" height="3" rx="0.5" />
                </svg>
              </button>
              <button type="button" data-view="grid" aria-pressed="false" aria-label="Grid layout" title="Grid">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="1" y="1" width="6" height="6" rx="0.5" />
                  <rect x="9" y="1" width="6" height="6" rx="0.5" />
                  <rect x="1" y="9" width="6" height="6" rx="0.5" />
                  <rect x="9" y="9" width="6" height="6" rx="0.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <h1>Photography</h1>
        <p class="lede">A small set of places, held in the light that found them.</p>
      </header>

      <section class="photo-gallery" aria-label="Photograph gallery">
${figures}
      </section>
    </main>

    <div
      id="lightbox"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      aria-hidden="true"
      aria-label="Enlarged photograph"
    >
      <button
        type="button"
        id="lightbox-close"
        class="lightbox-close"
        aria-label="Close"
      >
        ×
      </button>
      <button
        type="button"
        id="lightbox-prev"
        class="lightbox-nav lightbox-prev"
        aria-label="Previous photograph"
      >
        ‹
      </button>
      <button
        type="button"
        id="lightbox-next"
        class="lightbox-nav lightbox-next"
        aria-label="Next photograph"
      >
        ›
      </button>
      <div class="lightbox-inner">
        <img
          id="lightbox-image"
          src="assets/photos/web/${escapeHtml(first.id)}.jpg"
          alt=""
          width="${first.width}"
          height="${first.height}"
        />
        <p id="lightbox-caption" class="lightbox-caption"></p>
      </div>
    </div>
  </body>
</html>
`;

writeFileSync(PAGE_PATH, html);
console.log(
  `done     ${entries.length} photos in gallery (${converted} newly converted)`
);
console.log(`edit     assets/photos/gallery.json to change titles / locations / sizes`);
console.log(`then     run this script again to refresh photography.html`);
