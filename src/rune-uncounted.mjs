// 계산에 안 들어간 항목을 모으는 곳 — 모델을 표시용으로 바꾸는 변환이지 계산이 아니다.
//
// rune-app 에서 빼냈다. 소비자가 둘이 됐기 때문이다: 룬 상세 패널·결과 경고(rune-app)와
// 「계산 밖 항목」 전체 목록(limits-app). 한쪽에만 있으면 다른 쪽이 같은 판단을 다시
// 구현하게 되고, 그때부터 같은 룬이 화면마다 다르게 보인다.
//
// DOM 도 state 도 안 쓴다. 데이터만 받아 데이터를 돌려준다.
import { fieldLabel } from './gen/effect-fields.mjs';
import { RUNE_CONDITIONALS, POLLUTION_REDUCTION } from './rune-conditionals.mjs';

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
    out.push({ kind: '유틸', text: `${b.stat} ${b.value}% ${b.direction ?? '증가'}${b.conditional ? ' (조건부)' : ''}`, neg: b.direction === '감소' });
  }
  // 페널티 — 데미지 계산에 반영되지 않는 제약·감소 효과.
  // 이미 모델에 들어간 것(침식 오염 사이클 등)과 위에서 잡은 유틸 항목은 중복이라 뺀다.
  // 이미 모델에 들어간 문장은 페널티로 잡지 않는다.
  // '오염의 지속 시간 감소'는 이득인데 '감소한다'에 걸려 페널티로 오인된다(영원한 밤).
  const MODELED_PENALTY = /침식 수치가|오염되며|오염의 지속 시간/;
  for (const line of rune.desc.split('\n')) {
    const t = line.trim();
    if (!/감소한다|받을 수 없|잃는다|사라진다/.test(t)) continue;
    if (MODELED_PENALTY.test(t)) continue;
    // "이동 속도 15% 감소" 를 유틸로 이미 잡았으면 문장 페널티는 생략한다.
    const dup = out.some((o) => {
      const stat = o.text.match(/^([가-힣 ]+?)\s+[\d.]+%/)?.[1]?.trim();
      return stat && t.includes(stat) && /감소/.test(o.text);
    });
    if (dup) continue;
    out.push({ kind: '페널티', text: t, neg: true });
  }
  return out;
}
