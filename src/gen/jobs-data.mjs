// 자동 생성 파일 — 직접 수정하지 마라.
// 생성: node tools/build-data.mjs
// 원본: data/jobs/*.json

export const CLASS_NIGHT_BLESSING = Object.freeze({
  "검술사": {
    "trigger": "간파, 간파가 변화한 스킬 사용 시",
    "effects": {
      "attackIncrease.itemAttackPercent": 30
    },
    "confidence": "medium",
    "note": "선수필승(공격력 +30%, 15초)은 일섬 사용 시 조건 없이 발동한다. 밤의 축복 트리거인 간파를 일섬 뒤에 쓰면 두 15초 창이 겹친다. 로테이션을 그렇게 안 돌리면 0 이다. 집중은 유지형 패시브 쪽에서 따로 계산한다(간파가 집중력 35 를 채워 이 구간에는 확정 발동)."
  },
  "격투가": {
    "trigger": "백 스텝 스킬 사용 시",
    "effects": {},
    "confidence": "medium",
    "note": "밤의 축복 15초 구간을 덮는 자버프가 없어 0 이다."
  },
  "궁수": {
    "trigger": "이스케이프 스텝, 이스케이프 스텝이 변화한 스킬 사용 시",
    "effects": {
      "finalDamage.percent": 12.5
    },
    "confidence": "low",
    "note": "바람 75% 획득 → 질주하는 바람(이속 +25%) → 추진력 최종 데미지 +12.5%. 간접 경로라 실제 가동은 확인되지 않았다."
  },
  "기사": {
    "trigger": "강화 효과: 기사단의 서약을 얻을 시",
    "triggerIntervalSeconds": 45,
    "effects": {},
    "confidence": "high",
    "note": "밤의 축복 트리거가 곧 기사단의 서약 발동이라 두 창이 동기된다(서약 20초 ≥ 밤축 15초). 서약 자체는 유지형 패시브 쪽에서 계산한다."
  },
  "대검전사": {
    "trigger": "강화 효과: 전투 템포가 최대치에 도달하면",
    "effects": {},
    "confidence": "medium",
    "note": "패시브 겹침 없음."
  },
  "댄서": {
    "trigger": "강화 효과: 템포 2단계를 얻을 시",
    "triggerIntervalSeconds": 25,
    "effects": {
      "finalDamage.percent": 40
    },
    "confidence": "high",
    "note": "템포 2중첩 = 최종 데미지 +40%. 지속 15초로 밤의 축복과 완전히 동기된다."
  },
  "도적": {
    "trigger": "포이즌 트랩, 스플린터 트랩 스킬 사용 시",
    "effects": {},
    "confidence": "high",
    "note": "트랩 계열은 자버프가 없다."
  },
  "듀얼블레이드": {
    "trigger": "하울링 게일, 하울링 템페스트 스킬 사용 시",
    "effects": {
      "extraHit.runeExtraRatePercent": 15,
      "critical.runeCriticalRatePercent": 15,
      "attackIncrease.itemAttackPercent": 10
    },
    "confidence": "medium",
    "note": "하울링 템페스트 추확 +15%(60초) + 리버레이트 치확 +15%·공증 +10%(30초). 리버레이트는 마스터 엠블럼이 있어야 한다."
  },
  "마법사": {
    "trigger": "텔레키네시스 스킬 사용 시",
    "effects": {},
    "confidence": "high",
    "note": "겹치는 버프 없음."
  },
  "빙결술사": {
    "trigger": "아이스 스파이크 스킬 사용 시",
    "effects": {
      "attackIncrease.itemAttackPercent": 20
    },
    "confidence": "high",
    "note": "아이스 스파이크 공격력 +20%, 지속 15초. 밤의 축복과 지속시간이 정확히 일치한다."
  },
  "사제": {
    "trigger": "생츄어리 스킬 사용 시",
    "effects": {
      "finalDamage.percent": 20
    },
    "confidence": "low",
    "note": "생츄어리가 신성력 25 를 회복시키고, 성전이 신성력 1당 최종 데미지 +0.8%. 25 × 0.8 = 20. 신성력이 이미 차 있으면 증분이 없어 과대평가일 수 있다."
  },
  "석궁사수": {
    "trigger": "강화 볼트 소모 스킬 사용 시",
    "effects": {
      "damageIncrease.skillDamagePercent": 16
    },
    "confidence": "low",
    "note": "드라이빙 포스 대미지 +30% × 2스택 = +60% 이지만 제한 시간이 4초뿐이다. 60 × 4/15 = 16 으로 깎았다."
  },
  "수도사": {
    "trigger": "화신, 치유 스킬 사용 시",
    "effects": {
      "attackIncrease.itemAttackPercent": 10
    },
    "confidence": "low",
    "note": "치유 → 평온의 진언 공격력 +10%(30초)."
  },
  "악사": {
    "trigger": "기교: 크레센도 스킬 사용 시",
    "effects": {
      "attackIncrease.itemAttackPercent": 20
    },
    "confidence": "low",
    "note": "크레센도 최대 공격력 +30%, 지속 10초. 15초 구간 중 10초만 덮어 30 × 10/15 = 20 으로 깎았다. 소모한 무드에 비례하는 가변값이라 최대치가 아닐 수 있다."
  },
  "암흑술사": {
    "trigger": "혼돈의 제례 스킬 사용 시",
    "effects": {
      "critical.runeCriticalRatePercent": 10
    },
    "confidence": "low",
    "note": "빙의 시 의식 강화 치확 +10%(600초)."
  },
  "음유시인": {
    "trigger": "바즈 테일 스킬 적중 시",
    "effects": {
      "critical.runeCriticalRatePercent": 9,
      "extraHit.runeExtraRatePercent": 9
    },
    "confidence": "medium",
    "note": "전장의 노래 치확 +3%·추확 +3%, 최대 3중첩(30초). 3중첩 유지 기준."
  },
  "장궁병": {
    "trigger": "쉘 브레이커, 데들리 샷 스킬 사용 시",
    "effects": {
      "damageIncrease.itemMainDamagePercent": 10
    },
    "confidence": "medium",
    "note": "자버프가 아니라 쉘 브레이커의 적 디버프 [시너지] 받는 대미지 증가 10%(20초). 대상에게 걸리는 것이라 단일 대상 기준이다."
  },
  "전격술사": {
    "trigger": "과충전 10중첩 이상 도달 후 스킬 공격 적중 시",
    "effects": {
      "damageIncrease.itemMainDamagePercent": 100
    },
    "confidence": "medium",
    "note": "과충전은 중첩당 대미지 +10%, 지속 30초. 트리거 조건이 10중첩 이상이므로 밤의 축복이 켜지는 시점에 최소 +100% 가 이미 깔려 있다. 중첩이 더 쌓이면 커지지만 마나 소모도 같이 커져 10중첩을 하한으로 잡았다."
  },
  "전사": {
    "trigger": "전장의 함성 스킬 사용 시",
    "effects": {
      "damageIncrease.itemMainDamagePercent": 10
    },
    "confidence": "high",
    "note": "전장의 함성 [시너지] 대미지 증가 10%, 지속 25초."
  },
  "화염술사": {
    "trigger": "플래시 오버, 인페르노 스킬 사용 시",
    "effects": {
      "finalDamage.percent": 35
    },
    "confidence": "medium",
    "note": "인페르노 완료 시 버닝 소울 3단계 즉시 획득(최종뎀 +15%) + 집중된 화염 최대 +20%. 집중된 화염은 스킬 위력 5000 상한 비례라 실제로는 20%보다 낮을 수 있다."
  },
  "힐러": {
    "trigger": "서먼 루미너스 스킬 사용 시",
    "effects": {},
    "confidence": "high",
    "note": "빛의 결정 10개 적립만 있고 데미지 버프는 없다."
  }
});

