/* 근무 기록: 캐릭터와 메뉴 전환형 대시보드 */
const leaveYearSelect=document.getElementById('leaveYear');
const leaveResetMonth=document.getElementById('leaveResetMonth');
const leaveResetDay=document.getElementById('leaveResetDay');
const leaveAllowanceInput=document.getElementById('leaveAllowance');
const statsHireDate=document.getElementById('statsHireDate');
const statsExitDate=document.getElementById('statsExitDate');
const dashMenu=document.getElementById('dashboardMenu');
const dashPanel=document.getElementById('dashboardPanel');
const panelNames={leave:'연차 관리',hire:'입사 정보',settings:'내 근무 설정',character:'캐릭터 변경'};
function showDashboardPanel(name){
  const active=Boolean(panelNames[name]);
  dashMenu.hidden=active;dashPanel.hidden=!active;
  for(const key of Object.keys(panelNames))document.getElementById('dashboard'+key[0].toUpperCase()+key.slice(1)).hidden=key!==name;
  if(active)document.getElementById('dashboardPanelTitle').textContent=panelNames[name];
  if(name==='settings'){
    const fields=document.getElementById('baseSettingsFields');
    fields.hidden=false;
    document.getElementById('toggleBaseSettings').hidden=true;
  }
  if(name==='hire'){
    statsHireDate.value=localStorage.getItem('hireDate')||'';
    statsExitDate.value=localStorage.getItem('exitDate')||'';
  }
  if(name==='leave')renderLeaveInfo();
  if(name==='character')renderCharacterChoices();
}
document.querySelectorAll('#dashboardMenu [data-panel]').forEach(b=>b.addEventListener('click',()=>showDashboardPanel(b.dataset.panel)));
document.getElementById('characterChange').addEventListener('click',()=>showDashboardPanel('character'));
document.getElementById('dashboardBack').addEventListener('click',()=>showDashboardPanel(null));
function dateFromInput(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;const [y,m,d]=value.split('-').map(Number);const date=new Date(y,m-1,d);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date:null;}
function daysBetween(a,b){return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);}
function renderTenure(){
  const today=new Date();const hire=dateFromInput(localStorage.getItem('hireDate'));
  const exit=dateFromInput(localStorage.getItem('exitDate'));
  const elapsed=hire?Math.max(0,daysBetween(hire,today)+1):0;
  const total=hire&&exit?daysBetween(hire,exit)+1:0;
  const progress=total>0?Math.max(0,Math.min(100,elapsed/total*100)):100;
  const fill=document.getElementById('tenureFill');fill.style.width=progress+'%';
  const bar=fill.parentElement;bar.setAttribute('aria-valuenow',String(Math.round(progress)));
  document.getElementById('tenureDays').textContent=hire?elapsed+'일':'입사일 미설정';
  document.getElementById('tenureRemaining').textContent=exit?'D-'+Math.max(0,daysBetween(today,exit))+(daysBetween(today,exit)<0?' (퇴사일 경과)':''):'';
}
/* 연차 기준 기간은 매년 사용자가 선택한 월·일에 시작해요. */
function leaveReset(){
 const raw=localStorage.getItem('leaveResetDate')||'01-01';
 const match=/^(\d{2})-(\d{2})$/.exec(raw);
 return match?{month:Number(match[1]),day:Number(match[2])}:{month:1,day:1};
}
function leaveCycleStart(year){
 const {month,day}=leaveReset();
 return new Date(year,month-1,day);
}
function leaveCycleYear(date){
 const y=date.getFullYear();return date>=leaveCycleStart(y)?y:y-1;
}
function dateLabel(d){return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;}
function populateLeaveReset(){
 const reset=leaveReset();leaveResetMonth.replaceChildren();
 for(let m=1;m<=12;m++){const o=new Option(m+'월',String(m));leaveResetMonth.add(o);}
 leaveResetMonth.value=String(reset.month);
 populateLeaveDays(reset.day);
}
function populateLeaveDays(selected){
 const month=Number(leaveResetMonth.value);
 // 2월 29일도 설정할 수 있도록 윤년 기준으로 목록 구성
 const max=new Date(2024,month,0).getDate();
 leaveResetDay.replaceChildren();
 for(let d=1;d<=max;d++)leaveResetDay.add(new Option(d+'일',String(d)));
 leaveResetDay.value=String(Math.min(selected||1,max));
}
function saveLeaveReset(){
 const month=String(leaveResetMonth.value).padStart(2,'0'),day=String(leaveResetDay.value).padStart(2,'0');
 const next=month+'-'+day;
 if(next===localStorage.getItem('leaveResetDate'))return;
 if(!confirm('연차 갱신일을 변경하면 연차 사용 내역의 집계 기간이 달라져요. 변경할까요?')){populateLeaveReset();return;}
 localStorage.setItem('leaveResetDate',next);renderLeaveInfo();
}
leaveResetMonth.addEventListener('change',()=>{const oldDay=Number(leaveResetDay.value);populateLeaveDays(oldDay);saveLeaveReset();});
leaveResetDay.addEventListener('change',saveLeaveReset);
function renderLeaveInfo(){
 const today=new Date(),currentYear=leaveCycleYear(today);
 const selectedYear=leaveYearSelect.value!==''?Number(leaveYearSelect.value):currentYear;
 leaveYearSelect.replaceChildren();
 for(let y=currentYear-5;y<=currentYear+5;y++){
  const start=leaveCycleStart(y),end=new Date(leaveCycleStart(y+1).getTime()-86400000);
  const option=new Option(y+'년 시작',String(y));option.selected=y===selectedYear;leaveYearSelect.add(option);
 }
 if(!leaveYearSelect.value)leaveYearSelect.value=String(currentYear);
 const year=Number(leaveYearSelect.value),start=leaveCycleStart(year),end=new Date(leaveCycleStart(year+1).getTime()-86400000);
 document.getElementById('leavePeriodDates').textContent=dateLabel(start)+' ~ '+dateLabel(end);
 const reset=leaveReset();
 // 1월 1일 기준의 기존 연도별 연차 총량은 그대로 사용해요.
 const key=(reset.month===1&&reset.day===1)?'leaveAllowance:'+year:'leaveAllowanceCycle:'+String(reset.month).padStart(2,'0')+'-'+String(reset.day).padStart(2,'0')+':'+year;
 leaveAllowanceInput.dataset.storageKey=key;
 const allowance=localStorage.getItem(key);leaveAllowanceInput.value=allowance===null?'':allowance;
 const dates=Object.keys(customShifts).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&k>=`${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`&&k<=`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`&&customShifts[k]==='연차').sort();
 const used=dates.reduce((sum,k)=>sum+leaveAmountFor(k),0);
 const remaining=allowance===null?'미설정':(Number(allowance)-used).toLocaleString('ko-KR')+'일';
 document.getElementById('leaveSummary').innerHTML='';
 const sum=document.getElementById('leaveSummary');
 const items=[['총연차',allowance===null?'미설정':Number(allowance).toLocaleString('ko-KR')+'일'],['사용',used.toLocaleString('ko-KR')+'일'],['잔여',remaining]];
 items.forEach(([label,value])=>{const item=document.createElement('div');item.className='leave-summary-item';const small=document.createElement('span');small.textContent=label;const strong=document.createElement('strong');strong.textContent=value;item.append(small,strong);sum.appendChild(item);});
 const history=document.getElementById('leaveDates');history.replaceChildren();
 const title=document.createElement('strong');title.textContent='사용 내역 ('+dates.length+'회)';history.appendChild(title);
 if(!dates.length){const empty=document.createElement('p');empty.textContent='등록된 연차가 없어요.';history.appendChild(empty);}
 else dates.slice().reverse().forEach(k=>{const row=document.createElement('div');row.className='leave-history-row';const day=document.createElement('span');day.textContent=k;const amount=document.createElement('b');amount.textContent='−'+leaveAmountFor(k)+'일';row.append(day,amount);history.appendChild(row);});
}
populateLeaveReset();
leaveYearSelect.addEventListener('change',renderLeaveInfo);
leaveAllowanceInput.addEventListener('change',()=>{
 const v=leaveAllowanceInput.value,key=leaveAllowanceInput.dataset.storageKey;
 if(v==='')localStorage.removeItem(key);
 else if(Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=365)localStorage.setItem(key,String(Number(v)));
 else alert('연차는 0~365일 사이로 입력해 주세요.');renderLeaveInfo();
});
document.getElementById('saveHireDate').addEventListener('click',()=>{
 const hire=dateFromInput(statsHireDate.value),exit=statsExitDate.value?dateFromInput(statsExitDate.value):null;
 if(!hire){alert('올바른 입사일을 입력해 주세요.');return;}
 if(statsExitDate.value&&(!exit||exit<hire)){alert('퇴사 예정일은 입사일 이후로 설정해 주세요.');return;}
 localStorage.setItem('hireDate',statsHireDate.value);
 if(exit)localStorage.setItem('exitDate',statsExitDate.value);else localStorage.removeItem('exitDate');
 renderTenure();showDashboardPanel(null);
});
const mascotIcons={bean:'🌱',dog:'🐶',cat:'🐱'};
function selectedCharacter(){return localStorage.getItem('dashboardCharacter')||document.body.dataset.mascotTheme||'bean';}
function renderDashboardCharacter(){
 const el=document.getElementById('dashboardMascot');const choice=selectedCharacter();const photo=localStorage.getItem('dashboardPhoto');
 el.replaceChildren();
 if(choice==='photo'&&photo){const img=document.createElement('img');img.src=photo;img.alt='내 사진';el.appendChild(img);el.setAttribute('aria-label','내 사진');}
 else{const actual=choice==='photo'?'bean':choice;el.textContent=mascotIcons[actual]||'🌱';el.setAttribute('aria-label',({bean:'근무콩',dog:'근무멍',cat:'근무냥'})[actual]||'근무콩');}
}
function renderCharacterChoices(){const selected=selectedCharacter();document.querySelectorAll('[data-character]').forEach(b=>b.classList.toggle('selected',b.dataset.character===selected));}
document.querySelectorAll('[data-character]').forEach(b=>b.addEventListener('click',()=>{
 if(b.dataset.character==='photo'&&!localStorage.getItem('dashboardPhoto')){document.getElementById('characterPhoto').click();return;}
 localStorage.setItem('dashboardCharacter',b.dataset.character);renderDashboardCharacter();renderCharacterChoices();showDashboardPanel(null);
}));
document.getElementById('characterPhoto').addEventListener('change',e=>{
 const file=e.target.files&&e.target.files[0];if(!file)return;
 if(!file.type.startsWith('image/')){alert('이미지 파일을 선택해 주세요.');return;}
 const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{
  const canvas=document.createElement('canvas');const max=480;const scale=Math.min(1,max/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  try{localStorage.setItem('dashboardPhoto',canvas.toDataURL('image/jpeg',0.76));localStorage.setItem('dashboardCharacter','photo');renderDashboardCharacter();showDashboardPanel(null);}
  catch(_){alert('사진을 저장할 공간이 부족해요. 다른 사진을 선택해 주세요.');}
 };img.onerror=()=>alert('사진을 읽을 수 없어요.');img.src=reader.result;};reader.readAsDataURL(file);
});
function renderWorkStats(){renderTenure();renderDashboardCharacter();}
renderWorkStats();


