/**
 * 게임 정의 데이터 (오리지널) — 이름·설명·외형 파라미터는 이 프로젝트에서 새로 만든 것
 * 세계관: 생태 핵이 무너진 부유 대륙을 되살리는 탐사단. 생명체 = '공명체', 수집 = 서식지 복원 + 공명 계약
 * 밸런스 수치는 초안 (docs/04_게임시스템_명세.md 의 시뮬레이션 표 참고). 운영 중 조정은 GameConfig 시트의 배율로.
 */

export type Role = 'guard' | 'striker' | 'tuner' | 'shifter';
export type RegionId = 'mycel' | 'glass' | 'storm';
export type Trait = 'atk' | 'surv' | 'auto' | 'off';
export type ResearchKey = 'gather' | 'offline' | 'harmony' | 'instinct' | 'sense';

export interface SkillDef { name: string; desc: string; power: number; cd: number; hits?: number }
export interface Look {
  body: 'blob' | 'shell' | 'crystal' | 'jelly' | 'wisp' | 'serpent';
  c1: string; c2: string; eye: 1 | 2 | 3; mark: 'none' | 'spots' | 'stripes' | 'rings' | 'facets';
  crest: 'none' | 'cap' | 'fins' | 'spikes' | 'antenna' | 'halo';
}
export interface CreatureDef {
  id: string; name: string; role: Role; region: RegionId;
  atk: number; hp: number; def: number; spd: number;
  skill: SkillDef; look: Look;
  nature: string; habitat: string; lore: string;
  starter?: boolean;
  contract: { shards: number; materials: number };
}

export const ROLE_NAME: Record<Role, string> = { guard: '전위', striker: '공격', tuner: '조율', shifter: '변환' };
export const ROLE_DESC: Record<Role, string> = {
  guard: '앞줄에서 피해를 받아내고 방벽을 세움',
  striker: '강한 단일·범위 피해',
  tuner: '편대 강화와 재사용 대기 단축',
  shifter: '적 방어 패턴을 깨뜨리고 연쇄 공명을 일으킴'
};

export const REGIONS: { id: RegionId; name: string; desc: string; from: number; to: number; bg: [string, string]; env: string }[] = [
  { id: 'mycel', name: '균사림', desc: '빛나는 균사가 숲을 엮은 첫 탐사지', from: 1, to: 20, bg: ['#123d2c', '#2f7a55'], env: '습윤' },
  { id: 'glass', name: '유리 사막', desc: '모래가 녹아 굳은 유리 언덕과 신기루', from: 21, to: 40, bg: ['#4a3517', '#c2903e'], env: '건조' },
  { id: 'storm', name: '폭풍 해안', desc: '번개가 그치지 않는 부유 대륙의 끝자락', from: 41, to: 60, bg: ['#14233f', '#3d6fa8'], env: '폭풍' }
];

/** 지역 보스 — 깊이 20·40·60 에 관문. 60 이후는 20마다 세 보스가 '변이 n단계'로 반복 (무한 확장) */
export const BOSSES = [
  { id: 'b_rotking', name: '부패 균핵', region: 'mycel' as RegionId, pattern: ['harden', 'normal', 'spore'], desc: '숲의 생태 핵을 삼킨 거대한 균핵' },
  { id: 'b_sandmaw', name: '열사 아가리', region: 'glass' as RegionId, pattern: ['normal', 'charge', 'harden'], desc: '유리 모래 아래에서 입을 벌리는 포식자' },
  { id: 'b_galecore', name: '폭풍 심장', region: 'storm' as RegionId, pattern: ['charge', 'harden', 'storm'], desc: '해안 위 번개 구름의 중심' }
];

