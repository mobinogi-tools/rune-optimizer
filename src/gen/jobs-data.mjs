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
    "effects": {},
    "confidence": "low",
    "note": "추진력은 룬 이동 속도와 질주하는 바람의 평균 이동 속도 증가를 최종 대미지로 환산한다. 장신구·파티 버프 등 그 밖의 이동 속도는 계산 범위 밖이다."
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
    "extendedSeconds": 5,
    "cycleSeconds": 60,
    "effects": {},
    "confidence": "high",
    "note": "템포 2단계는 평상시 가동률과 절묘한 박자감 보정을 함께 계산한다. 밤의 축복 기본 15초에는 확정이며, 스포트라이트가 늘린 5초에는 템포가 끝난 것으로 본다."
  },
  "도적": {
    "trigger": "포이즌 트랩, 스플린터 트랩 스킬 사용 시",
    "effects": {},
    "confidence": "high",
    "note": "트랩 계열은 자버프가 없다."
  },
  "듀얼블레이드": {
    "trigger": "하울링 게일, 하울링 템페스트 스킬 사용 시",
    "effects": {},
    "confidence": "medium",
    "note": "하울링 템페스트의 추가타 확률은 전투 중 유지되는 효과로 별도 계산한다. 리버레이트는 마스터 엠블럼을 기본 장착하더라도 실제 가동률이 달라 별도 입력에서 계산한다."
  },
  "마법사": {
    "trigger": "텔레키네시스 스킬 사용 시",
    "effects": {},
    "confidence": "high",
    "note": "겹치는 버프 없음."
  },
  "빙결술사": {
    "trigger": "아이스 스파이크 스킬 사용 시",
    "effects": {},
    "confidence": "high",
    "note": "아이스 스파이크 공격력 증가는 평상시 가동률 입력으로 계산하고 밤의 축복 기본 구간에는 확정으로 계산한다."
  },
  "사제": {
    "trigger": "생츄어리 스킬 사용 시",
    "effects": {},
    "confidence": "low",
    "note": "성전은 적용되는 세 스킬의 딜 비중과 평균 신성력 소모량으로 계산한다."
  },
  "석궁사수": {
    "trigger": "강화 볼트 소모 스킬 사용 시",
    "effects": {},
    "confidence": "medium",
    "note": "드라이빙 포스는 각성 구간 근사값으로 계산하지 않고, 평균 중첩과 스킬 자원 소모 딜 비중으로 별도 계산한다."
  },
  "수도사": {
    "trigger": "화신, 치유 스킬 사용 시",
    "effects": {},
    "confidence": "low",
    "note": "치유 → 평온의 진언 공격력 +10%(30초)."
  },
  "악사": {
    "trigger": "기교: 크레센도 스킬 사용 시",
    "effects": {},
    "confidence": "low",
    "note": "크레센도는 밤의 축복 전용 효과가 아니므로 전투 전체 평균 공격력 입력에서 계산한다."
  },
  "암흑술사": {
    "trigger": "혼돈의 제례 스킬 사용 시",
    "effects": {},
    "confidence": "medium",
    "note": "각성 구간에만 겹치는 자버프는 없다. 혼돈의 제례가 주는 의식 강화(치확 +10%)는 600초짜리라 각성 주기보다 훨씬 길어 상시 패시브 쪽으로 옮겼다."
  },
  "음유시인": {
    "trigger": "바즈 테일 스킬 적중 시",
    "effects": {},
    "confidence": "medium",
    "note": "전장의 노래 치확 +3%·추확 +3%, 최대 3중첩(30초). 3중첩 유지 기준."
  },
  "장궁병": {
    "trigger": "쉘 브레이커, 데들리 샷 스킬 사용 시",
    "effects": {},
    "confidence": "medium",
    "note": "자버프가 아니라 쉘 브레이커의 적 디버프 [시너지] 받는 대미지 증가 10%(20초). 대상에게 걸리는 것이라 단일 대상 기준이다."
  },
  "전격술사": {
    "trigger": "과충전 10중첩 이상 도달 후 스킬 공격 적중 시",
    "effects": {},
    "confidence": "medium",
    "note": "과충전은 각성 구간만의 일반 주는 대미지가 아니라 전투 중 유지되는 스킬 피해 효과다. 평균 중첩 입력에서 별도로 계산한다."
  },
  "전사": {
    "trigger": "전장의 함성 스킬 사용 시",
    "effects": {},
    "confidence": "high",
    "note": "전장의 함성 [시너지] 대미지 증가 10%, 지속 25초."
  },
  "화염술사": {
    "trigger": "플래시 오버, 인페르노 스킬 사용 시",
    "effects": {},
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

export const CLASS_JOB_INPUTS = Object.freeze({
  "검술사": [
    {
      "key": "classPassiveUptimePercent",
      "label": "집중 가동률 %",
      "group": "직업 특성",
      "default": 100,
      "min": 0,
      "max": 100,
      "hint": "집중 상태에서 치명타 확률 +40%, 치명타 피해 +30%. 집중력이 1초에 5씩 차고 집중 중에는 1초에 5씩 빠져 방치하면 50% 근처지만, 숙련되면 100% 로 유지합니다. 밤의 축복 트리거(간파)가 집중력 35를 채워 그 구간에는 확정 발동합니다."
    }
  ],
  "격투가": [
    {
      "key": "fighterBackStepSkillSharePercent",
      "label": "백 스텝 보정 스킬 딜 비중 %",
      "group": "직업 특성",
      "default": 0,
      "min": 0,
      "max": 100,
      "hint": "전체 딜 중 백 스텝 뒤 스킬 대미지 50% 증가를 실제로 받는 공격의 비중입니다."
    },
    {
      "key": "fighterLinkedSkillSharePercent",
      "label": "연계 공격 스킬 딜 비중 %",
      "group": "직업 특성",
      "default": 0,
      "min": 0,
      "max": 100,
      "hint": "전체 딜 중 연계 공격의 스킬 대미지 5% 증가를 받는 연계·콤보 스킬 비중입니다."
    }
  ],
  "궁수": [
    {
      "key": "archerTailwindUptimePercent",
      "label": "질주하는 바람 가동률 %",
      "group": "직업 특성",
      "default": 100,
      "min": 0,
      "max": 100,
      "hint": "질주하는 바람의 이동 속도 증가 25%가 유지되는 시간 비율입니다. 추진력으로 이동 속도 1%당 최종 대미지 0.5%를 계산합니다."
    },
    {
      "key": "archerWeakPointAttackSharePercent",
      "label": "약점 공격 비중 %",
      "group": "직업 특성",
      "default": 30,
      "min": 0,
      "max": 100,
      "hint": "전체 공격 중 약점 관통의 약점 대상에게 적중하는 비율입니다. 해당 공격의 최종 대미지 30%를 이 비중만큼 계산합니다."
    }
  ],
  "기사": [
    {
      "key": "classPassiveUptimePercent",
      "label": "기사단의 서약 가동률 %",
      "group": "직업 특성",
      "default": 44,
      "min": 0,
      "max": 100,
      "hint": "기사단의 서약 중 공격력 +15%, 치명타 확률 +10%, 추가타 확률 +10%, 지속 20초. 지휘관의 시너지 피증도 이 동안 10% → 20% 로 올라갑니다(증분 10% 포함). 매 세 번째 서약마다 발동하므로 명예 게이지가 차는 속도가 가동률을 정합니다. 밤의 축복 트리거가 곧 이 발동이라 그 구간에는 확정입니다."
    },
    {
      "key": "knightShatterDebuffActivationPercent",
      "label": "파쇄 받피증 발동률 %",
      "group": "직업 특성",
      "default": 100,
      "min": 0,
      "max": 100,
      "hint": "파쇄의 받는 대미지 증가 10%가 대상에게 실제로 발동하는 비율입니다."
    }
  ],
  "대검전사": [
    {
      "key": "greatswordUltimateAttackBuffDurationSeconds",
      "label": "궁극기 공격력 버프 지속 (초)",
      "group": "직업 특성",
      "default": 10,
      "min": 0,
      "max": 120,
      "hint": "한 전투에서 궁극기를 1회 사용해 공격력 50%가 유지되는 시간입니다. 여러 번 사용한다면 총 유지 시간으로 고쳐 넣으세요."
    }
  ],
  "댄서": [
    {
      "key": "dancerSingleTarget",
      "label": "단일 대상 기준",
      "group": "직업 특성",
      "type": "boolean",
      "default": true,
      "hint": "켜면 클로즈드 포지션의 단일 대상 최종 대미지 15%를 더 계산합니다. 기본 최종 대미지 10%는 대상 수와 관계없이 적용됩니다."
    },
    {
      "key": "dancerTempoUptimePercent",
      "label": "평상시 템포 2단계 가동률 %",
      "group": "직업 특성",
      "default": 60,
      "min": 0,
      "max": 100,
      "hint": "밤의 축복 밖에서 템포 2단계를 유지하는 시간 비율입니다. 밤의 축복 구간은 100%로 계산합니다. 템포 1중첩당 기본 최종 대미지 20%에 절묘한 박자감의 상대 증가분을 적용합니다."
    }
  ],
  "듀얼블레이드": [
    {
      "key": "dualBladeLiberateUptimePercent",
      "label": "리버레이트 가동률 %",
      "group": "직업 특성",
      "default": 0,
      "min": 0,
      "max": 100,
      "hint": "마스터 엠블럼의 리버레이트를 실제로 유지하는 시간 비율입니다. 유지 중 최종 대미지와 치명타 확률 15%를 계산합니다. 사용하지 않으면 0으로 두세요."
    }
  ],
  "마법사": [
    {
      "key": "mageOverSurgeAverageStacks",
      "label": "오버 서지 평균 중첩",
      "group": "직업 특성",
      "default": 0,
      "min": 0,
      "max": 50,
      "hint": "최근 5초 동안 소모한 마나로 유지되는 평균 중첩입니다. 중첩당 스킬 피해 0.2%, 최대 50중첩으로 계산합니다."
    },
    {
      "key": "mageArcanePowerAverageElements",
      "label": "아케인 파워 활성 원소 수",
      "group": "직업 특성",
      "default": 3,
      "min": 0,
      "max": 3,
      "hint": "활성화한 원소 하나당 공격력 3%를 계산합니다."
    }
  ],
  "빙결술사": [
    {
      "key": "iceScatteredFrostAverageStacks",
      "label": "흩날리는 서리 평균 중첩",
      "group": "직업 특성",
      "default": 0,
      "min": 0,
      "hint": "최근 10초 동안 소모한 서리의 평균 칸 수입니다. 중첩당 적에게 주는 대미지 4%로 계산합니다. 효과 자체의 중첩 상한은 없으므로 입력을 임의로 자르지 않습니다."
    },
    {
      "key": "iceSpikeUptimePercent",
      "label": "평상시 아이스 스파이크 가동률 %",
      "group": "직업 특성",
      "default": 75,
      "min": 0,
      "max": 100,
      "hint": "밤의 축복 밖에서 아이스 스파이크 공격력 20%가 유지되는 시간 비율입니다. 밤의 축복 구간은 100%로 계산합니다."
    }
  ],
  "사제": [
    {
      "key": "priestSanctificationSkillSharePercent",
      "label": "성전 적용 스킬 딜 비중 %",
      "group": "직업 특성",
      "default": 0,
      "min": 0,
      "max": 100,
      "hint": "성전이 적용되는 세 스킬이 전체 딜에서 차지하는 합계 비중입니다."
    },
    {
      "key": "priestSanctificationAverageHolyPowerCost",
      "label": "성전 스킬 평균 신성력 소모",
      "group": "직업 특성",
      "default": 25,
      "min": 0,
      "max": 100,
      "hint": "성전 적용 스킬을 한 번 쓸 때 평균적으로 소모하는 신성력입니다. 신성력 1당 해당 스킬 최종 대미지 0.8%로 계산합니다."
    },
    {
      "key": "priestEnemyLinkEnabled",
      "label": "적 링커 연결",
      "group": "직업 특성",
      "type": "boolean",
      "default": true,
      "hint": "켜면 적에게 서먼 링커를 연결하고 그 대상을 직접 공격하는 기준으로, 사제 자신의 주는 대미지 10%를 계산합니다. 아군 연결 운용이면 끄세요."
    }
  ],
  "석궁사수": [
    {
      "key": "crossbowDrivingForceAverageStacks",
      "label": "드라이빙 포스 평균 중첩",
      "group": "직업 특성",
      "default": 2,
      "min": 0,
      "max": 2,
      "hint": "강화 볼트 계열을 사용할 때 유지하는 드라이빙 포스의 평균 중첩입니다. 중첩당 스킬 피해 30%를 스킬 자원 소모 딜 비중만큼 계산합니다."
    }
  ],
  "수도사": [
    {
      "key": "monkGuidanceMantraUptimePercent",
      "label": "인도의 진언 가동률 %",
      "group": "직업 특성",
      "default": 0,
      "min": 0,
      "max": 100,
      "hint": "인도의 진언을 유지하는 시간 비율입니다. 유지 중 최종 대미지 10%를 계산합니다. 다른 진언을 사용하면 0으로 두세요."
    }
  ],
  "악사": [
    {
      "key": "musicianCadenzaFinalDamageAverageStacks",
      "label": "카덴차 최종 대미지 평균 중첩",
      "group": "직업 특성",
      "default": 3,
      "min": 0,
      "max": 3,
      "hint": "전투 중 유지되는 카덴차의 최종 대미지 중첩 수입니다. 중첩당 5%, 최대 3중첩으로 계산합니다."
    },
    {
      "key": "musicianCrescendoAverageAttackPercent",
      "label": "크레센도 평균 공격력 증가 %",
      "group": "직업 특성",
      "default": 20,
      "min": 0,
      "max": 30,
      "hint": "소모한 무드와 실제 가동 시간을 반영한 전투 전체 평균 공격력 증가입니다."
    }
  ],
  "암흑술사": [
    {
      "key": "darkMageProphecyUptimePercent",
      "label": "파멸의 예언 가동률 %",
      "group": "직업 특성",
      "default": 0,
      "min": 0,
      "max": 100,
      "hint": "파멸의 예언 강화 효과가 유지되는 시간 비율입니다. 유지 중 최종 대미지 15%를 계산합니다."
    }
  ],
  "장궁병": [
    {
      "key": "longbowSnipingUptimePercent",
      "label": "저격 자세 가동률 %",
      "group": "직업 특성",
      "default": 100,
      "min": 0,
      "max": 100,
      "hint": "저격 자세 중 치명타 확률과 강타 피해 15%가 유지되는 시간 비율입니다."
    }
  ],
  "전격술사": [
    {
      "key": "electricOverchargeAverageStacks",
      "label": "과충전 평균 중첩",
      "group": "직업 특성",
      "default": 10,
      "min": 0,
      "max": 22,
      "hint": "전투 중 평균 과충전 중첩입니다. 중첩당 스킬 피해 10%로 계산하며, 최대 22중첩입니다."
    }
  ],
  "화염술사": [
    {
      "key": "fireStage3UptimePercent",
      "label": "버닝 소울 3단계 가동률 %",
      "group": "직업 특성",
      "default": 0,
      "min": 0,
      "max": 100,
      "hint": "평상시 버닝 소울 3단계를 유지하는 시간 비율입니다. 3단계 동안 최종 대미지 15%와, 스킬 위력 5000에서 최대 20%가 되는 집중된 화염을 함께 계산합니다. 개인 사이클을 모르므로 기본값은 0이고, 인페르노로 시작하는 밤의 축복 구간만 100%로 계산합니다."
    }
  ],
  "힐러": [
    {
      "key": "healerReviveAverageStacks",
      "label": "소생 평균 중첩",
      "group": "직업 특성",
      "default": 40,
      "min": 0,
      "max": 40,
      "hint": "소생으로 실제 유지되는 평균 중첩입니다. 1중첩마다 자신의 주는 대미지가 1.5% 증가하며 최대 40중첩입니다. 짧은 전투나 중첩 유지가 어려우면 낮추세요."
    }
  ]
});

export const CLASS_UPTIME_PASSIVES = Object.freeze({
  "검술사": [
    {
      "name": "집중",
      "label": "집중 가동률 %",
      "effects": {
        "critical.runeCriticalRatePercent": 40,
        "critical.criticalDamagePercent": 30
      },
      "uptimePercentFrom": "classPassiveUptimePercent",
      "nightBlessingGuarantees": true,
      "defaultUptimePercent": 100,
      "hint": "집중 상태에서 치명타 확률 +40%, 치명타 피해 +30%. 집중력이 1초에 5씩 차고 집중 중에는 1초에 5씩 빠져 방치하면 50% 근처지만, 숙련되면 100% 로 유지합니다. 밤의 축복 트리거(간파)가 집중력 35를 채워 그 구간에는 확정 발동합니다."
    }
  ],
  "기사": [
    {
      "name": "기사단의 서약",
      "label": "기사단의 서약 가동률 %",
      "effects": {
        "attackIncrease.itemAttackPercent": 15,
        "critical.runeCriticalRatePercent": 10,
        "extraHit.runeExtraRatePercent": 10
      },
      "uptimePercentFrom": "classPassiveUptimePercent",
      "nightBlessingGuarantees": true,
      "defaultUptimePercent": 44,
      "hint": "기사단의 서약 중 공격력 +15%, 치명타 확률 +10%, 추가타 확률 +10%, 지속 20초. 지휘관의 시너지 피증도 이 동안 10% → 20% 로 올라갑니다(증분 10% 포함). 매 세 번째 서약마다 발동하므로 명예 게이지가 차는 속도가 가동률을 정합니다. 밤의 축복 트리거가 곧 이 발동이라 그 구간에는 확정입니다."
    }
  ],
  "듀얼블레이드": [
    {
      "name": "리버레이트",
      "label": "리버레이트 가동률 %",
      "effects": {
        "finalDamage.percent": 15,
        "critical.runeCriticalRatePercent": 15
      },
      "uptimePercentFrom": "dualBladeLiberateUptimePercent",
      "nightBlessingGuarantees": false,
      "defaultUptimePercent": 0,
      "hint": "마스터 엠블럼의 리버레이트를 실제로 유지하는 시간 비율입니다. 유지 중 최종 대미지와 치명타 확률 15%를 계산합니다. 사용하지 않으면 0으로 두세요."
    }
  ]
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
        "damageIncrease.synergyDamagePercent": 10
      },
      "note": "전투 상태가 되면 조건 없이 붙고 지속시간이 무제한이라 상시다. [시너지] 대미지 증가 10%. 기사단의 서약 중에는 자신에 한해 20% 가 되는데, 그 증분 10 은 유지형 패시브 쪽에 있다."
    }
  ],
  "댄서": [
    {
      "name": "클로즈드 포지션",
      "effects": {
        "finalDamage.percent": 10
      },
      "note": "대상 수와 관계없이 적용되는 기본 최종 대미지 증가분이다. 단일 대상 추가분은 별도 선택에서 계산한다."
    }
  ],
  "듀얼블레이드": [
    {
      "name": "하울링 템페스트",
      "effects": {
        "extraHit.runeExtraRatePercent": 15
      },
      "note": "전투 중 유지되는 추가타 확률 증가를 계산한다."
    }
  ],
  "빙결술사": [
    {
      "name": "프리징 필드",
      "effects": {
        "damageIncrease.receivedDamagePercent": 10
      },
      "note": "단일 대상 전투에서 유지되는 받는 대미지 증가를 계산한다."
    }
  ],
  "사제": [
    {
      "name": "직업 최종 대미지",
      "effects": {
        "finalDamage.percent": 5
      }
    }
  ],
  "수도사": [
    {
      "name": "평온의 진언",
      "effects": {
        "attackIncrease.itemAttackPercent": 10
      },
      "note": "기본 장착 및 상시 유지 기준으로 계산한다."
    },
    {
      "name": "빛의 진언",
      "effects": {
        "damageIncrease.skillDamagePercent": 15
      },
      "note": "기본 장착 및 상시 유지 기준으로 계산한다."
    }
  ],
  "악사": [
    {
      "name": "아르페지오",
      "effects": {
        "damageIncrease.receivedDamagePercent": 10
      },
      "note": "지속시간과 재사용 대기시간이 같아 단일 대상 전투에서 상시 유지로 계산한다."
    }
  ],
  "암흑술사": [
    {
      "name": "의식 강화",
      "effects": {
        "critical.runeCriticalRatePercent": 10
      },
      "note": "빙의 시 치명타 확률 +10%, 지속 600초. 각성 주기(60초)보다 열 배 길어서 한 번 켜면 사실상 상시다 — 각성 구간 버프가 아니라 상시 패시브로 본다. 빙의를 안 하는 빌드면 0 이다."
    }
  ],
  "음유시인": [
    {
      "name": "전장의 노래",
      "effects": {
        "critical.runeCriticalRatePercent": 9,
        "extraHit.runeExtraRatePercent": 9
      },
      "note": "3중첩 유지 기준으로 계산한다."
    }
  ],
  "장궁병": [
    {
      "name": "쉘 브레이커",
      "effects": {
        "damageIncrease.receivedDamagePercent": 10
      },
      "note": "재사용 대기시간보다 디버프 지속시간이 길어 단일 대상 전투에서 상시로 계산한다."
    }
  ],
  "전사": [
    {
      "name": "전장의 함성",
      "effects": {
        "damageIncrease.synergyDamagePercent": 10
      },
      "note": "지속시간이 재사용 대기시간보다 길어 전투 중 상시 유지로 계산한다."
    }
  ],
  "화염술사": [
    {
      "name": "이그나이트",
      "effects": {
        "critical.criticalDamagePercent": 10
      },
      "note": "직업 패시브의 상시 치명타 대미지 증가."
    }
  ],
  "힐러": [
    {
      "name": "전이·고동치는 빛",
      "effects": {
        "finalDamage.percent": 20
      },
      "note": "자신에게 적용되는 최종 대미지 증가 10% 두 효과를 합산한다."
    },
    {
      "name": "오토 실드+",
      "effects": {
        "attackIncrease.itemAttackPercent": 15
      },
      "note": "마스터 엠블럼 기본 장착과 실드 유지 기준으로 계산한다."
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
      "hitsPerSecond": 3,
      "skillCastsPerSecond": 1,
      "rapidRatePercent": 99,
      "heavyRatePercent": 99,
      "areaRatePercent": 0,
      "characterCriticalRatePercent": 12,
      "characterExtraRatePercent": 12
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
 *  게임 툴팁이 명시한 세 직업이다. 목록이 아니라 직업 파일의 dualWield 가 진실이다. */
export const DUAL_WIELD_JOBS = Object.freeze([
  "격투가",
  "댄서",
  "듀얼블레이드"
]);

/** 기본 공격(평타)을 실제로 섞는 직업. 화면 체크박스의 기본값이고, 사람마다 바꿀 수 있다.
 *  대부분의 직업은 평타를 안 하려고 한다 — 스킬로 채우는 것이 이득이라서다.
 *  그래서 기본은 false 고, 섞는 직업만 여기 들어온다. */
export const BASIC_ATTACK_JOBS = Object.freeze([
  "궁수",
  "기사",
  "도적",
  "듀얼블레이드",
  "수도사"
]);

/** 스킬 자원을 소모하는 스킬이 딜에서 차지하는 기본 비중(%). 직업이 기본값만 주고,
 *  칸은 모든 직업에 뜬다 — 표에 없는 직업이라고 칸을 감추면 그 직업에서 무한한 탐욕을
 *  낀 사람은 값이 0 인데 고칠 자리가 없다. 표에 없으면 기본값이 0 일 뿐이다. */
export const RESOURCE_SKILL_SHARE = Object.freeze({
  "석궁사수": 60
});

/** 브레이크 스킬 버프 가동률에 쓰는 직업별 기본값. 여러 기본 스킬에 브레이크 대미지가
 * 있으면 재사용 대기시간이 가장 짧은 것을 쓴다. 장신구·세공에 따라 달라져 화면에서 고친다. */
export const BREAK_SKILL_DEFAULTS = Object.freeze({
  "검술사": {
    "skill": "비검: 칼집 치기",
    "cooldownSeconds": 10,
    "note": "기본 액티브의 브레이크 대미지 표기 스킬 중 가장 짧은 재사용 대기 시간."
  },
  "격투가": {
    "skill": "스러스트 킥",
    "cooldownSeconds": 14,
    "note": "장신구 각인으로 생기는 브레이크는 제외한 기본 액티브 기준."
  },
  "궁수": {
    "skill": "매그넘 샷",
    "cooldownSeconds": 12,
    "note": "기본 액티브의 브레이크 대미지 표기 스킬 기준."
  },
  "기사": {
    "skill": "파쇄",
    "cooldownSeconds": 14,
    "note": "브레이크 익스텐드 제압 명령은 브레이크 뒤에만 열리므로 평균 쿨 기본값에서 제외."
  },
  "대검전사": {
    "skill": "라이징 스매시",
    "cooldownSeconds": 12,
    "note": "장신구 각인으로 추가되는 발구르기 브레이크는 제외한 기본 액티브 기준."
  },
  "댄서": {
    "skill": "윈드밀",
    "cooldownSeconds": 12,
    "note": "기본 액티브의 브레이크 대미지 표기 스킬 기준."
  },
  "도적": {
    "skill": "스크류 대거",
    "cooldownSeconds": 6,
    "note": "기본 액티브의 브레이크 대미지 표기 스킬 중 가장 짧은 재사용 대기 시간."
  },
  "듀얼블레이드": {
    "skill": "더블 크레센트",
    "cooldownSeconds": 17,
    "note": "기본 액티브의 브레이크 대미지 표기 스킬 기준."
  },
  "마법사": {
    "skill": "파이어 볼",
    "cooldownSeconds": 10,
    "note": "기본 액티브의 브레이크 대미지 표기 스킬 기준."
  },
  "빙결술사": {
    "skill": "글래시어 커터",
    "cooldownSeconds": 10,
    "note": "브레이크 익스텐드 아이시클 섀클은 브레이크 뒤에만 열리므로 평균 쿨 기본값에서 제외."
  },
  "사제": {
    "skill": "디바인 윙",
    "cooldownSeconds": 10,
    "note": "기본 액티브의 브레이크 대미지 표기 스킬 중 가장 짧은 재사용 대기 시간."
  },
  "석궁사수": {
    "skill": "쇼크 익스플로전",
    "cooldownSeconds": 8,
    "note": "기본 액티브의 브레이크 대미지 표기 스킬 기준."
  },
  "수도사": {
    "skill": "벽력타",
    "cooldownSeconds": 15,
    "note": "장신구 각인으로 생기는 브레이크는 제외한 기본 액티브 기준."
  },
  "악사": {
    "skill": "기교: 클라이맥스",
    "cooldownSeconds": 8,
    "note": "브레이크 대미지가 명시된 기본 액티브 중 가장 짧은 재사용 대기 시간. 강타 적중 조건은 평균값을 사용자가 조정한다."
  },
  "암흑술사": {
    "skill": "어둠의 손아귀",
    "cooldownSeconds": 20,
    "note": "장신구 각인으로 바뀌는 의식 스킬과 상세 표기에 브레이크 대미지가 없는 스킬은 제외한 기본 액티브 기준."
  },
  "음유시인": {
    "skill": "멜로디 쇼크",
    "cooldownSeconds": 15,
    "note": "카운터에서만 브레이크 대미지가 생기고 쿨타임 표기가 없는 스트링 샷은 평균 쿨 기본값에서 제외."
  },
  "장궁병": {
    "skill": "윙 스큐어",
    "cooldownSeconds": 11,
    "note": "별도 쿨타임이 표기되지 않은 저격 자세 파생 스킬은 제외한 기본 액티브 기준."
  },
  "전격술사": {
    "skill": "전자기 폭풍(초월)",
    "cooldownSeconds": 10,
    "note": "브레이크 대미지가 명시된 액티브 중 가장 짧은 재사용 대기 시간. 초월을 쓰지 않는 운용이면 사용자가 15초로 고친다."
  },
  "전사": {
    "skill": "방패 치기",
    "cooldownSeconds": 10,
    "note": "브레이크 대미지가 명시된 기본 액티브 중 가장 짧은 재사용 대기 시간. 카운터 빈도는 평균값을 사용자가 조정한다."
  },
  "화염술사": {
    "skill": "파이어스톰",
    "cooldownSeconds": 20,
    "note": "기본 액티브의 브레이크 대미지 표기 스킬 기준."
  },
  "힐러": {
    "skill": "팬텀 페인",
    "cooldownSeconds": 12,
    "note": "장신구 각인으로 바뀌는 스킬은 제외한 기본 액티브 기준."
  }
});

/** 브레이크 익스텐드 스킬을 가진 직업. 서광의 게이트이며, 무방비 시작과 100% 겹친다고 본다. */
export const BREAK_EXTEND_JOBS = Object.freeze([
  "기사",
  "빙결술사",
  "전사"
]);

/** 직업이 스킬만으로 적에게 상시로 거는 지속 피해 종류. 화면 체크박스의 기본값이다.
 *  룬이 부여하는 것은 여기 안 적는다 — 그쪽은 세트를 보면 알 수 있어 자동으로 켜진다
 *  (dotsFromRunes). 두 곳에 적으면 룬을 뺀 뒤에도 켜진 채로 남는다. */
export const JOB_DOTS = Object.freeze({
  "댄서": [
    "화상",
    "빙결"
  ],
  "마법사": [
    "감전"
  ],
  "빙결술사": [
    "빙결"
  ],
  "장궁병": [
    "상처"
  ],
  "전격술사": [
    "감전"
  ],
  "화염술사": [
    "화상"
  ]
});

/** 아군을 치유하는 직업. 화면 체크박스의 기본값이다.
 *  전투 숙련과 안 겹친다 — 지원 숙련 넷에 기사·악사가 더 있다. 그래서 파생시키지 않고
 *  직업 파일이 스스로 밝힌다. (도발은 반대로 숙련이 그대로 말해주므로 표가 없다.) */
export const HEALING_JOBS = Object.freeze([
  "기사",
  "사제",
  "수도사",
  "악사",
  "음유시인",
  "힐러"
]);
