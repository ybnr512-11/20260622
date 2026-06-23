(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SajuEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const TTI_IDS = [
    "rat", "ox", "tiger", "rabbit", "dragon", "snake",
    "horse", "goat", "monkey", "rooster", "dog", "pig",
  ];

  const TTI_LABELS = {
    rat: "쥐띠", ox: "소띠", tiger: "호랑이띠", rabbit: "토끼띠",
    dragon: "용띠", snake: "뱀띠", horse: "말띠", goat: "양띠",
    monkey: "원숭이띠", rooster: "닭띠", dog: "개띠", pig: "돼지띠",
  };

  const TTI_META = {
    rat:     { emoji: "🐭", element: "水", hanja: "子", trait: "재치와 순발력" },
    ox:      { emoji: "🐮", element: "土", hanja: "丑", trait: "성실과 인내" },
    tiger:   { emoji: "🐯", element: "木", hanja: "寅", trait: "용맹과 추진력" },
    rabbit:  { emoji: "🐰", element: "木", hanja: "卯", trait: "온화와 섬세함" },
    dragon:  { emoji: "🐲", element: "土", hanja: "辰", trait: "기상과 리더십" },
    snake:   { emoji: "🐍", element: "火", hanja: "巳", trait: "지혜와 직관" },
    horse:   { emoji: "🐴", element: "火", hanja: "午", trait: "활력과 자유" },
    goat:    { emoji: "🐑", element: "土", hanja: "未", trait: "온순과 예술성" },
    monkey:  { emoji: "🐵", element: "金", hanja: "申", trait: "영리함과 변화" },
    rooster: { emoji: "🐔", element: "金", hanja: "酉", trait: "꼼꼼함과 명예" },
    dog:     { emoji: "🐶", element: "土", hanja: "戌", trait: "충성과 정의" },
    pig:     { emoji: "🐷", element: "水", hanja: "亥", trait: "관대함과 풍요" },
  };

  const STEMS = [
    { name: "갑", element: "木", yin: false },
    { name: "을", element: "木", yin: true },
    { name: "병", element: "火", yin: false },
    { name: "정", element: "火", yin: true },
    { name: "무", element: "土", yin: false },
    { name: "기", element: "土", yin: true },
    { name: "경", element: "金", yin: false },
    { name: "신", element: "金", yin: true },
    { name: "임", element: "水", yin: false },
    { name: "계", element: "水", yin: true },
  ];

  const ELEMENT_MOD = { 水: 0, 木: 1, 火: 2, 土: 3, 金: 4 };
  const GENERATING = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
  const REASON_TEMPLATES = {
    tti: [
      "{label}의 {element}行 기운이 {num}번과 숫자 합 {sum}에서 상생합니다.",
      "{hanja}띠 {trait}이 {num}번의 흐름과 맞물립니다.",
      "띠 오행 {element}과 {num}번(합 {sum})의 기운이 조화를 이룹니다.",
    ],
    day: [
      "일간 {stem}({stemElement}行)과 {num}번의 상성이 길합니다.",
      "생일 기운 {stemElement}行이 {num}번에서 희신(喜神)으로 작용합니다.",
      "일간 {stem}의 {yinYang} 기운이 {num}번과 맞습니다.",
    ],
    gender: [
      "{genderLabel}의 {element}行 보완 번호로 {num}번을 택했습니다.",
      "{genderLabel}에게 {element}行 {num}번이 균형을 돕습니다.",
    ],
    bonus: [
      "본번호 {element}行을 보완하는 보너스 {num}번입니다.",
      "메인 번호와 상생하는 {element}行 보너스 {num}번입니다.",
    ],
  };

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function createRng(seed) {
    let s = seed >>> 0;
    return function next() {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function numbersForElement(element) {
    const mod = ELEMENT_MOD[element];
    if (mod == null) return [];
    return Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => n % 5 === mod);
  }

  function getDayStem(birthDate) {
    const [y, m, d] = birthDate.split("-").map(Number);
    const idx = ((y * 5 + m * 7 + d * 11) % 10 + 10) % 10;
    return STEMS[idx];
  }

  function getYearStem(birthDate) {
    const year = parseInt(birthDate.slice(0, 4), 10);
    const idx = ((year - 4) % 10 + 10) % 10;
    return STEMS[idx];
  }

  function shuffle(arr, rng) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function pickFromPool(pool, count, used, rng) {
    const picked = [];
    for (const n of shuffle(pool, rng)) {
      if (used.has(n)) continue;
      picked.push(n);
      used.add(n);
      if (picked.length >= count) break;
    }
    return picked;
  }

  function fillRandom(count, used, rng) {
    const picked = [];
    while (picked.length < count) {
      const n = Math.floor(rng() * 45) + 1;
      if (used.has(n)) continue;
      used.add(n);
      picked.push(n);
    }
    return picked;
  }

  function pickTemplate(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  function buildReason(type, ctx) {
    const tpl = pickTemplate(REASON_TEMPLATES[type], ctx.rng);
    return tpl
      .replace(/\{label\}/g, ctx.label)
      .replace(/\{element\}/g, ctx.element)
      .replace(/\{num\}/g, String(ctx.num))
      .replace(/\{sum\}/g, String(ctx.sum))
      .replace(/\{hanja\}/g, ctx.hanja)
      .replace(/\{trait\}/g, ctx.trait)
      .replace(/\{stem\}/g, ctx.stem)
      .replace(/\{stemElement\}/g, ctx.stemElement)
      .replace(/\{yinYang\}/g, ctx.yinYang)
      .replace(/\{genderLabel\}/g, ctx.genderLabel);
  }

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

  function recommendSaju({ gender, birthDate, tti }) {
    const validationError = validateInput({ gender, birthDate, tti });
    if (validationError) {
      throw new Error(validationError);
    }

    const rng = createRng(hashSeed(`${gender}|${birthDate}|${tti}`));
    const genderLabel = gender === "male" ? "남성" : "여성";
    const genderYinYang = gender === "male" ? "양(陽)" : "음(陰)";
    const ttiInfo = TTI_META[tti];
    const ttiLabel = TTI_LABELS[tti];
    const dayStem = getDayStem(birthDate);
    const yearStem = getYearStem(birthDate);
    const used = new Set();
    const numberReasons = [];
    const reasonCtx = {
      rng,
      label: ttiLabel,
      hanja: ttiInfo.hanja,
      trait: ttiInfo.trait,
      genderLabel,
      stem: dayStem.name,
      stemElement: dayStem.element,
      yinYang: dayStem.yin ? "음(陰)" : "양(陽)",
    };

    const mainNumbers = [];

    pickFromPool(numbersForElement(ttiInfo.element), 3, used, rng).forEach((num) => {
      mainNumbers.push(num);
      numberReasons.push({
        number: num,
        reason: buildReason("tti", {
          ...reasonCtx,
          num,
          sum: num % 10 || 10,
          element: ttiInfo.element,
        }),
      });
    });

    pickFromPool(numbersForElement(dayStem.element), 2, used, rng).forEach((num) => {
      mainNumbers.push(num);
      numberReasons.push({
        number: num,
        reason: buildReason("day", { ...reasonCtx, num, element: dayStem.element }),
      });
    });

    const genderPoolElement =
      gender === "male" ? GENERATING[dayStem.element] : dayStem.element;
    pickFromPool(numbersForElement(genderPoolElement), 1, used, rng).forEach((num) => {
      mainNumbers.push(num);
      numberReasons.push({
        number: num,
        reason: buildReason("gender", {
          ...reasonCtx,
          num,
          element: genderPoolElement,
        }),
      });
    });

    while (mainNumbers.length < 6) {
      const [num] = fillRandom(1, used, rng);
      mainNumbers.push(num);
      numberReasons.push({
        number: num,
        reason: buildReason("tti", {
          ...reasonCtx,
          num,
          sum: num % 10 || 10,
          element: ttiInfo.element,
        }),
      });
    }

    mainNumbers.sort((a, b) => a - b);
    const mainSet = new Set(mainNumbers);

    const bonusElement = GENERATING[ttiInfo.element];
    let bonus = shuffle(numbersForElement(bonusElement), rng).find((n) => !mainSet.has(n));
    if (bonus == null) {
      bonus = shuffle(
        Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => !mainSet.has(n)),
        rng
      )[0];
    }

    numberReasons.push({
      number: bonus,
      reason: buildReason("bonus", {
        ...reasonCtx,
        num: bonus,
        element: bonusElement,
      }),
    });

    const sajuOverview =
      `${birthDate}생 ${genderLabel}의 일간은 ${dayStem.name}(${dayStem.element}行, ${dayStem.yin ? "음" : "양"})이며, ` +
      `년간 ${yearStem.name}(${yearStem.element}行)과 ${ttiLabel}(${ttiInfo.hanja}·${ttiInfo.element}行)의 기운을 함께 보았습니다. ` +
      `오행 상생(相生)과 ${genderYinYang} 조화를 기준으로 번호를 구성했습니다.`;

    const ttiOverview =
      `${ttiInfo.emoji} ${ttiLabel}(${ttiInfo.hanja})는 ${ttiInfo.element}行으로 ${ttiInfo.trait}의 성향을 지닙니다. ` +
      `이번 추천은 ${ttiInfo.element}行 번호를 중심으로 일간 ${dayStem.name}의 희신을 보완하는 방향입니다.`;

    const summary =
      `${ttiLabel} ${ttiInfo.element}行 × 일간 ${dayStem.name} 조합으로 행운 번호 ${mainNumbers.join(", ")} + 보너스 ${bonus}를 추천합니다.`;

    return {
      sajuOverview,
      ttiOverview,
      ttiLabel,
      tti,
      numbers: mainNumbers,
      bonus,
      numberReasons: numberReasons.filter((r) => mainNumbers.includes(r.number) || r.number === bonus),
      summary,
      entertainmentNotice: "본 추천은 재미·참고용이며 실제 당첨을 보장하지 않습니다.",
    };
  }

  return {
    TTI_IDS,
    TTI_LABELS,
    TTI_META,
    validateInput,
    recommendSaju,
  };
});