export const CREATURES: CreatureDef[] = [
  // 균사림
  { id: 'c01', name: '이끼등', role: 'guard', region: 'mycel', atk: 6, hp: 60, def: 14, spd: 3, starter: true,
    skill: { name: '포자 방벽', desc: '자신과 앞줄에 최대 체력 18% 방벽', power: 0.18, cd: 3 },
    look: { body: 'shell', c1: '#4f8a4b', c2: '#c9e8a2', eye: 2, mark: 'spots', crest: 'cap' },
    nature: '느긋함', habitat: '젖은 쓰러진 나무 밑', lore: '등의 이끼가 무성할수록 더 단단해진다.', contract: { shards: 0, materials: 0 } },
  { id: 'c02', name: '포롱', role: 'striker', region: 'mycel', atk: 14, hp: 30, def: 5, spd: 6, starter: true,
    skill: { name: '포자 폭발', desc: '대상에게 공격력 220% 피해', power: 2.2, cd: 3 },
    look: { body: 'blob', c1: '#e27a9b', c2: '#ffd3e0', eye: 2, mark: 'spots', crest: 'antenna' },
    nature: '덜렁댐', habitat: '균사 꽃이 핀 바닥', lore: '놀라면 몸속 포자를 한꺼번에 내뿜는다.', contract: { shards: 0, materials: 0 } },
  { id: 'c03', name: '실타래', role: 'tuner', region: 'mycel', atk: 8, hp: 38, def: 7, spd: 5, starter: true,
    skill: { name: '균사 연결', desc: '편대 공격력 +25% (2턴), 재사용 대기 1 감소', power: 0.25, cd: 4 },
    look: { body: 'wisp', c1: '#d9c27a', c2: '#fff6cf', eye: 1, mark: 'rings', crest: 'halo' },
    nature: '세심함', habitat: '나무 사이에 걸린 빛 실', lore: '동료의 기척을 실로 이어 하나의 박자로 만든다.', contract: { shards: 0, materials: 0 } },
  { id: 'c04', name: '등불갓', role: 'shifter', region: 'mycel', atk: 10, hp: 34, def: 6, spd: 4,
    skill: { name: '균열 포자', desc: '적에게 균열(방어 -50%, 2턴)', power: 0.5, cd: 3 },
    look: { body: 'blob', c1: '#5a62c9', c2: '#a9f0ff', eye: 3, mark: 'none', crest: 'cap' },
    nature: '호기심', habitat: '가장 어두운 균사 동굴', lore: '갓에서 나는 빛이 단단한 껍질의 틈을 비춘다.', contract: { shards: 300, materials: 0 } },
  // 유리 사막
  { id: 'c05', name: '규사갑', role: 'guard', region: 'glass', atk: 9, hp: 95, def: 22, spd: 2,
    skill: { name: '유리 장벽', desc: '자신과 앞줄에 최대 체력 24% 방벽', power: 0.24, cd: 3 },
    look: { body: 'shell', c1: '#c79a5b', c2: '#f6e3b8', eye: 2, mark: 'facets', crest: 'spikes' },
    nature: '고집셈', habitat: '유리 언덕 그늘', lore: '모래를 삼켜 등껍질에 유리 비늘을 키운다.', contract: { shards: 6e4, materials: 5 } },
  { id: 'c06', name: '프리즘핀', role: 'striker', region: 'glass', atk: 24, hp: 44, def: 7, spd: 7,
    skill: { name: '굴절 광선', desc: '적에게 공격력 160% 피해 ×2회', power: 1.6, cd: 4, hits: 2 },
    look: { body: 'crystal', c1: '#62c6d9', c2: '#e9fbff', eye: 1, mark: 'facets', crest: 'fins' },
    nature: '성급함', habitat: '햇빛이 모이는 유리 첨탑', lore: '몸을 지나는 빛을 날카로운 칼날로 바꾼다.', contract: { shards: 9e4, materials: 8 } },
  { id: 'c07', name: '신기루새', role: 'tuner', region: 'glass', atk: 12, hp: 50, def: 9, spd: 8,
    skill: { name: '아지랑이 노래', desc: '편대 공격력 +30% (2턴), 재사용 대기 1 감소', power: 0.3, cd: 4 },
    look: { body: 'wisp', c1: '#e7a35a', c2: '#fff0d6', eye: 2, mark: 'stripes', crest: 'fins' },
    nature: '명랑함', habitat: '열기 위의 공중', lore: '노랫소리가 닿는 곳마다 공기가 흔들린다.', contract: { shards: 1.2e5, materials: 10 } },
  { id: 'c08', name: '결정뱀', role: 'shifter', region: 'glass', atk: 15, hp: 48, def: 9, spd: 6,
    skill: { name: '결정 침식', desc: '적에게 균열(방어 -60%, 2턴)', power: 0.6, cd: 3 },
    look: { body: 'serpent', c1: '#9b6bd1', c2: '#efe0ff', eye: 2, mark: 'facets', crest: 'spikes' },
    nature: '신중함', habitat: '유리 모래 속 통로', lore: '닿는 것을 결정으로 바꿔 부서지기 쉽게 만든다.', contract: { shards: 1.5e5, materials: 12 } },
  // 폭풍 해안
  { id: 'c09', name: '조개보루', role: 'guard', region: 'storm', atk: 12, hp: 150, def: 32, spd: 2,
    skill: { name: '해무 보루', desc: '자신과 앞줄에 최대 체력 30% 방벽', power: 0.3, cd: 3 },
    look: { body: 'shell', c1: '#5d7f9e', c2: '#dcecf7', eye: 2, mark: 'rings', crest: 'spikes' },
    nature: '침착함', habitat: '파도가 부서지는 바위', lore: '폭풍이 칠수록 껍데기를 더 굳게 닫는다.', contract: { shards: 4e7, materials: 30 } },
  { id: 'c10', name: '뇌운포', role: 'striker', region: 'storm', atk: 40, hp: 62, def: 10, spd: 8,
    skill: { name: '낙뢰 방전', desc: '적에게 공격력 300% 피해', power: 3.0, cd: 4 },
    look: { body: 'jelly', c1: '#f2d14b', c2: '#fffbe0', eye: 1, mark: 'stripes', crest: 'antenna' },
    nature: '변덕스러움', habitat: '번개 구름 아래 수면', lore: '몸에 모은 정전기를 한순간에 풀어놓는다.', contract: { shards: 6e7, materials: 40 } },
  { id: 'c11', name: '파도노래', role: 'tuner', region: 'storm', atk: 16, hp: 70, def: 12, spd: 7,
    skill: { name: '밀물 합창', desc: '편대 공격력 +35% (2턴), 재사용 대기 1 감소', power: 0.35, cd: 4 },
    look: { body: 'jelly', c1: '#4fb3a6', c2: '#dffaf4', eye: 2, mark: 'rings', crest: 'fins' },
    nature: '다정함', habitat: '해안 동굴의 물웅덩이', lore: '파도의 박자에 맞춰 동료의 숨을 고른다.', contract: { shards: 8e7, materials: 45 } },
  { id: 'c12', name: '와류꼬리', role: 'shifter', region: 'storm', atk: 22, hp: 66, def: 12, spd: 7,
    skill: { name: '소용돌이 균열', desc: '적에게 균열(방어 -70%, 2턴)', power: 0.7, cd: 3 },
    look: { body: 'serpent', c1: '#3f5fc9', c2: '#cfe0ff', eye: 3, mark: 'stripes', crest: 'fins' },
    nature: '장난기', habitat: '소용돌이 바다', lore: '꼬리를 돌려 적의 자세를 흐트러뜨린다.', contract: { shards: 1e8, materials: 50 } }
];