export const CLASS_UPTIME_PASSIVE = Object.freeze({
  "검술사": {
    "name": "집중",
    "label": "집중 가동률 %",
    "effects": {
      "critical.runeCriticalRatePercent": 40,
      "critical.criticalDamagePercent": 30
    },
    "nightBlessingGuarantees": true,
    "defaultUptimePercent": 100,
    "hint": "집중 상태에서 치명타 확률 +40%, 치명타 피해 +30%. 집중력이 1초에 5씩 차고 집중 중에는 1초에 5씩 빠져 방치하면 50% 근처지만, 숙련되면 100% 로 유지합니다. 밤의 축복 트리거(간파)가 집중력 35를 채워 그 구간에는 확정 발동합니다."
  },
  "기사": {
    "name": "기사단의 서약",
    "label": "기사단의 서약 가동률 %",
    "effects": {
      "attackIncrease.itemAttackPercent": 15,
      "critical.runeCriticalRatePercent": 10,
      "extraHit.runeExtraRatePercent": 10,
      "damageIncrease.itemMainDamagePercent": 10
    },
    "nightBlessingGuarantees": true,
    "defaultUptimePercent": 44,
    "hint": "기사단의 서약 중 공격력 +15%, 치명타 확률 +10%, 추가타 확률 +10%, 지속 20초. 지휘관의 시너지 피증도 이 동안 10% → 20% 로 올라갑니다(증분 10% 포함). 매 세 번째 서약마다 발동하므로 명예 게이지가 차는 속도가 가동률을 정합니다. 밤의 축복 트리거가 곧 이 발동이라 그 구간에는 확정입니다."
  }
});

