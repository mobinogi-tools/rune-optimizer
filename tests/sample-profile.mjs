// 테스트가 쓰는 '현실적인 캐릭터'.
//
// DEFAULT_PROFILE 은 이제 **빈 양식**이다 — 스탯창과 전투 패턴이 전부 0 이다. 남의 숫자가
// 칸에 들어 있으면 자기 값이 아닌 걸 모른 채 결과를 믿기 때문이다.
//
// 그래서 테스트가 DEFAULT_PROFILE 을 그대로 쓰면 안 된다. 발동률이 0 이면 연타·강타 강화가
// D 항에 아예 안 들어가고, 그러면 '이 경로가 점수를 움직이는가' 같은 검사가 통과할 수 없다.
// 골든 점수도 0 투성이 입력으로 굳으면 무엇을 지키는지 알 수 없어진다.
//
// 검사 대상은 '기본값이 무엇인가' 가 아니라 '계산이 맞는가' 다. 그래서 여기서는 직업 샘플을
// 얹어 실제로 있을 법한 캐릭터를 만든다. 샘플이 바뀌면 골든 점수도 같이 바뀌는데, 그건
// 데이터를 고쳤다는 뜻이므로 정상이다.
import { DEFAULT_PROFILE, nightBlessingDefaults } from '../src/default-profile.mjs';
import { JOB_SAMPLES } from '../src/gen/jobs-data.mjs';

export const SAMPLE_JOB = '댄서';

export const sampleProfile = (over = {}) => ({
  ...DEFAULT_PROFILE,
  ...JOB_SAMPLES[SAMPLE_JOB].stats,
  ...JOB_SAMPLES[SAMPLE_JOB].combat,
  job: SAMPLE_JOB,
  /* 각성 구간 버프는 직업 표가 기본값을 준다. DEFAULT_PROFILE 의 것은 기본 직업 것이라,
   * over 로 다른 직업을 주면 앞 직업 값이 따라와 조용히 틀린다. 직업에 맞춰 다시 깐다.
   * (over 에 nightBlessingEffects 를 직접 주면 아래 스프레드가 그것을 이긴다.) */
  nightBlessingEffects: nightBlessingDefaults(over.job ?? SAMPLE_JOB),
  // 측정으로 채우는 값이라 샘플에 없다. 0 이면 B 가 1 이 되어 계산이 비현실적으로 눌린다.
  nonRuneAttackPercent: 7.6,
  ...over,
});
