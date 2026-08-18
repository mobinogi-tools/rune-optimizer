// 자동 생성 파일 — 직접 수정하지 마라.
// 생성: node tools/build-data.mjs
// 원본: data/rune-conditionals.json

export const AWAKENING_RUNES = Object.freeze([
  "교차하는 사슬",
  "첫 번째 서약",
  "잊힌 맹약"
]);

export const CURSE_RUNES = Object.freeze([
  "억눌린 충동",
  "날 선 적의"
]);

export const DOT_APPLIER_RUNES = Object.freeze([
  "부패",
  "아귀",
  "폭염"
]);

export const DOT_TRIGGER_RUNES = Object.freeze([
  "광채",
  "암운"
]);

export const DRAGON_SIGIL = Object.freeze({
  "maxEquipped": 2,
  "baseDurationSeconds": 10,
  "cooldownSeconds": 20,
  "extenderSeconds": 10,
  "enablers": [
    "별바라기",
    "용암 비늘",
    "황동 날개"
  ],
  "extenders": [
    "얼음 발톱",
    "잠들지 않는 불"
  ],
  "consumers": [
    "돌 심장",
    "번개 숨결"
  ]
});

export const EROSION_RUNES = Object.freeze([
  "잿빛 장막",
  "흐릿한 형상",
  "금 간 봉인",
  "무너진 경계"
]);

export const EROSION_SYSTEM = Object.freeze({
  "ratePerRunePerSecond": 5,
  "pollutionSeconds": 15,
  "boostThreshold": 100,
  "pollutionThreshold": 300,
  "boostMultiplier": 2
});

export const MAX_AWAKENING = Object.freeze(1);

export const MAX_CURSE = Object.freeze(1);

export const NEGATIVE_TRAITS = Object.freeze({
  "moveSpeed": {
    "label": "이동속도↓",
    "desc": "이동 속도가 느려집니다",
    "runes": [
      "억눌린 충동",
      "날 선 적의"
    ]
  },
  "ultimateGauge": {
    "label": "궁극기↓",
    "desc": "궁극기 게이지가 덜 찹니다",
    "runes": [
      "창백한 기수",
      "수호자"
    ]
  },
  "cooldown": {
    "label": "쿨회복↓",
    "desc": "재사용 대기 시간 회복이 느려집니다",
    "runes": [
      "무한한 탐욕"
    ]
  },
  "survivability": {
    "label": "생존↓",
    "desc": "회복량이 줄거나 체력을 소모합니다",
    "runes": [
      "잠든 땅",
      "끓는 피"
    ]
  },
  "selfDamage": {
    "label": "피해량↓",
    "desc": "발동한 뒤 일정 시간 자신의 피해량이 깎입니다",
    "runes": [
      "추적자"
    ]
  },
  "knockdown": {
    "label": "행동불능 취약",
    "desc": "행동 불능 방지 효과를 못 받거나, 넘어지면 약해집니다",
    "runes": [
      "죽음"
    ]
  }
});

export const NIGHT_BLESSING = Object.freeze({
  "durationSeconds": 15,
  "cooldownSeconds": 60,
  "baseAttackPercent": 15
});

export const NO_CONDITIONALS = Object.freeze([
  "햇살+",
  "환호+",
  "발걸음+",
  "전환+",
  "원정대"
]);

export const POLLUTION_REDUCTION = Object.freeze({
  "영원한 밤": 33
});

export const RUNE_ALWAYS_ON_EXTRA = Object.freeze({});

