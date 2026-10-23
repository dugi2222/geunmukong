let savedBaseDate = "2026-10-22";
let savedShiftIndex = 8;
let customShifts = JSON.parse(localStorage.getItem("customShifts") || "{}");
const calendarArea = document.getElementById("calendarArea");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let currentDate = new Date();
const calendar = document.getElementById("calendar");


// 기존 사용자 설정을 그대로 읽고, 새 패턴이 저장되면 추가 설정만 저장합니다.
const WEEKDAY_PATTERN = ["휴무","주간","주간","주간","주간","주간","휴무"];
const LEGACY_PATTERN = ["주간","주간","주간","야간","야간","야간","비번","비번","비번"];
const PATTERNS = {
    "3-2": [
        { name: "주야비 (3일)", cycle: ["주간","야간","비번"] },
        { name: "주주야야비비 (6일)", cycle: ["주간","주간","야간","야간","비번","비번"] },
        { name: "주주주야야야비비비 (9일)", cycle: LEGACY_PATTERN }
    ],
    "4-2": [{ name: "주야비휴 (4일)", cycle: ["주간","야간","비번","휴무"] }],
    "2-2": [{ name: "주주야야비비 (예시)", cycle: ["주간","주간","야간","야간","비번","비번"] }],
    "3-3": [{ name: "주오야비 (예시)", cycle: ["주간","오후","야간","비번"] }],
    "4-3": [{ name: "주오야비휴 (예시)", cycle: ["주간","오후","야간","비번","휴무"] }]
};
const allowedPatternShifts = new Set(["주간","야간","비번","오후","휴무"]);
function validCycle(value) {
    return Array.isArray(value) && value.length > 0 && value.length <= 60 && value.every(x => allowedPatternShifts.has(x));
}
let shifts = LEGACY_PATTERN.slice();
let workModeValue = "shift";
let storedPattern;
try { storedPattern = JSON.parse(localStorage.getItem("shiftPattern") || "null"); } catch (_) { storedPattern = null; }
if (storedPattern && validCycle(storedPattern.cycle)) shifts = storedPattern.cycle.slice();
if (storedPattern?.mode === "weekday") { workModeValue = "weekday"; shifts = WEEKDAY_PATTERN.slice(); }
const storedLegacyDate = localStorage.getItem("baseDate");
const storedLegacyIndex = localStorage.getItem("shiftIndex");
if (storedLegacyDate && /^\d{4}-\d{2}-\d{2}$/.test(storedLegacyDate)) savedBaseDate = storedLegacyDate;
if (storedLegacyIndex !== null && Number.isInteger(Number(storedLegacyIndex))) savedShiftIndex = Number(storedLegacyIndex);
savedShiftIndex = ((savedShiftIndex % shifts.length) + shifts.length) % shifts.length;

function getShiftIndex(year, month, day) {
    if (workModeValue === "weekday") return new Date(Date.UTC(year, month, day)).getUTCDay();
    const [baseYear, baseMonth, baseDay] = savedBaseDate.split("-").map(Number);
    const days = Math.round((Date.UTC(year, month, day) - Date.UTC(baseYear, baseMonth - 1, baseDay)) / 86400000);
    return ((days + savedShiftIndex) % shifts.length + shifts.length) % shifts.length;
}
function getShift(year, month, day) { return shifts[getShiftIndex(year, month, day)]; }
// 연속 근무 일차: 반복 경계를 넘어 동일 근무가 이어지는 경우도 계산합니다.
function getRunDay(index) {
    const current = shifts[index];
    if (shifts.every(x => x === current)) return index + 1;
    let count = 1;
    while (count < shifts.length && shifts[(index - count + shifts.length) % shifts.length] === current) count++;
    return count;
}
function getShiftLabel(index, long = false) {
    if (workModeValue === "weekday") return shifts[index];
    const shift = shifts[index];
    const count = getRunDay(index);
    return `${shift} ${count}${long ? "일차" : ""}`;
}

// 고정 날짜 공휴일과 기념일
const specialDays = {
    "01-01": { name: "신정", type: "holiday" },
    "02-14": { name: "발렌타인데이", type: "event" },
    "03-01": { name: "삼일절", type: "holiday" },
    "03-14": { name: "화이트데이", type: "event" },
    "05-05": { name: "어린이날", type: "holiday" },
    "06-06": { name: "현충일", type: "holiday" },
    "08-15": { name: "광복절", type: "holiday" },
    "10-03": { name: "개천절", type: "holiday" },
    "10-09": { name: "한글날", type: "holiday" },
    "11-11": { name: "빼빼로데이", type: "event" },
    "12-25": { name: "크리스마스", type: "holiday" }
};

