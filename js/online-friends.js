/* 23단계: 인증 사용자 간 온라인 친구 요청/수락. 근무표·채팅은 공유하지 않습니다. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const page=$('friendsPage');
 const slot=$('gmOnlineAddSlot');
 const panel=document.createElement('section');
 panel.className='gm-online-friends';panel.hidden=true;
 panel.innerHTML=`<div class="gm-online-head"><h3>🌐 온라인 친구 관리</h3><button type="button" id="gmOnlineClose" aria-label="닫기">✕</button><button type="button" id="gmFriendRefresh">↻ 새로고침</button></div>
 <p class="gm-online-note">친구 코드를 알려주면 상대방이 요청할 수 있어요. 아직 근무표·채팅은 공유되지 않아요.</p>
 <div class="gm-online-me"><strong id="gmOnlineName">내 프로필</strong><div class="gm-code-line"><code id="gmOnlineCode">불러오는 중</code><button type="button" id="gmCopyCode">복사</button></div><div class="gm-nick-edit"><input id="gmOnlineNickname" maxlength="24" placeholder="닉네임 (2~24자)" aria-label="온라인 닉네임"><button type="button" id="gmSaveNickname">수정</button></div></div>
 <form id="gmSendFriendForm" class="gm-friend-send"><label for="gmTargetCode">친구 코드로 요청하기</label><div><input id="gmTargetCode" maxlength="20" placeholder="GM-XXXXXXXXXX" autocomplete="off" required><button type="submit">친구 요청</button></div></form>
 <p id="gmFriendStatus" role="status" aria-live="polite"></p>
 <h4>📨 받은 요청 <span id="gmIncomingCount">0</span></h4><div id="gmIncomingList" class="gm-online-list"></div>
 <h4>📤 보낸 요청 <span id="gmOutgoingCount">0</span></h4><div id="gmOutgoingList" class="gm-online-list"></div>
 <h4>🐾 온라인 친구 <span id="gmOnlineCount">0</span></h4><div id="gmOnlineList" class="gm-online-list"></div>
 <p class="gm-online-note">온라인 친구 별칭은 현재 이 기기에만 저장돼요. 근무표 공유와 실제 채팅은 아직 지원하지 않아요.</p>`;
 slot.append(panel);
 const closeOnline=()=>{panel.hidden=true;};
 const openOnline=()=>{panel.hidden=false;if(user)refresh();};

 const onlineButton=$('gmChooseOnline');
 const manualButton=$('gmChooseManual');
 const manualFields=$('gmManualAddFields');
 function chooseMethod(method){
  const online=method==='online';
  onlineButton.classList.toggle('active',online);
  manualButton.classList.toggle('active',!online);
  onlineButton.setAttribute('aria-pressed',String(online));
  manualButton.setAttribute('aria-pressed',String(!online));
  manualFields.hidden=online;
  if(online)openOnline();else closeOnline();
 }
 onlineButton.addEventListener('click',()=>chooseMethod('online'));
 manualButton.addEventListener('click',()=>chooseMethod('manual'));
 $('friendOpenAdd').addEventListener('click',()=>chooseMethod('online'));
 $('gmOnlineClose').addEventListener('click',()=>chooseMethod('manual'));
 document.addEventListener('geunmeong:tab-leave',closeOnline);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeOnline();});

 const aliasKey='geunmeongOnlineFriendAliasesV1';
 let aliases={};try{aliases=JSON.parse(localStorage.getItem(aliasKey)||'{}')||{};}catch(_){aliases={};}
 function saveAliases(){localStorage.setItem(aliasKey,JSON.stringify(aliases));}
 const localHeading=page.querySelector('.friend-list-heading');
 const note=page.querySelector('.friends-disclaimer');
 const status=(msg,bad=false)=>{ $('gmFriendStatus').textContent=msg; $('gmFriendStatus').classList.toggle('error',bad); };
 let user=null, requestSerial=0, busy=false;
 const client=()=>window.gmSupabaseClient;
 const call=async(name,args={})=>{const c=client();if(!c)throw Error('로그인 연결을 확인해 주세요.');const {data,error}=await c.rpc(name,args);if(error)throw Error(error.message||'서버 요청에 실패했어요.');return data;};
 const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
 const action=(label,handler)=>{const b=el('button','gm-online-action',label);b.type='button';b.addEventListener('click',handler);return b;};
 async function perform(name,args,success){if(busy)return;busy=true;status('처리 중...');try{await call(name,args);status(success);await refresh(true);}catch(e){status(e.message,true);}finally{busy=false;}}
 function renderRows(id,items,kind){
  const root=$(id);root.replaceChildren();
  if(!items.length){root.append(el('p','gm-online-empty',kind==='friend'?'아직 온라인 친구가 없어요.':'아직 요청이 없어요.'));return;}
  for(const item of items){const row=el('div','gm-online-row');const info=el('div','gm-online-info');info.append(el('strong','',kind==='friend'?(aliases[item.code]||item.nickname):item.nickname));if(kind==='friend'&&aliases[item.code])info.append(el('small','', '닉네임: '+item.nickname));if(item.code)info.append(el('small','',item.code));row.append(info);
   if(kind==='incoming') {row.append(action('수락',()=>perform('gm_friend_respond',{request_id:item.id,accept_request:true},'친구가 되었어요!')),action('거절',()=>perform('gm_friend_respond',{request_id:item.id,accept_request:false},'요청을 거절했어요.')));}
   else if(kind==='outgoing')row.append(action('취소',()=>perform('gm_friend_remove',{request_id:item.id},'요청을 취소했어요.')));
   else {row.append(action('별칭',()=>{const value=prompt('이 친구의 별칭 (비우면 원래 닉네임)',aliases[item.code]||'');if(value===null)return;if(value.trim())aliases[item.code]=value.trim().slice(0,24);else delete aliases[item.code];saveAliases();refresh(true);}));row.append(action('삭제',()=>{if(confirm(item.nickname+'님과 친구 관계를 끊을까요?'))perform('gm_friend_remove',{request_id:item.id},'친구를 삭제했어요.');}));}
   root.append(row);
  }
 }
 async function refresh(silent=false){
  if(!user)return;
  const current=++requestSerial;
  if(!silent)status('친구 목록 불러오는 중...');
  try{
   const data=await call('gm_friend_overview');if(current!==requestSerial||!user)return;
   $('gmOnlineName').textContent=data.me.nickname;
   $('gmOnlineCode').textContent=data.me.code;
   if(document.activeElement!==$('gmOnlineNickname'))$('gmOnlineNickname').value=data.me.nickname;
   for(const [key,id,kind] of [['incoming','gmIncomingList','incoming'],['outgoing','gmOutgoingList','outgoing'],['friends','gmOnlineList','friend']])renderRows(id,Array.isArray(data[key])?data[key]:[],kind);
   $('gmIncomingCount').textContent=(data.incoming||[]).length;
   $('gmOutgoingCount').textContent=(data.outgoing||[]).length;
   $('gmOnlineCount').textContent=(data.friends||[]).length;
   if(!silent)status('');
  }catch(e){if(current===requestSerial)status('온라인 친구 설정을 확인해 주세요: '+e.message,true);}
 }
 function updateAuth(next){user=next;requestSerial++;page.querySelector('.friend-my-profile').hidden=!!user;
  if(localHeading)localHeading.querySelector('small').textContent=user?'이 기기에 저장된 친구 (온라인과 별개)':'기기에 등록된 친구';
  if(note)note.textContent=user?'아래 친구와 휴무 비교는 기기에 저장된 데이터로만 작동해요. 온라인 친구의 근무표는 아직 연결되지 않았어요.':'로그인하면 온라인 친구 요청·수락 기능을 이용할 수 있어요. 기기 내 친구는 그대로 이용할 수 있어요.';
  if(user)refresh();else status('로그인하면 온라인 친구 기능을 이용할 수 있어요.');
 }
 $('gmFriendRefresh').addEventListener('click',()=>refresh());
 $('gmSendFriendForm').addEventListener('submit',e=>{e.preventDefault();const code=$('gmTargetCode').value.trim().toUpperCase();if(!/^GM-[A-F0-9]{10}$/.test(code)){status('GM-으로 시작하는 10자리 친구 코드를 입력해 주세요.',true);return;}perform('gm_friend_send',{code_input:code},'친구 요청을 보냈어요!').then(()=>{$('gmTargetCode').value='';});});
 $('gmSaveNickname').addEventListener('click',()=>perform('gm_friend_set_nickname',{new_nickname:$('gmOnlineNickname').value.trim()},'닉네임을 수정했어요.'));
 $('gmCopyCode').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('gmOnlineCode').textContent);status('친구 코드를 복사했어요.');}catch(_){status('복사가 안 되면 코드를 길게 눌러 복사해 주세요.',true);}});
 document.addEventListener('geunmeong:auth-changed',e=>updateAuth(e.detail?.user||null));
 document.querySelector('[data-tab="friends"]').addEventListener('click',()=>{if(user)refresh();});
 // 이미 로그인한 상태에서 페이지를 연 경우에도 복원합니다.
 document.addEventListener('DOMContentLoaded',()=>{if(client())client().auth.getUser().then(({data})=>updateAuth(data.user||null)).catch(()=>{});});
})();
