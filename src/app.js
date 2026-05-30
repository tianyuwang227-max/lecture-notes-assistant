const STORAGE_KEY = "lecture-notes-assistant:v1";
const SYNC_KEY_STORAGE_KEY = "lecture-notes-assistant:sync-key";
const THEME_KEY = "lecture-notes-assistant:theme";
const APP_TIME_ZONE = "Asia/Shanghai";
let installPromptEvent = null;
let syncKey = localStorage.getItem(SYNC_KEY_STORAGE_KEY) || "";
let syncStatus = "本地自动保存";

const nowTime = () =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  }).format(new Date());

const todayKey = () => {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function getTheme() {
  return localStorage.getItem(THEME_KEY) || "auto";
}

function resolveTheme(preference) {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme() {
  const resolved = resolveTheme(getTheme());
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = resolved === "dark" ? "#1a1814" : "#f7f4ee";
}

function cycleTheme() {
  const current = getTheme();
  const next = current === "light" ? "dark" : current === "dark" ? "auto" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
  render();
}

const TIMER_KEY = "lecture-notes-assistant:timer";
let timerInterval = null;
let timerState = loadTimerState();

function defaultTimerState() {
  return {
    mode: "work",
    remaining: 25 * 60,
    running: false,
    pomodorosToday: 0,
    pomodorosDate: todayKey(),
    lastTickAt: null,
  };
}

function loadTimerState() {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return defaultTimerState();
    const saved = JSON.parse(raw);
    if (saved.pomodorosDate !== todayKey()) {
      saved.pomodorosToday = 0;
      saved.pomodorosDate = todayKey();
    }
    if (saved.running && saved.lastTickAt) {
      const elapsed = Math.floor((Date.now() - new Date(saved.lastTickAt).getTime()) / 1000);
      saved.remaining = Math.max(0, saved.remaining - elapsed);
      if (saved.remaining === 0) {
        saved.running = false;
        if (saved.mode === "work") {
          saved.pomodorosToday++;
          saved.mode = "break";
          saved.remaining = 5 * 60;
        } else {
          saved.mode = "work";
          saved.remaining = 25 * 60;
        }
      }
    }
    saved.running = false;
    return saved;
  } catch {
    return defaultTimerState();
  }
}

function saveTimerState() {
  timerState.lastTickAt = timerState.running ? new Date().toISOString() : null;
  localStorage.setItem(TIMER_KEY, JSON.stringify(timerState));
}

function startTimer() {
  if (timerState.running) return;
  timerState.running = true;
  saveTimerState();
  timerInterval = setInterval(tickTimer, 1000);
  render();
}

function pauseTimer() {
  timerState.running = false;
  saveTimerState();
  clearInterval(timerInterval);
  timerInterval = null;
  render();
}

function resetTimer() {
  timerState.running = false;
  timerState.remaining = timerState.mode === "work" ? 25 * 60 : 5 * 60;
  saveTimerState();
  clearInterval(timerInterval);
  timerInterval = null;
  render();
}

function tickTimer() {
  if (!timerState.running) return;
  timerState.remaining--;
  updateTimerDisplay();
  if (timerState.remaining <= 0) {
    handleTimerCompletion();
  }
}

function updateTimerDisplay() {
  const el = document.getElementById("timer-display");
  if (el) el.textContent = formatTime(timerState.remaining);
  const progress = document.getElementById("timer-progress");
  if (progress) {
    const total = timerState.mode === "work" ? 25 * 60 : 5 * 60;
    progress.style.width = `${((total - timerState.remaining) / total) * 100}%`;
  }
}

function handleTimerCompletion() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerState.running = false;
  if (timerState.mode === "work") {
    timerState.pomodorosToday++;
    timerState.mode = "break";
    timerState.remaining = 5 * 60;
    notifyTimerComplete("专注完成！休息 5 分钟。");
  } else {
    timerState.mode = "work";
    timerState.remaining = 25 * 60;
    notifyTimerComplete("休息结束，开始下一轮专注。");
  }
  saveTimerState();
  render();
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function notifyTimerComplete(message) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1000;
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.3);
    }, 400);
  } catch {}
  if (Notification.permission === "granted") {
    new Notification("听课笔记", { body: message });
  }
}

function renderTimer() {
  const isWork = timerState.mode === "work";
  const total = isWork ? 25 * 60 : 5 * 60;
  const progress = ((total - timerState.remaining) / total) * 100;
  return `
    <div class="timer-widget ${isWork ? "timer-work" : "timer-break"}">
      <div class="timer-header">
        <span class="timer-label">${isWork ? "专注中" : "休息中"}</span>
        <span class="timer-count">今日 ${timerState.pomodorosToday} 个番茄</span>
      </div>
      <div class="timer-display" id="timer-display">${formatTime(timerState.remaining)}</div>
      <div class="timer-bar">
        <div class="timer-progress" id="timer-progress" style="width: ${progress}%"></div>
      </div>
      <div class="timer-actions">
        ${
          timerState.running
            ? `<button class="secondary" data-action="pause-timer">暂停</button>`
            : `<button data-action="start-timer">开始专注</button>`
        }
        <button class="ghost small" data-action="reset-timer">重置</button>
      </div>
    </div>
  `;
}

