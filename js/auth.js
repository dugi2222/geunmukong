/* 근무멍 이메일 계정 인증. 로컬 달력 저장 데이터에는 접근하지 않습니다. */
(() => {
  'use strict';
  const URL = 'https://bppvbfkytehsfhoiskyj.supabase.co';
  const KEY = 'sb_publishable_EpuZRxiPNzYCcOZkiU5l8w_rhA3U7Xl';
  const $ = id => document.getElementById(id);
  const overlay = $('gmAuthOverlay');
  const status = $('gmAuthStatus');
  const openBtn = $('accountOpenBtn');
  let client = null;
  let mode = 'login';
  const message = (text, error=false) => { status.textContent = text; status.classList.toggle('error', error); };
  const setMode = next => {
    mode = next;
    $('gmTabLogin').classList.toggle('selected', mode === 'login');
    $('gmTabSignup').classList.toggle('selected', mode === 'signup');
    $('gmAuthSubmit').textContent = mode === 'login' ? '로그인' : '이메일로 회원가입';
    $('gmAuthPassword').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('gmNicknameRow').hidden = mode !== 'signup';
    $('gmAuthNickname').required = mode === 'signup';
    $('gmResetPassword').hidden = mode === 'signup';
    message('');
  };
  const showUser = user => {
    const logged = !!user;
    $('gmAuthSignedIn').hidden = !logged;
    $('gmAuthSignedOut').hidden = logged;
    $('gmAuthCurrentEmail').textContent = user?.email || '';
    $('gmAuthCurrentNickname').textContent = user?.user_metadata?.nickname || '내 계정';
    openBtn.textContent = logged ? '🐶 ' + (user?.user_metadata?.nickname || '내 계정') : '👤 로그인 / 회원가입';
  };
  openBtn.addEventListener('click', () => {
    const menu = $('shiftSettings');
    if (menu) menu.hidden = true;
    overlay.hidden = false;
    message('');
  });
  $('gmAuthClose').addEventListener('click', () => overlay.hidden = true);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.hidden = true; });
  $('gmTabLogin').addEventListener('click', () => setMode('login'));
  $('gmTabSignup').addEventListener('click', () => setMode('signup'));
  if (!window.supabase?.createClient) {
    openBtn.addEventListener('click', () => message('인증 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.', true));
    return;
  }
  client = window.supabase.createClient(URL, KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  window.gmSupabaseClient = client;
  client.auth.onAuthStateChange((_event, session) => { showUser(session?.user || null); document.dispatchEvent(new CustomEvent('geunmeong:auth-changed', {detail:{user:session?.user || null}})); });
  client.auth.getUser().then(({data, error}) => { if (!error) { showUser(data.user); document.dispatchEvent(new CustomEvent('geunmeong:auth-changed', {detail:{user:data.user || null}})); } }).catch(() => {});
  $('gmAuthForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('gmAuthEmail').value.trim();
    const password = $('gmAuthPassword').value;
    const nickname = $('gmAuthNickname').value.trim();
    if (mode === 'signup' && (nickname.length < 2 || nickname.length > 16)) { message('닉네임은 2~16자로 입력해 주세요.', true); return; }
    const submit = $('gmAuthSubmit');
    submit.disabled = true;
    message('처리 중...');
    try {
      const result = mode === 'login'
        ? await client.auth.signInWithPassword({email, password})
        : await client.auth.signUp({email, password, options:{emailRedirectTo:location.origin + location.pathname, data:{nickname}}});
      if (result.error) throw result.error;
      if (mode === 'signup') message('회원가입 요청 완료! 이메일 인증 링크를 확인해 주세요.');
      else message('로그인했어요!');
    } catch (err) { message(err.message || '요청에 실패했어요.', true); }
    finally { submit.disabled = false; }
  });
  $('gmResetPassword').addEventListener('click', async () => {
    const email = $('gmAuthEmail').value.trim();
    if (!email) { message('먼저 이메일 주소를 입력해 주세요.', true); return; }
    try {
      const {error} = await client.auth.resetPasswordForEmail(email, {redirectTo:location.origin + location.pathname});
      if (error) throw error;
      message('재설정 메일을 요청했어요. 메일함을 확인해 주세요.');
    } catch(err) { message(err.message || '요청에 실패했어요.', true); }
  });
  $('gmAuthLogout').addEventListener('click', async () => {
    const {error} = await client.auth.signOut();
    message(error ? error.message : '로그아웃했어요.', !!error);
  });
  // 복구 링크를 열었을 때 새 비밀번호를 설정할 수 있도록 안내합니다.
  client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      overlay.hidden = false;
      const newPassword = prompt('새 비밀번호를 입력해 주세요 (6자 이상)');
      if (newPassword && newPassword.length >= 6) {
        client.auth.updateUser({password:newPassword}).then(({error}) => message(error ? error.message : '비밀번호를 변경했어요.', !!error));
      } else message('비밀번호 변경이 취소되었어요.');
    }
  });
})();
