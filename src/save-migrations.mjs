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
/**
 * 각성 구간 직업 버프를 **자리마다 고치는 맵**으로 옮긴다.
 *
 * 거쳐온 모양이 둘이다.
 *
 *   ① `nightBlessingClassScalePercent` — 직업 표 전체에 곱하는 배율. 자리는 표가 정했고
 *      사람은 크기만 줄일 수 있었다. `표값 × 배율` 을 자리별로 그대로 옮기면 **숫자가
 *      하나도 안 변한다.**
 *   ② `nightBlessingFinalDamagePercent` — 최종 데미지 한 칸. 자리를 합치려던 시도였는데,
 *      피증 100% 를 최종 데미지로 옮기려면 자기 B 값을 알아야 해서 틀린 길이었다.
 *      적어둔 값은 최종 데미지 자리에 그대로 넣는다.
 *
 * 옛 키는 지운다. 같은 뜻의 칸이 둘 남으면 언젠가 이중으로 더해진다.
 *
 * @param {object} profile state.profile (제자리에서 고친다)
 * @param {object} classEffects 그 직업의 밤축 표 (CLASS_NIGHT_BLESSING[job]?.effects)
 */
export function migrateNightBlessingScale(profile, classEffects) {
  if (!profile) return profile;
  const scale = profile.nightBlessingClassScalePercent;
  const flat = profile.nightBlessingFinalDamagePercent;
  delete profile.nightBlessingClassScalePercent;
  delete profile.nightBlessingFinalDamagePercent;
  // 이미 새 모양이면 건드리지 않는다. 두 번 돌면 사용자가 고친 값을 덮어쓴다.
  if (profile.nightBlessingEffects !== undefined) return profile;
  if (Number.isFinite(flat)) {
    profile.nightBlessingEffects = flat > 0 ? { 'finalDamage.percent': flat } : {};
    return profile;
  }
  if (!Number.isFinite(scale)) return profile; // 손댄 적이 없으면 직업 표 기본값으로 시작한다
  const out = {};
  for (const [path, v] of Object.entries(classEffects ?? {})) out[path] = (v * scale) / 100;
  profile.nightBlessingEffects = out;
  return profile;
}

/**
 * 각성 구간 버프에서 **이제는 없는 항목**을 버린다.
 *
 * 직업 기본값에서 항목을 빼면(암흑술사의 치확을 상시 쪽으로 옮긴 것처럼) 이미 저장된
 * 프로필에는 그 값이 남는다. 그러면 화면에 유령 칸이 뜨고, 바로 위 설명은 "기본값이
 * 없습니다" 라 서로 어긋난다.
 *
 * 화면에서 지우게 만들 일이 아니다 — 쓸모가 없어진 값이므로 열 때 버린다.
 * 사람이 일부러 넣을 수 있는 항목은 **최종 데미지 하나뿐**이라(그 칸만 늘 떠 있다),
 * 기본값에도 없고 최종 데미지도 아닌 항목은 반드시 옛 기본값의 잔재다.
 *
 * @param {object} profile state.profile (제자리에서 고친다)
 * @param {object} classEffects 그 직업의 기본값 (CLASS_NIGHT_BLESSING[job]?.effects)
 * @param {string} alwaysPath 늘 띄우는 항목의 경로
 */
export function pruneNightBlessingEffects(profile, classEffects, alwaysPath) {
  const eff = profile?.nightBlessingEffects;
  if (!eff) return profile;
  const keep = new Set([...Object.keys(classEffects ?? {}), alwaysPath]);
  for (const path of Object.keys(eff)) if (!keep.has(path)) delete eff[path];
  return profile;
}

