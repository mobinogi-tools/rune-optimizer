// 룬의 조건부 옵션 — 데이터를 해석하는 규칙과 수식.
//
// 데이터 자체는 data/rune-conditionals.json 으로 옮겼다. 수치를 고치려면 거기를 고치고
// `node tools/build-data.mjs` 를 돌려라. 이 파일에는 그 데이터를 쓰는 함수만 남는다.
//
// 각 조건부 옵션은 min / expected / max 세 값을 가진다.
//   min      = 발동하지 않을 때
//   expected = 기대값 (가동률 반영)
//   max      = 발동했을 때
//
// basis 는 expected 가 어디서 왔는지 나타낸다 — 이 구분이 중요하다.
//   'derived'   = 룬 텍스트만으로 계산된 값. 근거가 note 에 있다.
//   'playstyle' = 로테이션/콘텐츠에 따라 달라지는 값. uptime 을 사용자가 조절해야 한다.
//
// expectedFrom 은 기대값을 만드는 수식의 이름이다(castCycle / stacks / streak / erosion /
// hitTrigger). 수식 본체는 이 파일 아래쪽에 있고, 디스패치는 build-evaluator 가 한다.
// 수식은 데이터에 넣지 않는다 — 데이터 안의 표현식은 결국 eval 이거나 미니 인터프리터다.
export * from './gen/rune-conditionals-data.mjs';
// `export *` 는 이 파일 안에 이름을 만들지 않는다 — 아래 함수들이 쓰는 것은 따로 받는다.

// `export *` 는 재수출일 뿐 이 파일 안에 이름을 만들어 주지 않는다. 아래 함수들이 쓰는
// 이름은 전부 여기에 다시 적어야 한다 — 빠뜨리면 그 함수가 불릴 때 ReferenceError 로 터진다.
import {
  DRAGON_SIGIL, AWAKENING_RUNES, MAX_AWAKENING, CURSE_RUNES, MAX_CURSE,
  GIANT_FRAGMENT,
  EROSION_RUNES, RUNE_CONDITIONALS, NIGHT_BLESSING,
  TRANSCEND_EMBLEM, EROSION_SYSTEM, RUNE_FAMILY, DOT_APPLIER_RUNES,
} from './gen/rune-conditionals-data.mjs';
import { RUNES } from './runes-data.mjs';

/* 무방비(브레이크) 가정에 값이 걸리는 룬.
 *
 * 손으로 적은 목록이었는데 같은 사실이 데이터에도 있어서 두 벌이었고, 실제로 갈라졌다 —
 * 등대지기는 requiresVulnerable 만 받고 목록에 못 들어가, 계산에서는 값이 꺼지는데
 * 화면에는 이유가 안 떴다. 목록을 지우고 데이터에서 파생시킨다.
 *
 * 값이 무방비에 걸리는 경로는 둘이고, 손 목록은 그 둘을 뭉개고 있었다:
 *   1. requiresVulnerable — 평가기가 항목을 통째로 건너뛴다 (build-evaluator)
 *   2. break.* 필드 — calculateBreakG 가 무방비가 아니면 1 을 돌려주므로 값이 죽는다
 * 그래서 위엄·아귀처럼 플래그가 없는 룬도 여기 들어와야 맞다. */
const vulnerableDependent = (e) => e.requiresVulnerable === true || (e.field ?? '').startsWith('break.');
const dropPlus = (n) => n.replace(/\+$/, '');

export const VULNERABLE_RUNES = Object.freeze([...new Set([
  ...Object.entries(RUNE_CONDITIONALS)
    .filter(([, entries]) => entries.some(vulnerableDependent))
    .map(([name]) => dropPlus(name)),
  // 조건부로 모델링되지 않은 룬은 runes-data 쪽에 경로가 있다. 양쪽을 다 봐야 빠지지 않는다.
  ...RUNES.items
    .filter((r) => [...Object.keys(r.conditionalRaw ?? {}), ...Object.keys(r.alwaysOnExtra ?? {})]
      .some((k) => k.startsWith('break.')))
    .map((r) => dropPlus(r.name)),
])].sort((a, b) => a.localeCompare(b, 'ko')));

