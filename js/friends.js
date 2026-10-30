/* 23단계: 서버 연결 전 로컬 친구 근무표 비교 미리보기. 실시간 친구 검색/요청 기능이 아닙니다. */
(() => {
  const $ = id => document.getElementById(id);
  const storageKey = 'friendPreviewProfilesV1';
  const allowed = new Set(['주간','야간','비번','휴무','연차','오후','당직']);
  let profiles = [];
  try { const data = JSON.parse(localStorage.getItem(storageKey) || '[]'); if(Array.isArray(data)) profiles = data.filter(x => x && typeof x.nickname === 'string' && Array.isArray(x.pattern)); } catch(_) {}
  const overlay=$('friendOverlay');
  const myProfileKey='geunmeongMyFriendProfileV1';
  let myProfile;
  try { myProfile=JSON.parse(localStorage.getItem(myProfileKey)||'null'); }catch(_){}
  if(!myProfile || typeof myProfile.code!=='string'){
    const bytes=new Uint8Array(5);
    if(globalThis.crypto && crypto.getRandomValues)crypto.getRandomValues(bytes);
    else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
    myProfile={nickname:'나',code:'GM-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()};
    localStorage.setItem(myProfileKey,JSON.stringify(myProfile));
  }
  function renderMyProfile(){ $('myFriendName').textContent=myProfile.nickname||'나'; $('myFriendCode').textContent='내 기기 코드 · '+myProfile.code; }
  renderMyProfile();
  $('friendEditMyProfile').addEventListener('click',()=>{$('myFriendNickname').value=myProfile.nickname;openSheet('profile');});
  $('friendSaveMyProfile').addEventListener('click',()=>{const value=$('myFriendNickname').value.trim();if(!value){alert('닉네임을 입력해 주세요.');return;}myProfile.nickname=value;localStorage.setItem(myProfileKey,JSON.stringify(myProfile));renderMyProfile();closeSheet();});
  function closeSheet(){overlay.hidden=true;document.body.classList.remove('friend-sheet-open');}
  function openSheet(kind){
    $('friendAddPanel').hidden=kind!=='add';
    $('friendProfilePanel').hidden=kind!=='profile';
    $('friendComparePanel').hidden=kind!=='compare';
    $('friendSheetTitle').textContent=kind==='add'?'친구 추가':kind==='profile'?'내 프로필':'같이 쉬는 날 찾기';
    overlay.classList.toggle('friend-add-modal',kind!=='compare');
    overlay.classList.toggle('friend-compare-drawer',kind==='compare');
    overlay.hidden=false;document.body.classList.add('friend-sheet-open');
    if(kind==='compare')renderComparison();
  }
  $('friendOpenAdd').addEventListener('click',()=>openSheet('add'));
  $('friendOpenCompare').addEventListener('click',()=>openSheet('compare'));
  $('friendSheetClose').addEventListener('click',closeSheet);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeSheet();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)closeSheet();});
  const today = new Date();
  $('friendStart').value = [today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),'01'].join('-');
  $('friendCompareMonth').value = [today.getFullYear(),String(today.getMonth()+1).padStart(2,'0')].join('-');
  function save(){ localStorage.setItem(storageKey, JSON.stringify(profiles)); }
  function safeDate(value){ return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T00:00:00')); }
  function parsePattern(){return $('friendPattern').value.split(/[,，\s]+/).map(x=>x.trim()).filter(Boolean);}
  function updateIndexes(){ const pattern=parsePattern(), select=$('friendStartIndex'); select.replaceChildren(); (pattern.length ? pattern : ['주간']).forEach((shift,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${i+1}번째 (${shift})`;select.append(o);}); }
  $('friendPattern').addEventListener('input',updateIndexes);updateIndexes();
  $('friendAdd').addEventListener('click',()=>{
    const nickname=$('friendNickname').value.trim(), code=$('friendCode').value.trim().toUpperCase(), pattern=parsePattern(), start=$('friendStart').value;
    const feedback=$('friendFeedback');
    if(!nickname || !code){feedback.textContent='닉네임과 친구 코드를 모두 입력해 주세요.';return;}
    if(!pattern.length || pattern.length>60 || pattern.some(x=>!allowed.has(x))){feedback.textContent='근무 패턴은 주간, 야간, 비번, 휴무, 연차, 오후, 당직 중에서 1~60개 입력해 주세요.';return;}
    if(!safeDate(start)){feedback.textContent='패턴 시작 날짜를 확인해 주세요.';return;}
    if(profiles.some(x=>x.code===code)){feedback.textContent='이미 등록한 코드예요.';return;}
    profiles.push({nickname,code,pattern,start,startIndex:Number($('friendStartIndex').value)||0, selected:true});save();render();
    feedback.textContent='이 기기에 저장했어요. 상대방에게 친구 요청이 전송된 것은 아니에요.';closeSheet();
    $('friendNickname').value='';$('friendCode').value='';
  });
  function utcDay(date){const [y,m,d]=date.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000;}
  function shiftFor(profile,date){const n=profile.pattern.length, diff=utcDay(date)-utcDay(profile.start);return profile.pattern[((diff+profile.startIndex)%n+n)%n];}
  // Local demo messaging: never sends data to a server.
  const demoCode='DEMO-MEONGMEONG';
  if(!profiles.some(p=>p.code===demoCode)){
    profiles.push({nickname:'멍멍이',code:demoCode,pattern:['주간','주간','야간','야간','비번','비번'],start:'2026-10-01',startIndex:0,selected:false,demo:true});
    save();
  }
  const messageKey='geunmeongFriendDemoMessagesV1';
  let chats={};
  try {const loaded=JSON.parse(localStorage.getItem(messageKey)||'{}');if(loaded&&typeof loaded==='object'&&!Array.isArray(loaded))chats=loaded;}catch(_){}
  let chatWith=null;
  const chatOverlay=document.createElement('div');chatOverlay.className='friend-chat-overlay';chatOverlay.hidden=true;
  chatOverlay.innerHTML=`<section class="friend-chat-dialog" role="dialog" aria-modal="true" aria-label="친구 메시지"><header class="friend-chat-header"><button type="button" id="friendChatBack" class="friend-chat-back">← 친구 목록</button><strong id="friendChatName"></strong><span class="friend-chat-demo-tag">기기 내 테스트</span></header><div id="friendChatMessages" class="friend-chat-messages" aria-live="polite"></div><form id="friendChatForm" class="friend-chat-form"><input id="friendChatInput" type="text" maxlength="300" placeholder="메시지를 입력하세요" autocomplete="off" aria-label="메시지 입력"><button type="submit">보내기</button></form></section>`;
  document.body.append(chatOverlay);
  const closeChat=()=>{chatOverlay.hidden=true;chatWith=null;document.body.classList.remove('friend-chat-open');};
  document.getElementById('friendChatBack').addEventListener('click',closeChat);
  document.addEventListener('geunmeong:tab-leave', () => { closeSheet(); closeChat(); });
  chatOverlay.addEventListener('click',e=>{if(e.target===chatOverlay)closeChat();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!chatOverlay.hidden)closeChat();});
  const chatList=document.getElementById('friendChatMessages');
  function renderChat(){
    chatList.replaceChildren();
    const history=Array.isArray(chats[chatWith])?chats[chatWith]:[];
    if(!history.length){const hint=document.createElement('p');hint.className='friend-chat-empty';hint.textContent='첫 메시지를 보내보세요! 🐾';chatList.append(hint);}
    history.forEach(msg=>{const bubble=document.createElement('div');bubble.className='friend-chat-bubble '+(msg.from==='me'?'mine':'theirs');bubble.textContent=msg.text;chatList.append(bubble);});
    chatList.scrollTop=chatList.scrollHeight;
  }
  function openChat(profile){chatWith=profile.code;document.getElementById('friendChatName').textContent=profile.nickname+' 🐶';chatOverlay.hidden=false;document.body.classList.add('friend-chat-open');renderChat();document.getElementById('friendChatInput').focus();}
  function appendChat(code,from,message){if(!Array.isArray(chats[code]))chats[code]=[];chats[code].push({from,text:message,time:Date.now()});chats[code]=chats[code].slice(-100);localStorage.setItem(messageKey,JSON.stringify(chats));if(chatWith===code)renderChat();}
  document.getElementById('friendChatForm').addEventListener('submit',e=>{
    e.preventDefault();const input=document.getElementById('friendChatInput');const message=input.value.trim();if(!message||!chatWith)return;
    const code=chatWith;appendChat(code,'me',message);input.value='';
    if(code===demoCode){setTimeout(()=>{if(profiles.some(p=>p.code===demoCode))appendChat(code,'friend','멍멍!');},450);}
  });
  function render(){
    const list=$('friendList');list.replaceChildren();
    $('friendCount').textContent=String(profiles.length);
    if(!profiles.length){
      const empty=document.createElement('div');empty.className='friends-empty';
      empty.innerHTML='<div class="friends-empty-emoji">👥</div><strong>아직 등록된 친구가 없어요</strong><p>오른쪽 위 + 버튼으로 친구를 추가해 보세요.</p>';
      list.append(empty);
    }
    const now=new Date(), todayStr=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    profiles.forEach((profile,index)=>{
      const row=document.createElement('div');row.className='friend-row friend-profile-row';
      const avatar=document.createElement('div');avatar.className='friend-avatar';avatar.textContent=['🐶','🐱','🦭','🐼','🐢'][index%5];
      const info=document.createElement('div');info.className='friend-info';
      const name=document.createElement('strong');name.textContent=profile.nickname;
      const detail=document.createElement('small');detail.textContent=profile.demo?'테스트 친구 · 자동 답장':`코드 ${profile.code}`;
      info.append(name,detail);
      const shift=document.createElement('span');shift.className='friend-shift-chip';shift.textContent=shiftFor(profile,todayStr);
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=profile.selected!==false;checkbox.setAttribute('aria-label',`${profile.nickname} 쉬는 날 비교에 포함`);checkbox.addEventListener('change',()=>{profile.selected=checkbox.checked;save();renderComparison();});
      const remove=document.createElement('button');remove.type='button';remove.className='friend-remove';remove.textContent='삭제';remove.setAttribute('aria-label',`${profile.nickname} 삭제`);remove.addEventListener('click',()=>{if(confirm(`${profile.nickname}의 기기 내 기록을 삭제할까요?`)){profiles.splice(index,1);save();render();}});
      const messageButton=document.createElement('button');messageButton.type='button';messageButton.className='friend-message-button';messageButton.textContent='💬 메시지';messageButton.setAttribute('aria-label',profile.nickname+'에게 메시지');messageButton.addEventListener('click',()=>openChat(profile));
      row.append(avatar,info,shift,messageButton,checkbox,remove);list.append(row);
    });renderComparison();
  }
  function isRest(shift, includeLeave){return shift==='비번'||shift==='휴무'||(includeLeave&&shift==='연차');}
  function renderComparison(){
    const result=$('friendCompareResults');result.replaceChildren();const selected=profiles.filter(p=>p.selected!==false);
    const month=$('friendCompareMonth').value;
    if(!selected.length){result.textContent='비교할 친구를 선택해 주세요.';return;}
    if(!/^\d{4}-\d{2}$/.test(month)){result.textContent='조회 월을 선택해 주세요.';return;}
    const [year,m]=month.split('-').map(Number), days=new Date(year,m,0).getDate(), includeLeave=$('friendIncludeLeave').checked;
    let count=0;
    const excludeAfterNight=$('friendNightNext').checked;
    const priorDate=date=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);};
    const grid=document.createElement('div');grid.className='friend-match-grid';
    for(let day=1;day<=days;day++){
      const date=`${month}-${String(day).padStart(2,'0')}`;
      const own=customShifts[date] || getShift(year,m-1,day);
      if(!isRest(own,includeLeave))continue;
      if(excludeAfterNight){const prev=priorDate(date),[py,pm,pd]=prev.split('-').map(Number);if((customShifts[prev]||getShift(py,pm-1,pd))==='야간')continue;}
      const other=selected.map(p=>shiftFor(p,date));if(!other.every(s=>isRest(s,includeLeave)))continue;
      if(excludeAfterNight&&selected.some(p=>shiftFor(p,priorDate(date))==='야간'))continue;
      count++;const item=document.createElement('div');item.className='friend-match-day';
      const title=document.createElement('strong');title.textContent=`${m}/${day}`;
      const detail=document.createElement('small');detail.textContent=`나 ${own} · ${selected.map((p,i)=>p.nickname+' '+other[i]).join(' · ')}`;
      item.append(title,detail);grid.append(item);
    }
    const summary=document.createElement('p');summary.className='friend-match-summary';summary.textContent=count?`${month}에 함께 쉬는 날 ${count}일`:`${month}에는 모두 쉬는 날이 없어요.`;
    result.append(summary,grid);
  }
  $('friendCompareMonth').addEventListener('change',renderComparison);
  $('friendIncludeLeave').addEventListener('change',renderComparison);
  $('friendNightNext').addEventListener('change',renderComparison);
  document.querySelector('[data-tab="friends"]').addEventListener('click',renderComparison);
  render();
})();
