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
        const specials = getSpecialDays(key);
        const hasHoliday = specials.some(item => item.type === "holiday");
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
            <span class="date-number ${weekend} ${inMonth && hasHoliday ? "public-holiday" : ""}">${d}</span>
            ${inMonth ? `<div>${customShifts[key] ? shift : shiftDisplay}</div>${specials.map(item => `<small class="special-day ${item.type}" title="${escapeNoteHTML(item.name)}">${escapeNoteHTML(item.name)}</small>`).join("")}${noteIndicator}` : ""}
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
    if (typeof renderWorkStats === "function") renderWorkStats();
    if (window.workSettingsDrawerActive) {
        window.dispatchEvent(new Event('work-settings-saved'));
    } else {
        alert(weekdayMode ? "📅 평일근무 설정이 저장됐어요!" : "🌱 근무 패턴이 저장됐어요!");
    }
});

updateTodayCard();

