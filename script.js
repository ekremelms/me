// Each segment is a piece of the full sentence.
//   revealAt : the stage at which the segment first appears (default 0)
//   linkAt   : the stage at which the segment is the clickable trigger
// Clicking the active link advances to the next stage, revealing the
// segments registered for it and moving the underline to the next word.
const SEGMENTS = [
  { text: "I’m a " },
  { text: "product ", revealAt: 1 },
  { text: "designer", linkAt: 0 },
  { text: " with ", revealAt: 1 },
  { text: "15 years of experience", revealAt: 1, linkAt: 1 },
  { text: " in building sleek, usable, and innovative ", revealAt: 2 },
  { text: "products", revealAt: 2, linkAt: 2 },
  { text: " such as V7, ClickUp, Qatalog, Lyssna, ", revealAt: 3 },
  { text: "and more", revealAt: 3, linkAt: 3 },
  { text: " with great people who enable ", revealAt: 4 },
  { text: "my design instincts", revealAt: 4, linkAt: 4 },
  {
    text: " to create profound 0→1 concepts, rapid prototypes, and scalable design patterns.",
    revealAt: 5,
  },
];

const root = document.getElementById("sentence");

// Single source of truth for timing — read straight from the CSS knobs.
const cssMs = (name) =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
const STAGGER = cssMs("--char-stagger");
const REVEAL = cssMs("--reveal-duration");
const SHIFT = cssMs("--shift-duration");
const UNDERLINE_LEAD = cssMs("--underline-lead");
// New text starts a touch before the glide fully settles, for a softer handoff.
const HANDOFF = Math.max(0, SHIFT - cssMs("--handoff-overlap"));

let stage = 0;

// Build a segment's DOM: words wrap as units, characters animate individually.
function buildSegment(seg) {
  const el = document.createElement("span");
  el.className = "segment";
  if (seg.revealAt) el.dataset.revealAt = seg.revealAt;
  if (seg.linkAt !== undefined) el.dataset.linkAt = seg.linkAt;

  // Split into words + whitespace, keep whitespace as plain text for wrapping.
  // Per-char delays are assigned at reveal time so a stage's stagger flows
  // continuously across all of its segments, not restarting per segment.
  const tokens = seg.text.split(/(\s+)/);
  for (const token of tokens) {
    if (token === "") continue;
    if (/^\s+$/.test(token)) {
      el.appendChild(document.createTextNode(token));
      continue;
    }
    const word = document.createElement("span");
    word.className = "word";
    for (const ch of token) {
      const c = document.createElement("span");
      c.className = "char";
      c.textContent = ch;
      word.appendChild(c);
    }
    el.appendChild(word);
  }
  seg._el = el;
  el.style.display = "none"; // hidden until its stage; revealed with animation
  return el;
}

const revealed = new Set();
let underlineTimer = null;

// Mark the active trigger word as a clickable link, and clear any styling
// from the word that is no longer the link.
function setActiveLink() {
  SEGMENTS.forEach((seg) => {
    const isLink = seg.linkAt === stage;
    seg._el.classList.toggle("link", isLink);
    if (!isLink) seg._el.classList.remove("underline-in");
  });
}

// Reveal every segment that belongs to `s`, as one continuous left-to-right
// cascade. We can't animate out of display:none, so: show them, flush layout
// (commits the "chars at opacity 0" start state), then flip is-visible next
// frame. The link word sits at the end of each run, so its underline only
// fades in once the whole run has settled.
// `delayOffset` holds the cascade back until the FLIP glide has finished, so
// the existing words settle before the new text starts appearing.
function revealStage(s, delayOffset = 0) {
  const batch = SEGMENTS.filter(
    (seg) => (seg.revealAt || 0) === s && !revealed.has(seg)
  );
  if (!batch.length) return;

  let count = 0; // running char index across the whole batch
  batch.forEach((seg) => {
    seg._el.style.display = "";
    seg._el.querySelectorAll(".char").forEach((c) => {
      c.style.transitionDelay = delayOffset + count * STAGGER + "ms";
      count++;
    });
    revealed.add(seg);
  });

  void root.offsetWidth; // single reflow for the whole batch
  requestAnimationFrame(() =>
    batch.forEach((seg) => seg._el.classList.add("is-visible"))
  );

  const linkSeg = SEGMENTS.find((seg) => seg.linkAt === s);
  if (linkSeg) {
    underlineTimer = setTimeout(
      () => linkSeg._el.classList.add("underline-in"),
      Math.max(0, delayOffset + count * STAGGER + REVEAL - UNDERLINE_LEAD)
    );
  }
}

