// 계산에 안 들어간 항목을 모으는 곳 — 모델을 표시용으로 바꾸는 변환이지 계산이 아니다.
//
// rune-app 에서 빼냈다. 소비자가 둘이 됐기 때문이다: 룬 상세 패널·결과 경고(rune-app)와
// 「계산 밖 항목」 전체 목록(limits-app). 한쪽에만 있으면 다른 쪽이 같은 판단을 다시
// 구현하게 되고, 그때부터 같은 룬이 화면마다 다르게 보인다.
//
// DOM 도 state 도 안 쓴다. 데이터만 받아 데이터를 돌려준다.
import { fieldLabel } from './gen/effect-fields.mjs';
import {
  RUNE_CONDITIONALS, POLLUTION_REDUCTION, NEGATIVE_TRAITS, STAT_BETTER_WHEN,
} from './rune-conditionals.mjs';

/** 강화 표기(`+`)를 뗀 기본 이름. 데이터는 기본 이름으로만 키를 잡는다. */
export const baseName = (n) => n.replace(/\+$/, '');

/** 한 룬에서 계산에 안 들어간 것들을 모은다. 상세 패널과 결과 경고가 같은 기준을 쓰도록 공용화한다. */
export function uncountedOf(rune) {
  const out = [];
  const modeled = RUNE_CONDITIONALS[rune.name] ?? RUNE_CONDITIONALS[baseName(rune.name)];
  // 모델에 있으면서도 계산에 못 넣는 항목(uncounted). 데이터가 스스로 밝힌 것이라
  // 여기서 문장을 다시 지어내지 않는다.
  //
  // 이게 없으면 '모델에 있는 룬' 이라는 이유로 조용히 넘어간다 — 무형이 그랬다.
  // 침식 조합에서는 수치 기여가 0 인데 화면에는 '옵션 없는 룬' 과 똑같이 보였다.
  for (const e of modeled ?? []) {
    if (!e.uncounted) continue;
    out.push({ kind: '직접 피해', text: `${e.label} — ${e.uncounted}` });
  }
  if (rune.conditionalRaw && !modeled) {
    for (const [f, v] of Object.entries(rune.conditionalRaw)) {
      out.push({ kind: '조건부', text: `${fieldLabel(f)} ${v}% — 발동 조건 미모델링, 0으로 계산` });
    }
  }
  if (rune.skillTypeBonuses) for (const b of rune.skillTypeBonuses) {
    out.push({ kind: '스킬한정', text: `${b.stat} ${b.value}% — 특정 스킬에만 적용` });
  }
  if (rune.uncountedEffects) for (const b of rune.uncountedEffects) {
    // 오염 지속시간 감소는 침식 사이클 계산에 이미 들어가 있다(POLLUTION_REDUCTION).
    // 여기 남겨두면 '계산 안 됨'으로 잘못 보이고, 보정 입력칸까지 생겨 이중 계산을 부른다.
    if (POLLUTION_REDUCTION[rune.name] !== undefined && /오염/.test(b.stat)) continue;
    const dir = b.direction ?? '증가';
    // 손해인지는 '감소' 인지가 아니라 **무엇이** 움직였는지가 정한다. 받는 피해는 줄면
    // 이득이고 늘면 손해다. '감소 = 손해' 로 두었더니 여신·녹슨 방패·맹세+ 의 「받는 피해
    // 감소」가 손해로 빨갛게 나오고, 반대로 무형의 「받는 피해 30% 증가」는 아무 표시도
    // 안 났다 — 페널티를 설명문에서 훑던 것과 같은 가정이 여기 남아 있었다.
    //
    // 어느 쪽이 좋은지는 스탯의 성질이므로 데이터가 한 번만 선언한다(STAT_BETTER_WHEN).
    // 표에 없는 스탯은 손해로 단정하지 않는다 — 없는 손해를 만드는 쪽이 더 나쁘다.
    // 빠진 스탯은 검증기가 막는다.
    const better = STAT_BETTER_WHEN[b.stat];
    out.push({
      kind: '유틸',
      text: `${b.stat} ${b.value}${b.unit ?? '%'} ${dir}${b.conditional ? ' (조건부)' : ''}`,
      neg: better !== undefined && (dir === '증가') !== (better === '높을수록'),
    });
  }
  // 페널티 — 계산에 안 들어간 나쁜 점. **설명문을 훑어서 짓지 않는다.**
  //
  // 예전에는 desc 를 '감소한다|사라진다' 로 훑었다. 무엇이 줄어드는지는 안 보므로 좋은 것이
  // 줄어드는 것까지 전부 페널티가 됐다 — 7건 중 4건이 오탐이었다(공허·다가옴+ 의 쿨감,
  // 위엄의 받는 피해 감소, 무형의 이동 속도 감소 해제). 그 문장들은 상세 패널 맨 위에
  // desc 로 이미 그대로 찍히는데, 세 줄 아래에서 같은 문장이 '페널티' 딱지를 달고 또 나왔다.
  // PLACEMENT.md 가 그래서 "부정 효과는 '감소' 로 훑으면 자동화가 안 된다" 고 적어 두었고,
  // 사람이 판단해 만든 목록은 NEGATIVE_TRAITS 하나뿐이다. 거기서 파생시킨다.
  //
  // 위에서 이미 부정 항목이 잡혔으면 붙이지 않는다. 부정 효과 대부분은 uncountedEffects 에
  // 수치까지 들어 있어서(「억눌린 충동」 이동 속도 15% 감소) 그쪽이 더 정확하다 —
  // 여기 남는 것은 수치로 적을 수 없어 산문으로만 말할 수 있는 것뿐이다.
  // 계산에 이미 들어간 페널티도 올리지 않는다. 「추적자」의 자기 강타 디버프는 음수 항으로
  // 모델링돼 있어서(min < 0) 점수에 반영된다 — 그걸 '계산 안 됨' 으로 적으면 거짓말이고,
  // 위의 오염 지속시간과 같은 이유로 이중 계산을 부른다. 부정 효과 배지는 그대로 붙는다.
  const modeledPenalty = (modeled ?? []).some((e) => e.field && e.min < 0);
  if (!modeledPenalty && !out.some((o) => o.neg)) {
    for (const t of Object.values(NEGATIVE_TRAITS)) {
      if (t.runes.includes(baseName(rune.name))) out.push({ kind: '페널티', text: t.desc, neg: true });
    }
  }
  return out;
}
