/* v26: online friend list/profile/chat view. The calendar-sharing module handles friend schedules. */
(() => {
  const $ = id => document.getElementById(id);
  const storageKey = 'friendPreviewProfilesV1';
  const allowed = new Set(['주간','야간','비번','휴무','연차','오후','당직']);
  let profiles = [];
  let onlineFriends = [];
  const onlineAliasKey='geunmeongOnlineFriendAliasesV1';
  function onlineAliases(){try{return JSON.parse(localStorage.getItem(onlineAliasKey)||'{}')||{};}catch(_){return {};}}
  document.addEventListener('geunmeong:online-friends-updated', e=>{onlineFriends=Array.isArray(e.detail?.friends)?e.detail.friends:[];render();if(activeFriendSubtab==='chats')renderChatRooms();});
  document.addEventListener('geunmeong:auth-changed',e=>{onlineFriends=[];render();if(activeFriendSubtab==='chats')renderChatRooms();});
  try { const data = JSON.parse(localStorage.getItem(storageKey) || '[]'); if(Array.isArray(data)) profiles = data.filter(x => x && typeof x.nickname === 'string' && Array.isArray(x.pattern) && x.code !== 'DEMO-MEONGMEONG' && !x.demo); } catch(_) {}
  // Clean up the old demo friend saved on previous versions.
  if (profiles.length === 0) {
    try {
      const old = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(old) && old.some(p => p?.code === 'DEMO-MEONGMEONG' || p?.demo)) {
        localStorage.setItem(storageKey, JSON.stringify(old.filter(p => p && p.code !== 'DEMO-MEONGMEONG' && !p.demo)));
      }
    } catch (_) {}
  }
  const overlay=$('friendOverlay');
  let activeFriendSubtab='friends';
  function showFriendSubtab(tab){
    activeFriendSubtab=tab;
    $('gmFriendsContent').hidden=tab!=='friends';$('gmChatsContent').hidden=tab!=='chats';
    $('gmFriendsSubtab').classList.toggle('active',tab==='friends');$('gmChatsSubtab').classList.toggle('active',tab==='chats');
    $('gmFriendsSubtab').setAttribute('aria-selected',String(tab==='friends'));$('gmChatsSubtab').setAttribute('aria-selected',String(tab==='chats'));
    if(tab==='chats')renderChatRooms();
  }
  $('gmFriendsSubtab').addEventListener('click',()=>showFriendSubtab('friends'));
  $('gmChatsSubtab').addEventListener('click',()=>showFriendSubtab('chats'));
  document.addEventListener('geunmeong:tab-leave',()=>showFriendSubtab('friends'));

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
  // Friend profile and settings. Preferences are local until server-side sharing is implemented.
  const prefKey='gmFriendPreferencesV1';
  const friendPrefs=()=>{try{return JSON.parse(localStorage.getItem(prefKey)||'{}')||{};}catch(_){return {};}};
  const friendPanel=document.createElement('div');friendPanel.className='gm-profile-overlay';friendPanel.hidden=true;
  friendPanel.innerHTML=`<section class="gm-profile-card" role="dialog" aria-modal="true" aria-label="친구 프로필"><div class="gm-profile-main"><button class="gm-profile-close" type="button" aria-label="닫기">✕</button><div class="gm-profile-avatar">🐾</div><h2 class="gm-profile-name"></h2><p class="gm-profile-subtitle">친구</p><div class="gm-profile-actions"><button type="button" data-action="message">💬 메시지 보내기</button><button type="button" data-action="settings">⚙ 설정</button></div></div><div class="gm-profile-settings" hidden><button type="button" class="gm-profile-back">← 돌아가기</button><h2>친구 설정</h2><div class="gm-profile-settings-inner"><h3>🔔 알림 설정</h3><label>메시지 알림 <input type="checkbox" data-pref="messageNotify"></label><label>게시물 알림 <input type="checkbox" data-pref="postNotify"></label><h3>🔐 공유 설정</h3><label>달력 공유 <input type="checkbox" data-pref="calendarShare" disabled></label><p id="gmCalendarShareStatus" class="gm-profile-note" role="status" aria-live="polite">친구별 공유 설정을 확인해요.</p><button type="button" id="gmViewSharedCalendar" class="gm-share-preview-button" disabled>📅 친구 근무표 보기</button><div id="gmFriendCalendarPreview" class="gm-calendar-preview" hidden><label>조회 월 <input id="gmFriendCalendarMonth" type="month"></label><div id="gmFriendCalendarDays" aria-live="polite"></div></div><label>게시물 공유 <input type="checkbox" data-pref="postShare" disabled></label><p class="gm-profile-note">공유 권한은 서버 연결 후 사용할 수 있어요. 현재는 친구에게 자동 공개되지 않습니다.</p><button type="button" class="gm-profile-alias">✏️ 별칭 변경</button></div></div></section>`;
  document.body.append(friendPanel);
  let selectedFriend=null, selectedDemo=false;
  const profileClose=()=>{friendPanel.hidden=true;document.body.classList.remove('gm-profile-open');};
  const profileSettings=friendPanel.querySelector('.gm-profile-settings');
  friendPanel.querySelector('.gm-profile-close').onclick=profileClose;
  friendPanel.querySelector('.gm-profile-back').onclick=()=>{profileSettings.hidden=true;};
  friendPanel.addEventListener('click',e=>{if(e.target===friendPanel)profileClose();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!friendPanel.hidden)profileClose();});
  document.addEventListener('geunmeong:tab-leave',profileClose);
  function openFriendProfile(friend,demo=false){
    selectedFriend=friend;selectedDemo=demo;profileSettings.hidden=true;
    friendPanel.querySelector('.gm-profile-name').textContent=demo?(friend.alias||friend.nickname):(onlineAliases()[friend.code]||friend.nickname);
    friendPanel.querySelector('.gm-profile-subtitle').textContent=demo?'테스트 친구':'온라인 친구';
    friendPanel.querySelector('.gm-profile-avatar').textContent=demo?'🐶':'🐾';
    const prefs=friendPrefs()[friend.code]||{};
    for(const input of friendPanel.querySelectorAll('[data-pref]'))if(input.dataset.pref!=='calendarShare')input.checked=!!prefs[input.dataset.pref];
    const calendarSwitch=friendPanel.querySelector('[data-pref="calendarShare"]');calendarSwitch.checked=false;calendarSwitch.disabled=true;
    friendPanel.hidden=false;document.body.classList.add('gm-profile-open');
    if(!demo)window.gmCalendarSharing?.profileOpened(friend);

  }
  friendPanel.querySelector('[data-action="settings"]').onclick=()=>{profileSettings.hidden=false;};
  friendPanel.querySelector('[data-action="message"]').onclick=()=>{const friend=selectedFriend,demo=selectedDemo;profileClose();if(demo)openChat(friend);else window.gmOnlineChat?.open({...friend,alias:onlineAliases()[friend.code]});};
  friendPanel.querySelectorAll('[data-pref]').forEach(input=>input.addEventListener('change',()=>{
    if(!selectedFriend||input.disabled)return;
    if(input.dataset.pref==='calendarShare'){window.gmCalendarSharing?.toggleShare(selectedFriend,input.checked);return;}
    const prefs=friendPrefs();prefs[selectedFriend.code]={...(prefs[selectedFriend.code]||{}),[input.dataset.pref]:input.checked};
    localStorage.setItem(prefKey,JSON.stringify(prefs));
  }));
  friendPanel.querySelector('.gm-profile-alias').onclick=()=>{
    if(!selectedFriend)return;
    const current=selectedDemo?(selectedFriend.alias||''):(onlineAliases()[selectedFriend.code]||'');
    const answer=prompt('친구 별칭 (비우면 원래 이름)',current);if(answer===null)return;
    if(selectedDemo){selectedFriend.alias=answer.trim().slice(0,24);save();}
    else{const aliases=onlineAliases();if(answer.trim())aliases[selectedFriend.code]=answer.trim().slice(0,24);else delete aliases[selectedFriend.code];localStorage.setItem(onlineAliasKey,JSON.stringify(aliases));document.dispatchEvent(new CustomEvent('geunmeong:online-friend-alias-changed'));}
    render();friendPanel.querySelector('.gm-profile-name').textContent=answer.trim()||selectedFriend.nickname;
  };
  const today = new Date();
  function utcDay(date){const [y,m,d]=date.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000;}
  function shiftFor(profile,date){if(profile.code===demoCode){const day=new Date(date+'T12:00:00Z').getUTCDay();return day===0||day===6?'휴무':'주간';}const n=profile.pattern.length, diff=utcDay(date)-utcDay(profile.start);return profile.pattern[((diff+profile.startIndex)%n+n)%n];}
  // Local demo messaging: never sends data to a server.
  const demoCode='DEMO-MEONGMEONG';
  // Demo friend retired in v25; online friends only.
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
  function renderChatRooms(){
    const root=$('gmChatRoomList');root.replaceChildren();
    const rooms=[]; // demo chats removed
    for(const friend of onlineFriends){const preview=window.gmOnlineChat?.preview(friend.code);const row=document.createElement('button');row.type='button';row.className='gm-chat-room';const avatar=document.createElement('span');avatar.className='gm-chat-room-avatar';avatar.textContent='🐾';const content=document.createElement('span');content.className='gm-chat-room-content';const name=document.createElement('strong');name.textContent=onlineAliases()[friend.code]||friend.nickname;const small=document.createElement('small');small.textContent=preview?.text||'온라인 친구 · 대화 시작하기';content.append(name,small);row.append(avatar,content);row.addEventListener('click',()=>window.gmOnlineChat?.open({...friend,alias:onlineAliases()[friend.code]}));root.append(row);}
    if(!onlineFriends.length){const empty=document.createElement('p');empty.className='gm-chat-disclaimer';empty.textContent='아직 온라인 친구가 없어요. 친구를 추가하면 여기에서 대화할 수 있어요.';root.append(empty);return;}
    for(const profile of rooms){const last=chats[profile.code].at(-1),row=document.createElement('button');row.type='button';row.className='gm-chat-room';
      const avatar=document.createElement('span');avatar.className='gm-chat-room-avatar';avatar.textContent='🐾';
      const content=document.createElement('span');content.className='gm-chat-room-content';const name=document.createElement('strong');name.textContent=profile.alias||profile.nickname;const preview=document.createElement('small');preview.textContent=last.text;content.append(name,preview);
      const time=document.createElement('small');time.textContent=new Date(last.time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});row.append(avatar,content,time);row.addEventListener('click',()=>openChat(profile));root.append(row);
    }
  }
  document.addEventListener('geunmeong:chat-updated',renderChatRooms);
  function openChat(profile){chatWith=profile.code;document.getElementById('friendChatName').textContent=(profile.alias||profile.nickname)+' 🐶';chatOverlay.hidden=false;document.body.classList.add('friend-chat-open');renderChat();document.getElementById('friendChatInput').focus();}
  function appendChat(code,from,message){if(!Array.isArray(chats[code]))chats[code]=[];chats[code].push({from,text:message,time:Date.now()});chats[code]=chats[code].slice(-100);localStorage.setItem(messageKey,JSON.stringify(chats));if(chatWith===code)renderChat();renderChatRooms();}
  document.getElementById('friendChatForm').addEventListener('submit',e=>{
    e.preventDefault();const input=document.getElementById('friendChatInput');const message=input.value.trim();if(!message||!chatWith)return;
    const code=chatWith;appendChat(code,'me',message);input.value='';
    if(code===demoCode){setTimeout(()=>{if(profiles.some(p=>p.code===demoCode))appendChat(code,'friend','멍멍!');},450);}
  });
  function render(){
    const list=$('friendList');list.replaceChildren();
    $('friendCount').textContent=String(onlineFriends.length);
    if(!profiles.length && !onlineFriends.length){
      const empty=document.createElement('div');empty.className='friends-empty';
      empty.innerHTML='<div class="friends-empty-emoji">👥</div><strong>아직 등록된 친구가 없어요</strong><p>오른쪽 위 + 버튼으로 친구를 추가해 보세요.</p>';
      list.append(empty);
    }
    // Accepted Supabase friends belong in the main Friends list, not only the management panel.
    const aliases=onlineAliases();
    onlineFriends.forEach((friend,index)=>{
      const row=document.createElement('div');row.className='friend-row friend-profile-row gm-online-main-row';
      const avatar=document.createElement('div');avatar.className='friend-avatar';avatar.textContent=['🐶','🐱','🦭','🐼','🐢'][index%5];
      const info=document.createElement('div');info.className='friend-info';
      const name=document.createElement('strong');name.textContent=aliases[friend.code]||friend.nickname;
      const detail=document.createElement('small');detail.textContent=(aliases[friend.code]?friend.nickname+' · ':'')+'온라인 친구';
      info.append(name,detail);
      const aliasButton=document.createElement('button');aliasButton.type='button';aliasButton.className='gm-alias-btn';aliasButton.textContent='별칭';
      aliasButton.addEventListener('click',()=>{const value=prompt('친구 별칭 (비우면 원래 닉네임)',aliases[friend.code]||'');if(value===null)return;const next=onlineAliases();if(value.trim())next[friend.code]=value.trim().slice(0,24);else delete next[friend.code];localStorage.setItem(onlineAliasKey,JSON.stringify(next));render();document.dispatchEvent(new CustomEvent('geunmeong:online-friend-alias-changed'));});
      const chatButton=document.createElement('button');chatButton.type='button';chatButton.className='friend-message-button';chatButton.textContent='💬 메시지';chatButton.addEventListener('click',()=>window.gmOnlineChat?.open({...friend,alias:onlineAliases()[friend.code]}));
      row.append(avatar,info);row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label',name.textContent+' 프로필 보기');row.addEventListener('click',()=>openFriendProfile(friend));row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openFriendProfile(friend);}});list.append(row);
    });
    const now=new Date(), todayStr=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    profiles.filter(p=>false).forEach((profile,index)=>{
      const row=document.createElement('div');row.className='friend-row friend-profile-row';
      const avatar=document.createElement('div');avatar.className='friend-avatar';avatar.textContent=['🐶','🐱','🦭','🐼','🐢'][index%5];
      const info=document.createElement('div');info.className='friend-info';
      const name=document.createElement('strong');name.textContent=profile.alias||profile.nickname;
      const detail=document.createElement('small');detail.textContent=profile.demo?'테스트 친구 · 자동 답장':`코드 ${profile.code}`;
      if(profile.alias){detail.textContent=profile.nickname+' · '+detail.textContent;}info.append(name,detail);
      const shift=document.createElement('span');shift.className='friend-shift-chip';shift.textContent=shiftFor(profile,todayStr);
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=profile.selected!==false;checkbox.setAttribute('aria-label',`${profile.nickname} 쉬는 날 비교에 포함`);checkbox.addEventListener('change',()=>{profile.selected=checkbox.checked;save();renderComparison();});
      const remove=document.createElement('button');remove.type='button';remove.className='friend-remove';remove.textContent='삭제';remove.setAttribute('aria-label',`${profile.nickname} 삭제`);remove.addEventListener('click',()=>{if(confirm(`${profile.nickname}의 기기 내 기록을 삭제할까요?`)){profiles.splice(index,1);save();render();}});
      const messageButton=document.createElement('button');messageButton.type='button';messageButton.className='friend-message-button';messageButton.textContent='💬 메시지';messageButton.setAttribute('aria-label',profile.nickname+'에게 메시지');messageButton.addEventListener('click',()=>openChat(profile));
      const aliasButton=document.createElement('button');aliasButton.type='button';aliasButton.className='gm-alias-btn';aliasButton.textContent='별칭';aliasButton.addEventListener('click',()=>{const answer=prompt('이 친구에게 표시할 별칭 (비우면 원래 이름)',profile.alias||'');if(answer===null)return;profile.alias=answer.trim().slice(0,24);save();render();});
      row.append(avatar,info,shift);row.tabIndex=0;row.setAttribute('role','button');row.addEventListener('click',()=>openFriendProfile(profile,true));row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openFriendProfile(profile,true);}});list.append(row);
    });renderComparison();renderChatRooms();
  }
  function isRest(shift, includeLeave){return shift==='비번'||shift==='휴무'||(includeLeave&&shift==='연차');}
  function renderComparison(){
    if(!$('friendComparePanel').hidden && window.gmCalendarSharing?.refreshCompare)window.gmCalendarSharing.refreshCompare();
  }
  document.querySelector('[data-tab="friends"]').addEventListener('click',renderComparison);
  render();
})();
