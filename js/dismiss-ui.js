/* 21단계: 닫기가 불편했던 화면만 바깥 터치/ESC로 접습니다. */
(() => {
  const byId = id => document.getElementById(id);
  const menu = byId('shiftSettings');
  const menuButton = byId('menuBtn');
  const panel = byId('dashboardPanel');
  const stats = byId('workStatsPage');
  const popupIds = ['shiftPopup', 'changesPopup', 'bulkPopup'];

  function dismissPanel() {
    if (panel.hidden) return false;
    const hire = byId('dashboardHire');
    if (!hire.hidden) {
      const changed = byId('statsHireDate').value !== (localStorage.getItem('hireDate') || '') ||
        byId('statsExitDate').value !== (localStorage.getItem('exitDate') || '');
      if (changed && !confirm('저장하지 않은 입사 정보 변경사항이 있어요. 닫을까요?')) return false;
    }
    byId('dashboardBack').click();
    return true;
  }

  // 팝업의 반투명 배경만 터치했을 때 닫기. 내부 클릭은 유지.
  for (const id of popupIds) {
    const popup = byId(id);
    popup.addEventListener('click', event => {
      if (event.target !== popup || popup.hidden) return;
      const closeId = id === 'shiftPopup' ? 'closePopup' : id === 'changesPopup' ? 'closeChangesBtn' : 'closeBulkPopup';
      byId(closeId).click(); // 기존 닫기 동작을 재사용
    });
  }

  // 왼쪽 메뉴 바깥을 누르면 접기. 메뉴 버튼은 기존 토글 핸들러에 맡김.
  document.addEventListener('pointerdown', event => {
    if (!menu.hidden && !menu.contains(event.target) && !menuButton.contains(event.target)) menu.hidden = true;
  });

  // 근무 기록의 연차/입사 정보/캐릭터 변경은 화면의 빈 영역을 누르면 메뉴로 복귀.
  // 근무 설정 서랍과 연차 팝업이 열려 있는 동안에는 뒤쪽 화면을 건드리지 않음.
  stats.addEventListener('click', event => {
    if (panel.hidden || panel.contains(event.target)) return;
    if (!byId('workSettingsDrawer').hidden || !byId('leaveSettingsModal').hidden ||
        byId('leaveHistoryDrawer').classList.contains('is-open')) return;
    if (event.target.closest('#dashboardMenu, #characterChange, #bottomTabs')) return;
    dismissPanel();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    // 다른 팝업이 열려 있으면 해당 팝업만 닫고 아래 화면은 유지.
    if (!byId('workSettingsDrawer').hidden || !byId('leaveSettingsModal').hidden ||
        byId('leaveHistoryDrawer').classList.contains('is-open')) return;
    for (const id of popupIds) {
      if (!byId(id).hidden) {
        const closeId = id === 'shiftPopup' ? 'closePopup' : id === 'changesPopup' ? 'closeChangesBtn' : 'closeBulkPopup';
        byId(closeId).click(); event.preventDefault(); return;
      }
    }
    if (!menu.hidden) { menu.hidden = true; event.preventDefault(); return; }
    if (!panel.hidden) { if (dismissPanel()) event.preventDefault(); }
  });
})();
