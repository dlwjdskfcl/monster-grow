/* GameCore.gs — 자동 생성 파일 (직접 고치지 마세요). 원본: shared/*.ts, 생성: npm run build:gas
 * 버전 0.1.0 */
var GameCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // shared/index.ts
  var index_exports = {};
  __export(index_exports, {
    ACTIONS: () => ACTIONS,
    BN: () => bignum_exports,
    BOSSES: () => BOSSES,
    CLIENT_VERSION: () => CLIENT_VERSION,
    CREATURES: () => CREATURES,
    CREATURE_BY_ID: () => CREATURE_BY_ID,
    DEFAULT_CONFIG: () => DEFAULT_CONFIG,
    F: () => formulas_exports,
    GameError: () => GameError,
    REGIONS: () => REGIONS,
    RESEARCH: () => RESEARCH,
    ROLE_DESC: () => ROLE_DESC,
    ROLE_NAME: () => ROLE_NAME,
    SCHEMA_VERSION: () => SCHEMA_VERSION,
    TRAITS: () => TRAITS,
    advanceDepth: () => advanceDepth,
    applyCommand: () => applyCommand,
    clone: () => clone,
    deserialize: () => deserialize,
    hashSeed: () => hashSeed,
    migrate: () => migrate,
    newCreature: () => newCreature,
    newState: () => newState,
    processRequest: () => processRequest,
    rng: () => rng,
    serialize: () => serialize,
    settle: () => settle,
    simulateBoss: () => simulateBoss,
    validateShape: () => validateShape,
    versionLess: () => versionLess
  });

  // shared/bignum.ts
  var bignum_exports = {};
  __export(bignum_exports, {
    ZERO: () => ZERO,
    add: () => add,
    bn: () => bn,
    cmp: () => cmp,
    div: () => div,
    floor: () => floor,
    fmt: () => fmt,
    gt: () => gt,
    gte: () => gte,
    isNeg: () => isNeg,
    isZero: () => isZero,
    log10: () => log10,
    max: () => max,
    min: () => min,
    mul: () => mul,
    mulN: () => mulN,
    neg: () => neg,
    parse: () => parse,
    powN: () => powN,
    str: () => str,
    sub: () => sub,
    toNumber: () => toNumber
  });
  var ZERO = Object.freeze({ m: 0, e: 0 });
  var SIG = 12;
  function round12(x) {
    return Number(x.toPrecision(SIG));
  }
  function norm(m, e) {
    if (!isFinite(m) || !isFinite(e)) throw new Error("BN_NOT_FINITE");
    if (m === 0) return { m: 0, e: 0 };
    const s = Math.floor(Math.log10(Math.abs(m)));
    m = m / Math.pow(10, s);
    e = e + s;
    m = round12(m);
    if (Math.abs(m) >= 10) {
      m = round12(m / 10);
      e += 1;
    }
    if (Math.abs(m) < 1) {
      m = round12(m * 10);
      e -= 1;
    }
    return { m, e };
  }
  function bn(v) {
    if (typeof v === "number") {
      if (!isFinite(v)) throw new Error("BN_NOT_FINITE");
      return norm(v, 0);
    }
    if (typeof v === "string") return parse(v);
    if (v && typeof v.m === "number" && typeof v.e === "number") return norm(v.m, v.e);
    throw new Error("BN_BAD_VALUE");
  }
  function parse(s) {
    if (typeof s !== "string" || s.length > 40) throw new Error("BN_BAD_STRING");
    if (s === "0") return { m: 0, e: 0 };
    const mt = /^(-?\d+(?:\.\d+)?)(?:e(-?\d+))?$/.exec(s);
    if (!mt) throw new Error("BN_BAD_STRING");
    return norm(Number(mt[1]), mt[2] ? Number(mt[2]) : 0);
  }
  function str(a) {
    if (a.m === 0) return "0";
    return String(a.m) + "e" + String(a.e);
  }
  function toNumber(a) {
    if (a.e > 308) return a.m > 0 ? Infinity : -Infinity;
    if (a.e < -308) return 0;
    return a.m * Math.pow(10, a.e);
  }
  function isZero(a) {
    return a.m === 0;
  }
  function isNeg(a) {
    return a.m < 0;
  }
  function add(a, b) {
    if (a.m === 0) return b;
    if (b.m === 0) return a;
    const d = a.e - b.e;
    if (d > SIG + 2) return a;
    if (d < -(SIG + 2)) return b;
    if (d >= 0) return norm(a.m + b.m / Math.pow(10, d), a.e);
    return norm(b.m + a.m / Math.pow(10, -d), b.e);
  }
  function neg(a) {
    return a.m === 0 ? a : { m: -a.m, e: a.e };
  }
  function sub(a, b) {
    return add(a, neg(b));
  }
  function mul(a, b) {
    if (a.m === 0 || b.m === 0) return { m: 0, e: 0 };
    return norm(a.m * b.m, a.e + b.e);
  }
  function mulN(a, n) {
    return mul(a, bn(n));
  }
  function div(a, b) {
    if (b.m === 0) throw new Error("BN_DIV_ZERO");
    if (a.m === 0) return { m: 0, e: 0 };
    return norm(a.m / b.m, a.e - b.e);
  }
  function powN(base, exp) {
    if (!(base > 0) || !isFinite(exp)) throw new Error("BN_BAD_POW");
    const l = exp * Math.log10(base);
    const e = Math.floor(l);
    return norm(Math.pow(10, l - e), e);
  }
  function cmp(a, b) {
    const d = sub(a, b);
    return d.m === 0 ? 0 : d.m > 0 ? 1 : -1;
  }
  function gte(a, b) {
    return cmp(a, b) >= 0;
  }
  function gt(a, b) {
    return cmp(a, b) > 0;
  }
  function max(a, b) {
    return cmp(a, b) >= 0 ? a : b;
  }
  function min(a, b) {
    return cmp(a, b) <= 0 ? a : b;
  }
  function floor(a) {
    if (a.e >= SIG || a.m === 0) return a;
    if (a.e < 0) return a.m < 0 ? bn(-1) : { m: 0, e: 0 };
    return bn(Math.floor(toNumber(a)));
  }
  function log10(a) {
    if (a.m <= 0) throw new Error("BN_BAD_LOG");
    return Math.log10(a.m) + a.e;
  }
  var UNITS = ["", "만", "억", "조", "경", "해", "자", "양", "구", "간"];
  function fmt(a) {
    if (a.m === 0) return "0";
    if (a.m < 0) return "-" + fmt(neg(a));
    if (a.e < 4) {
      const n = toNumber(a);
      return n < 10 ? String(Math.floor(n * 10) / 10) : Math.floor(n).toLocaleString("ko-KR");
    }
    const g = Math.floor(a.e / 4);
    if (g < UNITS.length) {
      const v = a.m * Math.pow(10, a.e - g * 4);
      const t = v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10;
      return t + UNITS[g];
    }
    return (Math.floor(a.m * 100) / 100).toFixed(2) + "e" + a.e;
  }

  // shared/data.ts
  var ROLE_NAME = { guard: "전위", striker: "공격", tuner: "조율", shifter: "변환" };
  var ROLE_DESC = {
    guard: "앞줄에서 피해를 받아내고 방벽을 세움",
    striker: "강한 단일·범위 피해",
    tuner: "편대 강화와 재사용 대기 단축",
    shifter: "적 방어 패턴을 깨뜨리고 연쇄 공명을 일으킴"
  };
  var REGIONS = [
    { id: "mycel", name: "균사림", desc: "빛나는 균사가 숲을 엮은 첫 탐사지", from: 1, to: 20, bg: ["#123d2c", "#2f7a55"], env: "습윤" },
    { id: "glass", name: "유리 사막", desc: "모래가 녹아 굳은 유리 언덕과 신기루", from: 21, to: 40, bg: ["#4a3517", "#c2903e"], env: "건조" },
    { id: "storm", name: "폭풍 해안", desc: "번개가 그치지 않는 부유 대륙의 끝자락", from: 41, to: 60, bg: ["#14233f", "#3d6fa8"], env: "폭풍" }
  ];
  var BOSSES = [
    { id: "b_rotking", name: "부패 균핵", region: "mycel", pattern: ["harden", "normal", "spore"], desc: "숲의 생태 핵을 삼킨 거대한 균핵" },
    { id: "b_sandmaw", name: "열사 아가리", region: "glass", pattern: ["normal", "charge", "harden"], desc: "유리 모래 아래에서 입을 벌리는 포식자" },
    { id: "b_galecore", name: "폭풍 심장", region: "storm", pattern: ["charge", "harden", "storm"], desc: "해안 위 번개 구름의 중심" }
  ];
  var CREATURES = [
    // 균사림
    {
      id: "c01",
      name: "이끼등",
      role: "guard",
      region: "mycel",
      atk: 6,
      hp: 60,
      def: 14,
      spd: 3,
      starter: true,
      skill: { name: "포자 방벽", desc: "자신과 앞줄에 최대 체력 18% 방벽", power: 0.18, cd: 3 },
      look: { body: "shell", c1: "#4f8a4b", c2: "#c9e8a2", eye: 2, mark: "spots", crest: "cap" },
      nature: "느긋함",
      habitat: "젖은 쓰러진 나무 밑",
      lore: "등의 이끼가 무성할수록 더 단단해진다.",
      contract: { shards: 0, materials: 0 }
    },
    {
      id: "c02",
      name: "포롱",
      role: "striker",
      region: "mycel",
      atk: 14,
      hp: 30,
      def: 5,
      spd: 6,
      starter: true,
      skill: { name: "포자 폭발", desc: "대상에게 공격력 220% 피해", power: 2.2, cd: 3 },
      look: { body: "blob", c1: "#e27a9b", c2: "#ffd3e0", eye: 2, mark: "spots", crest: "antenna" },
      nature: "덜렁댐",
      habitat: "균사 꽃이 핀 바닥",
      lore: "놀라면 몸속 포자를 한꺼번에 내뿜는다.",
      contract: { shards: 0, materials: 0 }
    },
    {
      id: "c03",
      name: "실타래",
      role: "tuner",
      region: "mycel",
      atk: 8,
      hp: 38,
      def: 7,
      spd: 5,
      starter: true,
      skill: { name: "균사 연결", desc: "편대 공격력 +25% (2턴), 재사용 대기 1 감소", power: 0.25, cd: 4 },
      look: { body: "wisp", c1: "#d9c27a", c2: "#fff6cf", eye: 1, mark: "rings", crest: "halo" },
      nature: "세심함",
      habitat: "나무 사이에 걸린 빛 실",
      lore: "동료의 기척을 실로 이어 하나의 박자로 만든다.",
      contract: { shards: 0, materials: 0 }
    },
    {
      id: "c04",
      name: "등불갓",
      role: "shifter",
      region: "mycel",
      atk: 10,
      hp: 34,
      def: 6,
      spd: 4,
      skill: { name: "균열 포자", desc: "적에게 균열(방어 -50%, 2턴)", power: 0.5, cd: 3 },
      look: { body: "blob", c1: "#5a62c9", c2: "#a9f0ff", eye: 3, mark: "none", crest: "cap" },
      nature: "호기심",
      habitat: "가장 어두운 균사 동굴",
      lore: "갓에서 나는 빛이 단단한 껍질의 틈을 비춘다.",
      contract: { shards: 300, materials: 0 }
    },
    // 유리 사막
    {
      id: "c05",
      name: "규사갑",
      role: "guard",
      region: "glass",
      atk: 9,
      hp: 95,
      def: 22,
      spd: 2,
      skill: { name: "유리 장벽", desc: "자신과 앞줄에 최대 체력 24% 방벽", power: 0.24, cd: 3 },
      look: { body: "shell", c1: "#c79a5b", c2: "#f6e3b8", eye: 2, mark: "facets", crest: "spikes" },
      nature: "고집셈",
      habitat: "유리 언덕 그늘",
      lore: "모래를 삼켜 등껍질에 유리 비늘을 키운다.",
      contract: { shards: 6e4, materials: 5 }
    },
    {
      id: "c06",
      name: "프리즘핀",
      role: "striker",
      region: "glass",
      atk: 24,
      hp: 44,
      def: 7,
      spd: 7,
      skill: { name: "굴절 광선", desc: "적에게 공격력 160% 피해 ×2회", power: 1.6, cd: 4, hits: 2 },
      look: { body: "crystal", c1: "#62c6d9", c2: "#e9fbff", eye: 1, mark: "facets", crest: "fins" },
      nature: "성급함",
      habitat: "햇빛이 모이는 유리 첨탑",
      lore: "몸을 지나는 빛을 날카로운 칼날로 바꾼다.",
      contract: { shards: 9e4, materials: 8 }
    },
    {
      id: "c07",
      name: "신기루새",
      role: "tuner",
      region: "glass",
      atk: 12,
      hp: 50,
      def: 9,
      spd: 8,
      skill: { name: "아지랑이 노래", desc: "편대 공격력 +30% (2턴), 재사용 대기 1 감소", power: 0.3, cd: 4 },
      look: { body: "wisp", c1: "#e7a35a", c2: "#fff0d6", eye: 2, mark: "stripes", crest: "fins" },
      nature: "명랑함",
      habitat: "열기 위의 공중",
      lore: "노랫소리가 닿는 곳마다 공기가 흔들린다.",
      contract: { shards: 12e4, materials: 10 }
    },
    {
      id: "c08",
      name: "결정뱀",
      role: "shifter",
      region: "glass",
      atk: 15,
      hp: 48,
      def: 9,
      spd: 6,
      skill: { name: "결정 침식", desc: "적에게 균열(방어 -60%, 2턴)", power: 0.6, cd: 3 },
      look: { body: "serpent", c1: "#9b6bd1", c2: "#efe0ff", eye: 2, mark: "facets", crest: "spikes" },
      nature: "신중함",
      habitat: "유리 모래 속 통로",
      lore: "닿는 것을 결정으로 바꿔 부서지기 쉽게 만든다.",
      contract: { shards: 15e4, materials: 12 }
    },
    // 폭풍 해안
    {
      id: "c09",
      name: "조개보루",
      role: "guard",
      region: "storm",
      atk: 12,
      hp: 150,
      def: 32,
      spd: 2,
      skill: { name: "해무 보루", desc: "자신과 앞줄에 최대 체력 30% 방벽", power: 0.3, cd: 3 },
      look: { body: "shell", c1: "#5d7f9e", c2: "#dcecf7", eye: 2, mark: "rings", crest: "spikes" },
      nature: "침착함",
      habitat: "파도가 부서지는 바위",
      lore: "폭풍이 칠수록 껍데기를 더 굳게 닫는다.",
      contract: { shards: 4e7, materials: 30 }
    },
    {
      id: "c10",
      name: "뇌운포",
      role: "striker",
      region: "storm",
      atk: 40,
      hp: 62,
      def: 10,
      spd: 8,
      skill: { name: "낙뢰 방전", desc: "적에게 공격력 300% 피해", power: 3, cd: 4 },
      look: { body: "jelly", c1: "#f2d14b", c2: "#fffbe0", eye: 1, mark: "stripes", crest: "antenna" },
      nature: "변덕스러움",
      habitat: "번개 구름 아래 수면",
      lore: "몸에 모은 정전기를 한순간에 풀어놓는다.",
      contract: { shards: 6e7, materials: 40 }
    },
    {
      id: "c11",
      name: "파도노래",
      role: "tuner",
      region: "storm",
      atk: 16,
      hp: 70,
      def: 12,
      spd: 7,
      skill: { name: "밀물 합창", desc: "편대 공격력 +35% (2턴), 재사용 대기 1 감소", power: 0.35, cd: 4 },
      look: { body: "jelly", c1: "#4fb3a6", c2: "#dffaf4", eye: 2, mark: "rings", crest: "fins" },
      nature: "다정함",
      habitat: "해안 동굴의 물웅덩이",
      lore: "파도의 박자에 맞춰 동료의 숨을 고른다.",
      contract: { shards: 8e7, materials: 45 }
    },
    {
      id: "c12",
      name: "와류꼬리",
      role: "shifter",
      region: "storm",
      atk: 22,
      hp: 66,
      def: 12,
      spd: 7,
      skill: { name: "소용돌이 균열", desc: "적에게 균열(방어 -70%, 2턴)", power: 0.7, cd: 3 },
      look: { body: "serpent", c1: "#3f5fc9", c2: "#cfe0ff", eye: 3, mark: "stripes", crest: "fins" },
      nature: "장난기",
      habitat: "소용돌이 바다",
      lore: "꼬리를 돌려 적의 자세를 흐트러뜨린다.",
      contract: { shards: 1e8, materials: 50 }
    }
  ];
  var CREATURE_BY_ID = Object.fromEntries(CREATURES.map((c) => [c.id, c]));
  var TRAITS = {
    atk: { name: "공격", desc: "공격력 +25%" },
    surv: { name: "생존", desc: "체력·방어 +25%" },
    auto: { name: "자동화", desc: "탐사 생산량 +8%" },
    off: { name: "야영", desc: "정산 한도 +1시간" }
  };
  var RESEARCH = {
    gather: { name: "채집 효율", desc: "탐사 생산량 +15% / 단계", base: 80, growth: 1.9, max: 1e9 },
    offline: { name: "야영 기술", desc: "오프라인 한도 +1시간 / 단계 (최대 16)", base: 500, growth: 3.2, max: 16 },
    harmony: { name: "공명 조율", desc: "편대 공격력 +12% / 단계", base: 120, growth: 2, max: 1e9 },
    instinct: { name: "생존 본능", desc: "편대 체력 +12% / 단계", base: 120, growth: 2, max: 1e9 },
    sense: { name: "재료 감지", desc: "복원 재료 획득 +20% / 단계", base: 2e3, growth: 2.6, max: 1e9 }
  };
  var DEFAULT_CONFIG = {
    configVersion: 1,
    offlineCapHours: 8,
    prodMult: 1,
    maxTeam: 5,
    minTeamForBoss: 3,
    rebuildMinDepth: 40
  };

  // shared/state.ts
  var SCHEMA_VERSION = 1;
  function newCreature(now, depth) {
    return { level: 1, skill: 0, resonance: 0, trait: null, alias: "", contractedAt: now, firstRegionDepth: depth, battles: 0 };
  }
  function newState(now) {
    const creatures = {};
    const discovered = {};
    const team = [];
    for (const c of CREATURES) {
      if (c.starter) {
        creatures[c.id] = newCreature(now, 1);
        team.push(c.id);
      }
      if (c.region === "mycel") discovered[c.id] = now;
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      lastSettledAt: now,
      revision: 0,
      cur: { shards: bn(50), energy: bn(100), materials: ZERO, seeds: ZERO },
      depth: 1,
      maxDepth: 1,
      bestDepth: 1,
      gates: 0,
      firstClears: [],
      creatures,
      discovered,
      team,
      research: { gather: 0, offline: 0, harmony: 0, instinct: 0, sense: 0 },
      rebuilds: 0,
      seedsEarned: ZERO,
      stats: { bossTries: 0, bossWins: 0, offlineClaims: 0, commands: 0 },
      recent: []
    };
  }
  function serialize(s) {
    return JSON.stringify(s, (_k, v) => v && typeof v === "object" && typeof v.m === "number" && typeof v.e === "number" && Object.keys(v).length === 2 ? str(v) : v);
  }
  var BN_PATHS = ["shards", "energy", "materials", "seeds"];
  function deserialize(text) {
    const o = JSON.parse(text);
    return migrate(o);
  }
  function migrate(o) {
    var _a, _b;
    const v = Number(o.schemaVersion || 0);
    if (v > SCHEMA_VERSION) throw new Error("SCHEMA_TOO_NEW");
    if (!Array.isArray(o.recent)) o.recent = [];
    const cur = o.cur || {};
    const out = o;
    out.cur = {};
    for (const k of BN_PATHS) out.cur[k] = bn((_a = cur[k]) != null ? _a : "0");
    out.seedsEarned = bn((_b = o.seedsEarned) != null ? _b : "0");
    out.schemaVersion = SCHEMA_VERSION;
    return out;
  }
  function clone(s) {
    return deserialize(serialize(s));
  }

  // shared/formulas.ts
  var formulas_exports = {};
  __export(formulas_exports, {
    BOSS_K: () => BOSS_K,
    L: () => L,
    TRAIT_CHANGE_COST: () => TRAIT_CHANGE_COST,
    bandOf: () => bandOf,
    bossAt: () => bossAt,
    bossReward: () => bossReward,
    bossStats: () => bossStats,
    contractedCount: () => contractedCount,
    creatureStats: () => creatureStats,
    enemyPower: () => enemyPower,
    gateDepth: () => gateDepth,
    levelCost: () => levelCost,
    levelLog: () => levelLog,
    logSum: () => logSum,
    offlineCapSeconds: () => offlineCapSeconds,
    rates: () => rates,
    reachableDepth: () => reachableDepth,
    rebuildSeeds: () => rebuildSeeds,
    regionOf: () => regionOf,
    regionUnlocked: () => regionUnlocked,
    researchCost: () => researchCost,
    resonanceCost: () => resonanceCost,
    resonanceNeedLevel: () => resonanceNeedLevel,
    seedMult: () => seedMult,
    skillCost: () => skillCost,
    skillMax: () => skillMax,
    teamPower: () => teamPower,
    tierOf: () => tierOf
  });
  var L = {
    enemyBase: 2.2,
    // log10(첫 적 전투력)
    enemyGrowth: 0.0792,
    // 깊이 1당 적 전투력 ×1.2
    shardBase: 0.5,
    rewardGrowth: 1.105,
    energyPerShard: 2,
    matPerSec: 6e-4,
    bandSize: 20,
    levelBase: 10,
    levelGrowth: 1.17,
    skillBase: 40,
    skillGrowth: 1.7,
    levelLin: 0.1,
    levelDoubleEvery: 25,
    seedEach: 0.1,
    seedPow: 1.4
  };
  function bandOf(depth) {
    return Math.floor((Math.max(1, depth) - 1) / L.bandSize);
  }
  function regionOf(depth) {
    return REGIONS[bandOf(depth) % REGIONS.length];
  }
  function tierOf(depth) {
    return Math.floor(bandOf(depth) / REGIONS.length);
  }
  function gateDepth(gates) {
    return (gates + 1) * L.bandSize;
  }
  function bossAt(gates) {
    const b = BOSSES[gates % BOSSES.length];
    return { ...b, tier: Math.floor(gates / BOSSES.length), depth: gateDepth(gates) };
  }
  function regionUnlocked(s, regionIndex) {
    return s.bestDepth > regionIndex * L.bandSize;
  }
  function seedMult(s) {
    return 1 + L.seedEach * Math.min(toNumber(s.cur.seeds), 1e12);
  }
  function contractedCount(s) {
    return Object.keys(s.creatures).length;
  }
  function traitCount(s, t) {
    return s.team.filter((id) => s.creatures[id] && s.creatures[id].trait === t).length;
  }
  function levelLog(level) {
    return Math.log10(1 + L.levelLin * (level - 1)) + Math.floor(level / L.levelDoubleEvery) * Math.log10(2);
  }
  function creatureStats(s, id) {
    const d = CREATURE_BY_ID[id];
    const c = s.creatures[id];
    if (!d || !c) throw new Error("NO_CREATURE");
    const res = c.resonance * Math.log10(1.5);
    const sm = Math.log10(seedMult(s));
    const lv = levelLog(c.level);
    let lAtk = Math.log10(d.atk) + lv + res + sm + Math.log10(1 + 0.12 * s.research.harmony);
    let lHp = Math.log10(d.hp) + lv + res + sm + Math.log10(1 + 0.12 * s.research.instinct);
    let def = d.def * (1 + 0.03 * (c.level - 1)) * Math.pow(1.2, c.resonance);
    if (c.trait === "atk") lAtk += Math.log10(1.25);
    if (c.trait === "surv") {
      lHp += Math.log10(1.25);
      def *= 1.25;
    }
    return { lAtk, lHp, def, spd: d.spd, role: d.role, region: d.region };
  }
  function logSum(xs) {
    if (!xs.length) return -Infinity;
    const m = Math.max(...xs);
    return m + Math.log10(xs.reduce((a, x) => a + Math.pow(10, x - m), 0));
  }
  function teamPower(s) {
    const ids = s.team.filter((id) => s.creatures[id]);
    if (!ids.length) return -Infinity;
    const ps = ids.map((id) => {
      const st = creatureStats(s, id);
      return st.lAtk + 0.5 * st.lHp;
    });
    const roles = new Set(ids.map((id) => CREATURE_BY_ID[id].role)).size;
    return logSum(ps) + Math.log10(1 + 0.06 * (roles - 1));
  }
  function enemyPower(d) {
    return L.enemyBase + (d - 1) * L.enemyGrowth;
  }
  function reachableDepth(s) {
    const p = teamPower(s);
    if (!isFinite(p)) return s.depth;
    const d = Math.floor((p - L.enemyBase) / L.enemyGrowth) + 1;
    return Math.max(1, Math.min(d, gateDepth(s.gates)));
  }
  function rates(s, cfg) {
    const mult = cfg.prodMult * (1 + 0.15 * s.research.gather) * (1 + 0.08 * traitCount(s, "auto")) * seedMult(s) * (1 + 0.03 * contractedCount(s));
    const shards = mulN(powN(L.rewardGrowth, s.depth - 1), L.shardBase * mult);
    return {
      shards,
      energy: mulN(shards, L.energyPerShard),
      materials: bn(L.matPerSec * (1 + bandOf(s.depth)) * (1 + 0.2 * s.research.sense) * cfg.prodMult)
    };
  }
  function offlineCapSeconds(s, cfg) {
    const h = cfg.offlineCapHours + Math.min(s.research.offline, RESEARCH.offline.max) + 1 * traitCount(s, "off");
    return Math.round(h * 3600);
  }
  function levelCost(level) {
    return mulN(powN(L.levelGrowth, level - 1), L.levelBase);
  }
  function skillCost(skill) {
    return mulN(powN(L.skillGrowth, skill), L.skillBase);
  }
  function skillMax(level) {
    return Math.floor(level / 5) + 1;
  }
  function resonanceCost(r) {
    return bn(Math.ceil(3 * Math.pow(2.2, r)));
  }
  function resonanceNeedLevel(r) {
    return 15 * (r + 1);
  }
  function researchCost(k, lv) {
    return mulN(powN(RESEARCH[k].growth, lv), RESEARCH[k].base);
  }
  var TRAIT_CHANGE_COST = 5;
  var BOSS_K = { atk: Math.log10(1.6), hp: Math.log10(20), def: 30, spd: 5 };
  function bossStats(gates) {
    const b = bossAt(gates);
    const e = enemyPower(b.depth) + (gates === 0 ? 0 : Math.log10(1.5));
    return { ...b, lAtk: 2 / 3 * e + BOSS_K.atk, lHp: 2 / 3 * e + BOSS_K.hp, def: BOSS_K.def + 12 * b.tier, spd: BOSS_K.spd };
  }
  function bossReward(gates, first) {
    const b = bossAt(gates);
    const shards = mulN(powN(L.rewardGrowth, b.depth - 1), L.shardBase * 600);
    return { shards, materials: bn((first ? 12 : 4) * (1 + b.tier) * (1 + gates % 3)) };
  }
  function rebuildSeeds(s) {
    const x = (s.maxDepth - 20) / 10;
    if (x <= 0) return ZERO;
    return bn(Math.floor(Math.pow(x, L.seedPow) * (1 + 0.05 * contractedCount(s))));
  }

  // shared/battle.ts
  function rng(seed) {
    let a = seed >>> 0;
    return function() {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashSeed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  var MAX_ROUNDS = 30;
  var r1 = (x) => Math.round(x * 10) / 10;
  function simulateBoss(s, seed) {
    const boss = bossStats(s.gates);
    const ids = s.team.filter((id) => s.creatures[id]);
    const st = ids.map((id) => creatureStats(s, id));
    const scale = Math.floor(Math.max(boss.lHp, ...st.map((x) => x.lHp))) - 6;
    const val = (l) => Math.pow(10, l - scale);
    const rand = rng(seed);
    const vary = () => 0.95 + rand() * 0.1;
    const units = ids.map((id, i) => {
      const d = CREATURE_BY_ID[id];
      const lvSkill = s.creatures[id].skill;
      return {
        i,
        id,
        role: d.role,
        front: i < 2,
        spd: st[i].spd + i * 0.01,
        atk: val(st[i].lAtk) * (d.region === boss.region ? 1.1 : 1),
        max: val(st[i].lHp),
        hp: val(st[i].lHp),
        def: st[i].def,
        shield: 0,
        cd: Math.max(0, d.skill.cd - 1),
        skill: d.skill,
        sp: 1 + 0.15 * lvSkill
      };
    });
    const B = { hp: val(boss.lHp), max: val(boss.lHp), atk: val(boss.lAtk), def: boss.def, crack: 0, crackPow: 0 };
    let buff = 0, buffT = 0;
    const log = [];
    let round = 0;
    const alive = () => units.filter((u) => u.hp > 0);
    const hitBoss = (u, mult, r, kind) => {
      const pat = boss.pattern[(r - 1) % boss.pattern.length];
      let def = B.def * (B.crack > 0 ? 1 - B.crackPow : 1);
      if (pat === "harden") def *= 2.5;
      const eff = u.atk * mult * (1 + buff) * (B.crack > 0 ? 1.3 : 1) * vary();
      const dmg = eff * 100 / (100 + def);
      B.hp = Math.max(0, B.hp - dmg);
      log.push([r, u.i, kind, -1, r1(dmg)]);
    };
    const hurt = (u, dmg, r, pierce) => {
      let d = dmg * 100 / (100 + u.def);
      const absorb = Math.min(u.shield * (1 - pierce), d);
      u.shield -= absorb;
      d -= absorb;
      u.hp = Math.max(0, u.hp - d);
      log.push([r, -1, "hit", u.i, r1(d)]);
    };
    for (round = 1; round <= MAX_ROUNDS && B.hp > 0 && alive().length; round++) {
      const pat = boss.pattern[(round - 1) % boss.pattern.length];
      const order = [...alive(), "boss"].sort((a, b) => (b === "boss" ? boss.spd : b.spd) - (a === "boss" ? boss.spd : a.spd));
      for (const a of order) {
        if (B.hp <= 0 || !alive().length) break;
        if (a === "boss") {
          const front = alive().filter((u2) => u2.front);
          const tgt = front[0] || alive()[0];
          if (pat === "charge") {
            for (const u2 of front.length ? front : [tgt]) hurt(u2, B.atk * 1.5 * vary(), round, 0);
          } else if (pat === "spore") {
            for (const u2 of alive()) hurt(u2, B.atk * 0.6 * vary(), round, 0);
          } else if (pat === "storm") {
            for (const u2 of alive()) hurt(u2, B.atk * 0.8 * vary(), round, 0.5);
          } else hurt(tgt, B.atk * vary(), round, 0);
          continue;
        }
        const u = a;
        if (u.hp <= 0) continue;
        if (u.cd <= 0) {
          u.cd = u.skill.cd;
          if (u.role === "guard") {
            const amt = u.max * u.skill.power * u.sp;
            for (const t of alive().filter((x) => x.front || x === u)) t.shield = Math.max(t.shield, amt);
            log.push([round, u.i, "shield", 9, r1(amt)]);
          } else if (u.role === "striker") {
            for (let h = 0; h < (u.skill.hits || 1); h++) hitBoss(u, u.skill.power * u.sp, round, "skill");
          } else if (u.role === "tuner") {
            buff = Math.max(buff, u.skill.power * u.sp);
            buffT = 2;
            for (const t of units) if (t !== u) t.cd = Math.max(0, t.cd - 1);
            log.push([round, u.i, "buff", 9, Math.round(buff * 100)]);
          } else {
            B.crack = 2;
            B.crackPow = Math.min(0.9, u.skill.power * (1 + 0.05 * (u.sp - 1) / 0.15));
            hitBoss(u, 1.2, round, "crack");
          }
        } else {
          u.cd -= 1;
          hitBoss(u, 1, round, "atk");
        }
      }
      if (buffT > 0 && --buffT === 0) buff = 0;
      if (B.crack > 0) B.crack -= 1;
    }
    return {
      win: B.hp <= 0,
      rounds: round - 1,
      seed,
      scale,
      team: units.map((u) => ({ id: u.id, max: r1(u.max), hp: r1(u.hp) })),
      boss: { id: boss.id, name: boss.name, max: r1(B.max), tier: boss.tier },
      log: log.slice(0, 400)
    };
  }

  // shared/commands.ts
  var ACTIONS = ["sync", "claimOffline", "upgrade", "setTeam", "challengeBoss", "rebuildEcology", "setAlias"];
  var GameError = class extends Error {
    constructor(code, reason) {
      super(reason);
      this.code = code;
      this.reason = reason;
    }
  };
  var bad = (reason) => new GameError("INVALID_REQUEST", reason);
  function settle(s, now, cfg) {
    const elapsed = Math.max(0, Math.floor((now - s.lastSettledAt) / 1e3));
    const cap = offlineCapSeconds(s, cfg);
    const recognized = Math.min(elapsed, cap);
    const effSec = recognized;
    const r = rates(s, cfg);
    const g = { shards: mulN(r.shards, effSec), energy: mulN(r.energy, effSec), materials: mulN(r.materials, effSec) };
    s.cur.shards = add(s.cur.shards, g.shards);
    s.cur.energy = add(s.cur.energy, g.energy);
    s.cur.materials = add(s.cur.materials, g.materials);
    s.lastSettledAt = Math.max(s.lastSettledAt, now);
    const from = s.depth;
    advanceDepth(s);
    return { elapsed, recognized, capped: elapsed > cap, gained: { shards: str(g.shards), energy: str(g.energy), materials: str(g.materials) }, depthFrom: from, depthTo: s.depth };
  }
  function advanceDepth(s) {
    const d = Math.max(s.depth, reachableDepth(s));
    s.depth = Math.min(d, gateDepth(s.gates));
    s.maxDepth = Math.max(s.maxDepth, s.depth);
    if (s.depth > s.bestDepth) s.bestDepth = s.depth;
    REGIONS.forEach((reg, i) => {
      if (!regionUnlocked(s, i)) return;
      for (const c of CREATURES) if (c.region === reg.id && !(c.id in s.discovered)) s.discovered[c.id] = s.lastSettledAt;
    });
  }
  function spend(s, k, amt) {
    if (!gte(s.cur[k], amt)) throw bad("NOT_ENOUGH_" + k.toUpperCase());
    s.cur[k] = sub(s.cur[k], amt);
    if (isNeg(s.cur[k])) s.cur[k] = ZERO;
  }
  var isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  var intIn = (x, a, b) => typeof x === "number" && Number.isInteger(x) && x >= a && x <= b;
  function ownCreature(s, id) {
    if (typeof id !== "string" || !CREATURE_BY_ID[id]) throw bad("UNKNOWN_CREATURE");
    const c = s.creatures[id];
    if (!c) throw bad("NOT_CONTRACTED");
    return c;
  }
  function applyCommand(s0, cmd, ctx) {
    if (!ACTIONS.includes(cmd.action)) throw bad("UNKNOWN_ACTION");
    const action = cmd.action;
    const p = cmd.payload === void 0 ? {} : cmd.payload;
    if (!isObj(p)) throw bad("PAYLOAD_NOT_OBJECT");
    const s = clone(s0);
    const rep = settle(s, ctx.now, ctx.cfg);
    const data = {};
    switch (action) {
      case "sync":
        break;
      case "claimOffline":
        s.stats.offlineClaims += rep.recognized >= 600 ? 1 : 0;
        break;
      case "upgrade": {
        const kind = p.kind;
        const times = p.times === void 0 ? 1 : p.times;
        if (!intIn(times, 1, 100)) throw bad("BAD_TIMES");
        let done = 0;
        if (kind === "level") {
          const c = ownCreature(s, p.id);
          for (; done < times; done++) {
            const cost = levelCost(c.level);
            if (!gte(s.cur.energy, cost)) break;
            spend(s, "energy", cost);
            c.level += 1;
          }
        } else if (kind === "skill") {
          const c = ownCreature(s, p.id);
          for (; done < times; done++) {
            if (c.skill + 1 > skillMax(c.level)) {
              if (!done) throw bad("SKILL_NEEDS_LEVEL");
              break;
            }
            const cost = skillCost(c.skill);
            if (!gte(s.cur.shards, cost)) break;
            spend(s, "shards", cost);
            c.skill += 1;
          }
        } else if (kind === "resonance") {
          const c = ownCreature(s, p.id);
          if (c.level < resonanceNeedLevel(c.resonance)) throw bad("RESONANCE_NEEDS_LEVEL");
          spend(s, "materials", resonanceCost(c.resonance));
          c.resonance += 1;
          done = 1;
        } else if (kind === "trait") {
          const c = ownCreature(s, p.id);
          if (typeof p.trait !== "string" || !(p.trait in TRAITS)) throw bad("UNKNOWN_TRAIT");
          if (c.resonance < 1) throw bad("TRAIT_NEEDS_RESONANCE");
          if (c.trait === p.trait) throw bad("SAME_TRAIT");
          if (c.trait) spend(s, "materials", bn(TRAIT_CHANGE_COST));
          c.trait = p.trait;
          done = 1;
        } else if (kind === "research") {
          if (typeof p.key !== "string" || !(p.key in RESEARCH)) throw bad("UNKNOWN_RESEARCH");
          const k = p.key;
          for (; done < times; done++) {
            if (s.research[k] >= RESEARCH[k].max) {
              if (!done) throw bad("RESEARCH_MAX");
              break;
            }
            const cost = researchCost(k, s.research[k]);
            if (!gte(s.cur.shards, cost)) break;
            spend(s, "shards", cost);
            s.research[k] += 1;
          }
        } else if (kind === "contract") {
          if (typeof p.id !== "string" || !CREATURE_BY_ID[p.id]) throw bad("UNKNOWN_CREATURE");
          const d = CREATURE_BY_ID[p.id];
          if (s.creatures[d.id]) throw bad("ALREADY_CONTRACTED");
          if (!(d.id in s.discovered)) throw bad("NOT_DISCOVERED");
          spend(s, "shards", bn(d.contract.shards));
          spend(s, "materials", bn(d.contract.materials));
          s.creatures[d.id] = newCreature(ctx.now, s.depth);
          done = 1;
        } else throw bad("UNKNOWN_UPGRADE");
        if (!done) throw bad("NOT_ENOUGH_RESOURCES");
        data.done = done;
        break;
      }
      case "setTeam": {
        const t = p.team;
        if (!Array.isArray(t) || t.length < 1 || t.length > ctx.cfg.maxTeam) throw bad("BAD_TEAM_SIZE");
        if (new Set(t).size !== t.length) throw bad("DUPLICATE_MEMBER");
        t.forEach((id) => ownCreature(s, id));
        s.team = t.slice();
        advanceDepth(s);
        break;
      }
      case "challengeBoss": {
        if (s.team.length < ctx.cfg.minTeamForBoss) throw bad("TEAM_TOO_SMALL");
        if (s.depth < gateDepth(s.gates)) throw bad("GATE_NOT_REACHED");
        const res = simulateBoss(s, ctx.seed);
        const bossId = res.boss.id + (res.boss.tier ? "#" + res.boss.tier : "");
        s.stats.bossTries += 1;
        for (const id of s.team) s.creatures[id].battles += 1;
        if (res.win) {
          const first = !s.firstClears.includes(bossId);
          const rw = bossReward(s.gates, first);
          s.cur.shards = add(s.cur.shards, rw.shards);
          s.cur.materials = add(s.cur.materials, rw.materials);
          if (first) s.firstClears.push(bossId);
          s.gates += 1;
          s.stats.bossWins += 1;
          advanceDepth(s);
          data.reward = { shards: str(rw.shards), materials: str(rw.materials), first };
        }
        data.battle = res;
        break;
      }
      case "rebuildEcology": {
        if (p.confirm !== true) throw bad("CONFIRM_REQUIRED");
        if (s.maxDepth < ctx.cfg.rebuildMinDepth) throw bad("REBUILD_LOCKED");
        const seeds = rebuildSeeds(s);
        const keep = s;
        const fresh = newState(ctx.now);
        for (const id of Object.keys(keep.creatures)) {
          const c = keep.creatures[id];
          fresh.creatures[id] = { ...c, level: 1, skill: 0 };
        }
        fresh.createdAt = keep.createdAt;
        fresh.revision = keep.revision;
        fresh.recent = keep.recent;
        fresh.discovered = keep.discovered;
        fresh.research = keep.research;
        fresh.firstClears = keep.firstClears;
        fresh.team = keep.team.filter((id) => fresh.creatures[id]);
        fresh.bestDepth = keep.bestDepth;
        fresh.stats = keep.stats;
        fresh.rebuilds = keep.rebuilds + 1;
        fresh.cur.seeds = add(keep.cur.seeds, seeds);
        fresh.seedsEarned = add(keep.seedsEarned, seeds);
        Object.assign(s, fresh);
        data.seeds = str(seeds);
        break;
      }
      case "setAlias": {
        const c = ownCreature(s, p.id);
        if (typeof p.alias !== "string" || p.alias.length > 12) throw bad("BAD_ALIAS");
        c.alias = p.alias.replace(/[\u0000-\u001f<>"'`=+@]/g, "").trim();
        break;
      }
    }
    s.stats.commands += 1;
    return { state: s, result: { action, settle: rep, data } };
  }

  // shared/protocol.ts
  var CLIENT_VERSION = "0.1.0";
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function validateShape(x) {
    const bad2 = (r) => new GameError("INVALID_REQUEST", r);
    if (!x || typeof x !== "object" || Array.isArray(x)) throw bad2("NOT_OBJECT");
    const o = x;
    if (typeof o.requestId !== "string" || !UUID.test(o.requestId)) throw bad2("BAD_REQUEST_ID");
    if (typeof o.action !== "string" || !ACTIONS.concat(["register", "restore", "hello"]).includes(o.action)) throw bad2("UNKNOWN_ACTION");
    if (typeof o.clientVersion !== "string" || o.clientVersion.length > 20) throw bad2("BAD_CLIENT_VERSION");
    if (o.schemaVersion !== SCHEMA_VERSION) throw bad2("SCHEMA_MISMATCH");
    if (o.expectedRevision !== void 0 && !(Number.isInteger(o.expectedRevision) && o.expectedRevision >= 0)) throw bad2("BAD_REVISION");
    if (o.payload !== void 0 && (!o.payload || typeof o.payload !== "object" || Array.isArray(o.payload))) throw bad2("BAD_PAYLOAD");
    if (o.token !== void 0 && (typeof o.token !== "string" || o.token.length > 400)) throw bad2("BAD_TOKEN");
    return o;
  }
  function versionLess(a, b) {
    const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0);
    }
    return false;
  }
  function processRequest(state, req, ctx) {
    const seen = state.recent.find((r) => r.id === req.requestId);
    if (seen) return { state, changed: false, code: "DUPLICATE_REQUEST", data: { duplicateOf: seen.r } };
    const action = req.action;
    if (action === "sync") {
      const { state: view, result: result2 } = applyCommand(state, { action, payload: {} }, ctx);
      view.revision = state.revision;
      view.recent = state.recent;
      view.stats = state.stats;
      return { state: view, changed: false, code: "OK", data: result2 };
    }
    if (req.expectedRevision !== state.revision) throw new GameError("VERSION_CONFLICT", "REVISION_MISMATCH");
    const { state: next, result } = applyCommand(state, { action, payload: req.payload }, ctx);
    next.revision = state.revision + 1;
    next.recent = [{ id: req.requestId, a: action, r: next.revision }, ...state.recent].slice(0, 40);
    return { state: next, changed: true, code: "OK", data: result };
  }
  return __toCommonJS(index_exports);
})();
