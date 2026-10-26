// Browser-only reminders: foreground tab/PWA only. No background alarm guarantee.
(() => {
  'use strict';
  const KEY='geunmukongNotificationSettings', LAST='geunmukongNotificationLastSent';
  const el=id=>document.getElementById(id);
  const validTime=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const localMinute=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const defaults={enabled:false,dayTime:'07:00',nightTime:'18:00',target:'today'};
  let settings={...defaults};
  try {
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved && typeof saved==='object') settings={
      enabled:saved.enabled===true,
      dayTime:validTime(saved.dayTime)?saved.dayTime:validTime(saved.time)?saved.time:defaults.dayTime,
      nightTime:validTime(saved.nightTime)?saved.nightTime:defaults.nightTime,
      target:saved.target==='tomorrow'||saved.tomorrow===true?'tomorrow':'today'
    };
  }catch(_){}
  const status=el('notificationStatus');
  el('notificationEnabled').checked=settings.enabled;
  el('notificationDayTime').value=settings.dayTime;
  el('notificationNightTime').value=settings.nightTime;
  el('notificationTarget').value=settings.target;
  const permissionText=()=>!('Notification' in window)?'이 환경에서는 시스템 알림을 지원하지 않아요.':Notification.permission==='granted'?'알림 권한 허용됨':Notification.permission==='denied'?'알림이 차단되어 있어요. 기기 설정을 확인해 주세요.':'알림 권한을 허용해야 표시돼요.';
  status.textContent=permissionText();
  el('toggleNotificationTools').addEventListener('click',()=>{
    const body=el('notificationToolsBody');body.hidden=!body.hidden;
    el('toggleNotificationTools').setAttribute('aria-expanded',String(!body.hidden));
  });
  function save(){
    settings={enabled:el('notificationEnabled').checked,dayTime:el('notificationDayTime').value,nightTime:el('notificationNightTime').value,target:el('notificationTarget').value};
    try{localStorage.setItem(KEY,JSON.stringify(settings));status.textContent='저장 완료 · '+permissionText();}
    catch(_){status.textContent='저장에 실패했어요. 저장 공간을 확인해 주세요.';}
  }
  ['notificationEnabled','notificationDayTime','notificationNightTime','notificationTarget'].forEach(id=>el(id).addEventListener('change',save));
  el('notificationPermission').addEventListener('click',async()=>{
    if(!('Notification' in window)){status.textContent=permissionText();return;}
    try{await Notification.requestPermission();status.textContent=permissionText();}
    catch(_){status.textContent='알림 권한 요청에 실패했어요.';}
  });
  async function notify(title,body,tag){
    if(!('Notification' in window)||Notification.permission!=='granted')return false;
    try{
      if('serviceWorker' in navigator){
        const reg=await navigator.serviceWorker.getRegistration();
        if(reg){await reg.showNotification(title,{body,icon:'./icon-192.png',tag});return true;}
      }
      new Notification(title,{body,icon:'./icon-192.png',tag});return true;
    }catch(_){return false;}
  }
  function shiftAt(d){const k=dateKey(d);return (typeof customShifts!=='undefined'&&customShifts[k])||getShift(d.getFullYear(),d.getMonth(),d.getDate());}
  el('notificationTest').addEventListener('click',async()=>{
    const ok=await notify('🌱 근무콩 테스트 알림',`오늘의 근무: ${shiftAt(new Date())}`,'geunmukong-test');
    status.textContent=ok?'테스트 알림을 요청했어요.':'알림을 표시하지 못했어요. 권한과 홈 화면 설치 여부를 확인해 주세요.';
  });
  let busy=false;
  async function check(){
    if(busy||document.visibilityState!=='visible'||!('Notification' in window)||Notification.permission!=='granted')return;
    busy=true;
    try{
      const now=new Date(),today=dateKey(now),minute=localMinute(now);
      let sent={};try{sent=JSON.parse(localStorage.getItem(LAST)||'{}')||{};}catch(_){}
      if(typeof sent!=='object'||Array.isArray(sent))sent={};
      // A reminder fires at most once for each date/time/event. No catch-up on reopening.
      const sendOnce=async(id,title,body)=>{
        if(sent[id])return;
        if(await notify(title,body,id)){sent[id]=today;try{localStorage.setItem(LAST,JSON.stringify(sent));}catch(_){}}
      };
      if(settings.enabled){
        const target=new Date(now.getFullYear(),now.getMonth(),now.getDate()+(settings.target==='tomorrow'?1:0));
        const shift=shiftAt(target),scheduled=shift==='주간'?settings.dayTime:shift==='야간'?settings.nightTime:null;
        if(scheduled===minute)await sendOnce(`shift:${today}:${dateKey(target)}:${shift}:${minute}`,`🌱 ${settings.target==='tomorrow'?'내일':'오늘'} ${shift} 근무`,`${dateKey(target)} · ${shift}`);
      }
      let notes={};try{notes=JSON.parse(localStorage.getItem('dayNotes')||'{}')||{};}catch(_){}
      const todayNotes=Array.isArray(notes[today])?notes[today]:[];
      for(let i=0;i<todayNotes.length;i++){
        const note=todayNotes[i];if(note&&note.alarmTime===minute){
          await sendOnce(`note:${today}:${i}:${minute}`,`📌 ${note.title||'근무콩 일정 알림'}`,note.text||`${today} 일정이 있어요.`);
        }
      }
      // Keep sent-state bounded to recent entries.
      const keys=Object.keys(sent);if(keys.length>150){for(const k of keys.slice(0,keys.length-150))delete sent[k];localStorage.setItem(LAST,JSON.stringify(sent));}
    }finally{busy=false;}
  }
  setInterval(check,15000);document.addEventListener('visibilitychange',check);check();
})();
