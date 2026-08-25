/** 특정 스킬에만 붙는 피해 옵션과 사용자가 입력하는 딜 비중의 연결. */
export const SKILL_SHARE_FIELDS = Object.freeze({
  '액티브 3번 슬롯 스킬로 주는 피해': 'slot3SkillSharePercent',
  '채널링 스킬로 주는 피해': 'channelingSkillSharePercent',
  '캐스팅 및 차지 스킬로 주는 피해': 'castingChargeSkillSharePercent',
  '궁극기 스킬로 주는 피해': 'ultimateSkillSharePercent',
  '브레이크 스킬로 주는 피해': 'breakSkillSharePercent',
});

export const skillShareFieldOf = (stat) => SKILL_SHARE_FIELDS[stat] ?? null;

/** 비중은 배타적인 조각이 아니다. 같은 스킬이 궁극기이면서 채널링일 수 있다. */
export function weightedSkillBonus(bonus, profile) {
  const field = skillShareFieldOf(bonus?.stat);
  if (!field) return null;
  const share = Math.min(100, Math.max(0, profile?.[field] ?? 0));
  return (bonus.value ?? 0) * share / 100;
}
