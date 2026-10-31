/* 계정별 클라우드 동기화: 사용자 승인 후에만 시작. 로컬 데이터를 자동으로 덮어쓰지 않습니다. */
(() => {
 'use strict';
 const keys=['baseDate','shiftIndex','shiftPattern','customShifts','dayNotes','leaveDeductions','leaveDeductionsMigrated','leaveResetDate','hireDate','exitDate','mascotShiftColors','mascotTheme','dashboardCharacter','geunmeongOnlineFriendAliasesV1'];
 const prefix='leaveRate:';
 const $=id=>document.getElementById(id);
 const box=document.createElement('section');box.className='gm-sync-box';
 box.innerHTML='<h3>☁️ 내 데이터 동기화</h3><p id="gmSyncStatus">계정 연결을 확인하는 중...</p><div class="gm-sync-actions"><button type="button" id="gmSyncUpload">이 기기 데이터로 시작</button><button type="button" id="gmSyncDownload">클라우드 데이터 가져오기</button><button type="button" id="gmSyncStop">자동 저장 끄기</button></div><small>처음에는 자동으로 덮어쓰지 않아요. 두 버튼 중 하나를 선택한 뒤에만 이 기기의 변경사항을 자동 저장합니다. 다른 기기에서 변경한 데이터가 있으면 자동 저장을 멈춰 충돌을 방지해요.</small>';
 const signed=$('gmAuthSignedIn');if(!signed)return;signed.append(box);
 let user=null,enabled=false,revision=null,working=false,timer=null;
 const client=()=>window.gmSupabaseClient;
 const flag=()=>user?'gmCloudSyncEnabled:'+user.id:'';
 const status=(s)=>{$('gmSyncStatus').textContent=s;};
 function snapshot(){const data={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(keys.includes(key)||key.startsWith(prefix))data[key]=localStorage.getItem(key);}return data;}
 function apply(data){if(!data||typeof data!=='object'||Array.isArray(data))throw Error('클라우드 데이터 형식이 올바르지 않아요.');for(const key of Object.keys(data)){if(!(keys.includes(key)||key.startsWith(prefix)))continue;if(typeof data[key]!=='string')continue;localStorage.setItem(key,data[key]);}}
 async function read(){const {data,error}=await client().from('gm_account_data').select('payload,revision,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw Error(error.message);return data;}
 async function upload(force=false){if(!user||working)return;working=true;try{
  const current=await read();
  if(!force&&current&&revision!==null&&current.revision!==revision){enabled=false;localStorage.removeItem(flag());status('⚠️ 다른 기기에서 데이터가 바뀌었어요. 자동 저장을 중지했어요. 다시 선택해 주세요.');return;}
  if(!force&&current&&revision===null){enabled=false;status('⚠️ 서버에 이미 데이터가 있어요. 업로드 또는 가져오기를 직접 선택해 주세요.');return;}
  const payload=snapshot();let result;
  if(current){result=await client().from('gm_account_data').update({payload,revision:current.revision+1,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('revision',current.revision).select('revision').maybeSingle();}
  else{result=await client().from('gm_account_data').insert({user_id:user.id,payload,revision:1}).select('revision').maybeSingle();}
  if(result.error)throw Error(result.error.message);
  if(!result.data){enabled=false;localStorage.removeItem(flag());status('⚠️ 다른 기기와 저장 충돌이 발생했어요. 자동 저장을 중지했어요.');return;}
  revision=result.data.revision;status('☁️ 자동 저장 완료 · '+new Date().toLocaleTimeString('ko-KR'));
 }catch(e){status('저장 실패: '+e.message);}finally{working=false;}}
 function schedule(){if(!enabled||!user||working)return;clearTimeout(timer);timer=setTimeout(()=>upload(),1800);}
 const original=Storage.prototype.setItem;
 Storage.prototype.setItem=function(k,v){const result=original.call(this,k,v);if(this===localStorage&&(keys.includes(k)||k.startsWith(prefix)))schedule();return result;};
 async function auth(next){clearTimeout(timer);user=next;revision=null;enabled=false;if(!user)return;status('클라우드 확인 중...');try{const data=await read();if(data){status('☁️ 저장된 데이터가 있어요 ('+new Date(data.updated_at).toLocaleString('ko-KR')+'). 이 기기 데이터와 비교해 선택해 주세요.');}else{status('아직 클라우드 백업이 없어요. 「이 기기 데이터로 시작」을 눌러 주세요.');}
 // 새로 로그인한 기기에서 로컬 데이터를 임의로 업로드하거나 다운로드하지 않습니다.
 }catch(e){status('클라우드 설정 확인 필요: '+e.message+' (ACCOUNT_SYNC_SETUP.sql 실행)');}}
 $('gmSyncUpload').addEventListener('click',async()=>{if(!user)return;if(!confirm('이 기기의 근무표·메모·연차·별칭을 클라우드에 저장할까요? 기존 클라우드 데이터가 있다면 교체됩니다.'))return;await upload(true);if(revision!==null){enabled=true;localStorage.setItem(flag(),'1');status('☁️ 이 기기에서 자동 저장을 시작했어요.');}});
 $('gmSyncDownload').addEventListener('click',async()=>{if(!user)return;try{const data=await read();if(!data){status('클라우드에 저장된 데이터가 없어요.');return;}if(!confirm('클라우드 근무표·메모·연차·별칭으로 이 기기의 해당 데이터를 교체할까요? 이 기기의 기존 데이터는 복원하기 어려울 수 있어요.'))return;working=true;apply(data.payload);revision=data.revision;enabled=true;localStorage.setItem(flag(),'1');status('☁️ 가져오기 완료. 화면을 새로고침합니다.');location.reload();}catch(e){status('불러오기 실패: '+e.message);}finally{working=false;}});
 $('gmSyncStop').addEventListener('click',()=>{enabled=false;clearTimeout(timer);if(user)localStorage.removeItem(flag());status('이 기기의 자동 저장을 껐어요.');});
 document.addEventListener('geunmeong:auth-changed',e=>auth(e.detail?.user||null));
 document.addEventListener('DOMContentLoaded',()=>{if(client())client().auth.getUser().then(({data})=>{if(data?.user&&(!user||user.id!==data.user.id))auth(data.user);}).catch(()=>{});});
 // 브라우저가 아닌 다른 탭에서 저장한 내용은 새로고침 후 사용자 선택으로 불러옵니다.
})();
