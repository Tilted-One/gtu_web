// Loads the timetable SQLite file with sql.js and keeps a copy in Cache Storage so the
// app works offline. data/current.json names the current file and its version (hash);
// a new version is downloaded, checked, and only then replaces the cached copy.
//
// Data source: https://github.com/Tilted-One/gtu_parser

const DATA_BASE = "https://raw.githubusercontent.com/Tilted-One/gtu_parser/main/data/";
const DATA_CACHE = "gtu-data";
const CACHED_DB = "offline/timetable.sqlite"; // cache keys only, never fetched
const CACHED_INFO = "offline/current.json";
const NETWORK_TIMEOUT_MS = 8000;

let sqlPromise;
function sql() {
  sqlPromise ??= initSqlJs({ locateFile: (f) => `vendor/${f}` });
  return sqlPromise;
}

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NETWORK_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function open(bytes) {
  const SQL = await sql();
  const db = new SQL.Database(bytes);
  db.exec("SELECT count(*) FROM lesson"); // throws on a broken or foreign file
  return new Timetable(db);
}

// Returns { timetable, info } from the offline copy, or null when there is none.
export async function loadCached() {
  if (!("caches" in self)) return null;
  const cache = await caches.open(DATA_CACHE);
  const [dbRes, infoRes] = await Promise.all([cache.match(CACHED_DB), cache.match(CACHED_INFO)]);
  if (!dbRes || !infoRes) return null;
  try {
    const info = await infoRes.json();
    return { timetable: await open(new Uint8Array(await dbRes.arrayBuffer())), info };
  } catch (e) {
    console.warn("cached timetable unusable", e);
    return null;
  }
}

// Returns { timetable, info } when the server has a version other than `knownVersion`,
// null when it is the same one. Throws when offline or the server is unreachable.
export async function loadLatest(knownVersion) {
  const info = await (await fetchWithTimeout(`${DATA_BASE}current.json`)).json();
  if (info.version === knownVersion) return null;
  const buf = await (await fetchWithTimeout(`${DATA_BASE}${encodeURIComponent(info.file)}?v=${info.version}`)).arrayBuffer();
  const timetable = await open(new Uint8Array(buf));
  if ("caches" in self) {
    const cache = await caches.open(DATA_CACHE);
    await cache.put(CACHED_DB, new Response(buf, { headers: { "Content-Type": "application/x-sqlite3" } }));
    await cache.put(CACHED_INFO, new Response(JSON.stringify(info), { headers: { "Content-Type": "application/json" } }));
  }
  return { timetable, info };
}

function rows(db, sqlText, params = []) {
  const stmt = db.prepare(sqlText);
  try {
    stmt.bind(params);
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    return out;
  } finally {
    stmt.free();
  }
}

// Per lesson: "id:name" of every group, joined by "|".
const LESSON_COLUMNS = `
  lv.id, lv.day_id, lv.slot_id, lv.start_time, lv.duration, lv.course_code, lv.course_name,
  lv.type, lv.teacher_id, lv.teacher, lv.room_id, lv.room, lv.building, lv.students,
  (SELECT group_concat(g.id || ':' || g.name, '|') FROM lesson_group x
     JOIN student_group g ON g.id = x.group_id WHERE x.lesson_id = lv.id) AS groups`;

function withGroups(lesson) {
  lesson.groups = lesson.groups
    ? lesson.groups.split("|").map((g) => {
        const i = g.indexOf(":");
        return { id: Number(g.slice(0, i)), name: g.slice(i + 1) };
      })
    : [];
  return lesson;
}

export class Timetable {
  constructor(db) {
    this.db = db;
    this.meta = Object.fromEntries(rows(db, "SELECT key, value FROM meta").map((r) => [r.key, r.value]));
    this.days = rows(db, "SELECT id, label, name_ka, name_en FROM day ORDER BY id");
    this.slots = rows(db, "SELECT id, label, start_time FROM slot ORDER BY id");
    this.lists = {
      group: rows(db, `
        SELECT g.id, g.name, p.name AS program, p.level,
               (SELECT count(*) FROM lesson_group x WHERE x.group_id = g.id) AS lessons
        FROM student_group g LEFT JOIN program p ON p.id = g.program_id
        ORDER BY g.name`),
      teacher: rows(db, `
        SELECT t.id, t.name, (SELECT count(*) FROM lesson l WHERE l.teacher_id = t.id) AS lessons
        FROM teacher t ORDER BY t.name`),
      room: rows(db, `
        SELECT r.id, r.name, r.building, (SELECT count(*) FROM lesson l WHERE l.room_id = r.id) AS lessons
        FROM room r ORDER BY r.building, r.name`),
    };
    // Ids are reassigned on every import, so links and recents refer to names.
    this.byName = Object.fromEntries(
      Object.entries(this.lists).map(([kind, list]) => [kind, new Map(list.map((x) => [x.name, x]))]),
    );
  }

  find(kind, name) {
    return this.byName[kind]?.get(name) ?? null;
  }

  lessons(kind, id) {
    const order = "ORDER BY lv.day_id, lv.slot_id, lv.course_name";
    if (kind === "group") {
      return rows(this.db, `
        SELECT ${LESSON_COLUMNS}, lg.subgroup
        FROM lesson_view lv JOIN lesson_group lg ON lg.lesson_id = lv.id
        WHERE lg.group_id = ? ${order}`, [id]).map(withGroups);
    }
    const column = kind === "teacher" ? "teacher_id" : "room_id";
    return rows(this.db, `SELECT ${LESSON_COLUMNS} FROM lesson_view lv WHERE lv.${column} = ? ${order}`, [id])
      .map(withGroups);
  }
}