/**
 * 밤의 축복 — 직업별 트리거로 발동하는 버프.
 *
 * 가동률(15/60 = 25%)로 뭉뚱그리면 안 된다. 트리거가 '딜이 가장 세지는 타이밍'에 걸리기
 * 때문에, 그 15초는 나머지 45초보다 타당 데미지가 훨씬 크다. 그래서 평가기는 ON/OFF
 * 두 상태를 따로 계산한 뒤 시간으로 가중평균한다(= 타당 기대 데미지).
 *
 * 스킬 자체는 모든 직업이 같다 — 공격력 15%, 지속 15초, 재사용 60초.
 * 직업마다 다른 것은 '무엇이 이 스킬을 발동시키는가' 이고, 그 트리거 타이밍이
 * 마침 그 직업의 딜 최대 구간과 겹치면 값어치가 크게 올라간다.
 * 댄서는 트리거가 최종 데미지 +40% 구간에 걸려 있어서 그 40%를 보정으로 넣는다.
 * 다른 직업은 그 구간이 뭔지 확인되기 전까지 0 이다(= 공격력 15%만 계산).
 */


/**
 * 초월 엠블럼(추가타/치명타 5회 스택)의 가동률.
 *
 * 해석 B(보수적): 재사용 대기 시간 동안에는 스택이 쌓이지 않는다고 본다.
 *   주기 = 쿨 + 필요 스택 누적 시간,  가동률 = min(1, 지속 / 주기)
 * 쿨·지속·스택 수는 게임 툴팁 값이라 데이터에 있다(TRANSCEND_EMBLEM). 여기 숫자를
 * 다시 적지 않는다 — 패치로 바뀌면 데이터만 고쳐야 하고, 주석은 반드시 낡는다.
 * 해석 A(쿨 중에도 누적, 주기 = max(누적, 쿨))도 가능하나 확인되지 않았다.
 * 초당 2타에서는 두 해석 모두 100%라 결과가 같고, 타수가 낮을 때만 갈린다.
 * 해석 B 기준 100% 유지 최소 타수: 치명타 1.67/초, 추가타 1.39/초.
 *
 * @param {number} triggerRate 트리거 확률 (0~1). 치명타율 또는 추가타율.
 * @param {number} hitsPerSecond 초당 타수
 */
export function transcendEmblemUptime(triggerRate, hitsPerSecond) {
  const { durationSeconds, cooldownSeconds, stacksRequired } = TRANSCEND_EMBLEM;
  if (!(triggerRate > 0) || !(hitsPerSecond > 0)) return 0;
  const accumulate = stacksRequired / (hitsPerSecond * triggerRate);
  return Math.min(1, durationSeconds / (cooldownSeconds + accumulate));
}

/**
 * 용의 문장(Dragon Sigil) 계열.
 *
 * 이 룬들은 하나의 시스템이다. 셋으로 나뉜다.
 *   발동(enabler)  — 용의 문장을 켠다. 없으면 나머지 룬의 조건부가 전부 죽는다.
 *   연장(extender) — 지속시간을 +10초 늘린다.
 *   소비(consumer) — 활성화된 동안 효과만 받는다. 스스로 켜지도 늘리지도 못한다.
 *
 * 기본 지속 10초 / 재사용 20초 → 발동 룬만 있으면 가동률 50%.
 * 연장 룬을 1개 끼면 20초 지속 = 쿨 20초 → 100%.
 *
 * 제약: 이 계열은 최대 2개까지만 장착할 수 있다. 그래서 조합이 사실상 둘 중 하나다.
 *   발동 + 연장 → 가동률 100%. 단 소비 룬(돌 심장/번개 숨결)을 쓸 자리가 없다.
 *   발동 + 소비 → 소비 룬을 쓸 수 있으나 가동률 50%.
 * 즉 돌 심장·번개 숨결은 100% 가동률에 도달할 수 없다.
 */

