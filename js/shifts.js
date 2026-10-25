let savedBaseDate = "2026-10-22";
let savedShiftIndex = 0;
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
let shifts = PATTERNS["3-2"][1].cycle.slice();
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

