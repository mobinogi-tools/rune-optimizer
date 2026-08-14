// 저장분의 모양이 바뀔 때 옛 모양을 새 모양으로 한 번 바꾸는 자리.
//
// `load()` 안에 두면 테스트가 못 부른다 — localStorage 와 DOM 을 타기 때문이다.
// 이행이 틀리면 실패가 조용하다. 사용자가 재놓은 값이 사라지거나 다른 값으로 바뀌는데,
// 화면에는 그럴듯한 숫자가 떠 있어 아무 신호가 없다. 그래서 순수 함수로 떼어 검사한다.
// (조정값 키 이행은 rune-conditionals.mjs 에 먼저 같은 이유로 나와 있다.)

/**
 * 측정 시점의 착용 목록을 저장분에 채운다.
 *
 * 룬 외 공증은 `총 공증 − 그때 낀 룬의 공증` 이라서, 그 목록이 측정의 일부다.
 * 예전에는 이걸 안 남기고 **매번 지금 착용으로 다시 뺐다.** 그래서 룬을 끼울 때마다
 * 룬 외 공증이 깎였다. 이제 확정 시점에 목록을 남기는데, 이미 저장된 사람에게는 그게 없다.
 *
 * 지금 착용을 그때 목록으로 삼는다. 옛 동작이 어차피 지금 착용으로 계산하고 있었으므로
 * **화면의 룬 외 공증이 한 자리도 안 움직인다.** 이행하면서 값이 변하면 사용자는 자기가
 * 잰 값이 틀어졌다고 읽는다 — 그건 이행이 아니라 사고다.
 *
 * 확정 전(`committed` 이 아님)이면 아무것도 하지 않는다. 그건 아직 측정이 아니다.
 *
 * @param {object} saved 저장분
 * @returns {{state: object, changed: boolean}}
 */
export function migrateMeasureBaseline(saved) {
  const m = saved?.measure;
  if (!m?.committed || Array.isArray(m.equippedAtMeasure)) return { state: saved, changed: false };
  return {
    state: { ...saved, measure: { ...m, equippedAtMeasure: [...(saved.equipped ?? [])] } },
    changed: true,
  };
}