export const RUNE_CONDITIONALS = Object.freeze({
  "추적자": [
    {
      "id": "heavy-damage",
      "field": "enhancement.heavyDamagePercent",
      "label": "강타 피해%(자기 디버프)",
      "min": -20,
      "expected": null,
      "max": 0,
      "expectedFrom": "castCycle",
      "perApplication": -20,
      "durationSeconds": 6,
      "castsRequired": 8,
      "basis": "derived",
      "note": "스킬 8회 사용마다 6초 동안 강타 피해 20% 감소. 초당 스킬 시전 수로 가동률을 계산한다. 초당 1회면 8초 주기에 6초 동안 걸려 있어 −15%(상시 35% → 실효 20%)."
    }
  ],
  "끓는 피": [
    {
      "id": "skill-damage",
      "field": "damageIncrease.skillDamagePercent",
      "label": "스킬 피해%",
      "min": 0,
      "expected": null,
      "max": 24,
      "expectedFrom": "stacks",
      "rateField": "skillCasts",
      "perStack": 24,
      "maxStacks": 1,
      "stackDurationSeconds": 5,
      "basis": "derived",
      "note": "스킬 사용마다 체력 4% 를 소모하고 5초 동안 스킬 피해 24%. 지속이 길어 초당 0.2회만 써도 끊기지 않는다. 체력 30% 이상에서만 발동한다."
    }
  ],
  "암운+": [
    {
      "id": "skill-damage",
      "field": "damageIncrease.skillDamagePercent",
      "label": "스킬 피해%",
      "min": 0,
      "expected": 10,
      "max": 10,
      "basis": "playstyle",
      "note": "지속 피해(중독/상처/두려움/절망)가 걸린 적 공격 시 15초 동안 스킬 피해 10%(쿨 5초). 도트 부여 수단이 있으면 상시에 가깝고, 없으면 0 이다."
    }
  ],
  "거두는 손길": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%",
      "min": 0,
      "expected": 26,
      "max": 26,
      "basis": "playstyle",
      "note": "전투 시작 시 15초 동안 피증 26%, 적 처치 시 재발동. 이 룬은 상황 한정으로 기본 제외되므로, 켜서 쓰는 사람 기준으로 최대치를 기본값에 둔다. 보스전 위주면 가동률이 10% 안팎이니 직접 낮춰 잡으세요."
    }
  ],
  "불꽃으로 새긴 문장": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%",
      "min": 0,
      "expected": 20,
      "max": 20,
      "basis": "playstyle",
      "note": "전투 시작 시 3분 동안 피증 20%. 이 룬은 상황 한정으로 기본 제외되므로 최대치를 기본값에 둔다. 단 밤의 흔적이 45레벨 이상이면 불의 인장이 사라지고 도트 딜로 대체되어 이 피증이 아예 나오지 않는다 — 그 경우 0 으로 내리세요."
    }
  ],
  "서광": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%",
      "min": 0,
      "expected": 12,
      "max": 20,
      "requiresVulnerable": true,
      "basis": "playstyle",
      "note": "브레이크 익스텐드 스킬 사용 시 10초 동안 피증 20%. 해당 스킬은 전사·빙결술사·기사만 가진다. 가동률 60% 로 잡아 12%."
    }
  ],
  "칼바람": [
    {
      "id": "critical-damage",
      "field": "critical.criticalDamagePercent",
      "label": "치명타 피해%",
      "min": 0,
      "expected": 6,
      "max": 10,
      "requiresVulnerable": true,
      "basis": "playstyle",
      "note": "브레이크 스킬 사용 시 7초 동안 치명타 피해 10%. 가동률 60% 로 잡아 6%. 상시 옵션인 브레이크 스킬 피해 29% 는 스킬 종류 한정이라 따로 계산되지 않는다."
    }
  ],
  "정복자+": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%",
      "min": 0,
      "expected": 10,
      "max": 12,
      "basis": "playstyle",
      "note": "주위에서 적 5/10/20명 처치 시 3/6/12%. 보스전이라도 잡몹 방을 지나며 쌓이는 경우가 많아 기대값 10%."
    }
  ],
  "용 사냥꾼": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%",
      "min": 0,
      "expected": 5,
      "max": 5,
      "basis": "derived",
      "note": "퀵슬롯 아이템 사용 시 60초 동안 피증 5%(쿨 3초). 지속이 길어 한 번만 쓰면 계속 유지된다."
    }
  ],
  "맹세+": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%",
      "min": 0,
      "expected": 15,
      "max": 15,
      "basis": "playstyle",
      "note": "체력 50% 이하일 때만. 그 상태에서는 2초마다 스택이 붙고 12초 지속이라 곧바로 5중첩(15%)으로 포화된다."
    }
  ],
  "복수+": [
    {
      "id": "attack",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%",
      "min": 0,
      "expected": 25,
      "max": 25,
      "basis": "playstyle",
      "note": "피해를 입을 때마다 공격력 5%(12초), 최대 5중첩. 12초 안에 5번 맞아야 포화된다."
    }
  ],
  "그믐달": [
    {
      "id": "attack",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%",
      "min": 0,
      "expected": 10,
      "max": 10,
      "basis": "playstyle",
      "note": "보유 자원이 50% 미만일 때만 공격력 10%."
    }
  ],
  "부서진 왕관": [
    {
      "id": "attack",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%",
      "min": 0,
      "expected": 12,
      "max": 12,
      "basis": "playstyle",
      "note": "마력의 원에 올라서 있어야 한다. 5초마다 생기고 15초 지속이라, 자리를 지키면 3중첩(12%)이 유지된다."
    },
    {
      "id": "heavy-damage",
      "field": "enhancement.heavyDamagePercent",
      "label": "강타 피해%",
      "min": 0,
      "expected": 13.5,
      "max": 13.5,
      "basis": "playstyle",
      "note": "위와 같은 3중첩 기준(4.5% × 3)."
    }
  ],
  "비늘 덮인 현자": [
    {
      "id": "attack",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%",
      "min": 0,
      "expected": 20,
      "max": 20,
      "basis": "playstyle",
      "note": "아군을 치유해야 켜진다(15초). 솔로 플레이면 0으로 두세요."
    }
  ],
  "긍지": [
    {
      "id": "attack",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%",
      "min": 25,
      "expected": 25,
      "max": 25,
      "requiresMastery": "지원",
      "basis": "derived",
      "note": "전투 숙련: 지원 보유 시 상시. 지원은 사제·수도사·힐러·음유 계열이다."
    },
    {
      "id": "armor-break",
      "field": "damageIncrease.armorBreakPercent",
      "label": "방어구 파괴%",
      "min": 0,
      "expected": 10,
      "max": 10,
      "basis": "derived",
      "note": "공격 시 적에게 방어구 파괴를 부여해 10초 동안 받는 피해 +10%. 재사용 1초에 지속 10초라 공격을 이어가는 동안에는 사실상 상시다. 방어구 파괴는 중복 적용되지 않아 유폐된 어둠·등대지기와 함께 껴도 10%가 상한이다."
    }
  ],
  "공세+": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%",
      "min": 0,
      "expected": null,
      "max": 27.5,
      "expectedFrom": "stacks",
      "rateField": "skillCasts",
      "perStack": 5.5,
      "maxStacks": 5,
      "stackDurationSeconds": 6,
      "basis": "derived",
      "note": "스킬 사용마다 +5.5%(6초), 최대 5중첩. 스택마다 지속시간이 따로라 초당 0.84회 이상 쓰면 최대치로 굳는다."
    }
  ],
  "거대한 분노": [
    {
      "id": "skill-damage",
      "field": "damageIncrease.skillDamagePercent",
      "label": "스킬 피해%",
      "min": 0,
      "expected": null,
      "max": 12,
      "expectedFrom": "streak",
      "perStack": 3,
      "maxStacks": 4,
      "streakRate": "heavyRatePercent",
      "basis": "derived",
      "note": "강타 적중마다 +3%, 최대 4중첩. 강타가 아닌 공격이 들어오면 즉시 0. 기대 중첩은 강타율에서 나온다."
    }
  ],
  "위엄": [
    {
      "id": "attack",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%",
      "min": 16,
      "expected": 16,
      "max": 16,
      "requiresMastery": "수호",
      "basis": "derived",
      "note": "전투 숙련: 수호 보유 시 상시. 수호는 전사·기사·빙법 계열이다."
    },
    {
      "id": "vulnerability-damage",
      "field": "break.vulnerabilityDamagePercent",
      "label": "무방비 피해%",
      "min": 32,
      "expected": 32,
      "max": 32,
      "requiresMastery": "수호",
      "basis": "derived",
      "note": "무방비 상태를 유효하게 계산할 때만 값이 붙는다."
    }
  ],
  "잿빛 장막": [
    {
      "id": "rapid-damage",
      "field": "enhancement.rapidDamagePercent",
      "label": "연타 피해%",
      "min": 0,
      "expected": null,
      "max": 36,
      "expectedFrom": "erosion",
      "erosionBase": 18,
      "basis": "derived",
      "note": "침식 부여 중 18%, 100 이상이면 2배(36%). 오염 중에는 0."
    }
  ],
  "흐릿한 형상": [
    {
      "id": "heavy-damage",
      "field": "enhancement.heavyDamagePercent",
      "label": "강타 피해%",
      "min": 0,
      "expected": null,
      "max": 36,
      "expectedFrom": "erosion",
      "erosionBase": 18,
      "basis": "derived",
      "note": "침식 부여 중 18%, 100 이상이면 2배(36%). 오염 중에는 0."
    }
  ],
  "금 간 봉인": [
    {
      "id": "critical-rate",
      "field": "critical.runeCriticalRatePercent",
      "label": "치명타 확률%",
      "min": 0,
      "expected": null,
      "max": 33,
      "expectedFrom": "erosion",
      "erosionBase": 16.5,
      "basis": "derived",
      "note": "침식 부여 중 16.5%, 100 이상이면 2배(33%). 오염 중에는 0."
    }
  ],
  "무너진 경계": [
    {
      "id": "extra-rate",
      "field": "extraHit.runeExtraRatePercent",
      "label": "추가타 확률%",
      "min": 0,
      "expected": null,
      "max": 33,
      "expectedFrom": "erosion",
      "erosionBase": 16.5,
      "basis": "derived",
      "note": "침식 부여 중 16.5%, 100 이상이면 2배(33%). 오염 중에는 0."
    }
  ],
  "얼음 발톱": [
    {
      "id": "extra-rate",
      "field": "extraHit.runeExtraRatePercent",
      "label": "추가타 확률%",
      "min": 0,
      "max": 12.5,
      "trigger": "dragonSigil",
      "basis": "derived",
      "note": "용의 문장 중. 자신이 지속 +10초 연장 룬이기도 하다."
    }
  ],
  "잠들지 않는 불": [
    {
      "id": "critical-rate",
      "field": "critical.runeCriticalRatePercent",
      "label": "치명타 확률%",
      "min": 0,
      "max": 12.5,
      "trigger": "dragonSigil",
      "basis": "derived",
      "note": "용의 문장 중. 자신이 지속 +10초 연장 룬이기도 하다."
    }
  ],
  "별바라기": [
    {
      "id": "attack",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%",
      "min": 0,
      "max": 14,
      "trigger": "dragonSigil",
      "basis": "derived",
      "note": "용의 문장 중. 자신이 발동 룬(공격 시)이다."
    }
  ],
  "황동 날개": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "적에게 주는 피해%",
      "min": 0,
      "max": 14,
      "trigger": "dragonSigil",
      "basis": "derived",
      "note": "용의 문장 중. 발동이 궁극기 사용 시라 주기가 길다."
    }
  ],
  "돌 심장": [
    {
      "id": "rapid-damage",
      "field": "enhancement.rapidDamagePercent",
      "label": "연타 피해%",
      "min": 0,
      "max": 18,
      "trigger": "dragonSigil",
      "basis": "derived",
      "note": "용의 문장 중. 발동/연장 능력이 없어 다른 룬에 의존한다. 쿨 회복 20%는 미계산."
    }
  ],
  "번개 숨결": [
    {
      "id": "heavy-damage",
      "field": "enhancement.heavyDamagePercent",
      "label": "강타 피해%",
      "min": 0,
      "max": 18,
      "trigger": "dragonSigil",
      "basis": "derived",
      "note": "용의 문장 중. 발동/연장 능력 없음. 스킬속도·캐스팅 17%는 미계산."
    }
  ],
  "승전": [
    {
      "id": "critical-damage",
      "field": "critical.criticalDamagePercent",
      "label": "치명타 피해%",
      "min": 0,
      "expected": 10,
      "max": 12,
      "basis": "playstyle",
      "note": "주위에서 적 5/10/20명 처치 시 3/6/12%. 보스전이라도 20명 처치한 방을 지나가는 경우가 많아 기대값 10%로 둔다."
    }
  ],
  "바위 칼날": [
    {
      "id": "attack",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%",
      "min": 0,
      "max": 21,
      "expectedFrom": "stacks",
      "perStack": 0.7,
      "maxStacks": 30,
      "stackDurationSeconds": 10,
      "basis": "derived",
      "note": "타격당 0.7%, 최대 30중첩(=21%). 30중첩에는 초당 3타 이상이 필요하다."
    },
    {
      "id": "critical-rate",
      "field": "critical.runeCriticalRatePercent",
      "label": "치명타 확률%",
      "min": 0,
      "max": 15,
      "expectedFrom": "stacks",
      "perStack": 0.5,
      "maxStacks": 30,
      "stackDurationSeconds": 10,
      "basis": "derived",
      "note": "타격당 0.5%, 최대 30중첩(=15%)."
    }
  ],
  "광채+": [
    {
      "id": "critical-damage",
      "field": "critical.criticalDamagePercent",
      "label": "치명타 피해%",
      "min": 0,
      "expected": 15,
      "max": 15,
      "basis": "playstyle",
      "note": "지속 피해(화상/빙결/감전/심판) 보유한 적 공격 시 15초. 도트 부여 수단이 있으면 상시에 가깝다."
    }
  ],
  "숲 길잡이": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "적에게 주는 피해%",
      "min": 0,
      "max": 21,
      "expectedFrom": "hitTrigger",
      "hitTrigger": {
        "hitsRequired": 10,
        "durationSeconds": 10,
        "cooldownSeconds": 0
      },
      "basis": "derived",
      "note": "공격 10회 또는 5m 이동 시 10초. 쿨 없음 → 초당 1타만 나와도 가동률 100%."
    }
  ],
  "무형": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%(저주 분기)",
      "min": 30,
      "expected": 30,
      "max": 30,
      "branch": "curse",
      "basis": "derived",
      "note": "저주 룬을 같이 끼면 피증 30%. 받는 피해도 30% 늘고 이동 속도 감소는 사라진다."
    },
    {
      "id": "erosion-direct",
      "label": "침식 조합",
      "branch": "erosion",
      "uncounted": "5초마다 (공격력×101%) 가 따로 나갑니다. 한 대 기준으로 비교하는 계산이라 자리가 없어 0 으로 잡힙니다",
      "basis": "derived",
      "note": "침식 룬을 같이 끼면 이 분기가 켜지고, 다른 세 분기(피증·스킬피해·공격력)는 꺼진다. 즉 침식 조합에서 무형의 수치 기여는 0 이 맞다 — 빠진 값이 아니라 계산할 수 없는 종류다."
    },
    {
      "id": "skill-damage",
      "field": "damageIncrease.skillDamagePercent",
      "label": "스킬 피해%(용의 문장 분기)",
      "min": 27,
      "expected": 27,
      "max": 27,
      "branch": "dragon",
      "basis": "derived",
      "note": "저주·침식이 없고 용의 문장 룬이 있을 때 스킬 피해 27%."
    },
    {
      "id": "attack",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%(미발동)",
      "min": 30,
      "expected": 30,
      "max": 30,
      "branch": "none",
      "basis": "derived",
      "note": "저주·침식·용의 문장을 하나도 안 꼈을 때 공격력 30%."
    }
  ],
  "사슬로 묶은 법전": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%(미발동 시)",
      "min": 0,
      "expected": 29,
      "max": 29,
      "basis": "playstyle",
      "note": "도발·아군 치유를 하지 않는 딜러 빌드에서는 사실상 상시 29%. 탱커·힐러면 낮춰라."
    }
  ],
  "계승자": [
    {
      "id": "skill-damage",
      "field": "damageIncrease.skillDamagePercent",
      "label": "스킬 피해%",
      "min": 0,
      "expected": 16.25,
      "max": 32.5,
      "basis": "derived",
      "note": "스킬 사용마다 +6.5%, 최대 5중첩. 6번째 사용 시 초기화되므로 중첩이 1,2,3,4,5,0 으로 순환 → 평균 2.5중첩 = 16.25%. 초기화 직후 바로 1중첩이 붙는다면 평균 3중첩(19.5%)이 되나, 문구상 보수적으로 잡았다."
    }
  ],
  "교차하는 사슬": [
    {
      "id": "rapid-damage",
      "field": "enhancement.rapidDamagePercent",
      "label": "연타 피해%",
      "min": 0,
      "max": 11,
      "trigger": "nightBlessing",
      "basis": "derived"
    },
    {
      "id": "extra-rate",
      "field": "extraHit.runeExtraRatePercent",
      "label": "추가타 확률%",
      "min": 0,
      "max": 11,
      "trigger": "nightBlessing",
      "basis": "derived"
    },
    {
      "id": "attack",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%",
      "min": 0,
      "max": 11,
      "trigger": "nightBlessing",
      "basis": "derived"
    }
  ],
  "첫 번째 서약": [
    {
      "id": "heavy-damage",
      "field": "enhancement.heavyDamagePercent",
      "label": "강타 피해%",
      "min": 0,
      "max": 11,
      "trigger": "nightBlessing",
      "basis": "derived"
    },
    {
      "id": "critical-rate",
      "field": "critical.runeCriticalRatePercent",
      "label": "치명타 확률%",
      "min": 0,
      "max": 11,
      "trigger": "nightBlessing",
      "basis": "derived"
    },
    {
      "id": "attack",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%",
      "min": 0,
      "max": 11,
      "trigger": "nightBlessing",
      "basis": "derived"
    }
  ],
  "고결함": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "적에게 주는 피해%",
      "min": 0,
      "max": 48,
      "trigger": "nightBlessing",
      "basis": "derived"
    }
  ],
  "위대함": [
    {
      "id": "heavy-damage",
      "field": "enhancement.heavyDamagePercent",
      "label": "강타 피해%(추가)",
      "min": 0,
      "max": 40,
      "trigger": "nightBlessing",
      "basis": "derived"
    }
  ],
  "해방": [
    {
      "id": "rapid-damage",
      "field": "enhancement.rapidDamagePercent",
      "label": "연타 피해%(추가)",
      "min": 0,
      "max": 40,
      "trigger": "nightBlessing",
      "basis": "derived"
    }
  ],
  "초월": [
    {
      "id": "main-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "적에게 주는 피해%",
      "min": 0,
      "expected": null,
      "max": 15,
      "uptimeFrom": "extraRate",
      "basis": "derived",
      "note": "추가타 5회 적중 시 10초 동안. 쿨 4초. 가동률 = min(1, 10 / (4 + 5/(타수×추가타율))) — 해석 B."
    },
    {
      "id": "critical-damage",
      "field": "critical.criticalDamagePercent",
      "label": "치명타 피해%",
      "min": 0,
      "expected": null,
      "max": 15,
      "uptimeFrom": "critRate",
      "basis": "derived",
      "note": "치명타 5회 적중 시 10초 동안. 쿨 4초. 가동률 = min(1, 10 / (4 + 5/(타수×치명타율))) — 해석 B."
    }
  ],
  "유폐된 어둠": [
    {
      "id": "armor-break",
      "field": "damageIncrease.armorBreakPercent",
      "label": "방어구 파괴%",
      "min": 0,
      "expected": 10,
      "max": 10,
      "basis": "derived",
      "note": "어둠의 화살이 3초마다 자동으로 나가며 방어구 파괴를 부여한다. 지속 10초라 전투 중에는 끊기지 않는다. 화살 자체의 피해(2.10)는 별도 타격이라 계산에 안 들어간다."
    }
  ],
  "등대지기": [
    {
      "id": "armor-break",
      "field": "damageIncrease.armorBreakPercent",
      "label": "방어구 파괴%",
      "min": 0,
      "expected": 10,
      "max": 10,
      "requiresVulnerable": true,
      "basis": "playstyle",
      "note": "무방비 공격이 적중해야 부여된다. 한 번 걸면 10초 지속이라 무방비를 만드는 조합에서는 유지되지만, 무방비를 안 쓰면 아예 안 걸린다 — 그래서 무방비를 유효하게 볼 때만 센다."
    }
  ],
  "작열": [
    {
      "id": "crit-rate-by-light",
      "field": "critical.runeCriticalRatePercent",
      "label": "치명타 확률%(빛 계열 수)",
      "min": 0,
      "expected": null,
      "max": 18,
      "expectedFrom": "familySteps",
      "familyOf": "빛",
      "steps": [
        3,
        7,
        12,
        18
      ],
      "basis": "derived",
      "note": "기본 공격 시 10초 동안 붙는다. 기본 공격은 자동으로 계속 나가므로 상시로 본다. 자기 자신도 세므로 작열만 끼면 3%."
    },
    {
      "id": "basic-attack",
      "label": "기본 공격 피해·추가타 확률 18%",
      "uncounted": "기본 공격(평타) 전용이라 한 대 기준 스킬 비교에 자리가 없습니다",
      "basis": "derived"
    }
  ],
  "오팔 성배": [
    {
      "id": "crit-damage-by-family",
      "field": "critical.criticalDamagePercent",
      "label": "치명타 피해%(빠른 스킬 비례)",
      "requiresFamily": {
        "빛": 2,
        "어둠": 2,
        "용": 2
      },
      "min": 0,
      "expected": null,
      "max": 6,
      "expectedFrom": "statSteps",
      "statOf": "fastSkill",
      "per": 500,
      "perStep": 1.5,
      "basis": "derived",
      "note": "빛·어둠·용을 각각 2개 이상 낀 경우에만 켜진다. 오팔 성배 자신이 빛이라 빛은 하나만 더 있으면 된다. 스탯창의 빠른 스킬 500마다 1.5%, 6%에서 멈춘다 — 상한 아래에서 노는 값이라 실제 수치가 그대로 반영된다."
    },
    {
      "id": "crit-damage-stack",
      "field": "critical.criticalDamagePercent",
      "label": "치명타 피해%(스킬 스택)",
      "min": 0,
      "expected": 5,
      "max": 5,
      "basis": "playstyle",
      "note": "스킬 사용 시 8초 동안 치명타 피해 1%, 최대 5중첩. 전투가 길어질수록 차오르는 스택이라 \"몇 중첩으로 볼 것이냐\" 가 곧 판의 길이다. 짧은 판에서는 이만큼 안 나온다. 수학으로 정할 수 있는 값이 아니라서 일단 최대로 두었다 — 판이 짧거나 자주 맞는다면 아래 조정 칸에서 낮춰라."
    }
  ],
  "삼키는 모래": [
    {
      "id": "main-damage-by-rapid",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%(연타 강화 비례)",
      "min": 0,
      "expected": null,
      "max": 8,
      "expectedFrom": "statSteps",
      "statOf": "rapidEnhance",
      "per": 500,
      "perStep": 2,
      "basis": "derived",
      "note": "스탯창의 연타 강화에 비례한다. 500마다 2%, 8%에서 멈춘다(연타 강화 2000이면 상한). 안 넣으면 0으로 본다."
    },
    {
      "id": "rapid-damage-erosion",
      "field": "enhancement.rapidDamagePercent",
      "label": "연타 피해 17%(침식 낮음·오염 중)",
      "min": 0,
      "expected": null,
      "max": 17,
      "expectedFrom": "erosionWindow",
      "basis": "derived",
      "note": "침식 룬이 세트에 있어야 켜진다. 침식이 0→100 인 동안과 오염 동안이 조건 구간이고, 100→300 구간은 아니다. 그 시간 비중을 침식 사이클에서 뽑아 쓴다 — 침식 룬을 더 끼면 카운터가 빨리 차서 이 비중도 올라간다. 시간 평균이라 '지금 어느 구간이냐' 는 못 본다. 침식을 구간별로 다루게 되면 다시 볼 자리다."
    }
  ],
  "신기루": [
    {
      "id": "main-damage-by-heavy",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%(강타 강화 비례)",
      "min": 0,
      "expected": null,
      "max": 10,
      "expectedFrom": "statSteps",
      "statOf": "heavyEnhance",
      "per": 500,
      "perStep": 2.5,
      "basis": "derived",
      "note": "스탯창의 강타 강화에 비례한다. 500마다 2.5%, 10%에서 멈춘다(강타 강화 2000이면 상한). 안 넣으면 0으로 본다."
    },
    {
      "id": "mirage-stack-damage",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증%(신기루 중첩)",
      "min": 0,
      "expected": 10,
      "max": 10,
      "basis": "playstyle",
      "note": "전투 중 5초마다 1중첩(최대 10), 전투 시작 시 5중첩, 피격 시 −1. 중첩당 피증 1%. 전투가 길어질수록 차오르는 스택이라 \"몇 중첩으로 볼 것이냐\" 가 곧 판의 길이다. 짧은 판에서는 이만큼 안 나온다. 수학으로 정할 수 있는 값이 아니라서 일단 최대로 두었다 — 판이 짧거나 자주 맞는다면 아래 조정 칸에서 낮춰라."
    },
    {
      "id": "mirage-stack-heavy",
      "field": "enhancement.heavyDamagePercent",
      "label": "강타 피해%(신기루 중첩)",
      "min": 0,
      "expected": 10,
      "max": 10,
      "basis": "playstyle",
      "note": "같은 중첩이 강타 피해도 중첩당 1% 올린다. 위 항목과 한 몸이라 따로 조정하면 어긋난다."
    }
  ],
  "황혼 숨결": [
    {
      "id": "attack-by-dragon",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%(용 계열 2개 이상)",
      "min": 0,
      "expected": null,
      "max": 10,
      "expectedFrom": "familySteps",
      "familyOf": "용",
      "steps": [
        0,
        10
      ],
      "basis": "derived",
      "note": "용 계열 룬 2개 이상 장착 시 활성화. 자기 자신도 세므로 혼자면 0, 하나만 더 있으면 10%. 스킬 위력 비례분은 아래 항목에서 따로 센다."
    },
    {
      "id": "skill-power-scale",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%(스킬 위력 비례)",
      "requiresFamily": {
        "용": 2
      },
      "min": 0,
      "expected": null,
      "max": 4,
      "expectedFrom": "statSteps",
      "statOf": "skillPower",
      "per": 500,
      "perStep": 1,
      "basis": "derived",
      "note": "룬 자체가 용 계열 2개 이상에서만 켜지므로 이 추가분도 같은 조건을 탄다. 스탯창의 스킬 위력 500마다 1%, 4%에서 멈춘다. 안 넣으면 0으로 본다."
    },
    {
      "id": "direct-hit",
      "label": "바위 쐐기 직접 피해",
      "uncounted": "따로 나가는 타격이라 한 대 기준 비교에 자리가 없습니다",
      "basis": "derived"
    }
  ],
  "두 영웅": [
    {
      "id": "main-damage-class",
      "field": "damageIncrease.itemMainDamagePercent",
      "label": "피증 22%(동일 무기 양손 클래스)",
      "requiresDualWield": true,
      "min": 22,
      "expected": 22,
      "max": 22,
      "basis": "derived",
      "note": "조건을 만족하는 직업이면 상시다 — 그래서 세 시나리오가 모두 같다. 툴팁이 명시한 듀얼블레이드·댄서·격투가에서만 켜진다. 직업 목록은 data/jobs/*.json 의 dualWield 가 정한다."
    },
    {
      "id": "direct-hit",
      "label": "끌어당기며 주는 직접 피해",
      "uncounted": "따로 나가는 타격이라 한 대 기준 비교에 자리가 없습니다",
      "basis": "derived"
    }
  ],
  "쐐기돌": [
    {
      "id": "attack-by-distinct-family",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%(서로 다른 계열 수)",
      "min": 0,
      "expected": null,
      "max": 15,
      "expectedFrom": "familySteps",
      "familyOf": "계열수",
      "steps": [
        5,
        10,
        15
      ],
      "basis": "derived",
      "note": "서로 다른 계열 1종마다 5%. 계열은 빛·어둠·용 셋뿐이라 최대 15%. 쐐기돌 자신은 계열이 없어 세지 않는다."
    },
    {
      "id": "attack-by-crit",
      "field": "attackIncrease.itemAttackPercent",
      "label": "공격력%(치명타 비례)",
      "requiresFamily": {
        "빛": 1,
        "어둠": 1,
        "용": 1
      },
      "min": 0,
      "expected": null,
      "max": 4,
      "expectedFrom": "statSteps",
      "statOf": "criticalStat",
      "per": 500,
      "perStep": 1,
      "basis": "derived",
      "note": "빛·어둠·용을 모두 낀 경우에만 켜진다. 쐐기돌 자신은 계열이 없어 세지 않으므로 다른 룬으로 셋을 채워야 한다. 스탯창의 치명타 500마다 1%, 4%에서 멈춘다. 안 넣으면 0으로 본다."
    }
  ]
});

