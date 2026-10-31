/* v21: authenticated friend-to-friend chat, polled while the conversation is open. */
(() => {
 'use strict';
 const overlay=document.createElement('div');overlay.className='friend-chat-overlay gm-real-chat';overlay.hidden=true;
 overlay.innerHTML=`<section class="friend-chat-dialog" role="dialog" aria-modal="true" aria-label="온라인 친구 채팅"><header class="friend-chat-header"><button type="button" id="gmRealChatBack" class="friend-chat-back">← 돌아가기</button><strong id="gmRealChatTitle"></strong><span class="friend-chat-demo-tag">온라인</span></header><div id="gmRealChatMessages" class="friend-chat-messages" aria-live="polite"></div><p id="gmRealChatStatus" class="gm-real-chat-status" role="status"></p><form id="gmRealChatForm" class="friend-chat-form"><input id="gmRealChatInput" type="text" maxlength="1000" placeholder="메시지를 입력하세요" autocomplete="off" aria-label="메시지 입력"><button type="submit">보내기</button></form></section>`;
 document.body.append(overlay);
 const $=id=>document.getElementById(id);
 let active=null, timer=null, busy=false, serial=0, history=[], preview={};
 const client=()=>window.gmSupabaseClient;
 const rpc=async(name,args)=>{const c=client();if(!c)throw Error('로그인 후 이용해 주세요.');const {data,error}=await c.rpc(name,args);if(error)throw Error(error.message||'채팅 요청 실패');return data;};
 const status=(s)=>{$('gmRealChatStatus').textContent=s||'';};
 function paint(){const root=$('gmRealChatMessages');root.replaceChildren();if(!history.length){const p=document.createElement('p');p.className='friend-chat-empty';p.textContent='첫 메시지를 보내보세요! 🐾';root.append(p);}for(const m of history){const bubble=document.createElement('div');bubble.className='friend-chat-bubble '+(m.from==='me'?'mine':'theirs');bubble.textContent=m.text;root.append(bubble);}root.scrollTop=root.scrollHeight;}
 async function refresh(){if(!active||busy||document.hidden)return;const code=active.code,version=serial;busy=true;try{const rows=await rpc('gm_chat_history',{friend_code:code});if(version!==serial||!active||active.code!==code)return;history=Array.isArray(rows)?rows:[];const last=history.at(-1);if(last){preview[code]={text:last.text,time:new Date(last.time).getTime()};document.dispatchEvent(new Event('geunmeong:chat-updated'));}paint();status('');}catch(e){if(version===serial)status('불러오기 오류: '+e.message);}finally{busy=false;}}
 function close(){serial++;active=null;clearInterval(timer);timer=null;overlay.hidden=true;document.body.classList.remove('friend-chat-open');}
 function open(friend){if(!friend?.code)return;close();active={...friend};$('gmRealChatTitle').textContent=friend.alias||friend.nickname||'온라인 친구';overlay.hidden=false;document.body.classList.add('friend-chat-open');history=[];paint();status('대화를 불러오는 중...');refresh();timer=setInterval(refresh,4000);$('gmRealChatInput').focus();}
 $('gmRealChatBack').addEventListener('click',close);
 overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close();});
 document.addEventListener('geunmeong:tab-leave',close);
 document.addEventListener('geunmeong:auth-changed',close);
 $('gmRealChatForm').addEventListener('submit',async e=>{e.preventDefault();if(!active)return;const input=$('gmRealChatInput'),body=input.value.trim();if(!body)return;const code=active.code,button=e.currentTarget.querySelector('button');button.disabled=true;status('전송 중...');try{await rpc('gm_chat_send',{friend_code:code,message_body:body});if(active?.code===code){input.value='';status('');await refresh();}}catch(err){status('전송 실패: '+err.message);}finally{button.disabled=false;}});
 window.gmOnlineChat={open,close,preview:(code)=>preview[code]||null};
})();