// 7단계: 날짜별 일정/메모는 기존 근무 변경과 별도의 키에 저장합니다.
let dayNotes = {};
try {
    const storedNotes = JSON.parse(localStorage.getItem("dayNotes") || "{}");
    if (storedNotes && typeof storedNotes === "object" && !Array.isArray(storedNotes)) dayNotes = storedNotes;
} catch (_) {}
const escapeNoteHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function persistDayNotes() {
    try { localStorage.setItem("dayNotes", JSON.stringify(dayNotes)); return true; }
    catch (_) { alert("저장 공간이 부족해 일정을 저장하지 못했어요."); return false; }
}
function getNotes(dateKey) { return Array.isArray(dayNotes[dateKey]) ? dayNotes[dateKey] : []; }

function buildMonthHTML(viewDate) {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const today = new Date();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    let html = "<table><thead><tr>";
    weekdays.forEach((day, i) => {
        html += `<th class="${i === 0 ? "sunday" : i === 6 ? "saturday" : ""}">${day}</th>`;
    });
    html += "</tr></thead><tbody>";

    // 언제나 6주(42칸)를 그려 달력과 오늘의 근무 카드 위치를 고정합니다.
    for (let i = 0; i < 42; i++) {
        if (i % 7 === 0) html += "<tr>";
        const cellDate = new Date(year, month, i - firstDay + 1);
        const y = cellDate.getFullYear();
        const m = cellDate.getMonth();
        const d = cellDate.getDate();
        const inMonth = m === month;
        const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const special = specialDays[key.slice(5)];
        const shift = customShifts[key] || getShift(y, m, d);
        const shiftIndex = getShiftIndex(y, m, d);
        const shiftDay = getRunDay(shiftIndex);
        const shiftDisplay = workModeValue === "weekday" ? shift : `${shift} ${shiftDay}`;
        const isToday = y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
        const color = {"주간":"day", "야간":"night", "비번":"off", "연차":"leave", "당직":"duty", "휴무":"holiday", "오후":"afternoon"}[shift] || "";
        const weekend = i % 7 === 0 ? "sunday" : i % 7 === 6 ? "saturday" : "";
        const notes = getNotes(key);
        const noteEmoji = notes.find(note => note.emoji)?.emoji || "";
        const noteTitle = notes.find(note => note.title)?.title || notes.find(note => note.text)?.text?.split("\n")[0] || "";
        const noteIndicator = inMonth && notes.length ? `<span class="note-emoji">${escapeNoteHTML(noteEmoji || "📝")}</span>${noteTitle ? `<small class="note-preview">${escapeNoteHTML(noteTitle)}</small>` : ""}` : "";
        // 다른 달 날짜는 연하게만 표시하고, 클릭해서 근무를 바꾸지 않도록 합니다.
        html += `<td ${inMonth ? `data-date="${key}"` : ""} class="${inMonth ? color : "adjacent-month"} ${isToday ? "today" : ""}">
            <span class="date-number ${weekend} ${inMonth && special?.type === "holiday" ? "public-holiday" : ""}">${d}</span>
            ${inMonth ? `<div>${customShifts[key] ? shift : shiftDisplay}</div>${special ? `<small class="special-day ${special.type}">${special.name}</small>` : ""}${noteIndicator}` : ""}
        </td>`;
        if (i % 7 === 6) html += "</tr>";
    }
    return html + "</tbody></table>";
}

// 이전 달 / 현재 달 / 다음 달을 한 줄에 나란히 배치
function offsetMonth(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

let sliding = false;
let suppressCalendarClick = false;
let slideTimer = null;

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    document.getElementById("monthTitle").innerHTML = `<span class="year-label">${year}년</span><span class="month-label">${month + 1}월</span>`;
    calendar.innerHTML = `<div class="calendar-track">
        <div class="calendar-page">${buildMonthHTML(offsetMonth(currentDate, -1))}</div>
        <div class="calendar-page">${buildMonthHTML(currentDate)}</div>
        <div class="calendar-page">${buildMonthHTML(offsetMonth(currentDate, 1))}</div>
    </div>`;
    const track = calendar.querySelector(".calendar-track");
    track.style.transform = "translate3d(-33.333333%, 0, 0)";
}

function moveMonth(direction) {
    if (sliding) return;
    sliding = true;
    const track = calendar.querySelector(".calendar-track");
    if (!track) { sliding = false; return; }
    track.style.transition = "transform 300ms cubic-bezier(.22,.75,.25,1)";
    track.style.transform = direction > 0
        ? "translate3d(-66.666667%, 0, 0)"
        : "translate3d(0%, 0, 0)";
    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => {
        currentDate = offsetMonth(currentDate, direction);
        renderCalendar();
        sliding = false;
    }, 310);
}

prevBtn.addEventListener("click", function() { moveMonth(-1); });

nextBtn.addEventListener("click", function() { moveMonth(1); });

