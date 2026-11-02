import { inject, pageview } from "@vercel/analytics";
import { loadCached, loadLatest } from "./db.js";

inject();

const KINDS = ["group", "teacher", "room"];
const SECTION_LIMIT = 6;
const SPLASH_MIN_MS = 1200;

const TEXT = {
  ka: {
    title: "Uni Hub",
    searchPlaceholder: "ჯგუფი, ლექტორი ან აუდიტორია",
    offline: "ოფლაინ",
    retry: "ხელახლა ცდა",
    back: "უკან",
    addToHome: "დაამატე მთავარ ეკრანზე",
    sheetTitle: "Uni Hub შენს ეკრანზე",
    sheetText: "ცხრილი ერთი შეხებით გაიხსნება და ინტერნეტის გარეშეც იმუშავებს.",
    gotIt: "გასაგებია",
    group: "ჯგუფი", teacher: "ლექტორი", room: "აუდიტორია",
    groups: "ჯგუფები", teachers: "ლექტორები", rooms: "აუდიტორიები",
    favorites: "რჩეულები",
    addFavorite: "რჩეულებში დამატება",
    removeFavorite: "რჩეულებიდან წაშლა",
    favoriteAdded: "დაემატა რჩეულებში",
    favoriteRemoved: "წაიშალა რჩეულებიდან",
    noResults: "ვერაფერი მოიძებნა",
    showMore: (n) => `კიდევ ${n}`,
    free: "ამ დღეს მეცადინეობა არ არის",
    lessons: (n) => `${n} მეცადინეობა`,
    week: (w) => `${w} კვირის ცხრილი`,
    building: (b) => `${b} კორპუსი`,
    with: "ერთად",
    subgroup: "ქვეჯგუფი",
    now: "ახლა",
    firstLoadOffline: "ცხრილის პირველად ჩასატვირთად საჭიროა ინტერნეტი. შემდეგ ის ოფლაინაც იმუშავებს.",
    loadFailed: "ცხრილი ვერ ჩაიტვირთა.",
    updated: (w) => `ცხრილი განახლდა: ${w} კვირა`,
    showingSaved: "ინტერნეტი არ არის — ნაჩვენებია შენახული ცხრილი.",
    notFound: "ეს ჩანაწერი ამ კვირის ცხრილში არ არის.",
    stepsIos: [
      `დააჭირე <b>გაზიარების</b> ღილაკს ${"{share}"} ბრაუზერის პანელში`,
      `აირჩიე <b>Add to Home Screen</b> (მთავარ ეკრანზე დამატება) ${"{plus}"}`,
      `დააჭირე <b>Add</b>-ს — Uni Hub გამოჩნდება შენს ეკრანზე`,
    ],
    stepsAndroid: [
      `დააჭირე მენიუს ${"{dots}"} ბრაუზერის ზედა მარჯვენა კუთხეში`,
      `აირჩიე <b>Add to Home screen</b> ან <b>Install app</b>`,
      `დაადასტურე — Uni Hub გამოჩნდება შენს ეკრანზე`,
    ],
    daysShort: ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"],
    types: { lecture: "ლექცია", practical: "პრაქტიკული", lab: "ლაბორატორიული", seminar: "სემინარი", coursework: "საკურსო", practice: "პრაქტიკა" },
  },
  en: {
    title: "Uni Hub",
    searchPlaceholder: "Group, teacher or room",
    offline: "Offline",
    retry: "Try again",
    back: "Back",
    addToHome: "Add to Home Screen",
    sheetTitle: "Uni Hub on your home screen",
    sheetText: "Open the timetable with one tap — it works without internet too.",
    gotIt: "Got it",
    group: "Group", teacher: "Teacher", room: "Room",
    groups: "Groups", teachers: "Teachers", rooms: "Rooms",
    favorites: "Favorites",
    addFavorite: "Add to favorites",
    removeFavorite: "Remove from favorites",
    favoriteAdded: "Added to favorites",
    favoriteRemoved: "Removed from favorites",
    noResults: "Nothing found",
    showMore: (n) => `${n} more`,
    free: "No lessons this day",
    lessons: (n) => `${n} lesson${n === 1 ? "" : "s"}`,
    week: (w) => `Week ${w} timetable`,
    building: (b) => `Building ${b}`,
    with: "With",
    subgroup: "Subgroup",
    now: "Now",
    firstLoadOffline: "The timetable needs an internet connection the first time. After that it works offline.",
    loadFailed: "Could not load the timetable.",
    updated: (w) => `Timetable updated: week ${w}`,
    showingSaved: "No connection — showing the saved timetable.",
    notFound: "This entry is not in this week's timetable.",
    stepsIos: [
      `Tap the <b>Share</b> button {share} in the browser bar`,
      `Choose <b>Add to Home Screen</b> {plus}`,
      `Tap <b>Add</b> — Uni Hub appears on your home screen`,
    ],
    stepsAndroid: [
      `Tap the menu {dots} in the top right corner of the browser`,
      `Choose <b>Add to Home screen</b> or <b>Install app</b>`,
      `Confirm — Uni Hub appears on your home screen`,
    ],
    daysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    types: { lecture: "Lecture", practical: "Practical", lab: "Lab", seminar: "Seminar", coursework: "Course work", practice: "Practice" },
  },
};

