// 자동 생성 파일 — 직접 수정하지 마라.
// 생성: node tools/build-data.mjs
// 원본: data/effect-fields.json

/** 데미지 공식에 배선된 effects 경로 → 표시 라벨. 여기 없는 경로는 계산에서 조용히 죽는다. */
export const EFFECT_FIELDS = Object.freeze({
  "attackIncrease.itemAttackPercent": {
    "label": "공증"
  },
  "damageIncrease.itemMainDamagePercent": {
    "label": "피증"
  },
  "damageIncrease.skillDamagePercent": {
    "label": "스킬 피해"
  },
  "damageIncrease.armorBreakPercent": {
    "label": "방어구 파괴",
    "stack": "max"
  },
  "critical.runeCriticalRatePercent": {
    "label": "치명타 확률"
  },
  "critical.criticalDamagePercent": {
    "label": "치명타 피해"
  },
  "extraHit.runeExtraRatePercent": {
    "label": "추가타 확률"
  },
  "extraHit.extraDamagePercent": {
    "label": "추가타 피해"
  },
  "enhancement.rapidDamagePercent": {
    "label": "연타 피해"
  },
  "enhancement.heavyDamagePercent": {
    "label": "강타 피해"
  },
  "enhancement.areaDamagePercent": {
    "label": "광역 피해"
  },
  "enhancement.comboDamagePercent": {
    "label": "콤보 피해"
  },
  "break.vulnerabilityDamagePercent": {
    "label": "무방비 피해"
  },
  "finalDamage.percent": {
    "label": "최종 데미지"
  }
});

export const EFFECT_PATHS = Object.freeze(Object.keys(EFFECT_FIELDS));

/** 경로 → 한국어 라벨. 모르는 경로는 경로 그대로 돌려준다. */
export const fieldLabel = (path) => EFFECT_FIELDS[path]?.label ?? path;