function updateTodayCard() {
    const today = new Date();

    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();
    const weekdays = [
    "일요일", "월요일", "화요일", "수요일",
    "목요일", "금요일", "토요일"
];

document.getElementById("todayDayNumber").textContent = date;

document.getElementById("todayMonthWeek").textContent =
    `${month + 1}월 · ${weekdays[today.getDay()]}`;

    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    const shift = customShifts[dateKey] || getShift(year, month, date);

    const index = getShiftIndex(year, month, date);
    const shiftDay = getRunDay(index);

    document.getElementById("todayShift").textContent =
        customShifts[dateKey] || workModeValue === "weekday" ? shift : `${shift} ${shiftDay}일차`;

    const messages = {
        "주간": "오늘도 힘내서 다녀와요! ☀️",
        "야간": "밤 근무도 파이팅! 🌙",
        "오후": "오후 근무도 힘내요! 🌇",
        "비번": "오늘은 푹 쉬어요! 🍀",
        "연차": "오늘은 연차! 즐겁게 쉬어요 🌴",
        "당직": "당직도 안전하게 다녀와요! 🕒",
        "휴무": "오늘은 휴무! 푹 쉬어요 🏠"
    };

    document.getElementById("todayMessage").textContent =
        messages[shift];
}

updateTodayCard();

const workMode = document.getElementById("workMode");
const rotationSettings = document.getElementById("rotationSettings");
const weekdayHint = document.getElementById("weekdayHint");
function updateWorkModeUI() {
    const weekday = workMode.value === "weekday";
    rotationSettings.hidden = weekday;
    weekdayHint.hidden = !weekday;
}
workMode.value = workModeValue;
workMode.addEventListener("change", updateWorkModeUI);
updateWorkModeUI();
const teamCount = document.getElementById("teamCount");
const shiftType = document.getElementById("shiftType");
const patternPreset = document.getElementById("patternPreset");
const customPatternPanel = document.getElementById("customPatternPanel");
const patternChips = document.getElementById("patternChips");
const referenceIndex = document.getElementById("referenceIndex");
let editingCycle = shifts.slice();
let selectedCycle = shifts.slice();

function renderChips() {
    patternChips.replaceChildren();
    editingCycle.forEach((shift, i) => {
        const chip = document.createElement("span");
        chip.className = "pattern-chip";
        chip.textContent = `${i + 1}. ${shift}`;
        patternChips.appendChild(chip);
    });
    if (!editingCycle.length) patternChips.textContent = "아래 버튼으로 근무 순서를 추가해 주세요.";
}
function renderReferenceIndex(preferred = 0) {
    referenceIndex.replaceChildren();
    selectedCycle.forEach((shift, i) => {
        const option = document.createElement("option");
        option.value = String(i);
        // 여기서는 반복되는 '주간'도 서로 구분되도록 전체 순번을 표시합니다.
        option.textContent = `${i + 1}번째 · ${shift}`;
        referenceIndex.appendChild(option);
    });
    referenceIndex.value = String(Math.min(Math.max(preferred, 0), selectedCycle.length - 1));
}
function selectCycle(cycle, preferred = 0) {
    if (!validCycle(cycle)) { selectedCycle = []; referenceIndex.replaceChildren(); return; }
    selectedCycle = cycle.slice();
    renderReferenceIndex(preferred);
}
function refreshPresets(preferredCycle = null, preferredIndex = 0) {
    const key = `${teamCount.value}-${shiftType.value}`;
    const options = PATTERNS[key] || [];
    patternPreset.replaceChildren();
    options.forEach((item, i) => {
        const option = document.createElement("option");
        option.value = String(i);
        option.textContent = item.name;
        patternPreset.appendChild(option);
    });
    const custom = document.createElement("option");
    custom.value = "custom";
    custom.textContent = "✏️ 직접 패턴 만들기";
    patternPreset.appendChild(custom);
    const matched = preferredCycle && options.findIndex(item => JSON.stringify(item.cycle) === JSON.stringify(preferredCycle));
    patternPreset.value = matched !== null && matched >= 0 ? String(matched) : preferredCycle ? "custom" : options.length ? "0" : "custom";
    if (patternPreset.value === "custom") editingCycle = preferredCycle ? preferredCycle.slice() : editingCycle.slice();
    applyPreset(preferredIndex);
}
function applyPreset(preferredIndex = 0) {
    const custom = patternPreset.value === "custom";
    customPatternPanel.hidden = !custom;
    if (custom) { renderChips(); selectCycle(editingCycle, preferredIndex); }
    else {
        const preset = (PATTERNS[`${teamCount.value}-${shiftType.value}`] || [])[Number(patternPreset.value)];
        if (preset) selectCycle(preset.cycle, preferredIndex);
    }
}
teamCount.addEventListener("change", () => refreshPresets());
shiftType.addEventListener("change", () => refreshPresets());
patternPreset.addEventListener("change", () => applyPreset());
document.querySelectorAll("[data-add-shift]").forEach(button => button.addEventListener("click", () => {
    if (editingCycle.length >= 60) { alert("패턴은 최대 60일까지 만들 수 있어요."); return; }
    editingCycle.push(button.dataset.addShift);
    renderChips(); selectCycle(editingCycle, editingCycle.length - 1);
}));
document.getElementById("removePatternShift").addEventListener("click", () => {
    editingCycle.pop(); renderChips(); selectCycle(editingCycle);
});
document.getElementById("clearPattern").addEventListener("click", () => {
    editingCycle = []; renderChips(); selectCycle(editingCycle);
});