/**
 * 각성의 룬 — 동시에 1개만 장착할 수 있다. (사용자 확인: 교차하는 사슬 ↔ 첫 번째 서약)
 *
 * 셋 다 구조가 같다: 상시 공격력 15% + 밤의 축복 활성화 시 3종 스탯 11~13% 증가.
 * 잊힌 맹약은 사용자가 직접 확인해준 것은 아니나 구조가 동일해 같은 계열로 본다.
 */

/**
 * 저주의 룬 — 착용은 되지만 동시에 하나만 발동한다(= 실질 1개 제한).
 * 시그니처는 '이동 속도 감소'다. 신화 룬 무형이 이 페널티를 없애준다.
 */

/**
 * 카브락 방어구 룬 — 모두 `유일 · 거신의 파편` 효과라 동시에 1개만 장착할 수 있다.
 * 카브락 엠블럼 원정대는 이 유일 효과가 아니므로 포함하지 않는다.
 */

/** 세트에 포함된 용의 문장 계열 룬 개수. */
export function countDragonSigil(runeNames) {
  const bn = (n) => n.replace(/\+$/, '');
  const fam = [...DRAGON_SIGIL.enablers, ...DRAGON_SIGIL.extenders, ...DRAGON_SIGIL.consumers];
  return runeNames.filter((n) => fam.includes(bn(n))).length;
}

/** 장착 제약 검사. 용의 문장 계열은 최대 2개. */
export function validateRuneSet(runeNames) {
  const bn = (n) => n.replace(/\+$/, '');
  const n = countDragonSigil(runeNames);
  if (n > DRAGON_SIGIL.maxEquipped) {
    return { valid: false, reason: `용의 문장 계열 ${n}개 — 최대 ${DRAGON_SIGIL.maxEquipped}개까지만 장착 가능` };
  }
  const aw = runeNames.filter((x) => AWAKENING_RUNES.includes(bn(x)));
  if (aw.length > MAX_AWAKENING) {
    return { valid: false, reason: `각성의 룬 ${aw.length}개(${aw.join(', ')}) — 1개만 장착 가능` };
  }
  const cu = runeNames.filter((x) => CURSE_RUNES.includes(bn(x)));
  if (cu.length > MAX_CURSE) {
    return { valid: false, reason: `저주의 룬 ${cu.length}개(${cu.join(', ')}) — 동시에 1개만 발동` };
  }
  const giant = runeNames.filter((x) => GIANT_FRAGMENT.runes.includes(bn(x)));
  if (giant.length > GIANT_FRAGMENT.maxEquipped) {
    return {
      valid: false,
      reason: `유일 효과 「거신의 파편」 ${giant.length}개(${giant.join(', ')}) — 1개만 장착 가능`,
    };
  }
  return { valid: true };
}

/** 계열은 이 셋뿐이다. 계열 이름을 검사하는 곳이 여럿이라 목록은 여기 하나만 둔다. */
export const FAMILIES = Object.freeze(['빛', '어둠', '용']);

/**
 * 세트에 든 계열별 룬 수. 빛·어둠·용 셋뿐이고 룬 하나는 많아야 한 계열이다.
 *
 * 새 룬들이 이 수를 조건으로 쓴다 — "용 계열 2개 이상", "빛 계열 수에 따라 3/7/12/18%",
 * "빛·어둠·용을 각각 2개 이상", "서로 다른 계열 1종마다".
 *
 * 계열이 없는 룬(신화·장신구·기본기+·쐐기돌·원정대)은 RUNE_FAMILY 에 없고 어디에도 안 세어진다.
 * **신화가 계열 없음이라는 것은 아직 추정이다**(표본 하나 — 가라앉은 왕국). 뒤집히면
 * 데이터만 고치면 되고 이 함수는 그대로다.
 */
export function familyCounts(runeNames) {
  // 표의 키는 강화 표기(+)를 뗀 기본 이름이다 — 다른 룬 목록들과 같은 관례다.
  // 한쪽만 떼면 '광채' 로 물었을 때 '광채+' 를 못 찾아 계열이 조용히 사라진다.
  const out = Object.fromEntries(FAMILIES.map((f) => [f, 0]));
  for (const n of runeNames) {
    const f = RUNE_FAMILY[n.replace(/\+$/, '')];
    if (f in out) out[f] += 1;
  }
  return out;
}