// Stroke icons in the style of the Uni Hub icon set (16/24px, 1.5px stroke).
const ICON = {
  group: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.5" cy="9" r="2.5"/><path d="M15.5 14.2c2.4-.3 4.4 1.2 5 4.3"/></svg>',
  teacher: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/></svg>',
  room: '<svg viewBox="0 0 16 16"><path d="M8 8.95A2.08 2.08 0 1 0 8 4.8a2.08 2.08 0 0 0 0 4.15Z"/><path d="M2.41 5.66C3.73-.11 12.28-.1 13.59 5.67c.76 3.38-1.34 6.25-3.19 8.02a3.47 3.47 0 0 1-4.81 0C3.75 11.92 1.65 9.05 2.41 5.66Z"/></svg>',
  book: '<svg viewBox="0 0 16 16"><path d="M14.67 11.16V3.11c0-.8-.66-1.39-1.45-1.32h-.04c-1.4.12-3.53.83-4.72 1.58l-.11.07a.68.68 0 0 1-.71 0l-.16-.1C6.29 2.6 4.17 1.89 2.77 1.78c-.79-.07-1.44.53-1.44 1.33v8.05c0 .64.52 1.24 1.16 1.32l.19.03c1.45.19 3.68.92 4.96 1.62l.03.02c.18.1.47.1.64 0 1.28-.7 3.52-1.44 4.97-1.64l.22-.03c.64-.08 1.16-.68 1.16-1.32Z"/><path d="M8 3.66v10"/></svg>',
  clock: '<svg viewBox="0 0 16 16"><path d="M14.67 8A6.67 6.67 0 1 1 1.33 8a6.67 6.67 0 0 1 13.34 0Z"/><path d="m10.47 10.12-2.06-1.23c-.36-.22-.66-.73-.66-1.15V5"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></svg>',
};

const ROMAN = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function roman(n) {
  let out = "";
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}

const $ = (id) => document.getElementById(id);

const storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

const state = {
  tt: null,
  info: null,
  index: [],
  lang: storage.get("gtu.lang", "ka") === "en" ? "en" : "ka",
  selected: null, // { kind, item, lessons }
  day: 1,
  expanded: new Set(),
  page: null,
};