// 기존 저장된 9일 패턴은 기본 3조2교대 설정으로 그대로 복원합니다.
teamCount.value = storedPattern?.team || "3";
shiftType.value = storedPattern?.type || "2";
if (!["2","3","4","5","other"].includes(teamCount.value)) teamCount.value = "other";
if (!["2","3","other"].includes(shiftType.value)) shiftType.value = "other";
document.getElementById("baseDateInput").value = savedBaseDate;
refreshPresets(shifts, savedShiftIndex);

document.getElementById("saveShiftBtn").addEventListener("click", function() {
    const date = document.getElementById("baseDateInput").value;
    const weekdayMode = workMode.value === "weekday";
    const index = weekdayMode ? new Date(date + "T00:00:00Z").getUTCDay() : Number(referenceIndex.value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert("기준 날짜를 선택해 주세요."); return; }
    if (!weekdayMode && !validCycle(selectedCycle)) { alert("근무 순서를 한 개 이상 추가해 주세요."); return; }
    if (!Number.isInteger(index) || index < 0 || index >= (weekdayMode ? 7 : selectedCycle.length)) { alert("기준 날짜의 근무 순서를 선택해 주세요."); return; }
    savedBaseDate = date;
    savedShiftIndex = index;
    shifts = weekdayMode ? WEEKDAY_PATTERN.slice() : selectedCycle.slice();
    workModeValue = weekdayMode ? "weekday" : "shift";
    // 기존 키는 유지해 구버전 설정과 사용자별 근무 변경 기록을 보존합니다.
    localStorage.setItem("baseDate", savedBaseDate);
    localStorage.setItem("shiftIndex", String(savedShiftIndex));
    localStorage.setItem("shiftPattern", JSON.stringify({mode: workModeValue, team: teamCount.value, type: shiftType.value, cycle: shifts}));
    renderCalendar();
    updateTodayCard();
    alert(weekdayMode ? "📅 평일근무 설정이 저장됐어요!" : "🌱 근무 패턴이 저장됐어요!");
});

updateTodayCard();

const themeBtn = document.getElementById("themeBtn");

function updateThemeButton() {
    if (document.body.classList.contains("dark")) {
        themeBtn.textContent = "☀️ 라이트모드";
    } else {
        themeBtn.textContent = "🌙 다크모드";
    }
}

themeBtn.addEventListener("click", function() {
    document.body.classList.toggle("dark");

    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("darkMode", isDark);

    updateThemeButton();
    if (typeof refreshShiftColors === "function") refreshShiftColors();
});

// 저장된 다크모드 설정 불러오기
if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
}

updateThemeButton();

// 5-1: 캐릭터 테마 선택과 로컬 저장. 기존 근무표 데이터와 독립적으로 관리합니다.
const mascotThemeSelect = document.getElementById("mascotTheme");
const mascotThemeNames = {
    bean: { icon: "🌱", name: "근무콩" },
    dog: { icon: "🐶", name: "근무멍" },
    cat: { icon: "🐱", name: "근무냥" }
};
// 5-3: 캐릭터별 근무 색상은 별도로 저장합니다. 다른 사용자 설정은 변경하지 않습니다.
const shiftColorDefaults = {
    bean: {day:"#dceBff",night:"#ede2ff",off:"#ddf5e7"},
    dog: {day:"#fff0b5",night:"#d9e3f7",off:"#ffe0df"},
    cat: {day:"#fce5df",night:"#e8ddfa",off:"#d9f1ed"}
};
const shiftColorDarkDefaults = {
    bean:{day:"#243b57",night:"#413255",off:"#25483a"},
    dog:{day:"#584b2c",night:"#273b5c",off:"#58383a"},
    cat:{day:"#593b3d",night:"#443459",off:"#284b4a"}
};
const colorInputs = {
    day: document.getElementById("shiftDayColor"),
    night: document.getElementById("shiftNightColor"),
    off: document.getElementById("shiftOffColor")
};
const validHex = value => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
let savedShiftColors = {};
try {
    const parsed = JSON.parse(localStorage.getItem("mascotShiftColors") || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) savedShiftColors = parsed;
} catch (_) {}
function currentColors(theme) {
    const custom = savedShiftColors[theme] || {};
    const defaults = document.body.classList.contains("dark") ? shiftColorDarkDefaults[theme] : shiftColorDefaults[theme];
    return Object.fromEntries(["day","night","off"].map(k => [k,validHex(custom[k]) ? custom[k] : defaults[k]]));
}
function refreshShiftColors() {
    const theme = document.body.dataset.mascotTheme || "bean";
    const colors = currentColors(theme);
    for (const key of ["day","night","off"]) {
        document.body.style.setProperty(`--custom-shift-${key}`,colors[key]);
        colorInputs[key].value = colors[key];
    }
}
function persistShiftColors() {
    try { localStorage.setItem("mascotShiftColors",JSON.stringify(savedShiftColors)); } catch (_) {}
}
for (const [key,input] of Object.entries(colorInputs)) {
    input.addEventListener("input", () => {
        const theme = document.body.dataset.mascotTheme || "bean";
        savedShiftColors[theme] = {...currentColors(theme),[key]:input.value};
        refreshShiftColors();
        persistShiftColors();
    });
}
document.getElementById("resetShiftColors").addEventListener("click", () => {
    const theme = document.body.dataset.mascotTheme || "bean";
    delete savedShiftColors[theme];
    refreshShiftColors();
    persistShiftColors();
});
function applyMascotTheme(theme) {
    const safeTheme = Object.hasOwn(mascotThemeNames, theme) ? theme : "bean";
    document.body.dataset.mascotTheme = safeTheme;
    mascotThemeSelect.value = safeTheme;
    refreshShiftColors();
    const mascot = mascotThemeNames[safeTheme];
    const splash = document.querySelector(".splash-bean");
    if (splash) splash.textContent = mascot.icon;
    const splashTitle = document.querySelector("#homeScreen h1");
    if (splashTitle) splashTitle.textContent = mascot.name;
}
let savedMascotTheme = "bean";
try { savedMascotTheme = localStorage.getItem("mascotTheme") || "bean"; } catch (_) {}
applyMascotTheme(savedMascotTheme);
mascotThemeSelect.addEventListener("change", function() {
    applyMascotTheme(this.value);
    try { localStorage.setItem("mascotTheme", document.body.dataset.mascotTheme); } catch (_) {}
});

