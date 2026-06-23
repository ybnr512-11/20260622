-- Supabase SQL Editor에서 실행하세요.
-- Table: lotto_draws — 추첨/사주 추천 번호 저장

create table if not exists public.lotto_draws (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  numbers integer[] not null,
  bonus integer not null,
  include_bonus boolean not null default true,
  source text not null default 'draw',
  tti text,
  constraint lotto_draws_numbers_len check (array_length(numbers, 1) = 6),
  constraint lotto_draws_bonus_range check (bonus >= 1 and bonus <= 45)
);

create index if not exists lotto_draws_created_at_idx
  on public.lotto_draws (created_at desc);

comment on table public.lotto_draws is '로또 6/45 추첨 및 사주 추천 기록';

-- API(Vercel + service role)만 사용할 경우 RLS는 켜두어도 service role이 bypass합니다.
alter table public.lotto_draws enable row level security;

-- anon 키로 클라이언트 직접 접근 시를 위한 정책 (선택). API만 쓸 경우 생략 가능.
create policy "Allow public read lotto_draws"
  on public.lotto_draws for select
  using (true);

create policy "Allow public insert lotto_draws"
  on public.lotto_draws for insert
  with check (true);

create policy "Allow public delete lotto_draws"
  on public.lotto_draws for delete
  using (true);
