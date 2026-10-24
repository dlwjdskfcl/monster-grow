/**
 * 보스전 시뮬레이션 (결정적: 같은 상태 + 같은 seed → 같은 결과). 서버가 실행해 승패·보상을 확정하고,
 * 클라이언트는 돌려받은 기록(log)을 재생만 함.
 *
 * 규칙 요약
 *  - 편대 앞 2칸 = 앞줄, 나머지 = 뒷줄. 보스는 앞줄부터 노림
 *  - 매 라운드 속도 순으로 행동. 스킬 대기가 0이면 스킬, 아니면 기본 공격
 *  - 피해 = 공격 효율 × 100 / (100 + 방어력)
 *    공격 효율 = 공격력 × 스킬 배율 × 공명 보정(조율 강화) × 환경 보정(같은 지역 +10%) × 연쇄(균열 중 +30%)
 *  - 보스 방어 패턴: 경화(방어 ×2.5) · 평상 · 돌진(앞줄 강타) · 포자(전원) · 폭풍(전원, 방벽 절반 무시)
 *  - 30 라운드 안에 보스 체력 0 → 승리
 * 숫자: 모두 같은 배율(10^scale)로 나눠 계산 → 크기가 커져도 결과는 같음 (방어력은 배율과 무관)
 */
import { CREATURE_BY_ID } from './data';
import { bossStats, creatureStats } from './formulas';
import { PlayerState } from './state';

export type Ev = [number, number, string, number, number];   // [라운드, 행동자(-1=보스), 종류, 대상(-1=보스, 9=전원), 수치]

export interface BattleResult {
  win: boolean; rounds: number; seed: number; scale: number;
  team: { id: string; max: number; hp: number }[]; boss: { id: string; name: string; max: number; tier: number };
  log: Ev[];
}

export function rng(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const MAX_ROUNDS = 30;
const r1 = (x: number) => Math.round(x * 10) / 10;

export function simulateBoss(s: PlayerState, seed: number): BattleResult {
  const boss = bossStats(s.gates);
  const ids = s.team.filter((id) => s.creatures[id]);
  const st = ids.map((id) => creatureStats(s, id));
  const scale = Math.floor(Math.max(boss.lHp, ...st.map((x) => x.lHp))) - 6;
  const val = (l: number) => Math.pow(10, l - scale);
  const rand = rng(seed);
  const vary = () => 0.95 + rand() * 0.1;

  const units = ids.map((id, i) => {
    const d = CREATURE_BY_ID[id];
    const lvSkill = s.creatures[id].skill;
    return {
      i, id, role: d.role, front: i < 2, spd: st[i].spd + i * 0.01,
      atk: val(st[i].lAtk) * (d.region === boss.region ? 1.1 : 1),
      max: val(st[i].lHp), hp: val(st[i].lHp), def: st[i].def, shield: 0,
      cd: Math.max(0, d.skill.cd - 1), skill: d.skill, sp: 1 + 0.15 * lvSkill
    };
  });
  const B = { hp: val(boss.lHp), max: val(boss.lHp), atk: val(boss.lAtk), def: boss.def, crack: 0, crackPow: 0 };
  let buff = 0, buffT = 0;
  const log: Ev[] = [];
  let round = 0;

  const alive = () => units.filter((u) => u.hp > 0);
  const hitBoss = (u: typeof units[number], mult: number, r: number, kind: string) => {
    const pat = boss.pattern[(r - 1) % boss.pattern.length];
    let def = B.def * (B.crack > 0 ? 1 - B.crackPow : 1);
    if (pat === 'harden') def *= 2.5;
    const eff = u.atk * mult * (1 + buff) * (B.crack > 0 ? 1.3 : 1) * vary();
    const dmg = eff * 100 / (100 + def);
    B.hp = Math.max(0, B.hp - dmg);
    log.push([r, u.i, kind, -1, r1(dmg)]);
  };
  const hurt = (u: typeof units[number], dmg: number, r: number, pierce: number) => {
    let d = dmg * 100 / (100 + u.def);
    const absorb = Math.min(u.shield * (1 - pierce), d);
    u.shield -= absorb; d -= absorb;
    u.hp = Math.max(0, u.hp - d);
    log.push([r, -1, 'hit', u.i, r1(d)]);
  };

  for (round = 1; round <= MAX_ROUNDS && B.hp > 0 && alive().length; round++) {
    const pat = boss.pattern[(round - 1) % boss.pattern.length];
    const order = [...alive(), 'boss' as const].sort((a, b) => (b === 'boss' ? boss.spd : b.spd) - (a === 'boss' ? boss.spd : a.spd));
    for (const a of order) {
      if (B.hp <= 0 || !alive().length) break;
      if (a === 'boss') {
        const front = alive().filter((u) => u.front);
        const tgt = front[0] || alive()[0];
        if (pat === 'charge') { for (const u of (front.length ? front : [tgt])) hurt(u, B.atk * 1.5 * vary(), round, 0); }
        else if (pat === 'spore') { for (const u of alive()) hurt(u, B.atk * 0.6 * vary(), round, 0); }
        else if (pat === 'storm') { for (const u of alive()) hurt(u, B.atk * 0.8 * vary(), round, 0.5); }
        else hurt(tgt, B.atk * vary(), round, 0);
        continue;
      }
      const u = a;
      if (u.hp <= 0) continue;
      if (u.cd <= 0) {
        u.cd = u.skill.cd;
        if (u.role === 'guard') {
          const amt = u.max * u.skill.power * u.sp;
          for (const t of alive().filter((x) => x.front || x === u)) t.shield = Math.max(t.shield, amt);
          log.push([round, u.i, 'shield', 9, r1(amt)]);
        } else if (u.role === 'striker') {
          for (let h = 0; h < (u.skill.hits || 1); h++) hitBoss(u, u.skill.power * u.sp, round, 'skill');
        } else if (u.role === 'tuner') {
          buff = Math.max(buff, u.skill.power * u.sp); buffT = 2;
          for (const t of units) if (t !== u) t.cd = Math.max(0, t.cd - 1);
          log.push([round, u.i, 'buff', 9, Math.round(buff * 100)]);
        } else {
          B.crack = 2; B.crackPow = Math.min(0.9, u.skill.power * (1 + 0.05 * (u.sp - 1) / 0.15));
          hitBoss(u, 1.2, round, 'crack');
        }
      } else {
        u.cd -= 1;
        hitBoss(u, 1, round, 'atk');
      }
    }
    if (buffT > 0 && --buffT === 0) buff = 0;
    if (B.crack > 0) B.crack -= 1;
  }
  return {
    win: B.hp <= 0, rounds: round - 1, seed, scale,
    team: units.map((u) => ({ id: u.id, max: r1(u.max), hp: r1(u.hp) })),
    boss: { id: boss.id, name: boss.name, max: r1(B.max), tier: boss.tier },
    log: log.slice(0, 400)
  };
}