/** 장착은 됐지만 계열 수 조건을 못 채워 0으로 계산되는 룬 효과들. */
export function unmetFamilyConditions(runeNames) {
  const current = familyCounts(runeNames);
  const rows = [];
  for (const name of runeNames) {
    const base = name.replace(/\+$/, '');
    for (const e of RUNE_CONDITIONALS[name] ?? RUNE_CONDITIONALS[base] ?? []) {
      if (!e.field || !e.requiresFamily) continue;
      if (Object.entries(e.requiresFamily).every(([family, count]) => (current[family] ?? 0) >= count)) continue;
      rows.push({
        rune: name,
        id: e.id,
        label: e.label,
        required: e.requiresFamily,
        current: Object.fromEntries(Object.keys(e.requiresFamily).map((family) => [family, current[family] ?? 0])),
      });
    }
  }
  return rows;
}

/** 세트에 든 서로 다른 계열의 수(0~3). 쐐기돌이 이걸 쓴다. */
export function distinctFamilies(runeNames) {
  return Object.values(familyCounts(runeNames)).filter((n) => n > 0).length;
}

/**
 * 세트 구성으로부터 용의 문장 가동률을 계산한다.
 * 황동 날개는 '궁극기 사용 시' 발동이라 공격 발동보다 주기가 훨씬 길다 — 별도 확인 필요.
 */
export function dragonSigilUptime(runeNames) {
  const bn = (n) => n.replace(/\+$/, '');
  const names = runeNames.map(bn);
  const enablers = DRAGON_SIGIL.enablers.filter((e) => names.includes(e));
  if (!enablers.length) return 0;
  const attackTriggered = enablers.some((e) => e !== '황동 날개');
  if (!attackTriggered) return 0.5; // 궁극기 발동만 있는 경우 — 보수적으로 둔다
  const ext = DRAGON_SIGIL.extenders.filter((e) => names.includes(e)).length;
  const duration = DRAGON_SIGIL.baseDurationSeconds + DRAGON_SIGIL.extenderSeconds * ext;
  return Math.min(1, duration / DRAGON_SIGIL.cooldownSeconds);
}

/**
 * 'N회 적중하면 M초 버프' 형태의 가동률.
 * 주기 = 재사용대기 + 누적시간(= 필요타수/초당타수),  가동률 = min(1, 지속/주기)
 * 재사용 대기가 없으면 cooldownSeconds = 0.
 */
export function hitTriggerUptime({ hitsRequired, durationSeconds, cooldownSeconds = 0 }, hitsPerSecond) {
  if (!(hitsPerSecond > 0)) return 0;
  const cycle = cooldownSeconds + hitsRequired / hitsPerSecond;
  return Math.min(1, durationSeconds / cycle);
}

/**
 * 쿨감 룬 목록(COOLDOWN_RUNES). 데이터가 갖는 것은 **이 룬이 쿨감 룬이라는 사실**뿐이고,
 * 값은 사람이 정한다 — 프로필의 `cooldownRuneDamagePercent`(전투 상황 칸).
 *
 * 예전에는 룬마다 '데미지 % 환산' 값을 들고 있었는데 두 가지가 틀렸다. 룬별로 곱해서
 * 둘을 끼면 1.15×1.15 로 불어났고(쿨감은 그렇게 안 겹친다), 단위가 다른 둘을 같은
 * 자리에 두었다 — 햇살+ 는 비율이고 공허는 '스킬 8회마다 3초' 라 절대 시간이다.
 * 지금은 세트에 하나라도 있으면 최종 데미지에 한 번만 붙는다.
 *
 * 값을 정할 근거(실측 방법과 그 한계)는 데이터의 note 에 있다.
 */

/**
 * 룬 이름 → 조건부 옵션 목록.
 * field 는 calculator.mjs 의 빌드 경로와 1:1로 대응한다.
 */

/**
 * 룬 고유 효과 중 상시 발동이지만 `src/runes-data.mjs` 의 alwaysOn* 필드로는
 * 담기지 않는 것들(공증/피증 외 스탯). 필요한 룬만 손으로 채운다.
 */