export const CLASS_ALWAYS_ON = Object.freeze({
  "검술사": [
    {
      "name": "날카로운 눈",
      "effects": {
        "critical.criticalDamagePercent": 30
      },
      "note": "치명타 적중마다 중첩당 치댐 +3%, 최대 10중첩(=30%), 지속 10초. 치명타가 아닌 공격이 들어오면 즉시 초기화된다. 치명타율이 높으면 사실상 상시라 최대치로 둔다."
    },
    {
      "name": "연계 검술+",
      "effects": {
        "critical.criticalDamagePercent": 5,
        "enhancement.heavyDamagePercent": 5,
        "enhancement.rapidDamagePercent": 5
      },
      "note": "마스터 엠블럼 필요. 비검-강철 쐐기 → 치댐 +5%, 비검-칼집 치기 → 강타 +5%, 비검-질풍 베기 → 연타 +5%. 셋이 각각 별도 지속시간(20초)을 가지므로 세 종류를 다 돌리면 동시에 붙는다. 칼집 치기를 안 쓰는 조합(관통+평정+일섬)이면 강타 5% 는 빼야 한다. 중첩당 비검 대미지 +5%(최대 25%)는 비검 스킬 한정이라 이 공식에 자리가 없다."
    }
  ],
  "기사": [
    {
      "name": "지휘관",
      "effects": {
        "damageIncrease.itemMainDamagePercent": 10
      },
      "note": "전투 상태가 되면 조건 없이 붙고 지속시간이 무제한이라 상시다. [시너지] 대미지 증가 10%. 기사단의 서약 중에는 자신에 한해 20% 가 되는데, 그 증분 10 은 유지형 패시브 쪽에 있다."
    }
  ]
});

export const JOB_SAMPLES = Object.freeze({
  "댄서": {
    "stats": {
      "rapidEnhance": 6300,
      "heavyEnhance": 2100,
      "areaEnhance": 1600,
      "comboEnhance": 2100,
      "ultimateEnhance": 2000,
      "criticalStat": 10500,
      "breakStat": 2600,
      "extraHitStat": 3900,
      "skillPower": 3000,
      "fastSkill": 1800
    },
    "combat": {
      "hitsPerSecond": 2.4,
      "skillCastsPerSecond": 1,
      "rapidRatePercent": 99,
      "heavyRatePercent": 88,
      "areaRatePercent": 0,
      "characterCriticalRatePercent": 8,
      "characterExtraRatePercent": 8
    }
  }
});

/** 직업마다 계산에 안 넣은 것과 그 이유. limits.html 이 읽는다. */
export const JOB_EXCLUSIONS = Object.freeze({
  "격투가": [
    {
      "what": "백 스텝 — 스킬 대미지 +50%",
      "why": "다음 1타에만 붙어 밤의 축복 15초 구간을 덮지 못한다"
    }
  ],
  "수도사": [
    {
      "what": "화신 — 쇄도·벽력타 대미지 +100%",
      "why": "특정 스킬에만 붙어 한 대 대미지 비교에 자리가 없다"
    }
  ],
  "암흑술사": [
    {
      "what": "갈망+ — 그림자 피해 +50%",
      "why": "6초뿐이고 특정 스킬 한정이다"
    }
  ],
  "음유시인": [
    {
      "what": "즉흥 연주+ — 타격 스킬 대미지 +50%",
      "why": "특정 스킬에만 붙는다"
    }
  ]
});

/** 양손에 같은 무기를 드는 직업. 두 영웅이 이 조건을 탄다.
 *  게임 툴팁은 듀얼블레이드·댄서·격투가를 적었지만, 확인 전까지는 전 직업을
 *  가능으로 둔다 — 틀린 쪽을 고르라면 '못 쓰는데 켜졌다' 가 눈에 띄고,
 *  '쓸 수 있는데 꺼졌다' 는 아무도 모른 채 추천에서 빠진다. */
export const DUAL_WIELD_JOBS = Object.freeze([
  "검술사",
  "격투가",
  "궁수",
  "기사",
  "대검전사",
  "댄서",
  "도적",
  "듀얼블레이드",
  "마법사",
  "빙결술사",
  "사제",
  "석궁사수",
  "수도사",
  "악사",
  "암흑술사",
  "음유시인",
  "장궁병",
  "전격술사",
  "전사",
  "화염술사",
  "힐러"
]);
