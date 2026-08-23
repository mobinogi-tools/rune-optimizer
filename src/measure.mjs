// 측정 — 스탯창 두 번 읽어 깡공(A)과 룬 외 공증을 가른다.
//
// 스탯창 공격력 = A × (1 + (공증룬 합 + 룬 외 공증)/100) 이다.
// 스탯창은 **합만** 보여주므로 한 번 읽어서는 룬 몫과 그 외 몫을 못 가른다.
// 공증룬 구성이 다른 두 상태를 읽으면 미지수 2개(A · 룬 외)에 식이 2개가 되어 풀린다.
//
//   A       = 100 × (스탯창₁ − 스탯창₂) ÷ (공증합₁ − 공증합₂)
//   룬 외    = 100 × (스탯창₁ ÷ A − 1) − 공증합₁
//
// 재는 방법은 기억각인으로 공증 룬을 상시 공증이 없는 룬으로(또는 그 반대로) 바꾸는 것이다.
// '룬을 뺀다' 고 적으면 안 된다 — 게임에 그런 동작이 없어서 무엇을 하라는 말인지 알 수 없다.
//
// 공증합은 **사용자가 직접 적는다.** 착용 목록에서 자동으로 더하지 않는다 —
// 그러려면 측정 전에 착용 목록부터 채우게 해야 하는데, 측정이 첫 단계라 순서가 뒤집힌다.
// 손으로 적으면 초월도 문제가 안 된다. 게임에 뜨는 실제 %를 그대로 더하면 되기 때문이다.
//
// 예전에는 '기준 룬 하나를 빼거나 넣는' 방식이었다. 그 룬의 %를 데이터에서 찾아 쓰다 보니
// 초월한 룬을 기준으로 잡으면 값이 어긋났고, 나머지 룬 공증은 **착용 목록**에서 빼왔다.
// 그 목록이 실제와 다르면 룬 외 공증이 조용히 틀어졌고, 음수가 되면 측정이 통째로 풀렸다.
// 두 쌍을 받으면 목록도 데이터 조회도 필요 없다.

/** 스탯창에 안 뜨는 것을 더하면 안 된다 — 조건부 공증이 대표적이다. 화면 안내와 짝이다. */
export const RUNE_PERCENT_HINT =
  '조건이 붙지 않은 "공격력 N% 증가"만 더하세요. 조건부 공증은 스탯창에 뜨지 않습니다.';

/**
 * 두 번의 읽기에서 A 와 룬 외 공증을 구한다.
 *
 * @param {{attack:number, runePercent:number}} a 첫 번째 읽기
 * @param {{attack:number, runePercent:number}} b 두 번째 읽기
 * @returns {{ok:boolean, attackA?:number, nonRunePercent?:number, totalPercent?:number,
 *            error?:string, detail?:string, spread?:number}}
 */
export function solveMeasurement(a, b) {
  const nums = [a?.attack, a?.runePercent, b?.attack, b?.runePercent];
  if (nums.some((v) => !Number.isFinite(v))) return { ok: false, error: 'incomplete' };
  if (!(a.attack > 0) || !(b.attack > 0)) return { ok: false, error: 'nonpositive' };
  if (a.runePercent < 0 || b.runePercent < 0) return { ok: false, error: 'negative-rune' };

  const spread = a.runePercent - b.runePercent;
  if (spread === 0) {
    return {
      ok: false,
      error: 'same-percent',
      detail: '두 읽기의 공증룬 합이 같습니다. 공증룬 구성을 다르게 한 두 상태를 재야 합니다.',
    };
  }
  // 공증이 큰 쪽이 공격력도 커야 한다. 어긋나면 두 줄이 뒤바뀌었거나 값을 잘못 읽은 것이다.
  if (Math.sign(a.attack - b.attack) !== Math.sign(spread)) {
    return {
      ok: false,
      error: 'direction',
      detail: '공증룬 합이 더 큰 쪽의 공격력이 더 커야 합니다. 두 줄이 뒤바뀌지 않았는지 확인해 주세요.',
      spread,
    };
  }
  const attackA = (100 * (a.attack - b.attack)) / spread;
  const totalPercent = (a.attack / attackA - 1) * 100;
  const nonRunePercent = totalPercent - a.runePercent;

  // 룬 외 공증이 음수면 물리적으로 불가능하다 — 인챈트·아티팩트가 공증을 깎지는 않는다.
  // 낙폭이 과하게 잡혔거나 공증합을 실제보다 크게 적은 것이다.
  // -1 까지 봐주는 것은 스탯창이 정수로 잘려 생기는 오차 때문이다.
  if (nonRunePercent < -1) {
    return {
      ok: false, error: 'negative-nonrune', attackA, totalPercent, nonRunePercent, spread,
      detail: `두 값으로 역산하면 총 공증이 ${totalPercent.toFixed(2)}% 인데 공증룬 합이 ` +
        `${a.runePercent}% 라, 룬 외 공증이 ${nonRunePercent.toFixed(2)}% (음수)가 됩니다. ` +
        '공격력을 잘못 읽었거나, 공증합에 조건부 공증을 더했을 수 있습니다.',
    };
  }
  return { ok: true, attackA, nonRunePercent, totalPercent, spread };
}

