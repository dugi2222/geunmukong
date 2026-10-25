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
    document.getElementById("bottomTabs").hidden = !document.getElementById("firstRunSetup").hidden;
    renderCalendar();
}, 1500);