const defaultState = () => {
  const courseId = uid();
  const noteId = uid();
  return {
    activeView: "quick",
    activeCourseId: courseId,
    activeNoteId: noteId,
    courses: [
      {
        id: courseId,
        title: "今天课程",
        source: "浏览器 / B站 / 腾讯会议",
        createdAt: new Date().toISOString(),
      },
    ],
    quickNotes: [
      {
        id: uid(),
        courseId,
        time: nowTime(),
        type: "important",
        text: "示例：听到重点就直接输入，系统会自动保存。",
        createdAt: new Date().toISOString(),
      },
    ],
    notes: [
      {
        id: noteId,
        courseId,
        title: "第 1 节课笔记",
        content:
          "## 核心内容\n\n把速记整理成正式文档。\n\n## 问题\n\n- 这里写没听懂的地方\n\n## 课后复习\n\n- 回看重点片段",
        updatedAt: new Date().toISOString(),
      },
    ],
    todos: [
      {
        id: uid(),
        date: todayKey(),
        text: "听完今天的课",
        done: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        date: todayKey(),
        text: "整理课堂笔记",
        done: false,
        createdAt: new Date().toISOString(),
      },
    ],
    lastSyncedAt: null,
  };
};

let state = loadLocalState();
const app = document.querySelector("#app");
let searchQuery = "";

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : defaultState();
    return { ...saved, activeView: routeView() || saved.activeView || "quick" };
  } catch {
    return { ...defaultState(), activeView: routeView() || "quick" };
  }
}

function routeView() {
  const view = location.hash.replace("#", "").trim();
  return ["quick", "notes", "today", "mini", "courses", "search"].includes(view)
    ? view
    : null;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueCloudSave();
}

let saveTimer;
function queueCloudSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const res = await fetch("/api/state", {
        method: "PUT",
        headers: syncHeaders(),
        body: JSON.stringify({ state }),
      });
      if (res.status === 401) {
        syncStatus = "云同步需要正确密钥";
        render();
        return;
      }
      if (!res.ok) return;
      state.lastSyncedAt = new Date().toISOString();
      syncStatus = `已云同步 ${new Date(state.lastSyncedAt).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
    } catch {
      // Local-first: Cloudflare D1 sync is optional until deployed.
    }
  }, 600);
}

async function hydrateFromCloud() {
  try {
    const res = await fetch("/api/state", { headers: syncHeaders(false) });
    if (res.status === 401) {
      syncStatus = "云同步需要正确密钥";
      render();
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    if (data?.state) {
      state = { ...defaultState(), ...data.state };
      state.activeView = routeView() || state.activeView || "quick";
      syncStatus = data.updatedAt ? "已读取云端数据" : "本地自动保存";
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
    }
  } catch {
    // Static file usage keeps working with localStorage only.
  }
}

function syncHeaders(includeContentType = true) {
  const headers = {};
  if (includeContentType) headers["content-type"] = "application/json";
  if (syncKey) headers["x-app-key"] = syncKey;
  return headers;
}

const byId = (id) => document.getElementById(id);
const activeCourse = () =>
  state.courses.find((course) => course.id === state.activeCourseId) ||
  state.courses[0];
const activeNote = () =>
  state.notes.find((note) => note.id === state.activeNoteId) ||
  state.notes.find((note) => note.courseId === activeCourse()?.id);
const todayTodos = () => state.todos.filter((todo) => todo.date === todayKey());
const overdueTodos = () =>
  state.todos
    .filter((todo) => todo.date < todayKey() && !todo.done)
    .sort((left, right) => left.date.localeCompare(right.date));

function setView(view) {
  state.activeView = view;
  if (location.hash !== `#${view}`) {
    history.replaceState(null, "", `#${view}`);
  }
  saveState();
  render();
}

function selectCourse(courseId) {
  state.activeCourseId = courseId;
  const note = state.notes.find((item) => item.courseId === courseId);
  if (note) state.activeNoteId = note.id;
  saveState();
  render();
}

function addCourse(title, source = "浏览器 / B站 / 腾讯会议") {
  if (!title?.trim()) return;
  const courseId = uid();
  const noteId = uid();
  state.courses.push({
    id: courseId,
    title: title.trim(),
    source: source.trim() || "浏览器 / B站 / 腾讯会议",
    createdAt: new Date().toISOString(),
  });
  state.notes.push({
    id: noteId,
    courseId,
    title: `${title.trim()} 笔记`,
    content: "## 核心内容\n\n\n## 问题\n\n\n## 课后复习\n\n",
    updatedAt: new Date().toISOString(),
  });
  state.activeCourseId = courseId;
  state.activeNoteId = noteId;
  saveState();
  render();
}