// FLIP: glide the already-visible words from where they were to where the
// reflow puts them, so the layout eases into place instead of snapping.
function advance() {
  if (stage >= 5) return;
  if (underlineTimer) clearTimeout(underlineTimer);

  // First: measure current positions (snap any in-flight glide to rest first
  // so we read true layout coordinates, not a mid-transition offset).
  const movers = [...root.querySelectorAll(".segment.is-visible .word")];
  movers.forEach((w) => {
    w.style.transition = "none";
    w.style.left = "0px";
    w.style.top = "0px";
  });
  const first = movers.map((w) => w.getBoundingClientRect());

  // Reveal the next stage — this is what reflows everything. When words are
  // gliding, hold the new text's cascade until the glide finishes.
  stage++;
  setActiveLink();
  revealStage(stage, movers.length ? HANDOFF : 0);

  if (!movers.length) return;

  // Invert: offset each word back to where it just was.
  movers.forEach((w, i) => {
    const a = first[i];
    const b = w.getBoundingClientRect();
    w.style.left = a.left - b.left + "px";
    w.style.top = a.top - b.top + "px";
  });

  // Play: release to the new positions on the next frame.
  void root.offsetWidth;
  requestAnimationFrame(() => {
    movers.forEach((w) => {
      // Keep opacity in the list so a company word's hover dim still eases
      // after it has glided (inline transition would otherwise override CSS).
      w.style.transition =
        "left var(--shift-duration) var(--ease), top var(--shift-duration) var(--ease), opacity 200ms ease";
      w.style.left = "0px";
      w.style.top = "0px";
    });
  });
}

root.addEventListener("click", (e) => {
  const seg = e.target.closest(".segment");
  if (seg && seg.classList.contains("link")) advance();
});

// Init
SEGMENTS.forEach((seg) => root.appendChild(buildSegment(seg)));
setActiveLink();
revealStage(0);

// ---- Cursor-following image on company hover --------------------------------
// Each company: a thumbnail shown on hover, and an optional URL opened on click.
const COMPANIES = {
  V7: { img: "images/v7.png", url: "https://www.v7labs.com/" },
  ClickUp: { img: "images/clickup.png", url: "https://clickup.com/" },
  Qatalog: { img: "images/qatalog.png", url: null },
  Lyssna: { img: "images/lyssna.png", url: "https://www.lyssna.com/" },
};

// Floating layer holding one (preloaded) image per company.
const media = document.createElement("div");
media.className = "hover-media";
media.setAttribute("aria-hidden", "true");
Object.entries(COMPANIES).forEach(([key, { img: src }]) => {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.dataset.key = key;
  media.appendChild(img);
});
document.body.appendChild(media);

// Tag the matching words (text minus punctuation, e.g. "ClickUp," -> "ClickUp").
root.querySelectorAll(".word").forEach((w) => {
  const key = w.textContent.replace(/[^A-Za-z0-9]/g, "");
  if (!COMPANIES[key]) return;
  w.classList.add("company");
  w.dataset.company = key;
  w.addEventListener("mouseenter", () => setActiveCompany(key));
  w.addEventListener("mouseleave", () => setActiveCompany(null));
  const { url } = COMPANIES[key];
  if (url) w.addEventListener("click", () => window.open(url, "_blank", "noopener"));
});

let activeCompany = null;
function setActiveCompany(key) {
  activeCompany = key;
  media.querySelectorAll("img").forEach((im) => {
    const on = im.dataset.key === key;
    im.classList.toggle("is-shown", on);
    // size the box to this image's aspect ratio so it isn't cropped
    if (on && im.naturalWidth) {
      media.style.height =
        Math.round(media.offsetWidth * (im.naturalHeight / im.naturalWidth)) + "px";
    }
  });
}

// Eased follow: the image trails the cursor and tilts with horizontal speed,
// so it visibly shifts as the mouse moves.
let targetX = window.innerWidth / 2;
let targetY = window.innerHeight / 2;
let curX = targetX;
let curY = targetY;
let lastX = curX;

window.addEventListener("mousemove", (e) => {
  targetX = e.clientX;
  targetY = e.clientY;
});

function followFrame() {
  curX += (targetX - curX) * 0.15;
  curY += (targetY - curY) * 0.15;
  const velocity = curX - lastX;
  lastX = curX;
  const tilt = Math.max(-12, Math.min(12, velocity * 0.6));
  // Tooltip-style: the image's bottom-right corner sits just up-left of the
  // cursor (translate(-100%,-100%)), with a small gap, and tilts with speed.
  const gap = 14;
  media.style.transform = `translate(${curX - gap}px, ${curY - gap}px) translate(-100%, -100%) rotate(${tilt}deg)`;
  requestAnimationFrame(followFrame);
}
requestAnimationFrame(followFrame);

// ---- Intro <-> blog-post view ----------------------------------------------
const post = document.getElementById("post");

function showPost() {
  document.body.classList.add("show-post");
  post.setAttribute("aria-hidden", "false");
  post.scrollTop = 0;
  setActiveCompany(null); // drop any hover image when leaving the intro
}

function showIntro() {
  document.body.classList.remove("show-post");
  post.setAttribute("aria-hidden", "true");
}

document.getElementById("learnMore").addEventListener("click", showPost);
document.getElementById("postClose").addEventListener("click", showIntro);
document.getElementById("logo").addEventListener("click", () => location.reload());