/**
 * 이 측정의 정밀도. 두 상태의 공증 차이가 작을수록 오차가 커진다.
 *
 * 스탯창은 정수로 잘리므로 각 읽기에 ±1 의 오차가 있다. A 의 오차는 그것을 공증 차이로
 * 나눈 값이라, 차이가 1%p 면 ±200 까지 벌어진다(16%p 면 ±13). 큰 차이로 재라고 말해주려면
 * 이 수치가 있어야 한다 — "정확히 재세요" 는 무엇을 하라는 말인지 알 수 없다.
 *
 * @returns {{attackError:number, weak:boolean}}
 */
export function measurementPrecision(spread) {
  const attackError = Math.abs((100 * 2) / spread);
  return { attackError, weak: Math.abs(spread) < 5 };
}

/**
 * 측정 이후 아티팩트가 **실제로** 바뀌었는가.
 *
 * 아티팩트는 공증(B)뿐 아니라 깡공(A)까지 바꾸므로(개당 133, 실측) 진짜로 바뀌었다면
 * 측정값이 통째로 못 쓰게 된다. 그래서 경고가 필요하다.
 *
 * 다만 **"내가 폼을 채운 것" 과 "게임에서 바뀐 것" 은 다르다.** 측정을 먼저 하고 아티팩트를
 * 나중에 입력하는 것이 자연스러운 순서인데(측정이 ① 단계다), 그걸 변경으로 읽으면 아무것도
 * 안 바꾼 사람에게 "다시 측정해 주세요" 가 뜬다. 실제로 그렇게 떴다.
 *
 * 측정할 때 아무것도 안 적혀 있었으면(`''`) 비교할 대상이 없다 — 그때 무엇을 끼고 있었는지
 * 앱은 모른다. 모르는 것을 바뀌었다고 말하지 않는다. 옛 저장분처럼 서명 자체가 없는 경우도
 * 같다. 괜한 경고는 진짜 경고까지 같이 무시하게 만든다.
 *
 * @param {unknown} atMeasure 측정 시점의 아티팩트 서명
 * @param {string} now 지금의 아티팩트 서명
 */
export function artifactsChanged(atMeasure, now) {
  if (typeof atMeasure !== 'string' || atMeasure === '') return false;
  return atMeasure !== now;
}

/* 간이 측정 — 공증룬 **하나**만 바꿔서 잰다. 물어보는 것은 세 가지뿐이다.
 *
 * 사람들이 막힌 자리는 산수가 아니라 **「지금 공증룬 합」** 이었다. 자기 룬을 다 뒤져
 * 조건부는 빼고 초월은 반영해서 더해야 하는데, 그 한 칸에서 대부분이 멈췄다.
 * 그래서 아예 안 묻는다. 나머지 공증 룬 몫은 **룬 외 공증에 섞여 들어간다.**
 *
 *   뺐다:  ① (지금 공격력, p)      ② (뺀 뒤 공격력, 0)
 *   넣었다: ① (넣은 뒤 공격력, p)   ② (지금 공격력, 0)
 *
 * 깡공(A)은 이래도 정확하다 — 차분에서 나머지 공증이 약분되기 때문이다.
 * **틀리는 것은 룬 외 공증이다.** 다른 공증 룬이 거기 섞여 실제보다 크게 잡히고,
 * 그러면 공증 항의 기저가 부풀어 공증 룬의 상대 가치가 눌린다. 재보니 룬 외 공증이
 * 25% → 102% 로 잡히고 추천 세트가 달라졌다(공증합 97%, 바꾼 룬 20% 인 경우).
 *
 * 그래도 두는 이유는 하나다 — **아무것도 못 재는 것보다 낫다.** 정확히 재고 싶으면
 * 두 쌍 모드가 있고, 화면이 그렇게 안내한다.
 *
 * 풀이는 두 쌍 방식과 **같은 함수**를 쓴다. 산수를 두 벌로 두면 한쪽만 고쳐지는 날이 온다.
 *
 * @param {{attackNow:number, attackAfter:number, runePercent:number,
 *          direction:'removed'|'added'}} v
 */
export function singleRunePair(v) {
  const { attackNow, attackAfter, runePercent: p, direction } = v ?? {};
  if (![attackNow, attackAfter, p].every(Number.isFinite)) return null;
  if (!(p > 0)) return null;
  return direction === 'added'
    ? { a: { attack: attackAfter, runePercent: p }, b: { attack: attackNow, runePercent: 0 } }
    : { a: { attack: attackNow, runePercent: p }, b: { attack: attackAfter, runePercent: 0 } };
}
