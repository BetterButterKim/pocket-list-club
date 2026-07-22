-- ============================================================
--  포켓리스트 클럽 · Supabase 스키마
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run] 하세요.
-- ============================================================

-- 1) 멤버 -----------------------------------------------------
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slack_user_id text unique,        -- 슬랙 사용자 ID (자동 연동용, 없어도 됨)
  created_at  timestamptz default now()
);

-- 2) 포켓리스트 항목 (멤버별 1~10) -----------------------------
create table if not exists pockets (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  num         int  not null check (num between 1 and 10),
  title       text default '',
  description text default '',
  updated_at  timestamptz default now(),
  unique (member_id, num)
);

-- 3) 인증 기록 -----------------------------------------------
create table if not exists records (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  num         int  not null check (num between 1 and 10),
  memo        text default '',
  image_url   text not null,        -- Storage 공개 URL
  date        date not null,
  time        text,                 -- 'HH:MM' 문자열 (선택)
  source      text default 'web',   -- 'web' | 'slack'
  type        text default 'done',  -- 'try'(시도) | 'done'(달성)
  created_at  timestamptz default now()
);

-- 기존 테이블에 type 컬럼 추가 (마이그레이션)
alter table records add column if not exists type text default 'done';

create index if not exists idx_records_member on records(member_id);
create index if not exists idx_records_created on records(created_at desc);

-- 4) 읽기는 누구나 (익명 키로 조회) ---------------------------
--    쓰기/삭제는 서버(Service Role 키)에서만 하므로 RLS로 클라이언트 쓰기를 막습니다.
alter table members enable row level security;
alter table pockets enable row level security;
alter table records enable row level security;

create policy "read members"  on members for select using (true);
create policy "read pockets"  on pockets for select using (true);
create policy "read records"  on records for select using (true);
--  (insert/update/delete 정책을 만들지 않으므로 익명 클라이언트는 쓰기 불가.
--   서버 라우트는 Service Role 키를 써서 RLS를 우회합니다.)

-- 5) 사진 저장용 Storage 버킷 --------------------------------
--    아래 줄이 에러 나면, 대시보드 Storage에서 'pocket-photos' 버킷을
--    Public 으로 직접 만들어도 됩니다.
insert into storage.buckets (id, name, public)
values ('pocket-photos', 'pocket-photos', true)
on conflict (id) do nothing;

create policy "public read photos"
  on storage.objects for select
  using (bucket_id = 'pocket-photos');