const menuBtn = document.getElementById("menuBtn");
const shiftSettings = document.getElementById("shiftSettings");

menuBtn.addEventListener("click", function() {
    shiftSettings.hidden = !shiftSettings.hidden;
});

// 앱 실행 1.5초 후 달력 표시
setTimeout(function() {
    document.getElementById("homeScreen").hidden = true;
    document.getElementById("calendarArea").hidden = false;
    renderCalendar();
}, 1500);

// 날짜별 근무 변경 팝업
const shiftPopup = document.getElementById("shiftPopup");
const popupDate = document.getElementById("popupDate");

// 달력 날짜 클릭 시 팝업 열기
calendar.addEventListener("click", function(event) {
    if (suppressCalendarClick || sliding) { event.preventDefault(); return; }
    const cell = event.target.closest("td[data-date]");

    if (!cell) return;

    const selectedDate = cell.dataset.date;
    activeNoteDate = selectedDate;

    popupDate.textContent = selectedDate + " 근무 변경";
    const [y, m, d] = selectedDate.split("-").map(Number);
    document.getElementById("customShift").value = customShifts[selectedDate] || getShift(y, m - 1, d);
    editingNoteIndex = -1;
    clearNoteEditor();
    renderDayNotes(selectedDate);
    document.getElementById("noteSaveStatus").textContent = "";
    shiftPopup.hidden = false;
});