function updateCourseField(courseId, field, value) {
  const course = state.courses.find((item) => item.id === courseId);
  if (!course) return;
  const cleanValue = value.trim();
  if (field === "title" && !cleanValue) return;
  course[field] = cleanValue;
  course.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function notesForCourse(courseId) {
  return state.notes.filter((note) => note.courseId === courseId);
}

function selectNote(noteId) {
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return;
  state.activeNoteId = note.id;
  state.activeCourseId = note.courseId;
  state.activeView = "notes";
  saveState();
  render();
}

function openSearchResult(type, id) {
  if (type === "course") {
    selectCourse(id);
    state.activeView = "courses";
  }
  if (type === "note") {
    selectNote(id);
    return;
  }
  if (type === "quick") {
    const item = state.quickNotes.find((note) => note.id === id);
    if (item) {
      state.activeCourseId = item.courseId;
      state.activeView = "quick";
    }
  }
  if (type === "todo") {
    state.activeView = "today";
  }
  saveState();
  render();
}

function addNoteForActiveCourse(title) {
  const course = activeCourse();
  if (!course) return;
  if (!title?.trim()) return;
  const noteId = uid();
  state.notes.push({
    id: noteId,
    courseId: course.id,
    title: title.trim(),
    content: "## 核心内容\n\n\n## 问题\n\n\n## 课后复习\n\n",
    appendedQuickNoteIds: [],
    updatedAt: new Date().toISOString(),
  });
  state.activeNoteId = noteId;
  state.activeView = "notes";
  saveState();
  render();
}

function classifyQuickNote(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("?") || trimmed.startsWith("？")) return "question";
  if (trimmed.startsWith("[]") || trimmed.startsWith("[ ]")) return "todo";
  if (trimmed.startsWith("!") || trimmed.startsWith("！")) return "important";
  return "normal";
}

function cleanQuickText(text) {
  return text
    .trim()
    .replace(/^(\?|\？|!|！|\[\]|\[ \])\s*/, "")
    .trim();
}

function addQuickNote(text) {
  if (!text.trim()) return;
  const type = classifyQuickNote(text);
  const cleanText = cleanQuickText(text);
  state.quickNotes.unshift({
    id: uid(),
    courseId: activeCourse().id,
    time: nowTime(),
    type,
    text: cleanText,
    createdAt: new Date().toISOString(),
  });
  if (type === "todo") {
    state.todos.push({
      id: uid(),
      date: todayKey(),
      text: cleanText,
      done: false,
      createdAt: new Date().toISOString(),
    });
  }
  saveState();
  render();
}

function addTodo(text) {
  if (!text.trim()) return;
  state.todos.push({
    id: uid(),
    date: todayKey(),
    text: text.trim(),
    done: false,
    createdAt: new Date().toISOString(),
  });
  saveState();
  render();
}

function toggleTodo(todoId) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) return;
  todo.done = !todo.done;
  todo.completedAt = todo.done ? new Date().toISOString() : null;
  saveState();
  render();
}

function deleteTodo(todoId) {
  state.todos = state.todos.filter((item) => item.id !== todoId);
  saveState();
  render();
}

function carryTodosToTomorrow() {
  const tomorrow = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIME_ZONE,
  })
    .formatToParts(new Date(Date.now() + 86400000))
    .reduce((nextDate, part) => {
      if (part.type !== "literal") nextDate[part.type] = part.value;
      return nextDate;
    }, {});
  const tomorrowKey = `${tomorrow.year}-${tomorrow.month}-${tomorrow.day}`;
  const remaining = todayTodos().filter((todo) => !todo.done);
  remaining.forEach((todo) => {
    const alreadyCarried = state.todos.some(
      (item) =>
        item.date === tomorrowKey &&
        item.text === todo.text &&
        item.carriedFrom === todayKey()
    );
    if (alreadyCarried) return;
    state.todos.push({
      id: uid(),
      date: tomorrowKey,
      text: todo.text,
      done: false,
      createdAt: new Date().toISOString(),
      carriedFrom: todayKey(),
    });
  });
  saveState();
  render();
}

function clearCompletedTodos() {
  const today = todayKey();
  state.todos = state.todos.filter((todo) => todo.date !== today || !todo.done);
  saveState();
  render();
}

function carryOverdueToToday() {
  const today = todayKey();
  overdueTodos().forEach((todo) => {
    const alreadyCarried = state.todos.some(
      (item) => item.date === today && item.text === todo.text && item.carriedFrom === todo.date
    );
    if (alreadyCarried) return;
    state.todos.push({
      id: uid(),
      date: today,
      text: todo.text,
      done: false,
      createdAt: new Date().toISOString(),
      carriedFrom: todo.date,
    });
  });
  saveState();
  render();
}