export const CREATURE_BY_ID: Record<string, CreatureDef> = Object.fromEntries(CREATURES.map((c) => [c.id, c]));

export const TRAITS: Record<Trait, { name: string; desc: string }> = {
  atk: { name: '공격', desc: '공격력 +25%' },
  surv: { name: '생존', desc: '체력·방어 +25%' },
  auto: { name: '자동화', desc: '탐사 생산량 +8%' },
  off: { name: '야영', desc: '정산 한도 +1시간' }
};

export const RESEARCH: Record<ResearchKey, { name: string; desc: string; base: number; growth: number; max: number }> = {
  gather: { name: '채집 효율', desc: '탐사 생산량 +15% / 단계', base: 80, growth: 1.9, max: 1e9 },
  offline: { name: '야영 기술', desc: '오프라인 한도 +1시간 / 단계 (최대 16)', base: 500, growth: 3.2, max: 16 },
  harmony: { name: '공명 조율', desc: '편대 공격력 +12% / 단계', base: 120, growth: 2.0, max: 1e9 },
  instinct: { name: '생존 본능', desc: '편대 체력 +12% / 단계', base: 120, growth: 2.0, max: 1e9 },
  sense: { name: '재료 감지', desc: '복원 재료 획득 +20% / 단계', base: 2000, growth: 2.6, max: 1e9 }
};

/** 운영에서 바꿀 수 있는 설정 (GameConfig 시트가 덮어씀). 클라이언트는 서버가 보낸 값만 씀 */
export interface GameConfig {
  configVersion: number;
  offlineCapHours: number;     // 기본 오프라인 한도
  prodMult: number;            // 생산 배율 (이벤트용)
  maxTeam: number;
  minTeamForBoss: number;
  rebuildMinDepth: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  configVersion: 1,
  offlineCapHours: 8,
  prodMult: 1,
  maxTeam: 5,
  minTeamForBoss: 3,
  rebuildMinDepth: 40
};