let editingNoteIndex = -1;
function clearNoteEditor() {
    document.getElementById("dayNoteEmoji").value = "";
    document.getElementById("dayNoteTitle").value = "";
    document.getElementById("dayNoteText").value = "";
    document.getElementById("saveDayNote").textContent = "일정 추가";
    document.getElementById("cancelDayNoteEdit").hidden = true;
}
let activeNoteDate = "";
function selectedNoteDate() { return activeNoteDate; }
function renderDayNotes(dateKey) {
    const list = document.getElementById("dayNotesList");
    const notes = getNotes(dateKey);
    list.replaceChildren();
    if (!notes.length) { const empty = document.createElement("p"); empty.textContent = "등록된 일정이 없어요."; empty.className = "notes-empty"; list.appendChild(empty); return; }
    notes.forEach((note, index) => {
        const item = document.createElement("div"); item.className = "day-note-item";
        const content = document.createElement("div"); content.className = "day-note-content";
        const title = document.createElement("strong"); title.textContent = `${note.emoji || "📝"} ${note.title || "메모"}`; content.appendChild(title);
        if (note.text) { const body = document.createElement("p"); body.textContent = note.text; content.appendChild(body); }
        const actions = document.createElement("div"); actions.className = "day-note-item-actions";
        const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "수정";
        edit.addEventListener("click", () => {
            editingNoteIndex = index;
            document.getElementById("dayNoteEmoji").value = note.emoji || "";
            document.getElementById("dayNoteTitle").value = note.title || "";
            document.getElementById("dayNoteText").value = note.text || "";
            document.getElementById("saveDayNote").textContent = "수정 저장";
            document.getElementById("cancelDayNoteEdit").hidden = false;
        });
        const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "삭제";
        remove.addEventListener("click", () => {
            if (!confirm("이 일정을 삭제할까요?")) return;
            const next = getNotes(dateKey).slice(); next.splice(index, 1);
            if (next.length) dayNotes[dateKey] = next; else delete dayNotes[dateKey];
            persistDayNotes(); editingNoteIndex = -1; clearNoteEditor(); renderDayNotes(dateKey); renderCalendar();
        });
        actions.append(edit, remove); item.append(content, actions); list.appendChild(item);
    });
}
function saveNoteFromEditor({ requireContent = false } = {}) {
    const dateKey = selectedNoteDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) { alert("날짜를 다시 선택해 줘!"); return false; }
    const note = {
        emoji: document.getElementById("dayNoteEmoji").value,
        title: document.getElementById("dayNoteTitle").value.trim(),
        text: document.getElementById("dayNoteText").value.trim()
    };
    if (!note.emoji && !note.title && !note.text) {
        if (requireContent) alert("이모지, 제목, 메모 중 하나는 입력해 줘!");
        return !requireContent;
    }
    const next = getNotes(dateKey).slice();
    if (editingNoteIndex >= 0 && editingNoteIndex < next.length) next[editingNoteIndex] = note;
    else next.push(note);
    const previous = dayNotes[dateKey];
    dayNotes[dateKey] = next;
    if (!persistDayNotes()) {
        if (previous === undefined) delete dayNotes[dateKey]; else dayNotes[dateKey] = previous;
        return false;
    }
    try {
        const verified = JSON.parse(localStorage.getItem("dayNotes") || "{}");
        if (!Array.isArray(verified[dateKey]) || verified[dateKey].length !== next.length) throw new Error("저장 확인 실패");
    } catch (_) {
        alert("메모 저장을 확인하지 못했어. 브라우저 저장 공간을 확인해 줘!");
        return false;
    }
    editingNoteIndex = -1;
    clearNoteEditor();
    renderDayNotes(dateKey);
    renderCalendar();
    return true;
}
document.getElementById("saveDayNote").addEventListener("click", () => {
    if (saveNoteFromEditor({requireContent:true})) {
        const status = document.getElementById("noteSaveStatus");
        status.textContent = "✓ 일정이 저장됐어! 달력에도 표시했어.";
    }
});
document.getElementById("cancelDayNoteEdit").addEventListener("click", () => { editingNoteIndex = -1; clearNoteEditor(); });

// 닫기 버튼
document.getElementById("closePopup").addEventListener("click", function() {
    shiftPopup.hidden = true;
});

/* 날짜별 근무 변경 저장 */



// 저장 버튼
document.getElementById("saveCustomShift").addEventListener("click", function() {
    // 아래쪽 저장 버튼도 작성 중인 메모를 함께 저장합니다.
    if (!saveNoteFromEditor()) return;
    const selectedDate = selectedNoteDate();
    const selectedShift = document.getElementById("customShift").value;

    customShifts[selectedDate] = selectedShift;

    localStorage.setItem(
        "customShifts",
        JSON.stringify(customShifts)
    );

    shiftPopup.hidden = true;
    renderCalendar();
    updateTodayCard();
});

// 기본 근무로 복구 버튼
document.getElementById("resetCustomShift").addEventListener("click", function() {
    const selectedDate = selectedNoteDate();

    delete customShifts[selectedDate];

    localStorage.setItem(
        "customShifts",
        JSON.stringify(customShifts)
    );

    shiftPopup.hidden = true;
    renderCalendar();
    updateTodayCard();
});

// 근무 변경 내역 확인
const changesPopup = document.getElementById("changesPopup");
const changesList = document.getElementById("changesList");

document.getElementById("showChangesBtn").addEventListener("click", function() {
    const dates = Object.keys(customShifts).sort();

    changesList.innerHTML = "";

    if (dates.length === 0) {
        changesList.textContent = "아직 변경한 근무가 없어요 🌱";
    } else {
        dates.forEach(function(dateKey) {
            const [year, month, day] = dateKey.split("-").map(Number);

            const index = getShiftIndex(year, month - 1, day);
            const originalShift = shifts[index];
            const originalDay = getRunDay(index);
            const changedShift = customShifts[dateKey];

            const item = document.createElement("div");
            item.className = "change-item";

            const dateText = document.createElement("strong");
            dateText.textContent = `${year}. ${month}. ${day}.`;

            const shiftText = document.createElement("span");
            shiftText.textContent =
                `${originalShift} ${originalDay}일차 → ${changedShift}`;

            item.appendChild(dateText);
            item.appendChild(shiftText);

// 원상복구 버튼 만들기
const resetBtn = document.createElement("button");
resetBtn.textContent = "되돌리기";
resetBtn.className = "change-reset-btn";

resetBtn.addEventListener("click", function() {
    const confirmed = confirm(
        `${year}년 ${month}월 ${day}일의 근무를 원래대로 복구할까요?`
    );

    if (!confirmed) return;

    // 해당 날짜의 변경 내역 삭제
    delete customShifts[dateKey];

    // 저장된 변경 내역 갱신
    localStorage.setItem(
        "customShifts",
        JSON.stringify(customShifts)
    );

    // 달력과 오늘의 근무 갱신
    renderCalendar();
    updateTodayCard();

    // 목록에서 해당 항목 제거
    item.remove();

    // 변경 내역이 모두 사라졌다면 안내 표시
    if (Object.keys(customShifts).length === 0) {
        changesList.textContent = "아직 변경한 근무가 없어요 🌱";
    }
});

item.appendChild(resetBtn);
changesList.appendChild(item);

        });
    }

    shiftSettings.hidden = true;
    changesPopup.hidden = false;
});

