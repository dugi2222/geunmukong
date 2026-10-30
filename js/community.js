/* 24단계: 게시판별 목록 → 글 상세 보기. 이 기기에서만 저장. */
(() => {
  const $ = id => document.getElementById(id);
  const key = 'geunmeongCommunityLocalV1';
  const categories = ['자유','근무 이야기','건의사항','친구 전용'];
  let posts=[];
  try { const saved=JSON.parse(localStorage.getItem(key)||'[]'); if(Array.isArray(saved))posts=saved.filter(p=>p&&typeof p.id==='string'&&typeof p.title==='string'&&typeof p.body==='string'&&Array.isArray(p.comments)); }catch(_){}
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(posts));return true;}catch(_){alert('저장 공간이 부족해요.');return false;}};
  const make=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e;};
  const date=t=>new Date(t).toLocaleDateString('ko-KR');
  let board=null, selected=null, composing=false;
  const show=(id,on)=>{$(id).hidden=!on;};
  function render(){
    show('communityBoards',!board&&!selected&&!composing);
    show('communityBoardView',!!board&&!selected&&!composing);
    show('communityDetailView',!!selected&&!composing);
    show('communityCompose',composing);
    $('communityComposeToggle').hidden=composing;
    [['자유','boardCountFree'],['근무 이야기','boardCountWork'],['건의사항','boardCountIdeas'],['친구 전용','boardCountFriends']].forEach(([c,id])=>$(id).textContent=posts.filter(p=>p.category===c).length);
    if(composing)return;
    if(selected){renderDetail();return;}
    if(!board)return;
    $('communityBoardTitle').textContent=board==='자유'?'☕ 자유게시판':board==='근무 이야기'?'🗓️ 근무 이야기':board==='건의사항'?'💡 건의사항':'👥 친구 전용 (테스트)';
    const items=posts.filter(p=>p.category===board).sort((a,b)=>b.created-a.created);
    $('communityPostCount').textContent=items.length+'개 글';
    const list=$('communityPosts');list.replaceChildren();
    if(!items.length){list.append(make('p','community-empty','아직 작성한 글이 없어요. 첫 글을 남겨보세요 🐶'));return;}
    items.forEach(p=>{
      const btn=make('button','community-row');btn.type='button';
      btn.append(make('strong','community-row-title',p.title));
      const meta=make('span','community-row-meta',(p.anonymous?'익명':'나')+'  ·  '+date(p.created)+'  ·  💬 '+p.comments.length);
      btn.append(meta);btn.addEventListener('click',()=>{selected=p.id;render();});list.append(btn);
    });
  }
  function renderDetail(){
    const p=posts.find(x=>x.id===selected);
    if(!p){selected=null;render();return;}
    const root=$('communityDetail');root.replaceChildren();
    root.append(make('span','community-tag',p.category),make('h3','community-detail-title',p.title),make('div','community-detail-date',(p.anonymous?'익명':'나')+' · '+date(p.created)),make('p','community-detail-body',p.body));
    const actions=make('div','community-actions');const del=make('button','','글 삭제');del.type='button';
    del.addEventListener('click',()=>{if(confirm('이 글과 댓글을 삭제할까요?')){posts=posts.filter(x=>x.id!==p.id);save();selected=null;render();}});
    actions.append(del);root.append(actions,make('h4','community-comment-heading','💬 댓글 '+p.comments.length));
    const comments=make('div','community-comments');
    p.comments.forEach((c,i)=>{const row=make('div','community-comment');row.append(make('span','', (c.anonymous?'익명: ':'나: ')+c.text));const remove=make('button','','✕');remove.type='button';remove.setAttribute('aria-label','댓글 삭제');remove.addEventListener('click',()=>{p.comments.splice(i,1);save();render();});row.append(remove);comments.append(row);});
    const form=make('form','community-comment-form');const input=make('input');input.placeholder='댓글을 입력해 주세요';input.maxLength=300;input.required=true;input.setAttribute('aria-label','댓글 내용');const submit=make('button','','등록');submit.type='submit';const anonLabel=make('label','community-comment-anon');const anon=document.createElement('input');anon.type='checkbox';anonLabel.append(anon,document.createTextNode(' 익명'));form.append(input,anonLabel,submit);
    form.addEventListener('submit',e=>{e.preventDefault();const value=input.value.trim();if(!value)return;p.comments.push({text:value,anonymous:anon.checked,created:Date.now()});save();render();});
    comments.append(form);root.append(comments);
  }
  document.querySelectorAll('#communityBoards [data-board]').forEach(btn=>btn.addEventListener('click',()=>{board=btn.dataset.board;selected=null;render();}));
  $('communityBackBoards').addEventListener('click',()=>{board=null;render();});
  $('communityBackList').addEventListener('click',()=>{selected=null;render();});
  $('communityComposeToggle').addEventListener('click',()=>{composing=true;$('communityCategory').value=board||'자유';render();$('communityTitle').focus();});
  $('communityCancel').addEventListener('click',()=>{composing=false;render();});
  $('communityCompose').addEventListener('submit',e=>{
    e.preventDefault();const title=$('communityTitle').value.trim(),body=$('communityBody').value.trim();if(!title||!body)return;
    const category=$('communityCategory').value;
    posts.push({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()),category,title,body,anonymous:$('communityAnonymous').checked,created:Date.now(),comments:[]});
    if(posts.length>200)posts=posts.slice(-200);
    save();e.target.reset();composing=false;board=category;selected=null;render();
  });
  document.addEventListener('geunmeong:tab-leave', () => {
    board = null;
    selected = null;
    composing = false;
    render();
  });
  render();
})();