// 지금은 비어 있다. 공증/피증 외 상시 스탯은 이미 runes-data.mjs 의 alwaysOnExtra 에
// 들어 있어서 손으로 적을 필요가 없다. 빠진 룬이 보이면 여기에 추가하면 평가기가
// 얹어서 반영한다 — runes-data.mjs 를 직접 고치는 것보다 이쪽이 되돌리기 쉽다.

/**
 * 부정 효과 분류. 후보에서 걸러내기 위한 것이다.
 *
 * 자동 추출이 아니라 손으로 골랐다. '감소' 로 훑으면 '받는 피해 감소'(이득),
 * '오염 지속시간 감소'(이득), '재사용 대기 시간 3초 감소'(이득)까지 딸려와 쓸 수 없다.
 * 데미지 공식에 안 잡히지만 실제로 불편한 것만 담는다.
 */

/** 오염(침식 300 도달 시 패널티) 지속시간을 줄여주는 룬. 값은 감소 %. */

// 침식 시스템 수치는 전부 게임 툴팁 값이라 데이터에 있다(EROSION_SYSTEM).

/**
 * 침식 계열 룬의 기대값.
 *
 * 침식 룬을 여러 개 끼면 카운터가 그만큼 빨리 차서 오염에 더 자주 걸린다(사용자 확인).
 * 그래서 침식 룬은 겹칠수록 개당 효율이 떨어진다.
 *
 *   기대값 = (누적 계수 × base) / (오염 임계 + r × D),  r = 초당 증가량 × 침식룬수
 *
 * 수치(증가량·임계·배수·오염 지속)는 게임 툴팁 값이라 EROSION_SYSTEM 에 있다.
 * 누적 계수도 임계값에서 파생시킨다 — 예전에는 500 이 상수로 박혀 있었는데,
 * 그건 임계 100·300 과 배수 2 로 계산되는 값이라 임계를 고치면 조용히 틀려진다.
 *
 * @param {number} base 침식 부여 중 기본 수치 (배수 구간 진입 전 값)
 * @param {number} pollutionReductionPercent 오염 지속시간 감소 %
 * @param {number} erosionRuneCount 세트에 포함된 침식 룬 개수
 */
export function erosionExpected(base, pollutionReductionPercent = 0, erosionRuneCount = 1) {
  if (erosionRuneCount <= 0) return 0;
  const {
    ratePerRunePerSecond, pollutionSeconds, boostThreshold, pollutionThreshold, boostMultiplier,
  } = EROSION_SYSTEM;
  const rate = ratePerRunePerSecond * erosionRuneCount; // 룬마다 +rate/초 (사용자 확인)
  const pollution = pollutionSeconds * (1 - pollutionReductionPercent / 100);
  // 0→boost 구간은 base, boost→pollution 구간은 base×배수, 이후 오염 동안 0.
  // 누적 = (boost + (pollution임계 − boost) × 배수) / r × base
  const accumulated = boostThreshold + (pollutionThreshold - boostThreshold) * boostMultiplier;
  return (accumulated * base) / (pollutionThreshold + rate * pollution);
}

/**
 * 침식 사이클 중 "침식 수치가 100 미만이거나 오염 상태" 인 시간 비중.
 *
 * 삼키는 모래가 이 구간에서만 연타 피해를 더 준다. erosionExpected 와 같은 사이클을
 * 다른 각도로 볼 뿐이라 상수를 새로 만들지 않는다:
 *
 *   0 → 100(boostThreshold)   조건 O   100/r 초
 *   100 → 300(pollutionThreshold) 조건 X   200/r 초
 *   오염                        조건 O   pollution 초
 *
 *   비중 = (boost/r + pollution) / (pollution임계/r + pollution)
 *
 * 오염 동안 카운터는 멈춘다 — 그래서 한 사이클이 300/r + pollution 이다(사용자 확인,
 * 2026-08-23. 침식 룬 1개면 60+15=75초). 오염 중에도 카운터가 돌았다면 오염 15초가
 * 0→100 구간 안에 들어가 사이클이 60초가 되고, 비중이 46.7% 대신 33.3% 로 떨어진다.
 * 분모와 조건 구간이 함께 움직이므로 어느 쪽이든 에러 없이 그럴듯한 값이 나온다.
 *
 * 침식 룬을 더 끼면 r 이 커져 카운터가 빨리 차고, 그만큼 오염 구간의 비중이 늘어
 * 이 값도 올라간다. 침식 룬이 없으면 사이클 자체가 없다 — 호출하는 쪽에서 막는다.
 *
 * ⚠ 이건 시간 평균이다. 실제로는 "지금 어느 구간이냐" 로 켜지고 꺼진다.
 *   침식을 구간별로 다루게 되면 여기도 같이 고쳐야 한다.
 */
