function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function supabaseHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function validateDraw(body) {
  const { numbers, bonus, include_bonus, source, tti } = body || {};
  if (!Array.isArray(numbers) || numbers.length !== 6) {
    return "numbers는 6개 배열이어야 합니다.";
  }
  const set = new Set(numbers);
  if (set.size !== 6) return "numbers에 중복이 있습니다.";
  for (const n of numbers) {
    if (!Number.isInteger(n) || n < 1 || n > 45) {
      return "numbers는 1~45 정수여야 합니다.";
    }
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.some((n, i) => i > 0 && sorted[i - 1] > n)) {
    /* allow unsorted input, we'll sort on save */
  }
  if (bonus != null) {
    if (!Number.isInteger(bonus) || bonus < 1 || bonus > 45) {
      return "bonus는 1~45 정수여야 합니다.";
    }
    if (set.has(bonus)) return "bonus는 numbers와 겹칠 수 없습니다.";
  }
  if (source && !["draw", "saju"].includes(source)) {
    return "source는 draw 또는 saju여야 합니다.";
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const config = getSupabaseConfig();
  if (!config) {
    return res.status(500).json({
      error:
        "Supabase가 설정되지 않았습니다. SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_ANON_KEY)를 Vercel 환경 변수에 추가하세요.",
    });
  }

  const { url, key } = config;
  const tableUrl = `${url}/rest/v1/lotto_draws`;

  if (req.method === "GET") {
    try {
      const resFetch = await fetch(
        `${tableUrl}?select=id,created_at,numbers,bonus,include_bonus,source,tti&order=created_at.desc&limit=100`,
        { headers: supabaseHeaders(key) }
      );
      if (!resFetch.ok) {
        const err = await resFetch.text();
        console.error("Supabase GET error:", resFetch.status, err);
        return res.status(502).json({ error: "기록 불러오기에 실패했습니다." });
      }
      const rows = await resFetch.json();
      return res.status(200).json({ draws: rows });
    } catch (err) {
      console.error("lotto-draws GET:", err);
      return res.status(500).json({ error: "기록 불러오기 중 오류가 발생했습니다." });
    }
  }

  if (req.method === "POST") {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const validationError = validateDraw(body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const numbers = [...body.numbers].sort((a, b) => a - b);
    const payload = {
      numbers,
      bonus: body.bonus,
      include_bonus: body.include_bonus !== false,
      source: body.source || "draw",
      tti: body.tti || null,
    };

    try {
      const resFetch = await fetch(tableUrl, {
        method: "POST",
        headers: supabaseHeaders(key, { Prefer: "return=representation" }),
        body: JSON.stringify(payload),
      });
      if (!resFetch.ok) {
        const err = await resFetch.text();
        console.error("Supabase POST error:", resFetch.status, err);
        return res.status(502).json({ error: "기록 저장에 실패했습니다." });
      }
      const [row] = await resFetch.json();
      return res.status(201).json({ draw: row });
    } catch (err) {
      console.error("lotto-draws POST:", err);
      return res.status(500).json({ error: "기록 저장 중 오류가 발생했습니다." });
    }
  }

  if (req.method === "DELETE") {
    try {
      const resFetch = await fetch(`${tableUrl}?id=not.is.null`, {
        method: "DELETE",
        headers: supabaseHeaders(key),
      });
      if (!resFetch.ok) {
        const err = await resFetch.text();
        console.error("Supabase DELETE error:", resFetch.status, err);
        return res.status(502).json({ error: "기록 삭제에 실패했습니다." });
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("lotto-draws DELETE:", err);
      return res.status(500).json({ error: "기록 삭제 중 오류가 발생했습니다." });
    }
  }

  return res.status(405).json({ error: "GET, POST, DELETE만 지원합니다." });
};
