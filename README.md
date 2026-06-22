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
- **추첨기에 적용**: AI 추천 번호를 당첨번호판에 바로 반영
- HP 디자인 시스템 (`DESIGN.md`) UI

## API

| Method | Path | Body |
|--------|------|------|
| POST | `/api/saju-recommend` | `{ "gender": "male"\|"female", "birthDate": "YYYY-MM-DD", "tti": "dragon" }` |

## 저장소

https://github.com/ybnr512-11/20260622