export function erosionWindowUptime(pollutionReductionPercent = 0, erosionRuneCount = 1) {
  if (erosionRuneCount <= 0) return 0;
  const {
    ratePerRunePerSecond, pollutionSeconds, boostThreshold, pollutionThreshold,
  } = EROSION_SYSTEM;
  const rate = ratePerRunePerSecond * erosionRuneCount;
  const pollution = pollutionSeconds * (1 - pollutionReductionPercent / 100);
  return (boostThreshold / rate + pollution) / (pollutionThreshold / rate + pollution);
}

/**
 * '연속 성공으로 쌓이고 한 번 실패하면 0으로 떨어지는' 스택의 기대 중첩 수.
 *
 * 거대한 분노가 이 형태다 — 강타 적중마다 +1, 강타가 아닌 공격이 들어오면 즉시 해제.
 * 계승자처럼 정해진 순서로 순환하는 것과 달리 확률 과정이라, 마르코프 체인의
 * 정상분포로 푼다. 상태 i(=현재 연속 성공 수, 상한 max)에서
 *   확률 p 로 i+1, 확률 1-p 로 0.
 * 어느 상태에서든 1-p 로 0 이 되므로 π₀ = 1-p 이고, 그 뒤는 등비로 이어진다.
 *   π_k = p^k (1-p)   (k < max),   π_max = p^max
 * (검산: (1-p)(1+p+…+p^(max-1)) + p^max = 1)
 *
 * @param {number} successRate 0~1 사이의 성공 확률(예: 강타율)
 * @param {number} maxStacks 상한 중첩
 */
export function streakStackExpected(successRate, maxStacks) {
  const p = Math.min(1, Math.max(0, successRate));
  if (!(maxStacks > 0)) return 0;
  if (p >= 1) return maxStacks;
  let e = 0;
  for (let k = 1; k < maxStacks; k++) e += k * Math.pow(p, k) * (1 - p);
  return e + maxStacks * Math.pow(p, maxStacks);
}


/**
 * 게임 플레이 조건 태그. 부정 효과(NEGATIVE_TRAITS)와 달리 '나쁜 룬'이 아니라
 * '켜려면 무언가를 해야 하는 룬'을 묶은 것이다.
 *
 * 특수 트리거는 기본적으로 후보에서 제외한다 — 체력을 낮게 유지하거나 일부러 맞아주는
 * 플레이를 전제하는데, 대부분의 사람에게는 해당하지 않아 켜두면 추천이 왜곡된다.
 */

/**
 * 지속 피해(도트)가 걸린 적을 때려야 켜지는 룬들.
 * 도트를 쓰는 구성이 드물지 않아 기본 제외는 하지 않는다.
 */

/**
 * 이 세트가 스스로 남기는 도트 종류.
 *
 * 도트는 두 곳에서 온다 — **직업이 상시로 거는 것**(댄서의 전환 룬처럼 스킬 자체가 건다)과
 * **세트에 낀 부여 룬**. 앞쪽은 사람이 캐릭터 화면에서 정하고, 뒤쪽은 세트만 보면 알 수
 * 있으므로 여기서 자동으로 더한다. 룬을 꼈는데 체크를 또 해야 한다면 그건 물어볼 필요가
 * 없는 것을 묻는 것이다.
 *
 * 목록이 낡으면 조용히 틀린다 — 부여 룬이 빠져 있으면 광채+·암운+ 가 0 으로 잡히는데
 * 화면에는 아무 신호가 없다. 실제로 황혼 숨결(절망)과 전환+(화상·빙결)이 빠져 있었다.
 */
