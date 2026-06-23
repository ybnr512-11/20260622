# 로또 추첨기 (Lotto Picker)

한국 로또 6/45 규칙에 맞는 웹 기반 무작위 번호 생성기 + **사주 기반 AI 번호 추천** 챗봇입니다.

## 실행 방법

### 로컬 (추첨기만)

`index.html` 파일을 브라우저에서 열면 추첨 기능을 사용할 수 있습니다.

### Vercel 배포 (사주 챗봇 포함)

사주 챗봇은 Gemini API를 서버에서 호출하므로 **Vercel 배포가 필요**합니다.

1. [Vercel](https://vercel.com)에 이 저장소를 Import
2. **Settings → Environment Variables**에 추가:
   - `GEMINI_API_KEY` = Google AI Studio에서 발급한 API 키
3. Deploy

로컬에서 API 테스트:

```bash
npm i -g vercel
vercel dev
```

## 기능

- **추첨기**: TV 방송 스타일 6/45 추첨 애니메이션
- **사주 챗봇**: 성별·생년월일·띠 입력 → Gemini 2.5 Flash가 사주·띠 기반 번호 추천 및 근거 설명
- **추첨 기록**: Supabase 클라우드 저장 + 불러오기
- HP 디자인 시스템 (`DESIGN.md`) UI

## Supabase 설정 (추첨 기록 저장)

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. **SQL Editor**에서 `supabase/schema.sql` 내용 실행 → `lotto_draws` 테이블 생성
3. **Project Settings → API**에서 URL과 **service_role** 키 복사
4. Vercel 환경 변수 추가:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (권장) 또는 `SUPABASE_ANON_KEY`
5. Redeploy

추첨·사주 추천 번호가 Supabase `lotto_draws` 테이블에 자동 저장되며, 페이지 로드 시 불러옵니다.

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/lotto-draws` | 저장된 추첨 기록 조회 |
| POST | `/api/lotto-draws` | `{ numbers, bonus, include_bonus, source, tti }` 저장 |
| DELETE | `/api/lotto-draws` | 전체 기록 삭제 |
| POST | `/api/saju-recommend` | `{ gender, birthDate, tti }` 사주 번호 추천 |

## 저장소

https://github.com/ybnr512-11/20260622
