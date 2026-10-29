// Step 16: offline, versioned data export/import. Only app-owned keys are included.
(() => {
  const exactKeys = new Set(['customShifts','shiftPattern','baseDate','shiftIndex','dayNotes','darkMode','mascotTheme','mascotShiftColors','leaveDeductions','leaveDeductionsMigrated','hireDate','exitDate','leaveResetDate','dashboardCharacter','dashboardPhoto','geunmukongNotificationSettings','geunmukongNotificationLastSent']);
  const appKey = key => exactKeys.has(key) || key.startsWith('leaveRate:') || key.startsWith('leaveAllowance:') || key.startsWith('leaveAllowanceCycle:') || key.startsWith('leaveTotal:');
  // Future per-period allowance keys are covered explicitly below.
  const extraKey = key => /^leave(?:Allowance|Total|Days|Year|Period)[_:]/.test(key);
  const owned = key => appKey(key) || extraKey(key);
  const snapshot = () => { const data={}; for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(owned(key))data[key]=localStorage.getItem(key);}return data;};
  const toggle=document.getElementById('toggleBackupTools');
  const body=document.getElementById('backupToolsBody');
  const status=document.getElementById('backupStatus');
  const fileInput=document.getElementById('backupFileInput');
  toggle.addEventListener('click',()=>{body.hidden=!body.hidden;toggle.setAttribute('aria-expanded',String(!body.hidden));});
  document.getElementById('downloadBackup').addEventListener('click',()=>{
    try{
      const payload={app:'geunmukong',formatVersion:1,exportedAt:new Date().toISOString(),data:snapshot()};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      const d=new Date(),date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      a.href=url;a.download=`근무멍_백업_${date}.json`;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent='백업 파일을 만들었어요. 파일 앱이나 클라우드에 안전하게 보관해 주세요.';
    }catch(e){status.textContent='백업 파일을 만들지 못했어요. 저장 공간과 브라우저 설정을 확인해 주세요.';}
  });
  document.getElementById('restoreBackup').addEventListener('click',()=>{fileInput.value='';fileInput.click();});
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files&&fileInput.files[0];if(!file)return;
    if(file.size>8*1024*1024){alert('백업 파일이 너무 커요 (최대 8MB).');return;}
    let payload;
    try{payload=JSON.parse(await file.text());}catch(_){alert('파일을 읽을 수 없어요. JSON 백업 파일인지 확인해 주세요.');return;}
    if(!payload||payload.app!=='geunmukong'||payload.formatVersion!==1||!payload.data||typeof payload.data!=='object'||Array.isArray(payload.data)){
      alert('근무멍에서 만든 지원되는 백업 파일이 아니에요.');return;
    }
    const entries=Object.entries(payload.data);
    if(entries.some(([key,value])=>!owned(key)||typeof value!=='string')||!('shiftPattern' in payload.data||'baseDate' in payload.data)){
      alert('백업 데이터 형식이 올바르지 않아요.');return;
    }
    const when=typeof payload.exportedAt==='string'?payload.exportedAt.slice(0,10):'날짜 정보 없음';
    if(!confirm(`백업 날짜: ${when}\n복원하면 이 기기의 기존 근무멍 설정, 메모, 연차 기록과 사진이 백업 내용으로 교체돼요.\n\n현재 데이터를 먼저 백업하는 것을 권장해요. 계속할까요?`))return;
    const before=snapshot();
    try{
      Object.keys(before).forEach(key=>localStorage.removeItem(key));
      entries.forEach(([key,value])=>localStorage.setItem(key,value));
      status.textContent='복원 완료! 근무멍을 다시 불러옵니다.';
      window.location.reload();
    }catch(error){
      try{Object.keys(snapshot()).forEach(key=>localStorage.removeItem(key));Object.entries(before).forEach(([key,value])=>localStorage.setItem(key,value));}
      catch(_){alert('저장 공간이 부족해 원상복구도 완료하지 못했어요. 백업 파일을 보관하고 다시 시도해 주세요.');return;}
      alert('복원 중 오류가 발생해 기존 데이터를 유지했어요. 저장 공간을 확인해 주세요.');
    }
  });
})();
