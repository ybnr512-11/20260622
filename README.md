# 로또 추첨기 (Lotto Picker)

한국 로또 6/45 규칙에 맞는 웹 기반 무작위 번호 생성기 + **사주·띠 기반 번호 추천** 챗봇입니다.

## 실행 방법

### 로컬

`index.html` 파일을 브라우저에서 열면 추첨 + 사주 추천을 모두 사용할 수 있습니다. **외부 API 키가 필요 없습니다.**

### Vercel 배포 (추첨 기록 Supabase 저장)

추첨 기록 클라우드 저장만 Vercel + Supabase가 필요합니다.

1. [Vercel](https://vercel.com)에 이 저장소를 Import
2. **Settings → Environment Variables**에 추가:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (권장)
3. Deploy

로컬에서 API 테스트:

```bash
npm i -g vercel
vercel dev
```

## 기능

- **추첨기**: TV 방송 스타일 6/45 추첨 애니메이션
- **사주 챗봇**: 성별·생년월일·띠 입력 → 오행·일간·띠 기반 번호 추천 및 근거 설명 (브라우저에서 즉시 실행, API 키 불필요)
- **추첨 기록**: Supabase 클라우드 저장 + 불러오기
- **추첨기에 적용**: 추천 번호를 당첨번호판에 바로 반영
- HP 디자인 시스템 (`DESIGN.md`) UI

## Supabase 설정 (추첨 기록 저장)

### 어떤 키를 쓸까?

| 키 | Vercel에 넣을까? | 설명 |
|----|----------------|------|
| **service_role** | **권장** | 서버(Vercel API) 전용. RLS 무시 → 설정이 단순하고 저장이 잘 됨 |
| **anon** | 가능 | `schema.sql` RLS 정책 필수. 정책 누락 시 저장 실패 |

**결론: Vercel에는 `SUPABASE_SERVICE_ROLE_KEY`를 넣으세요.**  
(service_role secret은 절대 프론트엔드/브라우저에 노출하지 마세요.)

### 설정 순서

1. [Supabase](https://supabase.com) → 프로젝트 생성
2. **SQL Editor** → `supabase/schema.sql` 전체 실행
3. **Project Settings → API**에서 복사:
   - **Project URL** → Vercel `SUPABASE_URL`
   - **service_role** (secret) → Vercel `SUPABASE_SERVICE_ROLE_KEY`
4. Vercel **Redeploy** (환경 변수 추가 후 반드시 재배포)
5. 확인: `https://your-site.vercel.app/api/lotto-draws?health=1`  
   → `{ "ok": true, "keyType": "service_role" }` 이면 정상

### 자주 하는 실수

- anon 키만 넣고 SQL(RLS 정책) 안 돌림 → 저장 401/403
- 환경 변수 추가 후 **Redeploy 안 함** → API가 옛 설정 사용
- `lotto_draws` 테이블 미생성 → 404 / relation does not exist
- service_role을 `SUPABASE_ANON_KEY` 변수에 넣음 → 변수 **이름**이 정확해야 함

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/lotto-draws` | 저장된 추첨 기록 조회 |
| POST | `/api/lotto-draws` | `{ numbers, bonus, include_bonus, source, tti }` 저장 |
| DELETE | `/api/lotto-draws` | 전체 기록 삭제 |
| POST | `/api/saju-recommend` | `{ gender, birthDate, tti }` 사주 번호 추천 (로컬 오행 엔진, API 키 불필요) |

## 저장소

https://github.com/ybnr512-11/20260622