// 닫기 버튼
document.getElementById("closeChangesBtn").addEventListener("click", function() {
    changesPopup.hidden = true;
});

// 여러 날짜 일괄 변경
const bulkPopup = document.getElementById("bulkPopup");
const bulkStart = document.getElementById("bulkStart");
const bulkEnd = document.getElementById("bulkEnd");
const bulkShift = document.getElementById("bulkShift");

// 한 팝업 안의 달력에서 시작일과 종료일을 차례로 선택
const bulkMonthTitle = document.getElementById("bulkMonthTitle");
const bulkDateGrid = document.getElementById("bulkDateGrid");
const bulkRangeStart = document.getElementById("bulkRangeStart");
const bulkRangeEnd = document.getElementById("bulkRangeEnd");
let bulkViewYear = new Date().getFullYear();
let bulkViewMonth = new Date().getMonth();
const bulkDateKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
function renderBulkDatePicker() {
    bulkMonthTitle.textContent = `${bulkViewYear}년 ${bulkViewMonth + 1}월`;
    bulkDateGrid.replaceChildren();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    weekdays.forEach((day, index) => {
        const header = document.createElement("span");
        header.className = "bulk-weekday" + (index === 0 ? " sunday" : index === 6 ? " saturday" : "");
        header.textContent = day;
        bulkDateGrid.appendChild(header);
    });
    const offset = new Date(bulkViewYear, bulkViewMonth, 1).getDay();
    const count = new Date(bulkViewYear, bulkViewMonth + 1, 0).getDate();
    for (let i = 0; i < offset; i++) {
        const blank = document.createElement("span");
        bulkDateGrid.appendChild(blank);
    }
    for (let day = 1; day <= count; day++) {
        const key = bulkDateKey(bulkViewYear, bulkViewMonth, day);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = day;
        button.setAttribute("aria-label", key);
        button.className = "bulk-day";
        if (bulkStart.value && key === bulkStart.value) button.classList.add("range-edge");
        if (bulkEnd.value && key === bulkEnd.value) button.classList.add("range-edge");
        if (bulkStart.value && bulkEnd.value && key > bulkStart.value && key < bulkEnd.value) button.classList.add("range-middle");
        button.setAttribute("aria-pressed", key === bulkStart.value || key === bulkEnd.value ? "true" : "false");
        button.addEventListener("click", () => {
            if (!bulkStart.value || bulkEnd.value) {
                bulkStart.value = key;
                bulkEnd.value = "";
            } else if (key < bulkStart.value) {
                bulkEnd.value = bulkStart.value;
                bulkStart.value = key;
            } else {
                bulkEnd.value = key;
            }
            renderBulkDatePicker();
        });
        bulkDateGrid.appendChild(button);
    }
    bulkRangeStart.textContent = `시작일: ${bulkStart.value || "미선택"}`;
    bulkRangeEnd.textContent = `종료일: ${bulkEnd.value || "미선택"}`;
}
document.getElementById("bulkPrevMonth").addEventListener("click", () => {
    const date = new Date(bulkViewYear, bulkViewMonth - 1, 1);
    bulkViewYear = date.getFullYear(); bulkViewMonth = date.getMonth();
    renderBulkDatePicker();
});
document.getElementById("bulkNextMonth").addEventListener("click", () => {
    const date = new Date(bulkViewYear, bulkViewMonth + 1, 1);
    bulkViewYear = date.getFullYear(); bulkViewMonth = date.getMonth();
    renderBulkDatePicker();
});
document.getElementById("bulkResetRange").addEventListener("click", () => {
    bulkStart.value = ""; bulkEnd.value = "";
    renderBulkDatePicker();
});

// 메뉴에서 창 열기
document.getElementById("bulkChangeBtn").addEventListener("click", function() {
    shiftSettings.hidden = true;

    const today = new Date();
    const localToday =
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    bulkStart.value = "";
    bulkEnd.value = "";
    bulkViewYear = today.getFullYear();
    bulkViewMonth = today.getMonth();
    bulkShift.value = "연차";
    renderBulkDatePicker();

    bulkPopup.hidden = false;
});

// 닫기
document.getElementById("closeBulkPopup").addEventListener("click", function() {
    bulkPopup.hidden = true;
});

