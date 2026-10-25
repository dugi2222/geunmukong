// 연차 차감량은 근무 변경 기록과 별도로 저장해 기존 설정을 유지합니다.
let leaveDeductions = {};
try { const raw = JSON.parse(localStorage.getItem('leaveDeductions') || '{}'); if(raw && typeof raw === 'object' && !Array.isArray(raw)) leaveDeductions=raw; } catch(_) {}
if(!localStorage.getItem('leaveDeductionsMigrated')){
  Object.keys(customShifts).forEach(k=>{if(customShifts[k]==='연차' && !(k in leaveDeductions))leaveDeductions[k]=1;});
  try{localStorage.setItem('leaveDeductions',JSON.stringify(leaveDeductions));localStorage.setItem('leaveDeductionsMigrated','1');}catch(_){}
}
const leaveRateDefaults={주간:1,야간:1.5,비번:0,휴무:0,오후:1,당직:1};
const leaveRateIds={주간:'leaveRateDay',야간:'leaveRateNight',비번:'leaveRateOff'};
function validLeaveNumber(v){const n=Number(v);return v!=='' && Number.isFinite(n)&&n>=0&&n<=3&&Math.round(n*2)===n*2;}
function leaveRate(shift){const key='leaveRate:'+shift;const saved=localStorage.getItem(key);return saved!==null&&validLeaveNumber(saved)?Number(saved):(leaveRateDefaults[shift]??1);}
function originalShiftForLeave(dateKey){const [y,m,d]=dateKey.split('-').map(Number);return getShift(y,m-1,d);}
function leaveAmountFor(dateKey){const stored=leaveDeductions[dateKey];return validLeaveNumber(stored)?Number(stored):leaveRate(originalShiftForLeave(dateKey));}
function saveLeaveRecords(){try{localStorage.setItem('leaveDeductions',JSON.stringify(leaveDeductions));return true;}catch(_){alert('연차 기록을 저장하지 못했어요. 저장 공간을 확인해 주세요.');return false;}}
function showLeaveInput(dateKey, bulk=false){const box=document.getElementById(bulk?'bulkLeaveDeductionBox':'leaveDeductionBox');const input=document.getElementById(bulk?'bulkLeaveDeduction':'leaveDeduction');const selected=document.getElementById(bulk?'bulkShift':'customShift').value;box.hidden=selected!=='연차';if(selected!=='연차')return;
 const original=bulk?null:originalShiftForLeave(dateKey);input.value=bulk?leaveRate('주간'):(customShifts[dateKey]==='연차'?leaveAmountFor(dateKey):leaveRate(original));
 if(!bulk)document.getElementById('leaveDeductionHint').textContent='원래 근무: '+original+' · 기본 차감 '+leaveRate(original)+'일';}
function commitLeave(dateKey, amount){if(!validLeaveNumber(String(amount)))return false;leaveDeductions[dateKey]=Number(amount);return true;}
Object.entries(leaveRateIds).forEach(([shift,id])=>{const el=document.getElementById(id);el.value=leaveRate(shift);el.addEventListener('change',()=>{if(!validLeaveNumber(el.value)){alert('차감량은 0~3일 사이, 0.5일 단위로 입력해 주세요.');el.value=leaveRate(shift);return;}localStorage.setItem('leaveRate:'+shift,String(Number(el.value)));renderLeaveInfo();});});
document.getElementById('customShift').addEventListener('change',()=>showLeaveInput(activeNoteDate));
document.getElementById('bulkShift').addEventListener('change',()=>showLeaveInput(bulkStart.value,true));

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
    showLeaveInput(selectedDate);
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

    if(selectedShift==='연차'){
        const amount=document.getElementById('leaveDeduction').value;
        if(!validLeaveNumber(amount)){alert('연차 차감량을 0.5일 단위로 입력해 주세요.');return;}
        commitLeave(selectedDate,amount);
    }else delete leaveDeductions[selectedDate];
    if(!saveLeaveRecords())return;
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
    delete leaveDeductions[selectedDate];
    if(!saveLeaveRecords())return;

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
    showLeaveInput("",true);
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

    const bulkAmount=document.getElementById('bulkLeaveDeduction').value;
    if(shift==='연차'&&!validLeaveNumber(bulkAmount)){alert('연차 차감량을 0.5일 단위로 입력해 주세요.');return;}
    // 선택한 기간의 모든 날짜 변경
    const cursor = new Date(start + "T00:00:00Z");

    while (cursor <= endDate) {
        const key =
            `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`;

        customShifts[key] = shift;
        if(shift==='연차')commitLeave(key,bulkAmount);else delete leaveDeductions[key];
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    saveLeaveRecords();
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
    // Keep receiving the gesture even when the finger leaves a date cell.
    try { calendar.setPointerCapture(e.pointerId); } catch (_) {}
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
        // Pointer capture is established at pointerdown for touch and mouse.
    }
    dragDeltaX = Math.max(-calendar.clientWidth, Math.min(calendar.clientWidth, dx));
    const track = calendar.querySelector(".calendar-track");
    if (track) track.style.transform = `translate3d(calc(-33.333333% + ${dragDeltaX}px), 0, 0)`;
});

function finishDrag(e) {
    if (!dragActive || e.pointerId !== dragPointerId) return;
    dragActive = false;
    try { if (calendar.hasPointerCapture(e.pointerId)) calendar.releasePointerCapture(e.pointerId); } catch (_) {}
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

