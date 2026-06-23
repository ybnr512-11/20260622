function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;
  if (!url || !key) return null;
  return {
    url: url.replace(/\/$/, ""),
    key,
    keyType: serviceKey ? "service_role" : "anon",
  };
}

function parseSupabaseError(status, errText) {
  try {
    const json = JSON.parse(errText);
    return json.message || json.error || json.hint || errText;
  } catch {
    return errText || `HTTP ${status}`;
  }
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
        "Supabase 환경 변수가 없습니다. Vercel에 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY(권장)를 추가하고 Redeploy 하세요.",
      hint: "service_role 키는 Project Settings → API → service_role secret 입니다.",
    });
  }

  const { url, key, keyType } = config;
  const tableUrl = `${url}/rest/v1/lotto_draws`;

  if (req.method === "GET" && req.query?.health === "1") {
    return res.status(200).json({
      ok: true,
      keyType,
      message:
        keyType === "service_role"
          ? "service_role 키 사용 중 (권장)"
          : "anon 키 사용 중 — schema.sql RLS 정책이 필요합니다",
    });
  }

  if (req.method === "GET") {
    try {
      const resFetch = await fetch(
        `${tableUrl}?select=id,created_at,numbers,bonus,include_bonus,source,tti&order=created_at.desc&limit=100`,
        { headers: supabaseHeaders(key) }
      );
      if (!resFetch.ok) {
        const err = await resFetch.text();
        console.error("Supabase GET error:", resFetch.status, err);
        const detail = parseSupabaseError(resFetch.status, err);
        return res.status(502).json({
          error: "기록 불러오기에 실패했습니다.",
          detail,
          hint:
            resFetch.status === 404
              ? "lotto_draws 테이블이 없습니다. Supabase SQL Editor에서 supabase/schema.sql을 실행하세요."
              : keyType === "anon"
                ? "anon 키 사용 시 RLS 정책이 필요합니다. service_role 키 사용을 권장합니다."
                : undefined,
        });
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
        const detail = parseSupabaseError(resFetch.status, err);
        return res.status(502).json({
          error: "기록 저장에 실패했습니다.",
          detail,
          hint:
            resFetch.status === 404
              ? "lotto_draws 테이블이 없습니다. Supabase SQL Editor에서 supabase/schema.sql을 실행하세요."
              : keyType === "anon" && resFetch.status === 401
                ? "anon 키 권한 부족. SUPABASE_SERVICE_ROLE_KEY로 교체하세요."
                : undefined,
        });
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
