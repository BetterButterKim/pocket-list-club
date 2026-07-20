# 100 Pocket List Club — 슬랙 연동 웹앱

포켓 메이트들이 **웹앱** 또는 **슬랙 `/시도` 명령**으로 인증을 남기면,
사진에 넘버·제목·날짜·로고가 자동 합성돼 모두가 함께 보는 갤러리에 쌓여요.

이 문서를 **위에서 아래로 순서대로** 따라 하면 완성됩니다.
처음이어도 괜찮아요. 막히면 어느 단계인지 알려주세요.

---

## 준비물 (모두 무료)

- GitHub 계정 — https://github.com
- Supabase 계정 — https://supabase.com (데이터베이스 + 사진 저장)
- Vercel 계정 — https://vercel.com (웹앱 호스팅 + 슬랙 서버)
- Slack 워크스페이스 관리 권한

컴퓨터에 **Node.js**가 필요해요. https://nodejs.org 에서 LTS 버전 설치.

---

## 큰 그림

```
   [슬랙 /시도]                    [웹앱에서 인증]
        │                               │
        ▼                               ▼
   Vercel 서버함수 ───────► Supabase (DB + 사진) ◄─── 웹앱이 읽어서 갤러리 표시
```

---

## 1단계 · Supabase 프로젝트 만들기

1. https://supabase.com → **New project** 생성 (이름/비밀번호 자유, 지역은 Seoul 추천)
2. 왼쪽 메뉴 **SQL Editor** → **New query**
3. 이 저장소의 `supabase/schema.sql` 내용을 통째로 붙여넣고 **Run**
   → members / pockets / records 테이블과 사진 버킷이 만들어져요.
4. 왼쪽 **Project Settings**(톱니) → **API** 메뉴에서 아래 3개를 메모:
   - `Project URL`
   - `anon public` 키
   - `service_role` 키 ← **비밀! 절대 공유 금지**

---

## 2단계 · 코드 내려받아 GitHub에 올리기

이 폴더(`pocket-list-club`)를 통째로 자기 컴퓨터에 두고, 터미널에서:

```bash
cd pocket-list-club
npm install
```

폰트 넣기: `public/fonts/README.md`를 보고 폰트 3개를 내려받아 그 폴더에 넣어요.
(안 넣어도 작동하지만, 슬랙 인증 사진 글씨가 예쁜 폰트로 안 나와요.)

GitHub에 올리기:

```bash
git init
git add .
git commit -m "포켓리스트 클럽"
```

그다음 github.com에서 빈 저장소 하나 만들고, 안내에 나오는 주소로:

```bash
git remote add origin https://github.com/내계정/pocket-list-club.git
git branch -M main
git push -u origin main
```

---

## 3단계 · Vercel에 배포하기

1. https://vercel.com → **Add New → Project** → 방금 만든 GitHub 저장소 선택
2. **Environment Variables**에 아래를 하나씩 추가 (`.env.local.example` 참고):

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public 키 |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 |
   | `SLACK_SIGNING_SECRET` | (4단계에서 채움 — 일단 비워두고 나중에 추가) |
   | `SLACK_BOT_TOKEN` | (4단계에서 채움) |

3. **Deploy** → 1~2분 뒤 `https://내프로젝트.vercel.app` 링크 완성 🎉
   이 링크가 여러분의 웹앱이에요. 열어서 멤버 추가·인증이 되는지 먼저 확인!

> 슬랙 없이도 웹앱만으로 완전히 동작해요. 슬랙 연동이 필요 없으면 여기서 끝!

---

## 4단계 · 슬랙 앱 만들기

1. https://api.slack.com/apps → **Create New App → From scratch**
   (이름: Pocket List Club, 워크스페이스 선택)

2. 왼쪽 **OAuth & Permissions** → **Scopes → Bot Token Scopes**에 추가:
   - `commands` (슬래시 명령)
   - `chat:write` (봇이 메시지 전송)
   - `files:read` (첨부 사진 읽기)
   - `channels:history` (채널 최근 메시지 읽기)
   그리고 위쪽 **Install to Workspace** 클릭 → 설치.
   설치 후 나오는 **Bot User OAuth Token**(`xoxb-...`)을 메모.

3. 왼쪽 **Basic Information** → **Signing Secret**을 메모.

4. 이 두 값을 **Vercel** 프로젝트의 Environment Variables에 채워 넣고 **Redeploy**:
   - `SLACK_BOT_TOKEN` = `xoxb-...`
   - `SLACK_SIGNING_SECRET` = 아까 그 값

5. 왼쪽 **Slash Commands** → **Create New Command**:
   - Command: `/시도`
   - Request URL: `https://내프로젝트.vercel.app/api/slack`
   - Description: `포켓리스트 인증 남기기`
   - Usage hint: `[넘버] [메모]`
   저장!

6. (봇을 인증 채널에 초대) 슬랙 채널에서 `/invite @Pocket List Club`

---

## 사용법

**웹앱:** 링크 접속 → 멤버 추가 → 포켓리스트 제목 입력 → '+ 인증 남기기'.
처음 인증/멤버 추가 시 그 사람이 "나"로 기억돼서, 본인 기록만 삭제 버튼이 보여요.

**슬랙:** 인증 채널에 **사진을 먼저 올린 뒤**, 같은 채널에서
```
/시도 3 오늘 아침 6시 러닝 완료!
```
→ 3번 포켓 제목·오늘 날짜·시간이 사진에 자동 합성돼 웹앱에 등록되고,
   채널에 완료 메시지가 올라와요. (웹앱은 30초마다 자동 새로고침)

**포켓리스트 제목 연동:** 웹앱에서 멤버 칩 클릭 → 넘버 선택 → 제목 입력.
슬랙에서 인증할 때 이 제목이 사진에 찍혀요. (슬랙 사용자와 웹 멤버는
이름이 같으면 자동으로 연결되고, 없으면 슬랙 표시이름으로 새로 만들어져요.)

---

## 자주 나는 문제

- **슬랙에서 "사진을 못 찾았어요"** → 명령 전에 같은 채널에 사진을 먼저 올렸는지 확인.
  봇이 채널에 초대돼 있어야 해요(`/invite`). `channels:history`, `files:read` 권한 확인.
- **슬랙 명령이 "dispatch_failed"** → Request URL이 정확한지, Vercel 재배포했는지 확인.
- **사진 글씨가 기본 폰트** → `public/fonts`에 폰트 3개 넣고 다시 배포.
- **웹앱은 되는데 저장이 안 됨** → Vercel 환경변수(특히 service_role 키) 다시 확인.

막히는 지점의 스크린샷이나 에러 메시지를 주면 같이 풀어봐요!
