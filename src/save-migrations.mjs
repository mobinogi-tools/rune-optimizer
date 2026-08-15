// 저장분의 모양이 바뀔 때 옛 모양을 새 모양으로 한 번 바꾸는 자리.
//
// `load()` 안에 두면 테스트가 못 부른다 — localStorage 와 DOM 을 타기 때문이다.
// 이행이 틀리면 실패가 조용하다. 사용자가 재놓은 값이 사라지거나 다른 값으로 바뀌는데,
// 화면에는 그럴듯한 숫자가 떠 있어 아무 신호가 없다. 그래서 순수 함수로 떼어 검사한다.
// (조정값 키 이행은 rune-conditionals.mjs 에 먼저 같은 이유로 나와 있다.)

/**
 * 측정을 '두 번 읽기' 모양으로 옮긴다.
 *
 * 옛 모양은 `기준 룬 하나를 빼거나 넣은` 방식이었다 — 현재 공격력·기준 룬·그 공증%·방향·
 * 그때 공격력. 나머지 룬 공증은 **착용 목록에서** 가져왔다. 그래서 목록이 실제와 다르면
 * 룬 외 공증이 조용히 틀어졌고, 음수가 되면 멀쩡한 측정이 통째로 풀렸다.
 *
 * 새 모양은 (공격력, 그때의 공증룬 합) 두 쌍이다. 목록도 룬 데이터 조회도 필요 없다.
 *
 * **값이 변하면 안 된다.** 사용자는 자기가 잰 값이 틀어졌다고 읽는다. 그래서 공격력 두 개는
 * 사용자가 넣은 것을 그대로 쓰고, 공증합은 옛 코드가 **이미 쓰고 있던 그 값**을 되살린다.
 * 그러면 새 식으로 다시 풀어도 깡공과 룬 외 공증이 옛 값과 같아진다.
 *
 * @param {object} saved 저장분
 * @param {(name:string) => number} attackPercentOf 룬 이름 → 상시 공증 %
 * @returns {{state: object, changed: boolean}}
 */
export function migrateMeasureToPairs(saved, attackPercentOf) {
  const m = saved?.measure;
  if (!m || m.a || m.b) return { state: saved, changed: false }; // 이미 새 모양

  const blank = { a: { attack: null, runePercent: null }, b: { attack: null, runePercent: null } };
  const drop = () => ({
    state: { ...saved, measure: { ...blank, nonRunePercent: null, attackA: null, at: null, committed: false, artifactSig: m.artifactSig ?? '' } },
    changed: true,
  });

  const p = m.removedPercent;
  if (!Number.isFinite(m.current) || !Number.isFinite(m.removedAttack) || !(p > 0)) return drop();

  // 옛 computeMeasure 가 '현재 공격력' 시점의 룬 공증 합으로 쓰던 값을 그대로 되살린다.
  // 기준 룬을 골랐다면 그 룬만 입력된 %로 센다(초월했으면 데이터값이 틀리기 때문).
  const base = Array.isArray(m.equippedAtMeasure) ? m.equippedAtMeasure : (saved.equipped ?? []);
  const removed = m.direction !== 'added';
  const others = m.removedRune
    ? base.filter((n) => n !== m.removedRune).reduce((sum, n) => sum + attackPercentOf(n), 0)
    : base.reduce((sum, n) => sum + attackPercentOf(n), 0);
  // 기준 룬이 켜져 있던 쪽의 합에는 그 룬의 %도 들어간다.
  //
  // 옛 코드는 목록에서 이름을 고른 경우에만 이걸 더했고, 기본값인 '초월 룬 등 — % 직접 입력'
  // 을 쓰면 빼먹었다. 그래서 그 룬의 공증이 통째로 「룬 외 공증」으로 잘못 넘어갔다.
  // 여기서 바로잡으므로, 그 기본값으로 잰 저장분은 이행 뒤 룬 외 공증이 그 룬의 % 만큼
  // 줄어든다. 옛 값을 지키는 것보다 맞는 값을 주는 편이 낫다 — 틀린 룬 외 공증은
  // 공증룬의 가치를 실제보다 낮게 만든다.
  const r1 = removed ? others + p : others;
  const r2 = removed ? others : others + p;
  // 공증합이 음수인 쌍은 새 모양으로 표현할 수 없다. 옛 '기타/초월 장비' 선택처럼 기준이
  // 룬인지 아닌지 모호했던 저장분에서만 나온다. 그럴듯한 숫자를 지어내느니 다시 재게 한다.
  if (r2 < 0 || r1 < 0) return drop();

  return {
    state: {
      ...saved,
      measure: {
        a: { attack: m.current, runePercent: r1 },
        b: { attack: m.removedAttack, runePercent: r2 },
        nonRunePercent: m.nonRunePercent ?? null,
        attackA: m.attackA ?? null,
        at: m.at ?? null,
        committed: !!m.committed,
        artifactSig: m.artifactSig ?? '',
      },
    },
    changed: true,
  };
}
