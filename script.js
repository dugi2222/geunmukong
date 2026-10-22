let savedBaseDate = "2026-10-22";
let savedShiftIndex = 8;
let customShifts = JSON.parse(localStorage.getItem("customShifts") || "{}");
const calendarArea = document.getElementById("calendarArea");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let currentDate = new Date();
const calendar = document.getElementById("calendar");


// 근무 순서: 주간 3일 → 야간 3일 → 비번 3일
const shifts = [
    "주간", "주간", "주간",
    "야간", "야간", "야간",
    "비번", "비번", "비번"
];

// 날짜에 맞는 근무 계산
function getShiftIndex(year, month, day) {
    const [baseYear, baseMonth, baseDay] =
        savedBaseDate.split("-").map(Number);

    const target = Date.UTC(year, month, day);
    const base = Date.UTC(baseYear, baseMonth - 1, baseDay);

    const days = Math.round((target - base) / 86400000);

    return ((days + savedShiftIndex) % 9 + 9) % 9;
}

function getShift(year, month, day) {
    return shifts[getShiftIndex(year, month, day)];
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

function buildMonthHTML(viewDate) {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();


let html = "";
    html += "<table><tr>";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

weekdays.forEach(function(day, index) {
    const weekendClass =
        index === 0 ? "sunday" :
        index === 6 ? "saturday" : "";

    html += `<th class="${weekendClass}">${day}</th>`;
});

    html += "</tr><tr>";

    for (let i = 0; i < firstDay; i++) {
        html += "<td></td>";
    }

    for (let date = 1; date <= lastDate; date++) {
        if ((firstDay + date - 1) % 7 === 0 && date !== 1) {
            html += "</tr><tr>";
        }

        const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
        const monthDay = dateKey.slice(5);
        const special = specialDays[monthDay];

        const shift = customShifts[dateKey] || getShift(year, month, date);

const index = getShiftIndex(year, month, date);
const shiftDay = (index % 3) + 1;

const today = new Date();
const isToday =
    year === today.getFullYear() &&
    month === today.getMonth() &&
    date === today.getDate();

        let color = "";
        if (shift === "주간") color = "day";
        if (shift === "야간") color = "night";
        if (shift === "비번") color = "off";
        if (shift === "연차") color = "leave";
        if (shift === "당직") color = "duty";
        if (shift === "휴무") color = "holiday";


        const dayOfWeek = (firstDay + date - 1) % 7;

const weekendClass =
    dayOfWeek === 0 ? "sunday" :
    dayOfWeek === 6 ? "saturday" : "";

html += `
    <td data-date="${dateKey}" class="${color} ${isToday ? 'today' : ''}">
        <span class="date-number ${weekendClass} ${special?.type === "holiday" ? "public-holiday" : ""}">${date}</span>
        <div>${customShifts[dateKey] ? shift : `${shift} ${shiftDay}`}</div>
        ${special ? `<small class="special-day ${special.type}">${special.name}</small>` : ""}

    </td>
`;
    }

    html += "</tr></table>";
    return html;
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
    document.getElementById("monthTitle").textContent = `${year}년 ${month + 1}월`;
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

    const target = Date.UTC(year, month, date);
    const base = Date.UTC(2026, 9, 22);
    const days = Math.round((target - base) / 86400000);
    const index = getShiftIndex(year, month, date);
    const shiftDay = (index % 3) + 1;

    document.getElementById("todayShift").textContent =
        customShifts[dateKey] ? shift : `${shift} ${shiftDay}일차`;

    const messages = {
        "주간": "오늘도 힘내서 다녀와요! ☀️",
        "야간": "밤 근무도 파이팅! 🌙",
        "비번": "오늘은 푹 쉬어요! 🍀",
        "연차": "오늘은 연차! 즐겁게 쉬어요 🌴",
        "당직": "당직도 안전하게 다녀와요! 🕒",
        "휴무": "오늘은 휴무! 푹 쉬어요 🏠"
    };

    document.getElementById("todayMessage").textContent =
        messages[shift];
}

updateTodayCard();

document.getElementById("saveShiftBtn").addEventListener("click", function() {
    savedBaseDate = document.getElementById("baseDateInput").value;

    const shift = document.getElementById("shiftInput").value;
    const shiftDay = Number(document.getElementById("shiftDayInput").value);

    const shiftStart = {
        "주간": 0,
        "야간": 3,
        "비번": 6
    };

    savedShiftIndex = shiftStart[shift] + shiftDay - 1;

    localStorage.setItem("baseDate", savedBaseDate);
    localStorage.setItem("shiftIndex", savedShiftIndex);

    renderCalendar();
    updateTodayCard();

    alert("🌱 근무 설정이 저장됐어요!");
});
const storedDate = localStorage.getItem("baseDate");
const storedIndex = localStorage.getItem("shiftIndex");

if (storedDate !== null && storedIndex !== null) {
    savedBaseDate = storedDate;
    savedShiftIndex = Number(storedIndex);

    document.getElementById("baseDateInput").value = savedBaseDate;
    document.getElementById("shiftInput").value =
        shifts[Math.floor(savedShiftIndex / 3) * 3];
    document.getElementById("shiftDayInput").value =
        (savedShiftIndex % 3) + 1;
}

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
});

// 저장된 다크모드 설정 불러오기
if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
}

updateThemeButton();

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

    popupDate.textContent = selectedDate + " 근무 변경";
    const [y, m, d] = selectedDate.split("-").map(Number);
    document.getElementById("customShift").value = customShifts[selectedDate] || getShift(y, m - 1, d);
    shiftPopup.hidden = false;
});

// 닫기 버튼
document.getElementById("closePopup").addEventListener("click", function() {
    shiftPopup.hidden = true;
});

/* 날짜별 근무 변경 저장 */



// 저장 버튼
document.getElementById("saveCustomShift").addEventListener("click", function() {
    const selectedDate = popupDate.textContent.split(" ")[0];
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
    const selectedDate = popupDate.textContent.split(" ")[0];

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
            const originalDay = (index % 3) + 1;
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

// 메뉴에서 창 열기
document.getElementById("bulkChangeBtn").addEventListener("click", function() {
    shiftSettings.hidden = true;

    const today = new Date();
    const localToday =
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    bulkStart.value = localToday;
    bulkEnd.value = localToday;
    bulkShift.value = "연차";

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
