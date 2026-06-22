module.exports = async function handler(req, res) {
  const MODEL = "gemini-2.5-flash";

  const SYSTEM_PROMPT = `당신은 사주(四柱)와 오행 이론, 십이지(띠)에 능통한 로또 번호 상담 챗봇입니다.
사용자의 성별, 생년월일, 띠(쥐·소·호랑이·토끼·용·뱀·말·양·원숭이·닭·개·돼지)를 바탕으로 사주와 띠를 함께 해석하고, 로또 6/45 규칙에 맞는 번호 6개와 보너스 1개를 추천합니다.

규칙:
- 추천 번호는 1~45 사이 정수, 중복 없음
- main 6개는 오름차순, bonus는 main과 겹치지 않음
- 사주(일간, 오행, 십성, 용신·희신)와 띠(십이지, 오행 상성, 해당 띠의 길흉)를 모두 근거로 설명
- numberReasons에 6개 번호 + 보너스 번호 각각의 reason 포함 (사주·띠 중 하나 이상 언급)
- ttiOverview: 선택한 띠의 성향과 이번 추천과의 연결
- summary는 한 줄 요약
- entertainmentNotice: "본 추천은 재미·참고용이며 실제 당첨을 보장하지 않습니다." 포함

반드시 아래 JSON 형식만 출력하세요:
{
  "sajuOverview": "사주 개요",
  "ttiOverview": "띠 해석",
  "numbers": [6개 오름차순],
  "bonus": 보너스번호,
  "numberReasons": [{ "number": 1, "reason": "근거" }],
  "summary": "한 줄 요약",
  "entertainmentNotice": "면책 문구"
}`;

  const TTI_IDS = [
    "rat", "ox", "tiger", "rabbit", "dragon", "snake",
    "horse", "goat", "monkey", "rooster", "dog", "pig",
  ];

  const TTI_LABELS = {
    rat: "쥐띠",
    ox: "소띠",
    tiger: "호랑이띠",
    rabbit: "토끼띠",
    dragon: "용띠",
    snake: "뱀띠",
    horse: "말띠",
    goat: "양띠",
    monkey: "원숭이띠",
    rooster: "닭띠",
    dog: "개띠",
    pig: "돼지띠",
  };

  function validateInput(body) {
    const { gender, birthDate, tti } = body || {};
    if (!gender || !["male", "female"].includes(gender)) {
      return "성별을 선택해 주세요.";
    }
    if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return "생년월일은 YYYY-MM-DD 형식이어야 합니다.";
    }
    if (!tti || !TTI_IDS.includes(tti)) {
      return "띠를 선택해 주세요.";
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

  function parseBody(req) {
    if (!req.body) return {};
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }

  function fixNumbers(parsed) {
    parsed.numbers = [...new Set((parsed.numbers || []).map(Number))]
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 45)
      .sort((a, b) => a - b);
    while (parsed.numbers.length < 6) {
      const candidate = Math.floor(Math.random() * 45) + 1;
      if (!parsed.numbers.includes(candidate)) parsed.numbers.push(candidate);
    }
    parsed.numbers.sort((a, b) => a - b);
    let bonus = Number(parsed.bonus);
    while (!Number.isInteger(bonus) || parsed.numbers.includes(bonus) || bonus < 1 || bonus > 45) {
      bonus = Math.floor(Math.random() * 45) + 1;
    }
    parsed.bonus = bonus;
    return parsed;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "사주 추천 API가 실행 중입니다.",
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      model: MODEL,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 지원합니다." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY가 설정되지 않았습니다. Vercel → Settings → Environment Variables에서 추가 후 Redeploy 해 주세요.",
    });
  }

  const body = parseBody(req);
  const validationError = validateInput(body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { gender, birthDate, tti } = body;
  const genderLabel = gender === "male" ? "남성" : "여성";
  const ttiLabel = TTI_LABELS[tti] || tti;

  const userPrompt = `성별: ${genderLabel}
생년월일: ${birthDate}
띠: ${ttiLabel} (${tti})

위 정보를 바탕으로 사주와 띠를 함께 고려해 로또 6/45 번호(6개+보너스 1개)를 추천하고, 근거를 설명해 주세요.`;

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
      let detail = "Gemini API 호출에 실패했습니다.";
      try {
        const errJson = JSON.parse(errText);
        detail = errJson?.error?.message || detail;
      } catch {
        /* ignore */
      }
      return res.status(502).json({ error: detail });
    }

    const geminiData = await geminiRes.json();
    const text =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!text) {
      const blockReason = geminiData?.candidates?.[0]?.finishReason || "UNKNOWN";
      return res.status(502).json({
        error: `Gemini 응답이 비어 있습니다. (${blockReason})`,
      });
    }

    let parsed;
    try {
      parsed = parseGeminiJson(text);
    } catch {
      return res.status(502).json({ error: "Gemini 응답 JSON 파싱에 실패했습니다." });
    }

    if (!validateNumbers(parsed)) {
      parsed = fixNumbers(parsed);
    }

    return res.status(200).json({
      sajuOverview: parsed.sajuOverview || "",
      ttiOverview: parsed.ttiOverview || "",
      ttiLabel,
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
    return res.status(500).json({
      error: "번호 추천 처리 중 오류가 발생했습니다.",
      detail: err.message,
    });
  }
};