const t = (key, ...args) => {
  const v = TEXT[state.lang][key];
  return typeof v === "function" ? v(...args) : v;
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const href = (kind, name) => `#/${kind}/${encodeURIComponent(name)}`;
const norm = (s) => String(s ?? "").toLocaleLowerCase().replace(/\s+/g, " ").trim();

function todayId() {
  const d = new Date().getDay(); // 0 = Sunday
  return d >= 1 && d <= 6 ? d : null;
}

// Dates of this week's Monday..Saturday; on Sunday, next week's (as in Uni Hub).
function weekDates() {
  const now = new Date();
  const start = new Date(now);
  if (now.getDay() === 0) start.setDate(start.getDate() + 1);
  const monday = new Date(start);
  monday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// The source mixes Georgian, English and Russian activity types; map them to one kind.
const TYPE_PATTERNS = [
  ["lecture", /ლექც|lect|лекц/],
  ["lab", /ლაბ|lab|лаб/],
  ["seminar", /სემინ|semin|семин/],
  ["coursework", /საკურს|course|курс/],
  ["practical", /პრაქტიკულ|practical|практическ/],
  ["practice", /პრაქტიკა|practice|практика|training|საველე/],
];
function typeKind(type) {
  const s = norm(type);
  return TYPE_PATTERNS.find(([, re]) => re.test(s))?.[0] ?? null;
}
const typeLabel = (type) => TEXT[state.lang].types[typeKind(type)] ?? type;

// Uni Hub colours: lecture = purple, practical = teal, everything else = orange.
function typeClass(type) {
  const kind = typeKind(type);
  return kind === "lecture" || kind === "practical" ? kind : "other";
}

// Teacher names may hold a Georgian, a Latin and a Cyrillic spelling at once
// ("ესაძე სერგო Esadze Sergo"); show only the one for the chosen language.
const GEORGIAN = /[Ⴀ-ჿᲐ-Ჿ]/;
const CYRILLIC = /[Ѐ-ӿ]/;
const LATIN = /[A-Za-z]/;
const TRANSLIT = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t", ი: "i", კ: "k", ლ: "l",
  მ: "m", ნ: "n", ო: "o", პ: "p", ჟ: "zh", რ: "r", ს: "s", ტ: "t", უ: "u", ფ: "p", ქ: "k",
  ღ: "gh", ყ: "q", შ: "sh", ჩ: "ch", ც: "ts", ძ: "dz", წ: "ts", ჭ: "ch", ხ: "kh", ჯ: "j", ჰ: "h",
};
function transliterate(text) {
  return text.replace(/[ა-ჰ]/g, (c) => TRANSLIT[c] ?? c)
    .replace(/(^|[\s-])([a-z])/g, (_, p, c) => p + c.toUpperCase());
}
function spellings(name) {
  const words = String(name ?? "").split(/\s+/).filter(Boolean);
  const ka = words.filter((w) => GEORGIAN.test(w)).join(" ");
  const en = words.filter((w) => LATIN.test(w) && !GEORGIAN.test(w) && !CYRILLIC.test(w)).join(" ");
  return { ka, en: en || (ka && transliterate(ka)) };
}
function personName(name) {
  const s = spellings(name);
  return (state.lang === "en" ? s.en : s.ka) || s.ka || s.en || name;
}
const displayName = (kind, name) => (kind === "teacher" ? personName(name) : name);

function toast(message, ms = 3500) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------------------------------------------------------------- pages

function showPage(id) {
  state.page = id;
  for (const p of ["search-page", "week-page", "error-page"]) $(p).hidden = p !== id;
  updateA2hs();
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
}

const splashStart = performance.now();
let splashHidden = false;
async function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;
  const wait = SPLASH_MIN_MS - (performance.now() - splashStart);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  $("splash").classList.add("done");
}

// ---------------------------------------------------------------- language

function applyLanguage() {
  document.documentElement.lang = state.lang;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) el.placeholder = t(el.dataset.i18nPlaceholder);
  $("lang").textContent = state.lang === "ka" ? "EN" : "KA";
  if (state.tt) render();
}

// ---------------------------------------------------------------- search

function buildIndex(tt) {
  const index = [];
  for (const kind of KINDS) {
    for (const item of tt.lists[kind]) {
      const name = norm(item.name);
      const extra = kind === "group" ? norm(item.program)
        : kind === "room" ? norm(item.building)
        : norm(spellings(item.name).en); // so "iashvili" finds იაშვილი
      index.push({ kind, item, name, hay: `${name} ${extra}` });
    }
  }
  return index;
}

function rank(entry, q, words) {
  if (!words.every((w) => entry.hay.includes(w))) return -1;
  if (entry.name === q) return 0;
  if (entry.name.startsWith(q)) return 1;
  if (entry.hay.split(/[\s-]/).some((p) => p.startsWith(words[0]))) return 2;
  return entry.name.includes(q) ? 3 : 4;
}

function subtitle(kind, item) {
  if (kind === "group") return item.program || t("lessons", item.lessons);
  if (kind === "room") return [item.building && t("building", item.building), t("lessons", item.lessons)].filter(Boolean).join(" · ");
  return t("lessons", item.lessons);
}

