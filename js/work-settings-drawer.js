/* 20단계: 기존 근무 설정 필드를 이동해 재사용합니다. 저장 키와 핸들러는 그대로 둡니다. */
(() => {
  const drawer = document.getElementById('workSettingsDrawer');
  const backdrop = document.getElementById('workSettingsBackdrop');
  const body = document.getElementById('workSettingsDrawerBody');
  const fields = document.getElementById('baseSettingsFields');
  const saveOriginal = document.getElementById('saveShiftBtn');
  const saveButton = document.getElementById('workSettingsSave');
  const status = document.getElementById('workSettingsStatus');
  const originalParent = fields.parentElement;
  const originalNext = fields.nextSibling;
  let snapshot = '';
  let statusTimer;
  const state = () => JSON.stringify({
    inputs: Array.from(fields.querySelectorAll('input,select')).map(el => [el.id,el.value]),
    pattern: typeof selectedCycle !== 'undefined' ? selectedCycle : null
  });
  function update() {
    if (drawer.hidden) return;
    const dirty = state() !== snapshot;
    saveButton.disabled = !dirty;
    saveButton.textContent = dirty ? '✓ 변경사항 저장' : '✓ 저장됨';
    if (dirty) status.textContent = '● 저장하지 않은 변경사항';
    else if (status.textContent !== '✓ 저장 완료!') status.textContent = '✓ 저장됨';
  }
  function open() {
    if (!document.getElementById('firstRunSetup').hidden) return;
    clearTimeout(statusTimer);
    fields.hidden = false;
    body.appendChild(fields);
    drawer.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add('work-drawer-open');
    window.workSettingsDrawerActive = true;
    snapshot = state();
    status.textContent = '✓ 저장됨';
    update();
    document.getElementById('closeWorkSettings').focus();
  }
  function close(force = false) {
    if (drawer.hidden) return true;
    if (!force && state() !== snapshot && !confirm('저장하지 않은 변경사항이 있어요. 저장하지 않고 닫을까요?')) return false;
    drawer.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove('work-drawer-open');
    window.workSettingsDrawerActive = false;
    if (originalNext && originalNext.parentNode === originalParent) originalParent.insertBefore(fields, originalNext);
    else originalParent.appendChild(fields);
    fields.hidden = true;
    document.querySelector('#dashboardMenu [data-panel="settings"]')?.focus();
    return true;
  }
  window.openWorkSettingsDrawer = open;
  window.closeWorkSettingsDrawer = close;
  document.getElementById('closeWorkSettings').addEventListener('click', () => close());
  backdrop.addEventListener('click', () => close());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !drawer.hidden) { event.preventDefault(); close(); }
  });
  saveButton.addEventListener('click', () => { if (!saveButton.disabled) saveOriginal.click(); });
  fields.addEventListener('input', update);
  fields.addEventListener('change', update);
  new MutationObserver(update).observe(document.getElementById('patternChips'), {childList:true,subtree:true,characterData:true});
  window.addEventListener('work-settings-saved', () => {
    snapshot = state();
    status.textContent = '✓ 저장 완료!';
    update();
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {status.textContent='✓ 저장됨';update();}, 2200);
  });
})();
