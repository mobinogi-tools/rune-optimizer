// 자동 생성 파일 — 직접 수정하지 마라.
// 생성: node tools/build-data.mjs
// 원본: data/masteries.json

export const COMBAT_MASTERIES = Object.freeze({
  "수호": {
    "label": "수호",
    "jobs": [
      "전사",
      "기사",
      "빙결술사"
    ],
    "desc": "전투에서 아군을 보호하는 숙련된 전투 기법.",
    "effects": {
      "break.vulnerabilityDamagePercent": 3
    },
    "uncounted": [
      "받는 데미지 감소 15%"
    ]
  },
  "패기": {
    "label": "패기",
    "jobs": [
      "대검전사",
      "장궁병",
      "전격술사",
      "암흑술사"
    ],
    "desc": "근거리에서 공격을 수행하는 숙련된 전투 기법.",
    "effects": {
      "enhancement.heavyDamagePercent": 5
    },
    "uncounted": [
      "받는 기본 공격 데미지 감소 10%"
    ]
  },
  "위협": {
    "label": "위협",
    "jobs": [
      "검술사",
      "석궁사수"
    ],
    "desc": "근거리에서 공격을 수행하는 숙련된 전투 기법.",
    "effects": {
      "critical.criticalDamagePercent": 5
    },
    "uncounted": [
      "받는 기본 공격 데미지 감소 10%"
    ]
  },
  "쾌속": {
    "label": "쾌속",
    "jobs": [
      "궁수",
      "악사",
      "댄서",
      "도적"
    ],
    "desc": "원거리에서 공격을 수행하는 숙련된 전투 기법.",
    "effects": {
      "enhancement.rapidDamagePercent": 5
    },
    "uncounted": []
  },
  "기교": {
    "label": "기교",
    "jobs": [
      "마법사",
      "화염술사"
    ],
    "desc": "원거리에서 공격을 수행하는 숙련된 전투 기법.",
    "effects": {
      "enhancement.areaDamagePercent": 5
    },
    "uncounted": []
  },
  "지원": {
    "label": "지원",
    "jobs": [
      "사제",
      "수도사",
      "힐러",
      "음유시인"
    ],
    "desc": "후방에서 아군을 치료하는 숙련된 전투 기법.",
    "effects": {
      "enhancement.rapidDamagePercent": 3
    },
    "uncounted": [
      "회복량 증가 10%"
    ]
  },
  "파멸": {
    "label": "파멸",
    "jobs": [
      "듀얼블레이드",
      "격투가"
    ],
    "desc": "근거리에서 공격을 수행하는 숙련된 전투 기법.",
    "effects": {
      "break.vulnerabilityDamagePercent": 5
    },
    "uncounted": [
      "받는 기본 공격 데미지 감소 10%"
    ]
  }
});