function itemRow(kind, item) {
  return `
    <a class="item k-${kind}" href="${esc(href(kind, item.name))}">
      <span class="bubble">${ICON[kind]}</span>
      <span class="text">
        <span class="name">${esc(displayName(kind, item.name))}</span>
        <span class="sub">${esc(subtitle(kind, item))}</span>
      </span>
      <svg class="chev" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>
    </a>`;
}

function renderResults() {
  const q = norm($("q").value);
  const out = $("results");
  if (!q) {
    // Favorites that are in this week's data; others stay saved for later weeks.
    const favs = favorites()
      .map((f) => ({ kind: f.kind, item: state.tt.find(f.kind, f.name) }))
      .filter((f) => f.item);
    out.innerHTML = favs.length
      ? `<div class="section-title">${esc(t("favorites"))} <span>${favs.length}</span></div>${favs.map((f) => itemRow(f.kind, f.item)).join("")}`
      : "";
    return;
  }

  const words = q.split(" ");
  const sections = Object.fromEntries(KINDS.map((k) => [k, []]));
  for (const entry of state.index) {
    const r = rank(entry, q, words);
    if (r >= 0) sections[entry.kind].push([r, entry.item]);
  }
  const ordered = KINDS
    .filter((k) => sections[k].length)
    .map((k) => {
      sections[k].sort((a, b) => a[0] - b[0] || b[1].lessons - a[1].lessons || a[1].name.localeCompare(b[1].name, "ka"));
      return [k, sections[k]];
    })
    .sort((a, b) => a[1][0][0] - b[1][0][0]); // section with the best match first

  if (!ordered.length) {
    out.innerHTML = `<p class="empty">${esc(t("noResults"))}</p>`;
    return;
  }
  out.innerHTML = ordered.map(([kind, list]) => {
    const shown = state.expanded.has(kind) ? list : list.slice(0, SECTION_LIMIT);
    const rest = list.length - shown.length;
    return `
      <div class="section-title">${esc(t(`${kind}s`))} <span>${list.length}</span></div>
      ${shown.map(([, item]) => itemRow(kind, item)).join("")}
      ${rest > 0 ? `<button class="more" type="button" data-more="${kind}">${esc(t("showMore", rest))}</button>` : ""}`;
  }).join("");
}

// ---------------------------------------------------------------- favorites

// Stored by kind and name (ids change with every data import), newest first.
const favorites = () => storage.get("gtu.favorites", []);
const isFavorite = (kind, name) => favorites().some((f) => f.kind === kind && f.name === name);

function toggleFavorite() {
  const { kind, item } = state.selected;
  const rest = favorites().filter((f) => !(f.kind === kind && f.name === item.name));
  const adding = rest.length === favorites().length;
  storage.set("gtu.favorites", adding ? [{ kind, name: item.name }, ...rest] : rest);
  renderFavoriteButton();
  toast(t(adding ? "favoriteAdded" : "favoriteRemoved"), 2000);
}

function renderFavoriteButton() {
  const { kind, item } = state.selected;
  const on = isFavorite(kind, item.name);
  $("fav").setAttribute("aria-pressed", String(on));
  $("fav").setAttribute("aria-label", t(on ? "removeFavorite" : "addFavorite"));
}

// ---------------------------------------------------------------- week page