export function dotsFromRunes(runeNames) {
  const out = new Set();
  for (const n of runeNames) {
    const types = DOT_APPLIER_RUNES[n] ?? DOT_APPLIER_RUNES[dropPlus(n)];
    if (types) for (const t of types) out.add(t);
  }
  return out;
}

/**
 * 「적 N명 처치 시」 계단. 문턱을 넘긴 마지막 단의 값이다.
 * 문턱 아래면 0 — 5명 문턱에 4명이면 아무것도 안 붙는다.
 */
export function killStepValue(thresholds, steps, killCount) {
  let v = 0;
  for (let i = 0; i < thresholds.length; i++) if (killCount >= thresholds[i]) v = steps[i] ?? v;
  return v;
}

/**
 * 「전투 시작 시 N초 동안」 버프가 한 판에서 차지하는 시간 비중.
 * 판이 창보다 짧으면 판 내내 켜져 있으므로 1 이다.
 */
export function fightWindowUptime(windowSeconds, fightSeconds) {
  if (!(fightSeconds > 0)) return 1;
  return Math.min(1, windowSeconds / fightSeconds);
}

/**
 * 전투 시간에 따라 차오르는 중첩의 **평균**. 마지막 중첩이 아니라 평균이어야 한다 —
 * 데미지는 판 내내 나가지 다 찬 뒤에만 나가는 것이 아니다.
 *
 * startStacks 에서 시작해 secondsPerStack 마다 하나씩, maxStacks 에서 멈춘다.
 * 램프 구간은 선형이라 평균이 (start+max)/2 이고, 그 뒤는 max 로 평평하다.
 */
export function stackRampAverage({ startStacks, maxStacks, secondsPerStack }, fightSeconds) {
  if (!(fightSeconds > 0)) return maxStacks;
  const rampSeconds = Math.max(0, maxStacks - startStacks) * secondsPerStack;
  if (fightSeconds >= rampSeconds) {
    const rampArea = ((startStacks + maxStacks) / 2) * rampSeconds;
    return (rampArea + maxStacks * (fightSeconds - rampSeconds)) / fightSeconds;
  }
  // 다 차기 전에 판이 끝난다. 램프 위 사다리꼴의 평균 = 시작 + 오른 만큼의 절반.
  return startStacks + (fightSeconds / secondsPerStack) / 2;
}

/**
 * 파티에서 무엇을 하고 있는가 — 도발 · 아군 치유 · 둘 다 아님.
 *
 * 사슬로 묶은 법전이 "하나의 효과만 적용" 이라 세 갈래가 배타적이다. 그래서 켜고 끄는
 * 게이트가 아니라 **시간 비중**으로 받는다.
 *
 * 도발은 직업이 정한다(전투 숙련 수호 = 기사·빙결술사·전사). 치유는 숙련과 안 겹쳐서
 * (기사·악사도 아군을 치유한다) 직업이 기본값만 주고 사람이 바꾼다.
 *
 * **기사는 둘 다 한다.** 실제로 어느 쪽을 더 하는지는 사람과 판마다 다르고 잴 방법이
 * 없어서 중립 가정인 반반으로 둔다. 불확실한 값임은 화면에 밝힌다.
 */
export function roleShares({ taunts = false, heals = false } = {}) {
  if (taunts && heals) return { taunt: 0.5, heal: 0.5, none: 0 };
  if (taunts) return { taunt: 1, heal: 0, none: 0 };
  if (heals) return { taunt: 0, heal: 1, none: 0 };
  return { taunt: 0, heal: 0, none: 1 };
}

/** 이 룬 항목이 쓸 수 있는 갈래 이름. 오타는 share[이름] 이 undefined 라 조용히 0 이 된다. */
export const PARTY_ROLES = Object.freeze(['taunt', 'heal', 'none']);

/** 무방비(브레이크)를 유효하게 계산할 때만 값이 붙는 룬들. */


