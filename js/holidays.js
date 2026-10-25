// 15단계: 오프라인 공휴일·기념일·24절기 데이터 (2024–2035)
function getSpecialDays(dateKey) {
    const year = dateKey.slice(0, 4);
    return window.GEUNMU_CALENDAR_DAYS?.[year]?.[dateKey] || [];
}

