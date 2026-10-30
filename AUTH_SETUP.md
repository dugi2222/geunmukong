# 근무멍 Supabase 이메일 인증

- 로그인 없이 달력 사용 가능. 기존 localStorage 일정은 자동으로 서버에 업로드되지 않습니다.
- Supabase Authentication > URL Configuration: Site URL 및 Redirect URL에 `https://dugi2222.github.io/geunmukong/` 등록.
- Email Provider 활성화, Confirm email 활성화.
- GitHub Pages의 기존 저장소 파일을 이 ZIP의 내용으로 교체하여 배포.
- 계정 기능은 로그인/회원가입/로그아웃/재설정이며, 친구 요청·수락은 `ONLINE_FRIENDS_SETUP.sql`을 실행한 뒤 온라인으로 작동합니다. 기존 기기 내 친구·채팅·게시판은 로컬 데모입니다.
- 온라인 친구 테이블은 RLS 및 서버 함수 권한을 `ONLINE_FRIENDS_SETUP.sql`에서 설정합니다.
- 비밀번호 재설정 링크에서는 브라우저 기본 입력 창으로 새 비밀번호를 입력합니다.
- CDN 접속이 불가능하면 로그인 기능을 사용할 수 없지만 기존 달력은 그대로 작동합니다.