export const RUNE_CONTENT = Object.freeze({
  "작열": "카브락",
  "오팔 성배": "카브락",
  "삼키는 모래": "카브락",
  "신기루": "카브락",
  "황혼 숨결": "카브락",
  "두 영웅": "카브락",
  "쐐기돌": "카브락",
  "원정대": "카브락"
});

export const RUNE_FAMILY = Object.freeze({
  "거대한 분노": "용",
  "거두는 손길": "어둠",
  "계승자": "용",
  "계시": "빛",
  "고결함": "빛",
  "공세": "빛",
  "공허": "어둠",
  "광채": "빛",
  "교차하는 사슬": "어둠",
  "그믐달": "빛",
  "금 간 봉인": "어둠",
  "긍지": "빛",
  "기사단장": "빛",
  "끓는 피": "어둠",
  "날 선 적의": "어둠",
  "녹슨 방패": "빛",
  "눈부신 잔영": "빛",
  "대군주": "용",
  "돌 심장": "용",
  "두 갈래 뿔": "용",
  "두 영웅": "용",
  "등대지기": "빛",
  "맹세": "빛",
  "무너진 경계": "어둠",
  "무덤지기": "어둠",
  "무한한 탐욕": "어둠",
  "바다뱀": "용",
  "바위 칼날": "용",
  "백금 천칭": "빛",
  "번개 숨결": "용",
  "별바라기": "용",
  "복수": "어둠",
  "봉인술사": "용",
  "부서진 왕관": "어둠",
  "부패": "어둠",
  "비늘 덮인 현자": "용",
  "빛바랜 별": "용",
  "빛살": "빛",
  "뼈 인장": "어둠",
  "삼키는 모래": "어둠",
  "서광": "빛",
  "수호자": "빛",
  "숲 길잡이": "용",
  "승전": "빛",
  "신기루": "어둠",
  "아귀": "어둠",
  "악몽": "어둠",
  "암운": "어둠",
  "억눌린 충동": "어둠",
  "얼음 발톱": "용",
  "열의": "빛",
  "영원한 밤": "어둠",
  "오랜 광기": "어둠",
  "오팔 성배": "빛",
  "용암 비늘": "용",
  "위대함": "용",
  "위엄": "빛",
  "은빛 찬가": "빛",
  "잊힌 맹약": "용",
  "작열": "빛",
  "잠든 땅": "용",
  "잠들지 않는 불": "용",
  "잿빛 장막": "어둠",
  "정복자": "빛",
  "창백한 기수": "어둠",
  "첫 번째 서약": "빛",
  "초월": "빛",
  "추적자": "용",
  "침묵": "어둠",
  "칼바람": "용",
  "타오르는 영광": "빛",
  "태초": "용",
  "폭염": "용",
  "해방": "어둠",
  "햇살": "빛",
  "황동 날개": "용",
  "황혼 숨결": "용",
  "흐릿한 형상": "어둠"
});