// 여러 날짜 저장
document.getElementById("saveBulkChange").addEventListener("click", function() {
    const start = bulkStart.value;
    const end = bulkEnd.value;
    const shift = bulkShift.value;

    if (!start || !end) {
        alert("시작 날짜와 종료 날짜를 선택해 주세요!");
        return;
    }

    if (start > end) {
        alert("종료 날짜가 시작 날짜보다 빠를 수 없어요!");
        return;
    }

    const startDate = new Date(start + "T00:00:00Z");
    const endDate = new Date(end + "T00:00:00Z");

    const days =
        Math.round((endDate - startDate) / 86400000) + 1;

    if (days > 366) {
        alert("한 번에 최대 366일까지만 변경할 수 있어요!");
        return;
    }

    if (!confirm(`${days}일을 모두 '${shift}'(으)로 변경할까요?`)) {
        return;
    }

    // 선택한 기간의 모든 날짜 변경
    const cursor = new Date(start + "T00:00:00Z");

    while (cursor <= endDate) {
        const key =
            `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`;

        customShifts[key] = shift;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    localStorage.setItem(
        "customShifts",
        JSON.stringify(customShifts)
    );

    bulkPopup.hidden = true;
    renderCalendar();
    updateTodayCard();

    alert(`🌱 ${days}일의 근무를 변경했어요!`);
});

// 메뉴 안에서 기준 근무 설정 접기/펼치기
const toggleBaseSettings = document.getElementById("toggleBaseSettings");
const baseSettingsFields = document.getElementById("baseSettingsFields");

if (toggleBaseSettings && baseSettingsFields) {
    toggleBaseSettings.addEventListener("click", function() {
        baseSettingsFields.hidden = !baseSettingsFields.hidden;
        toggleBaseSettings.setAttribute(
            "aria-expanded",
            String(!baseSettingsFields.hidden)
        );
        toggleBaseSettings.textContent =
            baseSettingsFields.hidden
                ? "⚙️ 내 근무 설정 ▾"
                : "⚙️ 내 근무 설정 ▴";
    });
}

/* 달력을 손가락/마우스로 끌면 옆 달력이 따라옵니다. */
let dragStartX = 0;
let dragStartY = 0;
let dragDeltaX = 0;
let dragActive = false;
let dragHorizontal = false;
let dragPointerId = null;

calendar.addEventListener("pointerdown", function(e) {
    if (sliding || (e.pointerType === "mouse" && e.button !== 0)) return;
    dragActive = true;
    dragHorizontal = false;
    dragPointerId = e.pointerId;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragDeltaX = 0;
    const track = calendar.querySelector(".calendar-track");
    if (track) track.style.transition = "none";
});

calendar.addEventListener("pointermove", function(e) {
    if (!dragActive || e.pointerId !== dragPointerId) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (!dragHorizontal) {
        if (Math.abs(dx) < 7) return;
        if (Math.abs(dy) > Math.abs(dx)) {
            dragActive = false; // 세로 스크롤은 브라우저에 맡김
            return;
        }
        dragHorizontal = true;
        if (e.pointerType === "mouse") calendar.setPointerCapture(e.pointerId);
    }
    dragDeltaX = Math.max(-calendar.clientWidth, Math.min(calendar.clientWidth, dx));
    const track = calendar.querySelector(".calendar-track");
    if (track) track.style.transform = `translate3d(calc(-33.333333% + ${dragDeltaX}px), 0, 0)`;
});

function finishDrag(e) {
    if (!dragActive || e.pointerId !== dragPointerId) return;
    dragActive = false;
    if (!dragHorizontal) return;
    suppressCalendarClick = true;
    setTimeout(() => { suppressCalendarClick = false; }, 350);
    if (Math.abs(dragDeltaX) > Math.min(80, calendar.clientWidth * 0.2)) {
        moveMonth(dragDeltaX < 0 ? 1 : -1);
    } else {
        const track = calendar.querySelector(".calendar-track");
        if (track) {
            track.style.transition = "transform 250ms ease";
            track.style.transform = "translate3d(-33.333333%, 0, 0)";
        }
    }
}
calendar.addEventListener("pointerup", finishDrag);
calendar.addEventListener("pointercancel", function(e) {
    if (!dragActive || e.pointerId !== dragPointerId) return;
    dragActive = false;
    const track = calendar.querySelector(".calendar-track");
    if (track) {
        track.style.transition = "transform 250ms ease";
        track.style.transform = "translate3d(-33.333333%, 0, 0)";
    }
});

// 캐릭터 테마 및 근무 색상 설정 접기/펼치기
(() => {
  const toggle = document.getElementById("toggleThemeSettings");
  const fields = document.getElementById("themeSettingsFields");
  if (!toggle || !fields) return;
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    fields.hidden = expanded;
    toggle.setAttribute("aria-expanded", String(!expanded));
    toggle.textContent = expanded
      ? "🎭 캐릭터 테마 · 근무 색상 ▾"
      : "🎭 캐릭터 테마 · 근무 색상 ▴";
  });
})();