function openMiniWindow() {
  const url = `${location.origin}${location.pathname}#mini`;
  const features = [
    "popup=yes",
    "width=380",
    "height=560",
    "left=40",
    "top=80",
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
  window.open(url, "lectureTodoMini", features);
}

function saveSyncKey(value) {
  syncKey = value.trim();
  if (syncKey) {
    localStorage.setItem(SYNC_KEY_STORAGE_KEY, syncKey);
    syncStatus = "同步密钥已保存";
  } else {
    localStorage.removeItem(SYNC_KEY_STORAGE_KEY);
    syncStatus = "本地自动保存";
  }
  render();
  hydrateFromCloud();
}

function clearSyncKey() {
  saveSyncKey("");
}

function exportBackup() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lecture-notes-backup-${todayKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "lecture-note";
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const importedState = parsed.state || parsed;
      if (!Array.isArray(importedState.courses) || !Array.isArray(importedState.todos)) {
        throw new Error("Invalid backup");
      }
      state = {
        ...defaultState(),
        ...importedState,
        activeView: "courses",
      };
      if (!state.activeCourseId && state.courses[0]) {
        state.activeCourseId = state.courses[0].id;
      }
      if (!state.activeNoteId && state.notes[0]) {
        state.activeNoteId = state.notes[0].id;
      }
      saveState();
      render();
    } catch {
      alert("备份文件无法导入，请确认它是从本应用导出的 JSON。");
    }
  });
  reader.readAsText(file);
}

function quickNotesForCourse(courseId) {
  return state.quickNotes.filter((note) => note.courseId === courseId);
}

function appendQuickToNote() {
  const note = activeNote();
  if (!note) return;
  const appendedIds = new Set(note.appendedQuickNoteIds || []);
  const pendingItems = quickNotesForCourse(activeCourse().id)
    .filter((item) => !appendedIds.has(item.id))
    .slice()
    .reverse();
  const snippets = pendingItems
    .map((item) => `- ${item.time} ${labelForType(item.type)}${item.text}`)
    .join("\n");
  if (!snippets) return;
  const heading = note.appendedQuickNoteIds?.length ? "" : "\n\n## 听课速记";
  note.content = `${note.content.trim()}${heading}\n\n${snippets}`;
  note.appendedQuickNoteIds = [...appendedIds, ...pendingItems.map((item) => item.id)];
  note.updatedAt = new Date().toISOString();
  state.activeView = "notes";
  saveState();
  render();
}

function exportActiveNoteMarkdown() {
  const note = activeNote();
  const course = activeCourse();
  if (!note || !course) return;
  const content = [
    `# ${note.title}`,
    "",
    `课程：${course.title}`,
    `来源：${course.source}`,
    `导出时间：${new Date().toLocaleString("zh-CN", { timeZone: APP_TIME_ZONE })}`,
    "",
    note.content.trim(),
    "",
  ].join("\n");
  downloadTextFile(`${safeFilename(note.title)}.md`, content, "text/markdown");
}

function exportCourseMarkdown(courseId) {
  const course = state.courses.find((item) => item.id === courseId);
  if (!course) return;
  const notes = notesForCourse(courseId);
  const quickNotes = quickNotesForCourse(courseId).slice().reverse();
  const content = [
    `# ${course.title}`,
    "",
    `来源：${course.source}`,
    `导出时间：${new Date().toLocaleString("zh-CN", { timeZone: APP_TIME_ZONE })}`,
    "",
    "## 文档笔记",
    "",
    notes.length
      ? notes
          .map((note, index) =>
            [`### ${index + 1}. ${note.title}`, "", note.content.trim()].join("\n")
          )
          .join("\n\n")
      : "暂无文档笔记。",
    "",
    "## 听课速记原始记录",
    "",
    quickNotes.length
      ? quickNotes.map((item) => `- ${item.time} ${labelForType(item.type)}${item.text}`).join("\n")
      : "暂无速记。",
    "",
  ].join("\n");
  downloadTextFile(`${safeFilename(course.title)}-课程导出.md`, content, "text/markdown");
}

function searchResults() {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return [];
  const includes = (value) => String(value || "").toLowerCase().includes(query);
  return [
    ...state.courses
      .filter((course) => includes(course.title) || includes(course.source))
      .map((course) => ({
        id: course.id,
        type: "course",
        label: "课程",
        title: course.title,
        meta: course.source,
      })),
    ...state.notes
      .filter((note) => includes(note.title) || includes(note.content))
      .map((note) => {
        const course = state.courses.find((item) => item.id === note.courseId);
        return {
          id: note.id,
          type: "note",
          label: "文档",
          title: note.title,
          meta: course?.title || "未命名课程",
        };
      }),
    ...state.quickNotes
      .filter((note) => includes(note.text))
      .map((note) => {
        const course = state.courses.find((item) => item.id === note.courseId);
        return {
          id: note.id,
          type: "quick",
          label: "速记",
          title: note.text,
          meta: `${course?.title || "未命名课程"} · ${note.time}`,
        };
      }),
    ...state.todos
      .filter((todo) => includes(todo.text))
      .map((todo) => ({
        id: todo.id,
        type: "todo",
        label: "Todo",
        title: todo.text,
        meta: `${todo.date}${todo.done ? " · 已完成" : ""}`,
      })),
  ].slice(0, 40);
}

function labelForType(type) {
  if (type === "question") return "问题：";
  if (type === "todo") return "待办：";
  if (type === "important") return "重点：";
  return "";
}

let activeTagFilter = null;

