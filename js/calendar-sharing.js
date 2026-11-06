/* v26: Explicit per-friend calendar sharing. All authorization is enforced by Supabase RPCs. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const client = () => window.gmSupabaseClient;
  const rpc = async (name, args={}) => {
    const c=client(); if(!c) throw Error('로그인이 필요해요.');
    const {data,error}=await c.rpc(name,args);
    if(error) throw Error(error.message||'서버 요청 오류');
    return data;
  };
  const make = (tag, cls, content) => {const node=document.createElement(tag);if(cls)node.className=cls;if(content!==undefined)node.textContent=content;return node;};
  const validShifts = new Set(['주간','야간','비번','오후','휴무']);
  const validOverrides = new Set([...validShifts,'연차','당직']);
  const prefInput = document.querySelector('.gm-profile-settings [data-pref="calendarShare"]');
  const profileNote = $('gmCalendarShareStatus');
  const previewButton=$('gmViewSharedCalendar');
  const previewBox=$('gmFriendCalendarPreview');
  const previewMonth=$('gmFriendCalendarMonth');
  const previewDays=$('gmFriendCalendarDays');
  let previewQuery=0;
  const comparisonChoices = $('gmCalendarFriendChoices');
  const comparisonResults = $('friendCompareResults');
  let activeFriend=null,activeProfileQuery=0, user=null;
  let friends=[], compareQuery=0, lastLoadedMonth='', comparedAccess=new Map();
  const included=new Map();
  let publishTimer=null, isPublishing=false, publishRequested=false;
  let shareCount=0;
  function getSnapshot(){
    const stored=JSON.parse(localStorage.getItem('shiftPattern')||'null');
    const cycle=stored?.mode==='weekday' ? ['휴무','주간','주간','주간','주간','주간','휴무'] : stored?.cycle;
    const baseDate=localStorage.getItem('baseDate');
    const shiftIndex=Number(localStorage.getItem('shiftIndex'));
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(baseDate||'') || !Array.isArray(cycle) || !cycle.length || cycle.length>60 || !cycle.every(x=>validShifts.has(x)) || !Number.isInteger(shiftIndex)||shiftIndex<0||shiftIndex>=cycle.length) {
      throw Error('먼저 내 근무 설정을 저장해 주세요.');
    }
    let savedOverrides={};
    try{savedOverrides=JSON.parse(localStorage.getItem('customShifts')||'{}')||{};}catch(_){throw Error('저장된 근무 변경 데이터를 확인해 주세요.');}
    if(typeof savedOverrides!=='object'||Array.isArray(savedOverrides))throw Error('근무 변경 데이터 형식이 올바르지 않아요.');
    const overrides={};
    for(const [day,shift] of Object.entries(savedOverrides)) if(/^\d{4}-\d{2}-\d{2}$/.test(day)&&validOverrides.has(shift))overrides[day]=shift;
    return {mode:stored.mode==='weekday'?'weekday':'shift',baseDate,shiftIndex,cycle,overrides};
  }
  async function publish(){
    if(!user)return;
    if(isPublishing){publishRequested=true;return;}
    isPublishing=true;
    try {await rpc('gm_calendar_publish',{p_schedule:getSnapshot()});}
    finally {isPublishing=false;if(publishRequested){publishRequested=false;schedulePublish();}}
  }
  const briefError = e => (e?.message||'요청에 실패했어요.').replace(/\s+/g,' ').slice(0,260);
  function schedulePublish(){
    if(!user||shareCount<=0)return;
    clearTimeout(publishTimer);
    publishTimer=setTimeout(()=>publish().catch(e=>{profileNote.textContent='근무표 서버 갱신 실패: '+briefError(e);}),1700);
  }
  // Observe only the calendar keys. Do not publish personal notes, email, leave costs, or other data.
  const originalSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){const result=originalSetItem.call(this,key,value);if(this===localStorage&&['shiftPattern','shiftIndex','baseDate','customShifts'].includes(key))schedulePublish();return result;};
  const say = (msg,bad=false) => {profileNote.textContent=msg;profileNote.classList.toggle('error',bad);};
  async function profileOpened(friend){
    activeFriend=friend;const serial=++activeProfileQuery;
    prefInput.checked=false;prefInput.disabled=true;
    previewButton.disabled=true;previewBox.hidden=true;previewQuery++;
    say('공유 설정 확인 중...');
    if(!user){say('로그인하면 달력 공유를 설정할 수 있어요.');return;}
    try {
      const status=await rpc('gm_calendar_access_status',{p_friend_code:friend.code});
      if(serial!==activeProfileQuery||activeFriend?.code!==friend.code)return;
      prefInput.checked=!!status.i_share;
      prefInput.disabled=false;
      previewButton.disabled=!(status.they_share&&status.they_have_schedule);
      say(status.they_share ? '상대방도 나에게 근무표를 공유 중이에요.' : '기본은 비공개예요. 켜면 이 친구에게 내 근무 종류만 보여줘요.');
    } catch(e) {
      if(serial===activeProfileQuery){say('공유 설정 불러오기 실패: '+briefError(e)+' (SQL 설정 확인)',true);}
    }
  }
  async function toggleShare(friend,allowed){
    if(!user||!friend)return;
    prefInput.disabled=true;
    say(allowed?'근무표 공유 설정 중...':'공유 끄는 중...');
    try {
      // Publish before granting permission. Never make stale data visible when a new grant is created.
      if(allowed) await publish();
      await rpc('gm_calendar_set_access',{p_friend_code:friend.code,p_allowed:allowed});
      if(allowed)shareCount+=1;else shareCount=Math.max(0,shareCount-1);
      if(activeFriend?.code===friend.code)prefInput.checked=allowed;
      say(allowed?'이 친구에게만 내 근무 종류를 공유해요. 메모는 공개되지 않아요.':'이 친구의 내 근무표 접근을 차단했어요.');
      if(!$('friendComparePanel').hidden) refreshCompare();
    } catch(e) {if(activeFriend?.code===friend.code){prefInput.checked=!allowed;say('설정 실패: '+briefError(e),true);}}
    finally {if(activeFriend?.code===friend.code)prefInput.disabled=false;}
  }
  async function showPreview(){
    const friend=activeFriend;
    if(!friend||previewButton.disabled)return;
    previewBox.hidden=false;
    const serial=++previewQuery;
    const month=previewMonth.value;
    previewDays.textContent='근무표 불러오는 중...';
    if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month)){
      previewDays.textContent='조회 월을 선택해 주세요.';return;
    }
    try {
      const result=await rpc('gm_calendar_shared_month',{p_friend_code:friend.code,p_month:month});
      if(serial!==previewQuery||activeFriend?.code!==friend.code||previewBox.hidden)return;
      const grid=make('div','gm-calendar-preview-grid');
      for(const day of result.days||[]){
        const card=make('div','gm-calendar-preview-day');
        card.append(make('strong','',String(Number(day.date.slice(-2)))),make('small','',day.shift));
        if(['비번','휴무'].includes(day.shift))card.classList.add('off');
        grid.append(card);
      }
      previewDays.replaceChildren(grid);
    } catch(e){if(serial===previewQuery)previewDays.textContent='근무표 불러오기 실패: '+briefError(e);}
  }
  previewMonth.value=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  previewButton.addEventListener('click',()=>{if(!previewBox.hidden){previewBox.hidden=true;previewQuery++;return;}showPreview();});
  previewMonth.addEventListener('change',()=>{if(!previewBox.hidden)showPreview();});
  function hideOldUI(){
    const oldText=document.querySelector('.gm-profile-note');
    if(oldText)oldText.textContent='달력 공유는 친구별로 허용해야 볼 수 있어요. 게시물 공유는 추후 지원해요.';
  }
  hideOldUI();
  // Compare only calendars explicitly shared with this account.
  const today=new Date();
  $('friendCompareMonth').value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const isRest=(s,leave)=>s==='휴무'||s==='비번'||(leave&&s==='연차');
  const previousDay=date=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);};
  const ownShift=date=>{const [y,m,d]=date.split('-').map(Number);return (typeof customShifts!=='undefined'&&customShifts[date])||getShift(y,m-1,d);};
  function renderChoices(){
    comparisonChoices.replaceChildren();
    for(const friend of friends){
      const state=comparedAccess.get(friend.code);
      const allowed=!!state?.they_share && !!state?.they_have_schedule;
      const row=make('label','gm-share-friend-row');
      const checkbox=make('input');checkbox.type='checkbox';checkbox.disabled=!allowed;checkbox.checked=allowed&&included.get(friend.code)!==false;
      checkbox.addEventListener('change',()=>{included.set(friend.code,checkbox.checked);renderResults();});
      const desc=make('span','');desc.append(make('strong','',friend.nickname),make('small','',!state?'공유 확인 중...':state.error?'공유 확인 오류 · SQL 설정을 확인해 주세요':allowed?'근무표 공유 중':state.they_share?'근무표 아직 저장되지 않음':'상대방이 근무표를 공유하지 않았어요'));
      row.append(checkbox,desc);comparisonChoices.append(row);
    }
    if(!friends.length)comparisonChoices.textContent='먼저 온라인 친구를 추가해 주세요.';
  }
  async function refreshCompare(){
    const serial=++compareQuery;
    comparedAccess.clear();renderChoices();
    comparisonResults.textContent=user?'친구의 공유 설정을 확인하고 있어요...':'로그인해야 친구 근무표를 비교할 수 있어요.';
    if(!user||!friends.length){if(friends.length===0)comparisonResults.textContent='비교할 친구가 없어요.';return;}
    try {
      const statuses=await Promise.all(friends.map(async f=>{try{return [f.code,await rpc('gm_calendar_access_status',{p_friend_code:f.code})];}catch(e){return [f.code,{error:briefError(e)}];}}));
      if(serial!==compareQuery)return;
      comparedAccess=new Map(statuses);
      shareCount=statuses.filter(([,s])=>s.i_share).length;
      renderChoices();
      await renderResults();
    } catch(e){if(serial===compareQuery)comparisonResults.textContent='공유 설정 확인 실패: '+briefError(e);}
  }
  async function renderResults(){
    const serial=++compareQuery;
    const month=$('friendCompareMonth').value;
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){comparisonResults.textContent='조회 월을 선택해 주세요.';return;}
    const selected=friends.filter(f=>comparedAccess.get(f.code)?.they_share&&comparedAccess.get(f.code)?.they_have_schedule&&included.get(f.code)!==false);
    if(!selected.length){comparisonResults.textContent=[...comparedAccess.values()].some(x=>x?.error)?'공유 기능 설정을 확인해 주세요. ONLINE_CALENDAR_SHARE_SETUP.sql을 먼저 실행해야 해요.':'근무표를 공유한 친구를 선택해 주세요.';return;}
    comparisonResults.textContent='공통 휴무일 계산 중...';
    const includeLeave=$('friendIncludeLeave').checked,excludeAfterNight=$('friendNightNext').checked;
    try {
      const monthly=await Promise.all(selected.map(async friend=>({friend, result:await rpc('gm_calendar_shared_month',{p_friend_code:friend.code,p_month:month})})));
      // To avoid false matches on the first day, fetch the prior month for previous-day night checks.
      let priorMonthMap=new Map();
      if(excludeAfterNight){
        const first=new Date(month+'-01T12:00:00Z');first.setUTCDate(0);
        const prevMonth=first.toISOString().slice(0,7);
        const history=await Promise.all(selected.map(async friend=>({friend,result:await rpc('gm_calendar_shared_month',{p_friend_code:friend.code,p_month:prevMonth})})));
        priorMonthMap=new Map(history.map(({friend,result})=>[friend.code,new Map((result?.days||[]).map(d=>[d.date,d.shift]))]));
      }
      if(serial!==compareQuery)return;
      const lookups=monthly.map(({friend,result})=>({friend,days:new Map((result?.days||[]).map(d=>[d.date,d.shift]))}));
      const [y,m]=month.split('-').map(Number),count=new Date(y,m,0).getDate();
      const grid=make('div','friend-match-grid');let matches=0;
      for(let day=1;day<=count;day++){
        const date=`${month}-${String(day).padStart(2,'0')}`,own=ownShift(date);
        if(!isRest(own,includeLeave))continue;
        const yesterday=previousDay(date);
        if(excludeAfterNight&&ownShift(yesterday)==='야간')continue;
        const shifts=lookups.map(item=>item.days.get(date));
        if(!shifts.every(s=>isRest(s,includeLeave)))continue;
        if(excludeAfterNight&&lookups.some(item=>(item.days.get(yesterday)||priorMonthMap.get(item.friend.code)?.get(yesterday))==='야간'))continue;
        matches++;
        const row=make('div','friend-match-day');
        row.append(make('strong','',`${m}/${day}`),make('small','',`나 ${own} · ${lookups.map((item,i)=>item.friend.nickname+' '+shifts[i]).join(' · ')}`));grid.append(row);
      }
      comparisonResults.replaceChildren(make('p','friend-match-summary',`${month} 공통 휴무일 ${matches}일`),grid);
      if(!matches)grid.append(make('small','','선택한 친구들과 쉬는 날이 겹치지 않아요.'));
    } catch(e){if(serial===compareQuery)comparisonResults.textContent='조회 실패: '+briefError(e)+' (공유 권한 또는 SQL 설정 확인)';}
  }
  function setOnlineFriends(data){friends=Array.isArray(data)?data:[]; if(!$('friendComparePanel').hidden)refreshCompare();}
  // Fetch current grant counts on login, only for keeping explicitly shared snapshots current.
  async function onAuth(next){
    user=next;shareCount=0;activeFriend=null;activeProfileQuery++;compareQuery++;
    clearTimeout(publishTimer);comparedAccess.clear();
    if(!user)return;
    // Grant count is only derived from accepted friend relationships. No permissions are enabled here.
    if(friends.length){
      const identity=user.id;
      const statuses=await Promise.all(friends.map(f=>rpc('gm_calendar_access_status',{p_friend_code:f.code}).catch(()=>null)));
      if(user?.id===identity)shareCount=statuses.filter(s=>s?.i_share).length;
    }
  }
  document.addEventListener('geunmeong:auth-changed',e=>onAuth(e.detail?.user||null));
  document.addEventListener('geunmeong:online-friends-updated',e=>{
    setOnlineFriends(e.detail?.friends);
    if(user&&friends.length)onAuth(user);
  });
  document.addEventListener('geunmeong:tab-leave',()=>{activeFriend=null;activeProfileQuery++;compareQuery++;});
  $('friendCompareMonth').addEventListener('change',()=>{if(!$('friendComparePanel').hidden)renderResults();});
  $('friendIncludeLeave').addEventListener('change',()=>{if(!$('friendComparePanel').hidden)renderResults();});
  $('friendNightNext').addEventListener('change',()=>{if(!$('friendComparePanel').hidden)renderResults();});
  // Initial auth event could occur before this module was loaded.
  if(client())client().auth.getUser().then(({data})=>onAuth(data?.user||null)).catch(()=>{});
  window.gmCalendarSharing={profileOpened,toggleShare,refreshCompare,setOnlineFriends,publishNow:publish};
})();
