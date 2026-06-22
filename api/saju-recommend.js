const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `당신은 사주(四柱)와 오행 이론에 능통한 로또 번호 상담 챗봇입니다.
사용자의 성별과 생년월일을 바탕으로 사주를 간략히 해석하고, 로또 6/45 규칙에 맞는 번호 6개와 보너스 1개를 추천합니다.

규칙:
- 추천 번호는 1~45 사이 정수, 중복 없음
- main 6개는 오름차순, bonus는 main과 겹치지 않음
- 사주의 일간(日干), 오행(木火土金水), 십성, 용신·희신 개념을 근거로 각 번호 선택 이유를 설명
- explanation은 한국어로 3~5문단, 번호별로 왜 그 숫자인지 구체적으로 서술
- summary는 한 줄 요약
- entertainmentNotice: "본 추천은 재미·참고용이며 실제 당첨을 보장하지 않습니다." 포함

반드시 아래 JSON 형식만 출력하세요:
{
  "sajuOverview": "사주 개요 (년월일 기준 간지·오행 요약)",
  "numbers": [6개 오름차순],
  "bonus": 보너스번호,
  "numberReasons": [
    { "number": 1, "reason": "이 번호를 고른 사주적 근거" }
  ],
  "summary": "한 줄 요약",
  "entertainmentNotice": "면책 문구"
}`;

function validateInput(body) {
  const { gender, birthDate } = body || {};
  if (!gender || !["male", "female"].includes(gender)) {
    return "성별을 male 또는 female로 보내주세요.";
  }
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return "생년월일은 YYYY-MM-DD 형식이어야 합니다.";
  }
  const date = new Date(birthDate + "T00:00:00");
  if (Number.isNaN(date.getTime())) {
    return "유효하지 않은 생년월일입니다.";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) {
    return "미래 날짜는 입력할 수 없습니다.";
  }
  return null;
}

function validateNumbers(data) {
  const { numbers, bonus } = data;
  if (!Array.isArray(numbers) || numbers.length !== 6) return false;
  const set = new Set(numbers);
  if (set.size !== 6) return false;
  for (const n of numbers) {
    if (!Number.isInteger(n) || n < 1 || n > 45) return false;
  }
  if (!Number.isInteger(bonus) || bonus < 1 || bonus > 45 || set.has(bonus)) return false;
  return numbers.every((n, i) => i === 0 || numbers[i - 1] <= n);
}

function parseGeminiJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 지원합니다." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경 변수에 추가해 주세요.",
    });
  }

  const validationError = validateInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { gender, birthDate } = req.body;
  const genderLabel = gender === "male" ? "남성" : "여성";

  const userPrompt = `성별: ${genderLabel}
생년월일: ${birthDate}

위 정보를 바탕으로 사주에 맞는 로또 6/45 번호(6개+보너스 1개)를 추천하고, 사주 근거를 설명해 주세요.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);
      return res.status(502).json({ error: "Gemini API 호출에 실패했습니다." });
    }

    const geminiData = await geminiRes.json();
    const text =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!text) {
      return res.status(502).json({ error: "Gemini 응답이 비어 있습니다." });
    }

    const parsed = parseGeminiJson(text);

    if (!validateNumbers(parsed)) {
      parsed.numbers = [...new Set(parsed.numbers || [])]
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 45)
        .sort((a, b) => a - b)
        .slice(0, 6);
      while (parsed.numbers.length < 6) {
        const candidate = Math.floor(Math.random() * 45) + 1;
        if (!parsed.numbers.includes(candidate)) parsed.numbers.push(candidate);
      }
      parsed.numbers.sort((a, b) => a - b);
      let bonus = parsed.bonus;
      while (!bonus || parsed.numbers.includes(bonus) || bonus < 1 || bonus > 45) {
        bonus = Math.floor(Math.random() * 45) + 1;
      }
      parsed.bonus = bonus;
    }

    return res.status(200).json({
      sajuOverview: parsed.sajuOverview || "",
      numbers: parsed.numbers,
      bonus: parsed.bonus,
      numberReasons: parsed.numberReasons || [],
      summary: parsed.summary || "",
      explanation:
        parsed.explanation ||
        [parsed.sajuOverview, parsed.summary, parsed.entertainmentNotice]
          .filter(Boolean)
          .join("\n\n"),
      entertainmentNotice:
        parsed.entertainmentNotice ||
        "본 추천은 재미·참고용이며 실제 당첨을 보장하지 않습니다.",
    });
  } catch (err) {
    console.error("saju-recommend error:", err);
    return res.status(500).json({ error: "번호 추천 처리 중 오류가 발생했습니다." });
  }
}