function slotEnd(lesson) {
  const next = state.tt.slots.find((s) => s.id === lesson.slot_id + lesson.duration);
  if (next?.start_time) return next.start_time;
  const [h, m] = (lesson.start_time || "0:00").split(":").map(Number);
  return `${String(h + lesson.duration).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isNow(lesson) {
  if (lesson.day_id !== todayId()) return false;
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return lesson.start_time <= hm && hm < slotEnd(lesson);
}

const link = (kind, name) => `<a href="${esc(href(kind, name))}">${esc(displayName(kind, name))}</a>`;
const links = (kind, names) => names.map((n) => link(kind, n)).join(", ");

function lessonCard(lesson, kind, current) {
  const groups = lesson.groups.map((g) => g.name);
  // The line under the title, as in Uni Hub: who the lesson is with.
  const who = kind === "teacher" ? links("group", groups) : lesson.teacher ? link("teacher", lesson.teacher) : "";
  const rows = [
    [ICON.clock, `${esc(lesson.start_time)} – ${esc(slotEnd(lesson))}${isNow(lesson) ? `<b class="now-badge">${esc(t("now"))}</b>` : ""}`],
  ];
  if (kind !== "room" && lesson.room) rows.push([ICON.room, link("room", lesson.room)]);
  if (kind === "room" && groups.length) rows.push([ICON.group, links("group", groups)]);
  if (kind === "group") {
    const others = groups.filter((g) => g !== current);
    if (lesson.subgroup) rows.push([ICON.group, `${esc(t("subgroup"))}: ${esc(lesson.subgroup)}`]);
    if (others.length) rows.push([ICON.group, `${esc(t("with"))}: ${links("group", others)}`]);
  }
  return `
    <article class="lesson ${typeClass(lesson.type)}${isNow(lesson) ? " now" : ""}">
      <div class="body">
        <div class="bubble">${ICON.book}</div>
        <div class="main">
          <div class="top">
            <h2>${esc(lesson.course_name)}</h2>
            ${lesson.type ? `<span class="type">${esc(typeLabel(lesson.type))}</span>` : ""}
          </div>
          ${who ? `<p class="who">${who}</p>` : ""}
          <div class="rows">${rows.map(([icon, html]) => `<div class="row">${icon}<span>${html}</span></div>`).join("")}</div>
        </div>
      </div>
    </article>`;
}

function renderWeek() {
  const { kind, item, lessons } = state.selected;
  $("week-name").textContent = displayName(kind, item.name);
  renderFavoriteButton();

  const dates = weekDates();
  const today = new Date().toDateString();
  const counts = new Map();
  for (const l of lessons) counts.set(l.day_id, (counts.get(l.day_id) ?? 0) + 1);
  $("days").innerHTML = state.tt.days.slice(0, 6).map((d, i) => `
    <button type="button" class="day${d.id === state.day ? " active" : ""}" data-day="${d.id}">
      <span class="wd">${esc(TEXT[state.lang].daysShort[i] ?? d.label)}</span>
      <span class="num">${dates[i].getDate()}</span>
      ${dates[i].toDateString() === today ? '<span class="dot"></span>' : counts.get(d.id) ? `<span class="count">${counts.get(d.id)}</span>` : ""}
    </button>`).join("");

  const list = lessons.filter((l) => l.day_id === state.day);
  $("lessons").innerHTML = list.length
    ? list.map((l) => lessonCard(l, kind, item.name)).join("")
    : `<p class="free">${esc(t("free"))}</p>`;
}

// ---------------------------------------------------------------- routing

function lockMainScreen() {
  if (!state.selected && (location.hash === "#/" || location.hash === "" || location.hash === "#")) {
    try {
      history.replaceState({ isMain: true }, "", location.pathname + "#/");
      history.pushState({ isMain: true }, "", location.pathname + "#/");
    } catch { /* ignore security/file restrictions */ }
  }
}

function route() {
  if (!state.tt) return;
  pageview({ path: location.pathname + (location.hash || "") });
  const m = location.hash.match(/^#\/(group|teacher|room)\/(.+)$/);
  const item = m && state.tt.find(m[1], decodeURIComponent(m[2]));
  if (m && !item) toast(t("notFound"));
  if (!item) {
    state.selected = null;
    render();
    lockMainScreen();
    return;
  }
  const kind = m[1];
  const same = state.selected?.kind === kind && state.selected.item.name === item.name;
  const lessons = state.tt.lessons(kind, item.id);
  state.selected = { kind, item, lessons };
  if (!same) state.day = todayId() ?? lessons[0]?.day_id ?? 1;
  render();
  if (!same) $("lessons").scrollTop = 0;
}

function render() {
  if (!state.tt) return;
  const w = Number(state.info?.week);
  $("week-line").textContent = w ? t("week", state.lang === "ka" ? roman(w) : w) : "";
  if (state.selected) {
    renderWeek();
    showPage("week-page");
  } else {
    renderResults();
    showPage("search-page");
    if (document.activeElement === $("q")) $("q").blur();
  }
}

// ---------------------------------------------------------------- data

function setTimetable({ timetable, info }) {
  const old = state.tt;
  state.tt = timetable;
  state.info = info;
  state.index = buildIndex(timetable);
  route();
  old?.db.close();
}

// Shows the saved timetable at once, then asks the server for a newer one.
async function start() {
  const hadData = Boolean(state.tt);
  if (!hadData) {
    try {
      const cached = await loadCached();
      if (cached) {
        setTimetable(cached);
        hideSplash();
      }
    } catch (e) {
      console.warn(e);
    }
  }
  try {
    const latest = await loadLatest(state.info?.version);
    if (latest) {
      const replacing = Boolean(state.tt);
      setTimetable(latest);
      const w = Number(latest.info.week);
      if (replacing) toast(t("updated", state.lang === "ka" ? roman(w) : w));
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    }
  } catch (e) {
    console.warn("could not refresh timetable", e);
    if (!state.tt) {
      $("error-text").textContent = navigator.onLine ? t("loadFailed") : t("firstLoadOffline");
      showPage("error-page");
    } else if (!hadData && !navigator.onLine) {
      toast(t("showingSaved"));
    }
  }
  hideSplash();
}

// ---------------------------------------------------------------- add to home screen

const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
const isMobile = isIOS || isAndroid || /Mobi/i.test(ua);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let installPrompt = null;

function updateA2hs() {
  const show = isMobile && !isStandalone() && state.page === "search-page";
  $("a2hs").hidden = !show;
  document.body.classList.toggle("with-a2hs", show);
}

function openSheet() {
  const steps = TEXT[state.lang][isIOS ? "stepsIos" : "stepsAndroid"];
  $("sheet-steps").innerHTML = steps.map((s, i) =>
    `<li><span class="n">${i + 1}</span><span>${s.replace(/\{(share|plus|dots)\}/g, (_, k) => ICON[k])}</span></li>`).join("");
  $("sheet").hidden = false;
  $("sheet-backdrop").hidden = false;
}

function closeSheet() {
  $("sheet").hidden = true;
  $("sheet-backdrop").hidden = true;
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  updateA2hs();
});

$("a2hs").addEventListener("click", async () => {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => {});
    installPrompt = null;
    return;
  }
  openSheet();
});
$("sheet-close").addEventListener("click", closeSheet);
$("sheet-backdrop").addEventListener("click", closeSheet);

// ---------------------------------------------------------------- events

$("q").addEventListener("input", () => {
  state.expanded.clear();
  renderResults();
});
$("q").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const first = $("results").querySelector("a.item");
  if (first) {
    $("q").blur();
    location.hash = first.getAttribute("href");
  }
});
$("results").addEventListener("click", (e) => {
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
  const more = e.target.closest("[data-more]");
  if (more) {
    state.expanded.add(more.dataset.more);
    renderResults();
  }
});
const backBtn = document.querySelector(".back");
if (backBtn) {
  backBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    location.hash = "#/";
  });
}
$("days").addEventListener("click", (e) => {
  const b = e.target.closest("[data-day]");
  if (!b) return;
  state.day = Number(b.dataset.day);
  renderWeek();
  $("lessons").scrollTop = 0;
});
$("fav").addEventListener("click", toggleFavorite);
$("lang").addEventListener("click", () => {
  state.lang = state.lang === "ka" ? "en" : "ka";
  storage.set("gtu.lang", state.lang);
  applyLanguage();
});
$("retry").addEventListener("click", start);

function updateNetwork() {
  $("offline").hidden = navigator.onLine;
}
window.addEventListener("popstate", () => {
  if (!state.selected && (location.hash === "#/" || location.hash === "" || location.hash === "#")) {
    try {
      history.pushState({ isMain: true }, "", location.pathname + "#/");
    } catch { /* ignore */ }
    return;
  }
  route();
});
window.addEventListener("hashchange", route);
window.addEventListener("online", () => { updateNetwork(); start(); });
window.addEventListener("offline", updateNetwork);

// PWA native feel: disable text copy and link preview callout popups
document.addEventListener("contextmenu", (e) => {
  if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
    e.preventDefault();
  }
});

document.addEventListener("copy", (e) => {
  if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
    e.preventDefault();
  }
});

if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
  navigator.serviceWorker.register("sw.js").catch((e) => console.warn("service worker", e));
}

updateNetwork();
applyLanguage();
start();