/**
 * 무형의 분기. 원문이 "순서대로 하나의 효과만 적용"이라 우선순위가 있다.
 *   저주 > 침식 > 용의 문장 > (없음)
 * 세트만 보면 답이 정해지므로 기대값을 추측할 필요가 없다.
 *
 * 여기서 돌려주는 이름 하나하나가 데이터의 `branch` 값과 짝이어야 한다. 짝이 없는 분기로
 * 떨어지면 그 룬은 아무 효과도 못 내는데, 화면에는 '옵션 없음'과 구분되지 않아 그냥
 * 조용히 0 이 된다. 검증기(validate-data)가 짝 없는 분기를 잡는다.
 */
export const FORMLESS_BRANCHES = Object.freeze(['curse', 'erosion', 'dragon', 'none']);

export function formlessBranch(runeNames) {
  const bn = (n) => n.replace(/\+$/, '');
  const names = runeNames.map(bn);
  if (names.some((n) => CURSE_RUNES.includes(n))) return 'curse';
  if (names.some((n) => EROSION_RUNES.includes(n))) return 'erosion';
  const fam = [...DRAGON_SIGIL.enablers, ...DRAGON_SIGIL.extenders, ...DRAGON_SIGIL.consumers];
  if (names.some((n) => fam.includes(n))) return 'dragon';
  return 'none';
}

/** 침식 수치를 쌓는 룬들. 개수만큼 초당 증가량이 빨라진다. */

/** 조건부 옵션이 없는(스킬 변형만 하는) 착용 룬 — 명시해 두면 누락과 구분된다. */

/**
 * 저장된 룬 조정값의 키를 라벨에서 id 로 옮긴다.
 *
 * 조정값은 원래 한국어 라벨을 키로 저장했다. 그래서 라벨 문구를 다듬는 순수 UI 수정이
 * 조회를 빗나가게 만들어, 사용자가 넣어둔 값이 아무 경고 없이 기본값으로 되돌아갔다.
 * id 는 문구와 무관하므로 앞으로는 라벨을 고쳐도 조정값이 살아남는다.
 *
 * SCHEMA_VERSION 을 올려 저장분을 통째로 버리는 길은 택하지 않았다 — 그러면 같은 저장소에
 * 들어 있는 측정값·장비 설정까지 함께 날아가는데, 이건 키 하나 이름이 바뀐 일일 뿐이다.
 *
 * 대응되는 id 를 못 찾은 옛 키는 그대로 둔다. 지워봐야 되살릴 방법이 없고, 남아 있어도
 * 조회는 id 로만 하므로 계산에 끼어들지 않는다. 데이터에서 사라진 옵션이 나중에 같은 id 로
 * 돌아올 수도 있다.
 *
 * @param {Record<string, {utility?: number, cond?: Record<string, number>}>} overrides
 * @returns {{overrides: object, changed: boolean}} 이행한 사본과, 실제로 바뀐 것이 있는지
 */
export function migrateConditionalOverrideKeys(overrides) {
  const bn = (n) => n.replace(/\+$/, '');
  let changed = false;
  const out = {};
  for (const [rune, ov] of Object.entries(overrides ?? {})) {
    const entries = RUNE_CONDITIONALS[rune] ?? RUNE_CONDITIONALS[bn(rune)];
    if (!ov?.cond || !entries) { out[rune] = ov; continue; }
    const ids = new Set(entries.map((e) => e.id));
    const byLabel = new Map(entries.map((e) => [e.label, e.id]));
    // 이미 id 로 저장된 값을 먼저 확정한다. 라벨 키는 이행 전에 쓰던 값이라, 나중에 훑어야
    // 사용자가 이행 후에 넣은 값을 옛 값으로 되돌리지 않는다(저장 순서에 결과가 안 끌려간다).
    const cond = {}, old = {};
    for (const [key, value] of Object.entries(ov.cond)) {
      if (ids.has(key)) cond[key] = value; else old[key] = value;
    }
    for (const [key, value] of Object.entries(old)) {
      const id = byLabel.get(key);
      if (id === undefined || cond[id] !== undefined) { cond[key] = value; continue; }
      cond[id] = value;
      changed = true;
    }
    out[rune] = { ...ov, cond };
  }
  return { overrides: out, changed };
}
