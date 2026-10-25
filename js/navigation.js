// 8단계: 화면 전환만 준비. 기존 근무 설정/메모 데이터는 건드리지 않습니다.
const tabPages = { calendar: document.getElementById('calendarArea'), stats: document.getElementById('workStatsPage'), friends: document.getElementById('friendsPage'), community: document.getElementById('communityPage') };
document.getElementById('bottomTabs').addEventListener('click', event => {
  const button = event.target.closest('button[data-tab]');
  if (!button) return;
  const tab = button.dataset.tab;
  if (!Object.hasOwn(tabPages, tab)) return;
  for (const [key, page] of Object.entries(tabPages)) page.hidden = key !== tab;
  document.querySelectorAll('#bottomTabs .bottom-tab').forEach(el => {
    const selected = el === button;
    el.classList.toggle('active', selected);
    if (selected) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  shiftSettings.hidden = true;
  if (tab === 'stats') renderWorkStats();
});


/* 9단계: 신규 사용자만 첫 근무 설정을 안내합니다. 기존 저장 데이터는 보존합니다. */
(() => {
  const firstRun = !localStorage.getItem('baseDate') && !localStorage.getItem('shiftPattern') && !localStorage.getItem('shiftIndex');
  if (!firstRun) return;
  const overlay = document.getElementById('firstRunSetup');
  const slot = document.getElementById('firstRunSettingsSlot');
  const fields = document.getElementById('baseSettingsFields');
  const originalParent = fields.parentElement;
  const originalNext = fields.nextElementSibling;
  const save = document.getElementById('saveShiftBtn');
  const hire = document.getElementById('hireDateInput');
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  hire.value = localDate;
  document.getElementById('baseDateInput').value = localDate;
  // 신규 사용자 기본값만 6일 패턴으로 적용 (기존 저장 설정은 그대로 유지)
  shifts = ["주간","주간","야간","야간","비번","비번"];
  refreshPresets(shifts, 0);
  fields.hidden = false;
  slot.appendChild(fields);
  overlay.hidden = false;
  document.getElementById('bottomTabs').hidden = true;
  // Save only after validating the hire date. The existing save handler persists
  // the cycle and anchor, preserving the same format as later settings edits.
  save.addEventListener('click', event => {
    if (!hire.value || !/^\d{4}-\d{2}-\d{2}$/.test(hire.value)) {
      event.stopImmediatePropagation();
      alert('입사일을 선택해 주세요.');
    }
  }, { capture: true });
  save.addEventListener('click', () => {
    if (!localStorage.getItem('shiftPattern')) return;
    localStorage.setItem('hireDate', hire.value);
    if (originalNext) originalParent.insertBefore(fields, originalNext);
    else originalParent.appendChild(fields);
    fields.hidden = true;
    overlay.hidden = true;
    document.getElementById('bottomTabs').hidden = false;
  });
})();