function extractTags(text) {
  const matches = text.match(/#[\w一-鿿㐀-䶿]+/g);
  return matches ? [...new Set(matches.map((t) => t.toLowerCase()))] : [];
}

function highlightTags(escapedText) {
  return escapedText.replace(
    /(#[\w一-鿿㐀-䶿]+)/g,
    '<span class="tag-text">$1</span>'
  );
}

function renderTagCloud(courseId) {
  const items = quickNotesForCourse(courseId);
  const tagCounts = {};
  items.forEach((item) => {
    extractTags(item.text).forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return "";
  return `
    <div class="section-title"><span>标签</span></div>
    <div class="tag-cloud">
      ${
        activeTagFilter
          ? `<button class="tag-chip active" data-filter-tag="">全部</button>`
          : ""
      }
      ${sorted
        .map(
          ([tag, count]) =>
            `<button class="tag-chip ${
              tag === activeTagFilter ? "active" : ""
            }" data-filter-tag="${escapeAttr(tag)}">${escapeHtml(tag)} (${count})</button>`
        )
        .join("")}
    </div>
  `;
}

function updateNoteField(field, value) {
  const note = activeNote();
  if (!note) return;
  note[field] = value;
  note.updatedAt = new Date().toISOString();
  saveState();
}

let notePreviewMode = false;

function parseSimpleMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, "<ul>$&</ul>");
  html = html.replace(/^(?!<[hupl]|<li|<pre|<code)(.+)$/gm, "<p>$1</p>");
  return html;
}

function render() {
  document.body.dataset.view = state.activeView;
  app.innerHTML = `
    <div class="shell">
      ${renderSidebar()}
      <main class="main">
        ${renderTopbar()}
        ${renderView()}
      </main>
    </div>
  `;
  bindEvents();
}

function renderSidebar() {
  const themeLabel = getTheme() === "light" ? "亮色" : getTheme() === "dark" ? "暗色" : "自动";
  return `
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark"></span>
        <div>
          <strong>听课笔记桌面</strong>
          <small>边听边记，课后整理</small>
        </div>
      </div>
      <button class="ghost small wide" data-action="toggle-theme" style="margin-bottom:16px;text-align:center">主题：${themeLabel}</button>
      <nav class="nav">
        ${navButton("quick", "速记")}
        ${navButton("notes", "文档笔记")}
        ${navButton("today", "今日 Todo")}
        ${navButton("mini", "桌面小窗")}
        ${navButton("courses", "课程")}
        ${navButton("search", "搜索")}
      </nav>
      <div class="course-box">
        <div class="section-title">
          <span>课程</span>
          <button class="ghost small" data-action="add-course">+</button>
        </div>
        <div class="course-list">
          ${state.courses
            .map(
              (course) => `
                <button class="course-item ${
                  course.id === activeCourse()?.id ? "active" : ""
                }" data-course="${course.id}">
                  <span>${escapeHtml(course.title)}</span>
                  <small>${escapeHtml(course.source)}</small>
                </button>
              `
            )
            .join("")}
        </div>
      </div>
    </aside>
  `;
}

function navButton(view, label) {
  return `
    <button class="${state.activeView === view ? "active" : ""}" data-view="${view}">
      ${label}
    </button>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar">
      <div>
        <small>正在使用</small>
        <h1>${titleForView(state.activeView)}</h1>
      </div>
      <div class="top-actions">
        <button class="secondary install-button" data-action="install-app" hidden>安装到桌面</button>
        <div class="status">${escapeHtml(syncStatus)}</div>
      </div>
    </header>
  `;
}

function titleForView(view) {
  return (
    {
      quick: "听课速记",
      notes: "课程文档笔记",
      today: "今日 Todo",
      mini: "桌面 Todo 小窗",
      courses: "课程管理",
      search: "搜索",
    }[view] || "听课笔记桌面"
  );
}

function renderView() {
  if (state.activeView === "notes") return renderNotes();
  if (state.activeView === "today") return renderToday(false);
  if (state.activeView === "mini") return renderToday(true);
  if (state.activeView === "courses") return renderCourses();
  if (state.activeView === "search") return renderSearch();
  return renderQuick();
}

function renderQuick() {
  const course = activeCourse();
  let items = quickNotesForCourse(course.id);
  if (activeTagFilter) {
    items = items.filter((item) => extractTags(item.text).includes(activeTagFilter));
  }
  items = items.slice(0, 12);
  return `
    <section class="quick-layout">
      <div class="quick-card">
        ${renderTimer()}
        <p class="eyebrow">正在听：${escapeHtml(course.title)}</p>
        <form class="quick-input" data-form="quick">
          <textarea id="quick-text" name="quickText" rows="4" placeholder="听到重点就写在这里。用 ? 表示问题，用 [] 表示待办，用 ! 表示重点。"></textarea>
          <button type="button" data-action="add-quick-note">记录</button>
        </form>
        <p class="hint">快捷键：Mac 用 ⌘ + Enter，Windows 用 Ctrl + Enter。</p>
        <div class="quick-actions">
          <button data-action="append-quick">整理到文档笔记</button>
          <button data-action="open-mini-window" class="secondary">弹出 Todo 小窗</button>
        </div>
      </div>
      <div class="panel">
        <div class="section-title"><span>最近记录</span></div>
        <div class="timeline">
          ${
            items.length
              ? items.map(renderQuickItem).join("")
              : `<p class="empty">还没有速记。听到一句，就先记一句。</p>`
          }
        </div>
      </div>
      <aside class="panel compact-todos">
        ${renderTagCloud(course.id)}
        ${renderTodoList(true)}
      </aside>
    </section>
  `;
}

function renderQuickItem(item) {
  const note = state.notes.find((entry) => entry.courseId === item.courseId);
  const isAppended = note?.appendedQuickNoteIds?.includes(item.id);
  const tags = extractTags(item.text);
  const tagChips = tags.length
    ? `<div class="tag-chips">${tags
        .map(
          (t) =>
            `<button class="tag-chip" data-filter-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>`
        )
        .join("")}</div>`
    : "";
  return `
    <article class="quick-item ${item.type}">
      <time>${item.time}</time>
      <div>
        <span>${labelForType(item.type)}</span>${highlightTags(escapeHtml(item.text))}
        ${isAppended ? `<small class="quick-state">已整理</small>` : ""}
        ${tagChips}
      </div>
    </article>
  `;
}

function renderNotes() {
  const note = activeNote();
  const courseNotes = notesForCourse(activeCourse()?.id);
  if (!note) {
    return `<div class="empty page-empty">先创建一门课程，再开始写文档笔记。</div>`;
  }
  const noteContent = notePreviewMode
    ? `<div class="note-preview markdown-body">${parseSimpleMarkdown(note.content)}</div>`
    : `<textarea class="note-body" id="note-body" spellcheck="false">${escapeHtml(note.content)}</textarea>`;
  return `
    <section class="notes-layout">
      <div class="document">
        <input class="note-title" id="note-title" value="${escapeAttr(note.title)}" />
        ${noteContent}
      </div>
      <aside class="panel">
        <div class="section-title">
          <span>本课程文档</span>
        </div>
        <form class="inline-create" data-form="note-create">
          <input id="new-note-title" name="noteTitle" placeholder="新笔记标题" />
          <button type="submit">+</button>
        </form>
        <div class="note-list">
          ${courseNotes
            .map(
              (item) => `
                <button class="note-tab ${item.id === note.id ? "active" : ""}" data-note="${item.id}">
                  <span>${escapeHtml(item.title)}</span>
                  <small>${new Date(item.updatedAt).toLocaleDateString("zh-CN", {
                    timeZone: APP_TIME_ZONE,
                  })}</small>
                </button>
              `
            )
            .join("")}
        </div>
        <div class="side-actions">
          <button data-action="toggle-preview">${notePreviewMode ? "编辑" : "预览"}</button>
          <button data-action="append-quick">追加未整理速记</button>
          <button class="secondary" data-action="export-note-md">导出 Markdown</button>
        </div>
        <div class="section-title"><span>本课速记</span></div>
        <div class="timeline mini-list">
          ${quickNotesForCourse(activeCourse().id).slice(0, 8).map(renderQuickItem).join("")}
        </div>
      </aside>
    </section>
  `;
}

function renderToday(isMini) {
  return `
    <section class="${isMini ? "mini-page" : "today-layout"}">
      <div class="today-card">
        ${renderTodoList(false)}
      </div>
      ${
        isMini
          ? ""
          : `<div class="panel help-panel">
              <h2>使用方式</h2>
              <p>把这个页面作为小窗口放在桌面右侧，就能随时看到每日任务。第二版可以用 Tauri 做真正置顶桌面小组件。</p>
              <div class="button-row">
                <button data-action="open-mini-window">弹出 Todo 小窗</button>
                <button class="secondary" data-view="mini">切到小窗排版</button>
              </div>
            </div>`
      }
    </section>
  `;
}

function renderTodoList(compact) {
  const todos = todayTodos();
  const overdue = overdueTodos();
  const doneCount = todos.filter((todo) => todo.done).length;
  const remainingCount = todos.length - doneCount;
  return `
    <div class="section-title">
      <span>今日 Todo</span>
      <small>${todayKey()}</small>
    </div>
    <form class="todo-form" data-form="todo">
      <input id="todo-text" name="todoText" placeholder="添加今天要做的事" />
      <button type="button" data-action="add-todo">+</button>
    </form>
    <div class="todo-list ${compact ? "compact" : ""}">
      ${
        todos.length
          ? todos
              .map(
                (todo) => `
                  <div class="todo-item ${todo.done ? "done" : ""}">
                    <button class="check" data-todo="${todo.id}" aria-label="切换完成状态">${
                  todo.done ? "✓" : ""
                }</button>
                    <span>${escapeHtml(todo.text)}</span>
                    <button class="delete" data-delete-todo="${todo.id}" aria-label="删除">×</button>
                  </div>
                `
              )
              .join("")
          : `<p class="empty">今天还没有计划。</p>`
      }
    </div>
    <div class="todo-summary">
      <span>剩余 ${remainingCount}</span>
      <span>完成 ${doneCount}</span>
    </div>
    <div class="todo-actions">
      <button class="secondary" data-action="carry-tomorrow">未完成带到明天</button>
      <button class="ghost" data-action="clear-completed">清理已完成</button>
    </div>
    ${
      overdue.length
        ? `<div class="overdue-box">
            <div class="section-title">
              <span>过期未完成</span>
              <small>${overdue.length} 条</small>
            </div>
            <div class="overdue-list">
              ${overdue
                .slice(0, compact ? 3 : 6)
                .map(
                  (todo) => `
                    <div class="overdue-item">
                      <span>${escapeHtml(todo.text)}</span>
                      <small>${escapeHtml(todo.date)}</small>
                    </div>
                  `
                )
                .join("")}
            </div>
            <button class="secondary wide" data-action="carry-overdue-today">带到今天</button>
          </div>`
        : ""
    }
  `;
}

function renderCourses() {
  return `
    <section class="courses-page">
      <div class="section-title">
        <span>课程管理</span>
      </div>
      <form class="course-create" data-form="course-create">
        <input name="courseTitle" placeholder="新课程名称" />
        <input name="courseSource" placeholder="来源：浏览器 / B站 / 腾讯会议" />
        <button type="submit">添加课程</button>
      </form>
      <div class="data-tools">
        <div>
          <strong>数据备份</strong>
          <p>本地使用时也可以导出 JSON，换电脑或清浏览器前先备份。</p>
        </div>
        <div class="button-row">
          <button data-action="export-backup">导出备份</button>
          <button class="secondary" data-action="open-import">导入备份</button>
          <input id="backup-file" type="file" accept="application/json,.json" hidden />
        </div>
      </div>
      <div class="data-tools">
        <div>
          <strong>云同步密钥</strong>
          <p>部署时如果设置了 Cloudflare 环境变量 APP_KEY，这里填同一个值才会同步 D1。</p>
        </div>
        <form class="sync-key-form" data-form="sync-key">
          <input id="sync-key" type="password" value="${escapeAttr(syncKey)}" placeholder="输入 APP_KEY" autocomplete="current-password" />
          <button type="submit">保存密钥</button>
          <button type="button" class="ghost" data-action="clear-sync-key">清除</button>
        </form>
      </div>
      <div class="course-grid">
        ${state.courses
          .map((course) => {
            const quickCount = quickNotesForCourse(course.id).length;
            const noteCount = state.notes.filter((note) => note.courseId === course.id).length;
            return `
              <article class="course-card">
                <label>
                  <span>课程名称</span>
                  <input value="${escapeAttr(course.title)}" data-course-field="title" data-course-id="${course.id}" />
                </label>
                <label>
                  <span>来源</span>
                  <input value="${escapeAttr(course.source)}" data-course-field="source" data-course-id="${course.id}" />
                </label>
                <div class="metrics">
                  <span>${quickCount} 条速记</span>
                  <span>${noteCount} 篇文档</span>
                </div>
                <div class="card-actions">
                  <button data-course="${course.id}">进入课程</button>
                  <button class="secondary" data-export-course="${course.id}">导出课程</button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSearch() {
  const results = searchResults();
  return `
    <section class="search-page">
      <form class="search-box" data-form="search">
        <input name="query" value="${escapeAttr(searchQuery)}" placeholder="搜索课程、文档、速记、Todo" autofocus />
        <button type="submit">搜索</button>
      </form>
      <div class="search-results">
        ${
          searchQuery.trim()
            ? results.length
              ? results.map(renderSearchResult).join("")
              : `<p class="empty">没有找到相关内容。</p>`
            : `<p class="empty">输入关键词后开始搜索。</p>`
        }
      </div>
    </section>
  `;
}

function renderSearchResult(result) {
  return `
    <button class="search-result" data-result-type="${result.type}" data-result-id="${result.id}">
      <span>${escapeHtml(result.label)}</span>
      <strong>${escapeHtml(result.title)}</strong>
      <small>${escapeHtml(result.meta)}</small>
    </button>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelectorAll("[data-action='toggle-theme']").forEach((button) => {
    button.addEventListener("click", cycleTheme);
  });
  document.querySelectorAll("[data-filter-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTagFilter = button.dataset.filterTag || null;
      render();
    });
  });
  document.querySelectorAll("[data-course]").forEach((button) => {
    button.addEventListener("click", () => selectCourse(button.dataset.course));
  });
  document.querySelectorAll("[data-note]").forEach((button) => {
    button.addEventListener("click", () => selectNote(button.dataset.note));
  });
  document.querySelectorAll("[data-result-type]").forEach((button) => {
    button.addEventListener("click", () =>
      openSearchResult(button.dataset.resultType, button.dataset.resultId)
    );
  });
  document.querySelector("[data-form='search']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    searchQuery = event.currentTarget.elements.query.value;
    render();
  });
  document.querySelector("[data-form='course-create']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    addCourse(form.elements.courseTitle.value, form.elements.courseSource.value);
  });
  document.querySelector("[data-form='note-create']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.noteTitle;
    addNoteForActiveCourse(input.value);
  });
  document.querySelectorAll("[data-action='append-quick']").forEach((button) => {
    button.addEventListener("click", appendQuickToNote);
  });
  document.querySelectorAll("[data-action='toggle-preview']").forEach((button) => {
    button.addEventListener("click", () => {
      notePreviewMode = !notePreviewMode;
      render();
    });
  });
  document.querySelectorAll("[data-action='start-timer']").forEach((btn) => {
    btn.addEventListener("click", startTimer);
  });
  document.querySelectorAll("[data-action='pause-timer']").forEach((btn) => {
    btn.addEventListener("click", pauseTimer);
  });
  document.querySelectorAll("[data-action='reset-timer']").forEach((btn) => {
    btn.addEventListener("click", resetTimer);
  });
  document.querySelectorAll("[data-action='carry-tomorrow']").forEach((button) => {
    button.addEventListener("click", carryTodosToTomorrow);
  });
  document.querySelectorAll("[data-action='clear-completed']").forEach((button) => {
    button.addEventListener("click", clearCompletedTodos);
  });
  document.querySelectorAll("[data-action='carry-overdue-today']").forEach((button) => {
    button.addEventListener("click", carryOverdueToToday);
  });
  document.querySelectorAll("[data-action='open-mini-window']").forEach((button) => {
    button.addEventListener("click", openMiniWindow);
  });
  document.querySelectorAll("[data-action='export-backup']").forEach((button) => {
    button.addEventListener("click", exportBackup);
  });
  document.querySelectorAll("[data-action='export-note-md']").forEach((button) => {
    button.addEventListener("click", exportActiveNoteMarkdown);
  });
  document.querySelectorAll("[data-export-course]").forEach((button) => {
    button.addEventListener("click", () => exportCourseMarkdown(button.dataset.exportCourse));
  });
  document.querySelectorAll("[data-action='open-import']").forEach((button) => {
    button.addEventListener("click", () => byId("backup-file")?.click());
  });
  byId("backup-file")?.addEventListener("change", (event) => {
    importBackup(event.target.files?.[0]);
    event.target.value = "";
  });
  document.querySelector("[data-form='sync-key']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSyncKey(byId("sync-key")?.value || "");
  });
  document.querySelectorAll("[data-action='clear-sync-key']").forEach((button) => {
    button.addEventListener("click", clearSyncKey);
  });
  document.querySelectorAll("[data-course-field]").forEach((input) => {
    input.addEventListener("change", () =>
      updateCourseField(input.dataset.courseId, input.dataset.courseField, input.value)
    );
  });
  document.querySelectorAll("[data-action='install-app']").forEach((button) => {
    button.hidden = !installPromptEvent;
    button.addEventListener("click", installApp);
  });
  document.querySelectorAll("[data-action='add-quick-note']").forEach((button) => {
    button.addEventListener("click", () => {
      const input = byId("quick-text");
      const text = input?.value || "";
      addQuickNote(text);
      if (input) {
        input.value = "";
        input.focus();
      }
    });
  });
  document.querySelectorAll("[data-action='add-todo']").forEach((button) => {
    button.addEventListener("click", () => {
      const input = byId("todo-text");
      const text = input?.value || "";
      addTodo(text);
      if (input) {
        input.value = "";
        input.focus();
      }
    });
  });
  document.querySelectorAll("[data-todo]").forEach((button) => {
    button.addEventListener("click", () => toggleTodo(button.dataset.todo));
  });
  document.querySelectorAll("[data-delete-todo]").forEach((button) => {
    button.addEventListener("click", () => deleteTodo(button.dataset.deleteTodo));
  });
  const quickForm = document.querySelector("[data-form='quick']");
  quickForm?.addEventListener("submit", (event) => event.preventDefault());
  byId("quick-text")?.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      const input = event.currentTarget;
      addQuickNote(input.value);
      input.value = "";
      input.focus();
    }
  });
  const todoForm = document.querySelector("[data-form='todo']");
  todoForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = byId("todo-text");
    const text = input?.value || "";
    addTodo(text);
    if (input) {
      input.value = "";
      input.focus();
    }
  });
  byId("note-title")?.addEventListener("input", (event) =>
    updateNoteField("title", event.target.value)
  );
  byId("note-body")?.addEventListener("input", (event) =>
    updateNoteField("content", event.target.value)
  );
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

applyTheme();
render();
hydrateFromCloud();

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (getTheme() === "auto") applyTheme();
});

window.addEventListener("hashchange", () => {
  const view = routeView();
  if (!view || view === state.activeView) return;
  state.activeView = view;
  saveState();
  render();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPromptEvent = event;
  render();
});

async function installApp() {
  if (!installPromptEvent) return;
  installPromptEvent.prompt();
  await installPromptEvent.userChoice;
  installPromptEvent = null;
  render();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app still works without offline caching.
    });
  });
}