/**
 * 저장분을 열 때 측정 화면으로 시작할지 정한다.
 *
 * **확정한 측정이 있을 때만** 측정 화면이다. 「측정」을 눌러 폼을 열어 두기만 하고
 * 확정하지 않은 것은 잰 적이 있는 것이 아니라 재려다 만 것이고, 그 상태가 새로고침을
 * 넘어가면 다음에 열 때 큰 폼부터 보게 된다 — 기본은 안 재는 쪽인데 정반대다.
 *
 * 재던 방식은 `prevMode` 로 남긴다. 「측정」을 다시 누르면 그 화면으로 돌아가고 적어둔
 * 숫자도 그대로다 — 버리는 것이 아니라 접어두는 것이다.
 *
 * 새 객체를 돌려주지 않고 받은 것을 고친다(load 가 이미 만든 사본을 넘긴다).
 * @param {object} measure state.measure
 */
export function settleMeasureMode(measure) {
  if (!measure) return measure;
  if (!measure.committed) {
    if (measure.mode && measure.mode !== 'none') measure.prevMode = measure.mode;
    measure.mode = 'none';
  } else if (!measure.mode) {
    // mode 가 아예 없던 옛 저장분. 확정한 값이 있으니 재는 화면으로 연다.
    measure.mode = 'pairs';
  }
  return measure;
}

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

/**
 * 쿨감 룬의 룬별 「유틸 보정」을 세트 단위 칸으로 옮긴다.
 *
 * 쿨감 룬(햇살+·공허)은 예전에 룬마다 환산 % 를 들고 있었고 사람이 그 칸을 덮어쓸 수
 * 있었다. 지금은 값이 프로필 한 칸(cooldownRuneDamagePercent)으로 갔고, 룬 상세에는
 * 그 칸이 없다. 옮기지 않으면 **사람이 일부러 넣은 숫자가 아무 말 없이 사라진다.**
 *
 * 여럿이면 가장 큰 값을 쓴다. 더하면 예전의 곱하기와 같은 병(둘을 끼면 불어남)이
 * 되돌아오고, 그걸 피하려고 세트 단위로 옮긴 것이기 때문이다.
 *
 * 옮긴 뒤에는 그 자리를 지운다. 쓸모없어진 값을 남겨두면 다음에 보는 사람이
 * "이건 왜 있지" 를 다시 묻는다.
 *
 * @param profile 프로필(제자리에서 고친다)
 * @param overrides state.overrides (제자리에서 고친다)
 * @param cooldownRuneNames 쿨감 룬 이름들(COOLDOWN_RUNES 의 키)
 * @returns 옮겼으면 true
 */
export function migrateCooldownUtility(profile, overrides, cooldownRuneNames) {
  const base = (n) => n.replace(/\+$/, '');
  const names = new Set(cooldownRuneNames.flatMap((n) => [n, base(n)]));
  let moved = null;
  for (const [rune, ov] of Object.entries(overrides ?? {})) {
    if (!names.has(rune) && !names.has(base(rune))) continue;
    if (Number.isFinite(ov?.utility)) {
      if (moved === null || ov.utility > moved) moved = ov.utility;
      delete ov.utility;
      if (!Object.keys(ov).length) delete overrides[rune];
    }
  }
  if (moved === null) return false;
  // 이미 사람이 새 칸에 값을 넣었으면 그것이 우선이다 — 옛 값으로 덮지 않는다.
  if (!(profile.cooldownRuneDamagePercent > 0)) profile.cooldownRuneDamagePercent = moved;
  return true;
}

/**
 * 「룬 외 피증」에 남아 있는 값을 버린다.
 *
 * 그 입력칸은 없앴다 — 저장소가 아는 피증 출처는 전부 자기 경로가 따로 있고(헬리오도르·
 * 아티팩트·직업 버프·룬), 남는 출처를 아무도 못 댔기 때문이다.
 *
 * **칸만 감추고 값을 두면 더 나쁘다.** 화면 어디에도 안 보이는 숫자가 계산에는 계속
 * 들어가고, 룬 피증과 같은 가산 그룹이라 피증 룬의 순위를 조용히 흔든다. 고칠 방법도
 * 없다 — 칸이 없으니 0 으로 되돌릴 수가 없다.
 *
 * @returns 버렸으면 true
 */
export function pruneNonRuneDamage(profile) {
  if (!profile || !(profile.nonRuneDamagePercent > 0)) return false;
  profile.nonRuneDamagePercent = 0;
  return true;
}
