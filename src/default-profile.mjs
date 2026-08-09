// 처음 열었을 때의 프로필.
//
// rune-app.mjs 가 import 하므로 빌드가 dist 로 복사한다 — 여기 적는 값은 곧 배포되는 값이다.
import { JOB_MASTERY } from './combat-mastery.mjs';
import { uptimePassive, nightBlessingCycleSeconds } from './class-passives.mjs';
import { NIGHT_BLESSING } from './rune-conditionals.mjs';

/* 처음 선택돼 있는 직업. 직업이 정하는 값(숙련·주기)의 기준이 되므로,
 * data/jobs 에 파일이 있는 직업이어야 한다. */
const DEFAULT_JOB = '댄서';

export const DEFAULT_PROFILE = Object.freeze({
  // 스탯창과 전투 패턴은 **전부 0 으로 시작한다.**
  //
  // 예전에는 댄서 샘플로 채워 두었는데, 남의 숫자가 칸에 들어 있으면 사람들은 그게 자기
  // 값이 아니라는 걸 알아채지 못한 채 결과를 믿는다. 6,300 처럼 그럴듯한 값일수록 더 그렇다.
  // 0 은 "안 넣었다" 가 눈에 보이고, 채우는 길은 두 개나 있다 — 스샷으로 채우기, 샘플값 버튼.
  //
  // 0 이어도 계산은 안 깨진다(0 나눗셈·NaN 없음). 다만 발동률이 0 이면 그 강화 수치가
  // D 항에 안 들어가는데, 그건 버그가 아니라 "안 알려줬으니 안 센다" 가 맞다.
  rapidEnhance: 0,
  heavyEnhance: 0,
  areaEnhance: 0,
  comboEnhance: 0,
  ultimateEnhance: 0,
  criticalStat: 0,
  breakStat: 0,
  extraHitStat: 0,
  skillPower: 0,
  hitsPerSecond: 0,
  skillCastsPerSecond: 0,
  rapidRatePercent: 0,
  heavyRatePercent: 0,
  characterCriticalRatePercent: 0,
  characterExtraRatePercent: 0,

  // 직업이 정하는 값 — 개인 수치가 아니라 그 직업의 모양이다.
  combatMastery: JOB_MASTERY[DEFAULT_JOB] ?? null,
  // 유지형 직업 패시브(검술사 집중 등)의 가동률. 해당 패시브가 없는 직업이면 안 쓰인다.
  classPassiveUptimePercent: uptimePassive(DEFAULT_JOB)?.defaultUptimePercent ?? 100,
  // 주기는 직업의 트리거 간격에서 파생된다. 숫자를 여기 적어두면 data/jobs 의 간격을
  // 고쳤을 때 같이 안 바뀌어 조용히 어긋난다 — 그래서 계산해서 넣는다.
  nightBlessingCycleSeconds: nightBlessingCycleSeconds(DEFAULT_JOB, NIGHT_BLESSING.cooldownSeconds),
  // 광역(멀티 대상) 판정이 뜨는 비율. 0 이면 광역 강화 수치가 D 에 안 들어간다.
  // 단일 대상 보스전 기준이라 0. 잡몹 광역 위주면 올려 잡는다.
  areaRatePercent: 0,
  isUltimate: false,
  comboTier: 0,

  // 측정(① 단계)으로 채우는 값. 사람마다 달라서 기본값을 주면 안 된다.
  nonRuneAttackPercent: 0,
  nonRuneDamagePercent: 0,

  // 장비에서 오는 값. 마찬가지로 비워 두고 사용자가 넣는다.
  helioPercent: 0,
  artifactDamagePercent: 0,
  artifactCriticalRatePercent: 0,
  artifactExtraRatePercent: 0,
  artifactRapidDamagePercent: 0,
});
