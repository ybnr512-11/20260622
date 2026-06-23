const { validateInput, recommendSaju } = require("../saju-engine.js");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "사주 추천 API (로컬 오행 엔진, API 키 불필요)",
      engine: "saju-engine",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 지원합니다." });
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const validationError = validateInput(body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const result = recommendSaju(body);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || "번호 추천 처리 중 오류가 발생했습니다." });
  }
};