export const SPECIAL_TRIGGER_RUNES = Object.freeze([
  "맹세",
  "복수",
  "그믐달",
  "부서진 왕관",
  "비늘 덮인 현자",
  "거두는 손길",
  "불꽃으로 새긴 문장"
]);

export const STAT_BETTER_WHEN = Object.freeze({
  "공격 속도": "높을수록",
  "공격 속도 및 스킬 사용 속도": "높을수록",
  "궁극기 게이지 회복량": "높을수록",
  "궁극기 게이지 획득량": "높을수록",
  "다음 1회의 공격 속도": "높을수록",
  "모든 스킬 재사용 대기 시간": "낮을수록",
  "받는 피해": "낮을수록",
  "받는 회복량": "높을수록",
  "스킬 사용 속도": "높을수록",
  "오염의 지속 시간": "낮을수록",
  "이동 속도": "높을수록",
  "재사용 대기 시간 회복 속도": "높을수록",
  "체력": "높을수록",
  "캐스팅 및 차지 속도": "높을수록",
  "회복 구슬을 획득한 대상의 최대 체력": "높을수록",
  "회복량": "높을수록"
});

export const TRANSCEND_EMBLEM = Object.freeze({
  "durationSeconds": 10,
  "cooldownSeconds": 4,
  "stacksRequired": 5
});

export const UTILITY_DAMAGE_EQUIVALENT = Object.freeze({
  "햇살+": {
    "percent": 0,
    "note": "실측: 같은 던전 최소 클리어 타임이 광채 166초 → 햇살 154초(DPS +7.79%). 모델상 타당 데미지는 햇살이 6.26% 열세였으므로 설명되지 않는 나머지가 14.99% 다(쿨감 표기 15% 와 거의 일치하나 1회 측정이라 노이즈가 크다). 지금 0 인 이유는 아래 disabledReason 참고.",
    "disabledReason": "쿨감 룬을 둘 끼면 배수가 1.15×1.15=1.32 로 곱해지는데 쿨감은 그렇게 겹치지 않는다. 다시 켜려면 세트 단위로 한 번만 적용하거나 체감 곡선을 넣어야 한다."
  },
  "공허": {
    "percent": 0,
    "note": "추정. 메커니즘이 다르지만('스킬 8회마다 모든 스킬 쿨 3초 감소') 실질 기여가 햇살과 비슷할 것이라는 사용자 판단. 검증되지 않았다.",
    "disabledReason": "햇살+ 와 같은 이유. 더해서, 햇살 실측값을 그대로 옮긴 것이라 근거가 더 약하다."
  }
});
