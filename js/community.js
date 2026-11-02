/* v22: Supabase online bulletin board. Local posts remain untouched in localStorage. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const make=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e;};
 const date=t=>new Date(t).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
 const client=()=>window.gmSupabaseClient;
 const rpc=async(name,args={})=>{const c=client();if(!c)throw Error('로그인 후 이용해 주세요.');const {data,error}=await c.rpc(name,args);if(error)throw Error(error.message||'요청에 실패했어요.');return data;};
 let board=null,selected=null,composing=false,items=[],detail=null,version=0,loading=false;
 const note=document.querySelector('.community-local-notice');
 note.textContent='🌐 온라인 게시판입니다. 로그인한 사용자끼리 글과 댓글을 공유해요. 기존 기기 저장 글은 자동으로 게시되지 않아요.';
 const status=make('p','community-online-status','');status.setAttribute('role','status');status.setAttribute('aria-live','polite');note.after(status);
 const tell=(msg,bad=false)=>{status.textContent=msg||'';status.style.color=bad?'#bb3434':'';};
 const show=(id,on)=>{$(id).hidden=!on;};
 function render(){
  show('communityBoards',!board&&!selected&&!composing);
  show('communityBoardView',!!board&&!selected&&!composing);
  show('communityDetailView',!!selected&&!composing);
  show('communityCompose',composing);
  $('communityComposeToggle').hidden=composing;
  if(composing)return;
  if(selected!==null){renderDetail();return;}
  if(!board)return;
  $('communityBoardTitle').textContent=({'자유':'☕ 자유게시판','근무 이야기':'🗓️ 근무 이야기','건의사항':'💡 건의사항','친구 전용':'👥 친구 전용'})[board];
  $('communityPostCount').textContent=items.length+'개 글';
  const list=$('communityPosts');list.replaceChildren();
  if(!items.length){list.append(make('p','community-empty',loading?'불러오는 중...':'아직 게시글이 없어요. 첫 글을 남겨보세요 🐶'));return;}
  items.forEach(p=>{const btn=make('button','community-row');btn.type='button';btn.append(make('strong','community-row-title',p.title));btn.append(make('span','community-row-meta',p.author+' · '+date(p.created_at)+' · 💬 '+p.comment_count));btn.addEventListener('click',()=>{selected=p.id;detail=null;render();loadDetail();});list.append(btn);});
 }
 async function loadList(){if(!board)return;const current=++version;loading=true;items=[];render();tell('게시글을 불러오는 중...');try{const rows=await rpc('gm_board_list',{p_category:board});if(current!==version)return;items=Array.isArray(rows)?rows:[];tell('');}catch(e){if(current===version)tell('게시판 오류: '+e.message,true);}finally{if(current===version){loading=false;render();}}}
 async function loadDetail(){const id=selected,current=++version;tell('게시글을 불러오는 중...');try{const row=await rpc('gm_board_detail',{p_post_id:id});if(current!==version||selected!==id)return;detail=row;tell('');render();}catch(e){if(current===version)tell('게시글 오류: '+e.message,true);}}
 function renderDetail(){const root=$('communityDetail');root.replaceChildren();const p=detail;if(!p||p.id!==selected){root.append(make('p','community-empty','게시글을 불러오는 중...'));return;}
  root.append(make('span','community-tag',p.category),make('h3','community-detail-title',p.title),make('div','community-detail-date',p.author+' · '+date(p.created_at)),make('p','community-detail-body',p.body));
  if(p.mine){const actions=make('div','community-actions');const del=make('button','','글 삭제');del.type='button';del.addEventListener('click',async()=>{if(!confirm('이 글과 댓글을 삭제할까요?'))return;del.disabled=true;try{await rpc('gm_board_delete',{p_post_id:p.id});selected=null;detail=null;await loadList();}catch(e){tell(e.message,true);del.disabled=false;}});actions.append(del);root.append(actions);}
  const comments=Array.isArray(p.comments)?p.comments:[];root.append(make('h4','community-comment-heading','💬 댓글 '+comments.length));const container=make('div','community-comments');
  comments.forEach(c=>{const row=make('div','community-comment');row.append(make('span','',c.author+': '+c.body));if(c.mine){const del=make('button','','✕');del.type='button';del.setAttribute('aria-label','댓글 삭제');del.addEventListener('click',async()=>{del.disabled=true;try{await rpc('gm_board_comment_delete',{p_comment_id:c.id});await loadDetail();}catch(e){tell(e.message,true);del.disabled=false;}});row.append(del);}container.append(row);});
  const form=make('form','community-comment-form');const input=make('input');input.placeholder='댓글을 입력해 주세요';input.maxLength=300;input.required=true;input.setAttribute('aria-label','댓글 내용');const submit=make('button','','등록');submit.type='submit';const label=make('label','community-comment-anon');const anon=document.createElement('input');anon.type='checkbox';label.append(anon,document.createTextNode(' 익명'));form.append(input,label,submit);
  form.addEventListener('submit',async e=>{e.preventDefault();const body=input.value.trim();if(!body)return;submit.disabled=true;try{await rpc('gm_board_comment',{p_post_id:p.id,p_body:body,p_anonymous:anon.checked});await loadDetail();}catch(err){tell('댓글 등록 실패: '+err.message,true);}finally{submit.disabled=false;}});
  container.append(form);root.append(container);
 }
 document.querySelectorAll('#communityBoards [data-board]').forEach(btn=>btn.addEventListener('click',()=>{board=btn.dataset.board;selected=null;detail=null;render();loadList();}));
 $('communityBackBoards').addEventListener('click',()=>{version++;board=null;selected=null;detail=null;tell('');render();});
 $('communityBackList').addEventListener('click',()=>{version++;selected=null;detail=null;render();loadList();});
 $('communityComposeToggle').addEventListener('click',()=>{composing=true;$('communityCategory').value=board||'자유';render();$('communityTitle').focus();});
 $('communityCancel').addEventListener('click',()=>{composing=false;render();});
 $('communityCompose').addEventListener('submit',async e=>{e.preventDefault();const title=$('communityTitle').value.trim(),body=$('communityBody').value.trim(),category=$('communityCategory').value;if(!title||!body)return;const submit=e.currentTarget.querySelector('[type="submit"]');submit.disabled=true;tell('글 등록 중...');try{await rpc('gm_board_create',{p_category:category,p_title:title,p_body:body,p_anonymous:$('communityAnonymous').checked});e.target.reset();composing=false;board=category;selected=null;detail=null;await loadList();}catch(err){tell('글 등록 실패: '+err.message,true);}finally{submit.disabled=false;}});
 document.querySelector('[data-tab="community"]').addEventListener('click',()=>{if(board&&!composing&&selected===null)loadList();});
 document.addEventListener('geunmeong:tab-leave',()=>{version++;board=null;selected=null;detail=null;composing=false;tell('');render();});
 document.addEventListener('geunmeong:auth-changed',()=>{version++;items=[];detail=null;if(board&&!composing)loadList();});
 render();
})();
