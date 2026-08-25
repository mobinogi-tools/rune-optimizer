// 자동 생성 파일 — 직접 수정하지 마라.
// 생성: node tools/build-data.mjs
// 원본: data/artifacts.json

export const ARTIFACTS = Object.freeze([
  {
    "name": "순수",
    "color": "무색",
    "unique": true,
    "desc": "공격력이 2% 증가한다.",
    "effects": {
      "attackIncrease.itemAttackPercent": 2
    }
  },
  {
    "name": "조화",
    "color": "무색",
    "unique": true,
    "desc": "적색, 청색, 녹색 팔라딘 아티팩트를 각각 1개씩 착용한 것으로 간주한다. 적에게 주는 피해가 2% 증가한다.",
    "effects": {
      "damageIncrease.itemMainDamagePercent": 2
    }
  },
  {
    "name": "강인함",
    "color": "무색",
    "unique": true,
    "desc": "적색 팔라딘 아티팩트를 2개 착용한 것으로 간주한다. 치명타 확률이 1.80% 증가한다.",
    "effects": {
      "critical.runeCriticalRatePercent": 1.8
    }
  },
  {
    "name": "기교",
    "color": "무색",
    "unique": true,
    "desc": "녹색 팔라딘 아티팩트를 2개 착용한 것으로 간주한다. 추가타 확률이 1.80% 증가한다.",
    "effects": {
      "extraHit.runeExtraRatePercent": 1.8
    }
  },
  {
    "name": "마력",
    "color": "무색",
    "unique": false,
    "desc": "캐스팅 및 차지 스킬로 주는 피해가 3% 증가한다.",
    "requires": "무색 2개 이상",
    "requiresColors": {
      "무색": 2
    },
    "skillTypeOnly": "캐스팅 및 차지 스킬 피해 3%",
    "skillTypeBonuses": [
      {
        "stat": "캐스팅 및 차지 스킬로 주는 피해",
        "value": 3
      }
    ]
  },
  {
    "name": "연격",
    "color": "무색",
    "unique": false,
    "desc": "콤보 피해가 2% 증가한다.",
    "requires": "적색 1개, 청색 1개, 녹색 1개 이상",
    "effects": {
      "enhancement.comboDamagePercent": 2
    }
  },
  {
    "name": "지혜",
    "color": "무색",
    "unique": true,
    "desc": "청색 팔라딘 아티팩트를 2개 착용한 것으로 간주한다. 스킬 사용 속도가 2%, 캐스팅 및 차지 속도가 2% 증가한다.",
    "uncounted": "스킬 사용 속도 2%, 캐스팅·차지 속도 2%"
  },
  {
    "name": "연타",
    "color": "청색",
    "unique": false,
    "desc": "연타 피해가 2% 증가한다.",
    "requires": "무색 1개 이상",
    "effects": {
      "enhancement.rapidDamagePercent": 2
    }
  },
  {
    "name": "원소",
    "color": "청색",
    "unique": false,
    "desc": "속성 피해가 2% 증가한다.",
    "requires": "적색 1개, 청색 1개, 녹색 1개 이상",
    "skillTypeOnly": "속성 피해 2%"
  },
  {
    "name": "수호",
    "color": "청색",
    "unique": true,
    "desc": "팔라딘 변신이 지속되는 동안 받는 피해가 9% 감소하며, 적에게 주는 피해가 6% 증가한다.",
    "requires": "녹색 1개 이상",
    "conditional": "팔라딘 변신 중 피증 6%"
  },
  {
    "name": "가호",
    "color": "청색",
    "unique": true,
    "desc": "해방 효과를 가진 황금색 팔라딘 아티팩트 발동 시, 20초 동안 적에게 주는 피해가 9% 증가한다.",
    "requires": "청색 2개 이상",
    "conditional": "황금(해방) 발동 시 피증 9%"
  },
  {
    "name": "가속",
    "color": "청색",
    "unique": false,
    "desc": "장착한 청색 팔라딘 아티팩트 1개마다 스킬 사용 속도가 0.40% 증가한다. 최대 5개까지 적용된다.",
    "uncounted": "청색 1개당 스킬 사용 속도 0.4% (최대 5개)"
  },
  {
    "name": "신비",
    "color": "청색",
    "unique": true,
    "desc": "팔라딘 변신이 지속되는 동안 재사용 대기 시간 회복 속도가 8% 증가한다.",
    "requires": "무색 1개 이상",
    "uncounted": "팔라딘 변신 중 쿨 회복 8%"
  },
  {
    "name": "심판",
    "color": "청색",
    "unique": true,
    "desc": "해방 효과를 가진 황금색 팔라딘 아티팩트 발동 시, 큰 폭발을 일으켜 주변 적들에게 피해를 준다.",
    "requires": "적색 1개 이상",
    "uncounted": "황금(해방) 연계 폭발 피해"
  },
  {
    "name": "강타",
    "color": "적색",
    "unique": false,
    "desc": "강타 피해가 2% 증가한다.",
    "requires": "무색 1개 이상",
    "effects": {
      "enhancement.heavyDamagePercent": 2
    }
  },
  {
    "name": "분쇄",
    "color": "적색",
    "unique": true,
    "desc": "무방비 피해가 8% 증가한다.",
    "requires": "적색 2개 이상",
    "effects": {
      "break.vulnerabilityDamagePercent": 8
    }
  },
  {
    "name": "확산",
    "color": "적색",
    "unique": false,
    "desc": "멀티히트 피해가 2% 증가한다.",
    "requires": "적색 1개, 청색 1개, 녹색 1개 이상",
    "effects": {
      "enhancement.areaDamagePercent": 2
    }
  },
  {
    "name": "분노",
    "color": "적색",
    "unique": true,
    "desc": "빛의 화살 효과를 가진 황금색 아티팩트 사용 시, 투사체마다 공격력이 20초 동안 0.90% 증가(최대 10중첩).",
    "requires": "청색 1개 이상",
    "conditional": "황금(빛의 화살) 연계, 최대 공격력 9%"
  },
  {
    "name": "파괴",
    "color": "적색",
    "unique": true,
    "desc": "광휘 효과를 가진 황금색 아티팩트 발동 시, 방어구 파괴를 부여해 10초 동안 받는 피해를 10% 증가시킨다.",
    "conditional": "황금(광휘) 연계 방어구 파괴"
  },
  {
    "name": "연사",
    "color": "적색",
    "unique": true,
    "desc": "빛의 화살 효과를 가진 황금색 아티팩트가 발사하는 투사체 수가 2배 증가한다.",
    "requires": "적색 2개 이상",
    "conditional": "황금(빛의 화살) 연계"
  },
  {
    "name": "폭발",
    "color": "적색",
    "unique": true,
    "desc": "광휘 효과를 가진 황금색 아티팩트의 피해량과 폭발 범위가 2배 증가한다.",
    "conditional": "황금(광휘) 연계"
  },
  {
    "name": "신속",
    "color": "녹색",
    "unique": false,
    "desc": "장착한 녹색 팔라딘 아티팩트 1개마다 캐스팅 및 차지 속도가 1% 증가한다. 최대 5개까지 적용된다.",
    "uncounted": "녹색 1개당 캐스팅·차지 속도 1% (최대 5개)"
  },
  {
    "name": "회복",
    "color": "녹색",
    "unique": false,
    "desc": "회복량이 3% 증가한다.",
    "requires": "무색 1개 이상",
    "uncounted": "회복량 3%"
  },
  {
    "name": "궁극",
    "color": "녹색",
    "unique": false,
    "desc": "스킬을 사용할 때마다 궁극기 게이지를 2.00% 획득한다. (쿨 20초)",
    "requires": "청색 3개 이상",
    "uncounted": "궁극기 게이지 2%"
  },
  {
    "name": "질풍",
    "color": "녹색",
    "unique": true,
    "desc": "축복 효과를 가진 황금색 아티팩트 사용 시, 축복 적용 시 20초 동안 모든 속도가 9% 증가한다.",
    "requires": "청색 1개 이상",
    "conditional": "황금(축복) 연계 속도 9%"
  },
  {
    "name": "열정",
    "color": "녹색",
    "unique": true,
    "desc": "선고 효과를 가진 황금색 아티팩트 사용 시, 선고된 적 공격마다 스킬 쿨이 0.4초씩 감소한다.",
    "requires": "무색 1개 이상",
    "conditional": "황금(선고) 연계 쿨 감소"
  },
  {
    "name": "선고",
    "color": "녹색",
    "unique": true,
    "desc": "선고 효과를 가진 황금색 아티팩트 사용 시, 선고 부여마다 지속 피해를 추가로 준다.",
    "requires": "녹색 2개 이상",
    "conditional": "황금(선고) 연계 지속 피해"
  },
  {
    "name": "재생",
    "color": "녹색",
    "unique": true,
    "desc": "축복 효과를 가진 황금색 아티팩트 사용 시, 축복 적용마다 주변 아군을 회복시킨다.",
    "requires": "적색 1개 이상",
    "conditional": "황금(축복) 연계 회복"
  },
  {
    "name": "유성우",
    "color": "황금",
    "unique": true,
    "desc": "팔라딘 변신 시작 시, 힘을 해방하여 주변 12m 범위 내의 적들에게 빛의 화살을 6개 발사한다. 빛의 화살은 각각 공격력의 25%의 피해를 준다.",
    "uncounted": "변신 시작 시 빛의 화살 6발(각 공격력 25%) — 별도 타격이라 공식에 자리가 없다"
  },
  {
    "name": "서광",
    "color": "황금",
    "unique": true,
    "desc": "팔라딘 변신이 지속되는 동안 5초마다 빛의 화살 2개를 타겟에게 발사하여 각각 공격력의 19%의 피해를 준다.",
    "uncounted": "변신 중 5초마다 빛의 화살 2발(각 공격력 19%) — 별도 타격"
  },
  {
    "name": "천벌",
    "color": "황금",
    "unique": true,
    "desc": "팔라딘 변신 시작 시, 힘을 해방하여 주변 12m 범위 내의 적 최대 7명에게 빛줄기를 떨어뜨린다. 빛줄기는 각각 1.5m 범위에 공격력의 22%의 폭발 피해를 준다.",
    "uncounted": "변신 시작 시 빛줄기 최대 7명(각 공격력 22%) — 별도 타격, 다수 대상 전제"
  },
  {
    "name": "집행자",
    "color": "황금",
    "unique": true,
    "desc": "팔라딘 변신 도중 무방비 공격 시, 타겟 주변 4m 범위 내의 적들에게 공격력의 7%의 폭발 피해를 주고 강화 효과를 부여한다.",
    "uncounted": "변신 중 무방비 공격 시 폭발(공격력 7%) — 별도 타격"
  },
  {
    "name": "영웅",
    "color": "황금",
    "unique": true,
    "desc": "팔라딘 변신이 지속되는 동안 공격력이 5% 증가하는 강화 효과를 부여하며, 공격 적중 시 약화 효과를 부여한다.",
    "conditional": "팔라딘 변신 중 공격력 5%"
  },
  {
    "name": "화신",
    "color": "황금",
    "unique": true,
    "desc": "팔라딘 변신 시, 20초 동안 지속되는 오라를 활성화해 5초마다 주변 12m 범위 내의 적들에게 약화 효과를 부여한다.",
    "uncounted": "변신 시 오라 — 약화 효과라 수치 기여를 특정할 수 없다"
  },
  {
    "name": "은의 기사",
    "color": "은색",
    "unique": true,
    "desc": "적색, 청색, 녹색, 무색 팔라딘 아티팩트를 각각 1개씩 추가로 착용한 것으로 간주한다. 공격력이 2% 증가한다. 팔라딘 변신 시 외형이 바뀐다.",
    "effects": {
      "attackIncrease.itemAttackPercent": 2
    }
  }
]);
