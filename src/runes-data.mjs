// 시즌2 룬 데이터 — 이 저장소에 커밋된 데이터셋이다.
//
// data/*.json 과 달리 이 파일에는 생성기가 없다. 손으로 고쳐도 되고, 그게 정상이다.
// 다만 desc 는 게임 안 룬 설명 원문이라, 고칠 일이 있다면 오탈자가 아니라
// **게임이 실제로 바뀐 경우**여야 한다. 바꿀 때는 PR 에 어떻게 확인했는지 적어라.
//
// 담는 범위: 무기·방어구·엠블럼 전량 + 댄서 장신구(브라우저 로딩 최소화).
// 계산에 쓰이는 필드(alwaysOn*, conditionalRaw, uncountedEffects...)는 desc 에서
// 파생된 값이다. 수치의 근거와 해석 규칙은 data/rune-conditionals.json 쪽에 있다.

export const RUNES = Object.freeze({
 "count": 90,
 "items": [
  {
   "name": "불꽃으로 새긴 문장",
   "slot": "무기",
   "grade": "신화",
   "desc": "전투 시작 시, 3분 동안 불의 인장을 활성화해 적에게 주는 피해가 20%, 재사용 대기 시간 회복 속도가 15%, 증가한다.\n밤의 흔적이 45레벨 이상일 경우, 불의 인장이 사라지는 대신 강화되어 공격 적중 시 전방의 적들에게 1.60의 피해를 주는 불길을 내뿜는다. (재사용 대기 시간: 3초)",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 20
   },
   "uncountedEffects": [
    {
     "stat": "재사용 대기 시간 회복 속도",
     "value": 15,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "죽음",
   "slot": "무기",
   "grade": "신화",
   "desc": "공격력이 20%, 치명타 피해가 20%, 증가한다.\n행동 불능을 방지하는 룬의 효과를 받을 수 없게 된다.\n행동 불능 상태가 될 경우, 30초 동안 공격력이 10% 감소한다.",
   "alwaysOnAttackPercent": 20,
   "alwaysOnDamagePercent": 0,
   "alwaysOnExtra": {
    "critical.criticalDamagePercent": 20
   }
  },
  {
   "name": "거대한 분노",
   "slot": "무기",
   "grade": "전설",
   "desc": "적에게 주는 피해가 21% 증가한다.\n강타 적중 시, 스킬 피해가 3% 증가하며 해당 효과는 최대 4회까지 중첩된다. 강타가 아닌 공격 적중 시, 효과가 즉시 해제된다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 21,
   "conditionalRaw": {
    "damageIncrease.skillDamagePercent": 3
   }
  },
  {
   "name": "계시+",
   "slot": "무기",
   "grade": "전설",
   "desc": "공격력이 24% 증가하고, 캐스팅 및 차지 속도가 25% 증가한다.",
   "alwaysOnAttackPercent": 24,
   "alwaysOnDamagePercent": 0,
   "uncountedEffects": [
    {
     "stat": "캐스팅 및 차지 속도",
     "value": 25,
     "direction": "증가",
     "conditional": false
    }
   ]
  },
  {
   "name": "광채+",
   "slot": "무기",
   "grade": "전설",
   "desc": "적에게 주는 피해가 20% 증가한다.\n지속 피해: 화상, 빙결, 감전, 심판을 보유한 적 공격 시, 15초 동안 치명타 피해가 15% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 20,
   "conditionalRaw": {
    "critical.criticalDamagePercent": 15
   }
  },
  {
   "name": "눈부신 잔영",
   "slot": "무기",
   "grade": "전설",
   "desc": "스킬 사용 시, 다음 기본 공격 적중 시 타겟 주변 3m 범위 내의 적들에게 (공격력×111%)의 피해를 추가로 입히고, 다음 1회의 공격 속도가 10% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "uncountedEffects": [
    {
     "stat": "다음 1회의 공격 속도",
     "value": 10,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "대군주+",
   "slot": "무기",
   "grade": "전설",
   "desc": "궁극기 스킬로 주는 피해가 20% 증가한다.\n궁극기 게이지 회복량이 20% 증가한다.\n공격력이 16% 증가한다.",
   "alwaysOnAttackPercent": 16,
   "alwaysOnDamagePercent": 0,
   "skillTypeBonuses": [
    {
     "stat": "궁극기 스킬로 주는 피해",
     "value": 20,
     "conditional": false
    }
   ],
   "uncountedEffects": [
    {
     "stat": "궁극기 게이지 회복량",
     "value": 20,
     "direction": "증가",
     "conditional": false
    }
   ]
  },
  {
   "name": "두 갈래 뿔",
   "slot": "무기",
   "grade": "전설",
   "desc": "공격력이 16% 증가한다.\n기본 공격 사용 시, 스킬 사용 속도가 5초 동안 15% 증가한다.\n스킬 사용 시, 공격 속도가 5초 동안 15% 증가한다.",
   "alwaysOnAttackPercent": 16,
   "alwaysOnDamagePercent": 0
  },
  {
   "name": "바위 칼날",
   "slot": "무기",
   "grade": "전설",
   "desc": "공격이 적중할 때마다 10초 동안 공격력이 0.7%, 치명타 확률이 0.5% 증가한다. 해당 효과는 최대 30회까지 중첩되며 지속 시간은 스택마다 개별로 가진다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "attackIncrease.itemAttackPercent": 0.7,
    "critical.runeCriticalRatePercent": 0.5
   }
  },
  {
   "name": "부패+",
   "slot": "무기",
   "grade": "전설",
   "desc": "공격력이 15% 증가한다.\n전투 중 6초마다 1개씩, 최대 2개까지 충전되는 맹독의 정수를 얻는다.\n공격 적중 시, 맹독의 정수를 1개 소모하여 타겟 주변 4m 범위 내의 적들에게 7.70의 피해와 11.60의 지속 피해: 중독을 준다. (재사용 대기 시간: 0.5초)",
   "alwaysOnAttackPercent": 15,
   "alwaysOnDamagePercent": 0
  },
  {
   "name": "암운+",
   "slot": "무기",
   "grade": "전설",
   "desc": "강타 피해가 15% 증가한다.\n지속 피해: 중독, 상처, 두려움, 절망이 부여된 적 공격 시, 타겟 주변 3m 내의 적들에게 4.30의 피해를 주고 15초 동안 스킬 피해가 10% 증가한다. (재사용 대기 시간: 5초)",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "alwaysOnExtra": {
    "enhancement.heavyDamagePercent": 15
   },
   "conditionalRaw": {
    "damageIncrease.skillDamagePercent": 10
   }
  },
  {
   "name": "억눌린 충동",
   "slot": "무기",
   "grade": "전설",
   "desc": "공격력이 30% 증가하며, 치명타 피해가 5% 증가한다.\n이동 속도가 15% 감소한다.",
   "alwaysOnAttackPercent": 30,
   "alwaysOnDamagePercent": 0,
   "alwaysOnExtra": {
    "critical.criticalDamagePercent": 5
   },
   "uncountedEffects": [
    {
     "stat": "이동 속도",
     "value": 15,
     "direction": "감소",
     "conditional": false
    }
   ]
  },
  {
   "name": "오랜 광기",
   "slot": "무기",
   "grade": "전설",
   "desc": "적에게 주는 피해가 20% 증가하며 공격 속도, 캐스팅 및 차지 속도, 스킬 사용 속도가 10% 증가한다.\n전투 중, 5초마다 최대 체력의 10% 만큼 피해를 입는다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 20,
   "uncountedEffects": [
    {
     "stat": "캐스팅 및 차지 속도",
     "value": 10,
     "direction": "증가",
     "conditional": false
    },
    {
     "stat": "스킬 사용 속도",
     "value": 10,
     "direction": "증가",
     "conditional": false
    }
   ]
  },
  {
   "name": "창백한 기수",
   "slot": "무기",
   "grade": "전설",
   "desc": "궁극기 스킬로 주는 피해가 20% 증가하고, 궁극기 게이지 회복량이 20% 감소한다.\n공격력이 17%, 적에게 주는 피해가 17% 증가한다.",
   "alwaysOnAttackPercent": 17,
   "alwaysOnDamagePercent": 17,
   "skillTypeBonuses": [
    {
     "stat": "궁극기 스킬로 주는 피해",
     "value": 20,
     "conditional": false
    }
   ],
   "uncountedEffects": [
    {
     "stat": "궁극기 게이지 회복량",
     "value": 20,
     "direction": "감소",
     "conditional": false
    }
   ]
  },
  {
   "name": "추적자",
   "slot": "무기",
   "grade": "전설",
   "desc": "강타 피해가 35% 증가한다.\n스킬 8회 사용 시 주변 10m 범위 내의 적들에게 11.70의 피해를 주고, 강타 피해가 6초 동안 20% 감소한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "alwaysOnExtra": {
    "enhancement.heavyDamagePercent": 35
   }
  },
  {
   "name": "타오르는 영광",
   "slot": "무기",
   "grade": "전설",
   "desc": "공격력이 23.5% 증가한다.\n전투 시, 5초마다 불씨를 얻는다. 이 효과는 최대 12회까지 중첩된다.\n궁극기 사용 시, 모든 불씨를 소모하여 15초 동안 공격력이 소모한 중첩 당 3.5% 증가한다.",
   "alwaysOnAttackPercent": 23.5,
   "alwaysOnDamagePercent": 0
  },
  {
   "name": "햇살+",
   "slot": "무기",
   "grade": "전설",
   "desc": "공격력이 16% 증가하고, 재사용 대기 시간 회복 속도가 15% 증가한다.",
   "alwaysOnAttackPercent": 16,
   "alwaysOnDamagePercent": 0,
   "uncountedEffects": [
    {
     "stat": "재사용 대기 시간 회복 속도",
     "value": 15,
     "direction": "증가",
     "conditional": false
    }
   ]
  },
  {
   "name": "가라앉은 왕국",
   "slot": "방어구",
   "grade": "신화",
   "desc": "공격력이 15%, 궁극기 스킬로 주는 피해가 10% 증가한다.\n궁극기 사용 시, 30초 동안 재사용 대기 시간 회복 속도가 8% 증가하며, 10초 동안 속박 상태가 된다.",
   "alwaysOnAttackPercent": 15,
   "alwaysOnDamagePercent": 0,
   "skillTypeBonuses": [
    {
     "stat": "궁극기 스킬로 주는 피해",
     "value": 10,
     "conditional": false
    }
   ],
   "uncountedEffects": [
    {
     "stat": "재사용 대기 시간 회복 속도",
     "value": 8,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "무형",
   "slot": "방어구",
   "grade": "신화",
   "desc": "저주 룬 착용 시, 적에게 주는 피해와 받는 피해가 30% 증가하고 이동 속도 감소 효과가 사라진다.\n침식 룬 착용 시,  5초마다 타겟 방향의 적들에게 (공격력×101%)의 피해를 준다.\n용의 문장 룬 착용 시, 스킬 피해가 27% 증가한다.\n순서대로 하나의 효과만 적용되며, 활성화되지 않은 경우 공격력이 30% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 30,
    "damageIncrease.skillDamagePercent": 27,
    "attackIncrease.itemAttackPercent": 30
   },
   "uncountedEffects": [
    {
     "stat": "받는 피해",
     "value": 30,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "사슬로 묶은 법전",
   "slot": "방어구",
   "grade": "신화",
   "desc": "도발 시, 적에게 주는 피해가 26%, 무방비 피해가 16% 증가한다.\n아군 치유 시, 공격력이 25%, 재사용 대기 시간 회복 속도가 4% 증가한다.\n하나의 효과만 적용되며, 활성화되지 않은 경우 적에게 주는 피해가 29.0% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 29,
    "break.vulnerabilityDamagePercent": 16,
    "attackIncrease.itemAttackPercent": 25
   },
   "uncountedEffects": [
    {
     "stat": "재사용 대기 시간 회복 속도",
     "value": 4,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "여신",
   "slot": "방어구",
   "grade": "신화",
   "desc": "적에게 주는 피해가 29.0% 증가한다.\n적색,청색,녹색,무색,황금색 팔라딘 아티팩트를 모두 1개 이상 장착했을 경우, 받는 피해가 10% 감소한다.\n행동 불능에 이르는 공격을 1회 막아주고 체력을 대량 회복한다. 이 후 3초 동안 받는 피해가 80% 감소한다. 동일한 행동 불능에 저항하는 효과와 재사용 대기 시간을 공유한다. (재사용 대기 시간 : 180초)",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 29,
   "uncountedEffects": [
    {
     "stat": "받는 피해",
     "value": 10,
     "direction": "감소",
     "conditional": true
    },
    {
     "stat": "받는 피해",
     "value": 80,
     "direction": "감소",
     "conditional": true
    }
   ]
  },
  {
   "name": "용 사냥꾼",
   "slot": "방어구",
   "grade": "신화",
   "desc": "치명타 확률이 10%, 치명타 피해가 10% 증가한다.\n퀵슬롯의 회복 물약 개수가 2개 증가하며, 붕대 개수가 2개 증가한다.\n퀵슬롯 아이템 사용 시, 마력탄을 발사해 타겟 방향의 적들에게 2.90의 피해를 주고 60초 동안 적에게 주는 피해가 5% 증가한다. (재사용 대기 시간: 3초)",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "alwaysOnExtra": {
    "critical.runeCriticalRatePercent": 10,
    "critical.criticalDamagePercent": 10
   },
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 5
   }
  },
  {
   "name": "유폐된 어둠",
   "slot": "방어구",
   "grade": "신화",
   "desc": "적에게 주는 피해가 10% 증가한다.\n3초마다 타겟 주변 적 최대 3명에게 어둠의 화살을 발사하여 2.10의 피해를 주고 약화 효과: 방어구 파괴를 부여해 10초 동안 받는 피해를 10% 증가시킨다.\n밤의 축복 스킬이 활성화된 동안 발사 횟수가 2배로 증가한다.\n방어구 파괴는 중복 적용되지 않는다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 10,
   "uncountedEffects": []
  },
  {
   "name": "거두는 손길",
   "slot": "방어구",
   "grade": "전설",
   "desc": "전투 시작 시,  15초 동안 적에게 주는 피해가 26% 증가한다.\n자신과 전투 중인 적이 처치되었을 경우 재발동한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 26
   }
  },
  {
   "name": "계승자",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가  13% 증가한다.\n스킬 사용 시, 스킬 피해가 6.5% 증가한다. 이 효과는 최대 5회까지 중첩되며, 최대 중첩을 초과하여 발동 시 효과가 초기화된다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 13,
   "conditionalRaw": {
    "damageIncrease.skillDamagePercent": 6.5
   }
  },
  {
   "name": "공세+",
   "slot": "방어구",
   "grade": "전설",
   "desc": "스킬 사용 시, 6초 동안 적에게 주는 피해가 5.5% 증가한다. 해당 효과는 최대 5회까지 중첩되며 지속 시간은 스택마다 개별로 가진다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 5.5
   }
  },
  {
   "name": "공허",
   "slot": "방어구",
   "grade": "전설",
   "desc": "스킬 8회 사용 시, 모든 스킬의 재사용 대기 시간이 3초 감소한다.\n공격력이 5% 증가한다.",
   "alwaysOnAttackPercent": 5,
   "alwaysOnDamagePercent": 0
  },
  {
   "name": "교차하는 사슬",
   "slot": "방어구",
   "grade": "전설",
   "desc": "공격력이 15% 증가한다.\n밤의 축복 스킬 활성화 시, 연타 피해와 추가타 확률, 공격력이 11% 증가한다.",
   "alwaysOnAttackPercent": 15,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "enhancement.rapidDamagePercent": 11,
    "extraHit.runeExtraRatePercent": 11,
    "attackIncrease.itemAttackPercent": 11
   }
  },
  {
   "name": "그믐달",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 15% 증가한다.\n보유한 자원이 50% 미만일 경우, 공격력이 10% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 15,
   "conditionalRaw": {
    "attackIncrease.itemAttackPercent": 10
   }
  },
  {
   "name": "금 간 봉인",
   "slot": "방어구",
   "grade": "전설",
   "desc": "전투 시, 1초마다 침식 수치가 5 증가한다.\n침식이 부여된 동안 치명타 확률이 16.5% 증가한다.\n침식 수치가 100 이상일 경우, 효과가 두 배로 증가한다. 침식 수치가 300에 도달하면 오염되며, 15초 동안 모든 효과를 잃는다.\n침식과 오염은 전투 중에만 진행된다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "critical.runeCriticalRatePercent": 16.5
   }
  },
  {
   "name": "긍지",
   "slot": "방어구",
   "grade": "전설",
   "desc": "전투 숙련: 지원 보유 시 공격력이 25%, 회복량이 10% 증가한다.\n공격 시, 약화 효과: 방어구 파괴를 부여해 10초 동안 받는 피해를 10% 증가시킨다. 방어구 파괴는 중복 적용되지 않는다. (재사용 대기 시간: 1초)",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "attackIncrease.itemAttackPercent": 25
   },
   "uncountedEffects": [
    {
     "stat": "회복량",
     "value": 10,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "기본기+",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 20% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 20
  },
  {
   "name": "기사단장",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 5%, 공격 속도 및 스킬 사용 속도가 6% 증가한다.\n주위에서 적이 5/10/20명 처치될 경우, 공격 속도 및 스킬 사용 속도가 3%/6%/12% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 5,
   "uncountedEffects": [
    {
     "stat": "공격 속도 및 스킬 사용 속도",
     "value": 6,
     "direction": "증가",
     "conditional": false
    },
    {
     "stat": "공격 속도 및 스킬 사용 속도",
     "value": 3,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "끓는 피",
   "slot": "방어구",
   "grade": "전설",
   "desc": "스킬 사용 시, 최대 체력의 4% 만큼 피해를 입고 5초 동안 스킬 피해가 24% 증가한다.\n이 효과는 남은 체력이 30% 이상일 때만 발동한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "damageIncrease.skillDamagePercent": 24
   }
  },
  {
   "name": "날 선 적의",
   "slot": "방어구",
   "grade": "전설",
   "desc": "공격력이 6%, 치명타 확률, 추가타 확률, 적에게 주는 피해가 6% 증가한다.\n이동 속도가 15% 감소한다.",
   "alwaysOnAttackPercent": 6,
   "alwaysOnDamagePercent": 6,
   "alwaysOnExtra": {
    "critical.runeCriticalRatePercent": 6,
    "extraHit.runeExtraRatePercent": 6
   },
   "uncountedEffects": [
    {
     "stat": "이동 속도",
     "value": 15,
     "direction": "감소",
     "conditional": false
    }
   ]
  },
  {
   "name": "녹슨 방패",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 22% 증가한다.\n행동 불능에 이르는 공격을 1회 막아주고 체력을 대량 회복한다. 이 후 3초 동안 받는 피해가 80% 감소한다. 동일한 행동 불능에 저항하는 효과와 재사용 대기 시간을 공유한다. (재사용 대기 시간 : 180초)",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 22,
   "uncountedEffects": [
    {
     "stat": "받는 피해",
     "value": 80,
     "direction": "감소",
     "conditional": true
    }
   ]
  },
  {
   "name": "돌 심장",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 10% 증가한다.\n용의 문장이 활성화된 동안 재사용 대기 시간 회복 속도가 20%, 연타 피해가 18% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 10,
   "conditionalRaw": {
    "enhancement.rapidDamagePercent": 18
   },
   "uncountedEffects": [
    {
     "stat": "재사용 대기 시간 회복 속도",
     "value": 20,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "등대지기",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 24% 증가한다.\n무방비 공격 적중 시, 약화 효과: 방어구 파괴를 부여해 10초 동안 받는 피해를 10% 증가시킨다. 방어구 파괴는 중복 적용되지 않는다. (재사용 대기 시간: 1초)",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 24,
   "uncountedEffects": []
  },
  {
   "name": "맹세+",
   "slot": "방어구",
   "grade": "전설",
   "desc": "공격력이 10% 증가한다.\n체력이 50% 이하일 경우 받는 피해가 10% 감소하며, 2초마다 맹세 효과를 얻어 12초 동안 적에게 주는 피해가 3% 증가한다. 이 효과는 최대 5회까지 중첩된다.",
   "alwaysOnAttackPercent": 10,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 3
   },
   "uncountedEffects": [
    {
     "stat": "체력",
     "value": 50,
     "direction": "감소",
     "conditional": true
    },
    {
     "stat": "받는 피해",
     "value": 10,
     "direction": "감소",
     "conditional": true
    }
   ]
  },
  {
   "name": "무너진 경계",
   "slot": "방어구",
   "grade": "전설",
   "desc": "전투 시, 1초마다 침식 수치가 5 증가한다.\n침식이 부여된 동안 추가타 확률이 16.5% 증가한다.\n침식 수치가 100 이상일 경우, 효과가 두 배로 증가한다. 침식 수치가 300에 도달하면 오염되며, 15초 동안 모든 효과를 잃는다.\n침식과 오염은 전투 중에만 진행된다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "extraHit.runeExtraRatePercent": 16.5
   }
  },
  {
   "name": "무덤지기+",
   "slot": "방어구",
   "grade": "전설",
   "desc": "공격력이 16% 증가한다. 자신과 전투 중인 적이 처치되었을 경우, 자신의 체력을 -29만큼 회복한다.",
   "alwaysOnAttackPercent": 16,
   "alwaysOnDamagePercent": 0
  },
  {
   "name": "무한한 탐욕",
   "slot": "방어구",
   "grade": "전설",
   "desc": "스킬 자원을 소모하는 스킬로 주는 피해가 38% 증가한다.\n재사용 대기 시간 회복 속도가 10% 감소한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "skillTypeBonuses": [
    {
     "stat": "스킬 자원을 소모하는 스킬로 주는 피해",
     "value": 38,
     "conditional": false
    }
   ],
   "uncountedEffects": [
    {
     "stat": "재사용 대기 시간 회복 속도",
     "value": 10,
     "direction": "감소",
     "conditional": false
    }
   ]
  },
  {
   "name": "바다뱀+",
   "slot": "방어구",
   "grade": "전설",
   "desc": "공격력이 5%, 스킬 사용 속도가 5% 증가한다.\n채널링 스킬로 주는 피해가 31% 증가한다.",
   "alwaysOnAttackPercent": 5,
   "alwaysOnDamagePercent": 0,
   "skillTypeBonuses": [
    {
     "stat": "채널링 스킬로 주는 피해",
     "value": 31,
     "conditional": false
    }
   ],
   "uncountedEffects": [
    {
     "stat": "스킬 사용 속도",
     "value": 5,
     "direction": "증가",
     "conditional": false
    }
   ]
  },
  {
   "name": "번개 숨결",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 10% 증가한다.\n용의 문장이 활성화된 동안 스킬 사용 속도와 캐스팅 및 차지 속도가 17%, 강타 피해가 18% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 10,
   "conditionalRaw": {
    "enhancement.heavyDamagePercent": 18
   },
   "uncountedEffects": [
    {
     "stat": "스킬 사용 속도",
     "value": 17,
     "direction": "증가",
     "conditional": true
    },
    {
     "stat": "캐스팅 및 차지 속도",
     "value": 17,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "별바라기",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 10% 증가한다.\n공격 시, 10초 동안 용의 문장을 활성화한다. (재사용 대기 시간 : 20초)\n용의 문장이 활성화된 동안 공격력이 14.0% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 10,
   "conditionalRaw": {
    "attackIncrease.itemAttackPercent": 14
   }
  },
  {
   "name": "복수+",
   "slot": "방어구",
   "grade": "전설",
   "desc": "피해를 입을 경우 12초 동안 공격력이 5%, 받는 회복량이 2% 증가한다.\n이 효과는 최대 5회까지 중첩된다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "attackIncrease.itemAttackPercent": 5
   },
   "uncountedEffects": [
    {
     "stat": "받는 회복량",
     "value": 2,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "봉인술사",
   "slot": "방어구",
   "grade": "전설",
   "desc": "캐스팅 및 차지 속도가 15% 증가한다.\n캐스팅 및 차지 스킬로 주는 피해가 25% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "skillTypeBonuses": [
    {
     "stat": "캐스팅 및 차지 스킬로 주는 피해",
     "value": 25,
     "conditional": false
    }
   ],
   "uncountedEffects": [
    {
     "stat": "캐스팅 및 차지 속도",
     "value": 15,
     "direction": "증가",
     "conditional": false
    }
   ]
  },
  {
   "name": "부서진 왕관",
   "slot": "방어구",
   "grade": "전설",
   "desc": "전투 중,  5초마다 자신 주위 5m 범위 내에 15초 동안 지속되는 마력의 원을 생성한다.\n마력의 원에 올라설 경우, 15초 동안 공격력이 4%, 강타 피해가 4.5% 증가한다. 최대 3회까지 중첩된다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "attackIncrease.itemAttackPercent": 4,
    "enhancement.heavyDamagePercent": 4.5
   }
  },
  {
   "name": "비늘 덮인 현자",
   "slot": "방어구",
   "grade": "전설",
   "desc": "아군 치유 시, 15초 동안 자신의 공격력이 20% 증가한다.\n추가로, 회복된 아군 근처에 10초 동안 지속되는 회복 구슬을  생성한다. (재사용 대기시간:  5초)\n회복 구슬을 획득한 대상의 최대 체력을  2% 회복시키고, 15초 동안 공격력을 5%만큼 증가시킨다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "attackIncrease.itemAttackPercent": 5
   },
   "uncountedEffects": [
    {
     "stat": "회복 구슬을 획득한 대상의 최대 체력",
     "value": 2,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "빛살+",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 5.5%, 캐스팅 및 차지 속도와 스킬 사용 속도가 5% 증가한다.\n무방비 공격 적중 시, 10초 동안 캐스팅 및 차지 속도와 스킬 사용 속도가 추가로 20% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 5.5,
   "uncountedEffects": [
    {
     "stat": "캐스팅 및 차지 속도",
     "value": 5,
     "direction": "증가",
     "conditional": false
    },
    {
     "stat": "스킬 사용 속도",
     "value": 5,
     "direction": "증가",
     "conditional": false
    },
    {
     "stat": "캐스팅 및 차지 속도",
     "value": 20,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "뼈 인장",
   "slot": "방어구",
   "grade": "전설",
   "desc": "액티브 3번 슬롯 스킬로 주는 피해가 53% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "skillTypeBonuses": [
    {
     "stat": "액티브 3번 슬롯 스킬로 주는 피해",
     "value": 53,
     "conditional": false
    }
   ]
  },
  {
   "name": "서광",
   "slot": "방어구",
   "grade": "전설",
   "desc": "공격력이 20% 증가한다.\n브레이크 익스텐드 스킬 사용 시, 10초 동안 적에게 주는 피해가 20% 증가한다.",
   "alwaysOnAttackPercent": 20,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 20
   }
  },
  {
   "name": "수호자",
   "slot": "방어구",
   "grade": "전설",
   "desc": "궁극기 게이지 획득량이 20% 감소한다.\n공격력이 24% 증가한다.\n궁극기 스킬로 주는 피해가 20% 증가한다.",
   "alwaysOnAttackPercent": 24,
   "alwaysOnDamagePercent": 0,
   "skillTypeBonuses": [
    {
     "stat": "궁극기 스킬로 주는 피해",
     "value": 20,
     "conditional": false
    }
   ],
   "uncountedEffects": [
    {
     "stat": "궁극기 게이지 획득량",
     "value": 20,
     "direction": "감소",
     "conditional": false
    }
   ]
  },
  {
   "name": "숲 길잡이",
   "slot": "방어구",
   "grade": "전설",
   "desc": "이동 속도가 10% 증가한다.\n공격 10회 적중 혹은 5m를 이동할 경우, 10초 동안 이동 속도를 추가로 5%, 적에게 주는 피해를 21% 증가시킨다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 21
   },
   "uncountedEffects": [
    {
     "stat": "이동 속도",
     "value": 10,
     "direction": "증가",
     "conditional": false
    }
   ]
  },
  {
   "name": "승전",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 5%, 치명타 피해가 10% 증가한다.\n주위에서 적이 5/10/20명 처치될 경우, 치명타 피해가 3%/6%/12% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 5,
   "alwaysOnExtra": {
    "critical.criticalDamagePercent": 10
   },
   "conditionalRaw": {
    "critical.criticalDamagePercent": 3
   }
  },
  {
   "name": "아귀",
   "slot": "방어구",
   "grade": "전설",
   "desc": "매 5초마다, 다음 공격 시  2.10의 피해와  5.30의 지속 피해: 상처를 추가로 준다.\n공격력이 15%, 무방비 피해가 12% 증가한다.",
   "alwaysOnAttackPercent": 15,
   "alwaysOnDamagePercent": 0,
   "alwaysOnExtra": {
    "break.vulnerabilityDamagePercent": 12
   }
  },
  {
   "name": "악몽",
   "slot": "방어구",
   "grade": "전설",
   "desc": "전투 중 4초마다 1개씩, 최대 3개까지 충전되는 불의 정수를 얻는다.\n스킬 사용 시, 불의 정수를 1개 소모하여 타겟의 위치에 화염 지대를 소환한다. 화염 지대는 3초 동안 주변 2m 범위 내의 적들에게 0.5초마다  1.40의 화염 피해를 준다. (재사용 대기 시간 0.5초)\n전투 시작 시, 3중첩을 즉시 획득한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0
  },
  {
   "name": "얼음 발톱",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 10% 증가한다.\n용의 문장의 지속 시간이 10초만큼 증가한다.\n용의 문장이 활성화된 동안 추가타 확률이 12.5% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 10,
   "conditionalRaw": {
    "extraHit.runeExtraRatePercent": 12.5
   }
  },
  {
   "name": "열의+",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 7.0% 증가한다.\n공격 속도가 30% 증가하며, 기본 공격으로 주는 피해가 30% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 7,
   "skillTypeBonuses": [
    {
     "stat": "기본 공격으로 주는 피해",
     "value": 30,
     "conditional": false
    }
   ],
   "uncountedEffects": [
    {
     "stat": "공격 속도",
     "value": 30,
     "direction": "증가",
     "conditional": false
    }
   ]
  },
  {
   "name": "용암 비늘",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 10% 증가한다.\n공격 시, 10초 동안 용의 문장을 활성화한다. (재사용 대기 시간 : 20초)\n용의 문장이 활성화된 동안 1초마다 가장 가까운 적에게 1의 피해를 준다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 10
  },
  {
   "name": "위엄",
   "slot": "방어구",
   "grade": "전설",
   "desc": "전투 숙련: 수호 보유 시 공격력이 16%, 무방비 피해가 32% 증가하며 적에게 받는 피해가 5% 감소한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "attackIncrease.itemAttackPercent": 16,
    "break.vulnerabilityDamagePercent": 32
   }
  },
  {
   "name": "은빛 찬가",
   "slot": "방어구",
   "grade": "전설",
   "desc": "공격력이 5%, 재사용 대기 시간 회복 속도가 6% 증가한다.\n주위에서 적이 5/10/20명 처치될 경우, 재사용 대기시간 회복속도가 3%/6%/12% 증가한다.",
   "alwaysOnAttackPercent": 5,
   "alwaysOnDamagePercent": 0,
   "uncountedEffects": [
    {
     "stat": "재사용 대기 시간 회복 속도",
     "value": 6,
     "direction": "증가",
     "conditional": false
    },
    {
     "stat": "재사용 대기시간 회복속도",
     "value": 3,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "잊힌 맹약",
   "slot": "방어구",
   "grade": "전설",
   "desc": "공격력이 15% 증가한다.\n밤의 축복 스킬 활성화 시, 스킬 사용 속도와 캐스팅 및 차지 속도, 재사용 대기 시간 회복 속도가 13% 증가한다.",
   "alwaysOnAttackPercent": 15,
   "alwaysOnDamagePercent": 0,
   "uncountedEffects": [
    {
     "stat": "스킬 사용 속도",
     "value": 13,
     "direction": "증가",
     "conditional": true
    },
    {
     "stat": "캐스팅 및 차지 속도",
     "value": 13,
     "direction": "증가",
     "conditional": true
    },
    {
     "stat": "재사용 대기 시간 회복 속도",
     "value": 13,
     "direction": "증가",
     "conditional": true
    }
   ]
  },
  {
   "name": "잠든 땅",
   "slot": "방어구",
   "grade": "전설",
   "desc": "받는 회복량이 60% 감소한다.\n연타 피해가 13%, 강타 피해가 13% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "alwaysOnExtra": {
    "enhancement.rapidDamagePercent": 13,
    "enhancement.heavyDamagePercent": 13
   },
   "uncountedEffects": [
    {
     "stat": "받는 회복량",
     "value": 60,
     "direction": "감소",
     "conditional": false
    }
   ]
  },
  {
   "name": "잠들지 않는 불",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 10% 증가한다.\n용의 문장의 지속 시간이 10초만큼 증가한다.\n용의 문장이 활성화된 동안 치명타 확률이 12.5% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 10,
   "conditionalRaw": {
    "critical.runeCriticalRatePercent": 12.5
   }
  },
  {
   "name": "잿빛 장막",
   "slot": "방어구",
   "grade": "전설",
   "desc": "전투 시, 1초마다 침식 수치가 5 증가한다.\n침식이 부여된 동안 연타 피해가 18% 증가한다.\n침식 수치가 100 이상일 경우, 효과가 두 배로 증가한다. 침식 수치가 300에 도달하면 오염되며, 15초 동안 모든 효과를 잃는다.\n침식과 오염은 전투 중에만 진행된다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "enhancement.rapidDamagePercent": 18
   }
  },
  {
   "name": "정복자+",
   "slot": "방어구",
   "grade": "전설",
   "desc": "공격력이 5%, 적에게 주는 피해가 9% 증가한다.\n주위에서 적이 5/10/20명 처치될 경우, 적에게 주는 피해가 3%/6%/12% 증가한다.",
   "alwaysOnAttackPercent": 5,
   "alwaysOnDamagePercent": 9,
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 3
   }
  },
  {
   "name": "첫 번째 서약",
   "slot": "방어구",
   "grade": "전설",
   "desc": "공격력이 15% 증가한다.\n밤의 축복 스킬 활성화 시, 강타 피해와 치명타 확률, 공격력이 11% 증가한다.",
   "alwaysOnAttackPercent": 15,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "enhancement.heavyDamagePercent": 11,
    "critical.runeCriticalRatePercent": 11,
    "attackIncrease.itemAttackPercent": 11
   }
  },
  {
   "name": "칼바람",
   "slot": "방어구",
   "grade": "전설",
   "desc": "브레이크 스킬로 주는 피해가 29.0% 증가한다.\n브레이크 스킬 사용 시, 7초 동안 치명타 피해가 10% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "critical.criticalDamagePercent": 10
   },
   "skillTypeBonuses": [
    {
     "stat": "브레이크 스킬로 주는 피해",
     "value": 29,
     "conditional": false
    }
   ]
  },
  {
   "name": "폭염+",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 5% 증가한다.\n전투 시, 2초마다 자신 주변 4m 범위 내의 모든 적에게 4.50의 피해와  2.10의 지속 피해: 화상을 준다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 5
  },
  {
   "name": "황동 날개",
   "slot": "방어구",
   "grade": "전설",
   "desc": "적에게 주는 피해가 10% 증가한다.\n궁극기 사용 시, 10초 동안 용의 문장을 활성화한다. (재사용 대기 시간 : 20초)\n용의 문장이 활성화된 동안 적에게 주는 피해가 14.0% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 10,
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 14
   }
  },
  {
   "name": "흐릿한 형상",
   "slot": "방어구",
   "grade": "전설",
   "desc": "전투 시, 1초마다 침식 수치가 5 증가한다.\n침식이 부여된 동안 강타 피해가 18% 증가한다.\n침식 수치가 100 이상일 경우, 효과가 두 배로 증가한다. 침식 수치가 300에 도달하면 오염되며, 15초 동안 모든 효과를 잃는다.\n침식과 오염은 전투 중에만 진행된다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "enhancement.heavyDamagePercent": 18
   }
  },
  {
   "name": "고결함",
   "slot": "엠블럼",
   "grade": "전설",
   "desc": "스킬 사용 속도가 15%, 재사용 대기 시간 회복 속도가 10% 증가한다.\n밤의 축복 스킬 활성화 시, 15초 동안 적에게 주는 피해가 48% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "conditionalRaw": {
    "damageIncrease.itemMainDamagePercent": 48
   },
   "uncountedEffects": [
    {
     "stat": "스킬 사용 속도",
     "value": 15,
     "direction": "증가",
     "conditional": false
    },
    {
     "stat": "재사용 대기 시간 회복 속도",
     "value": 10,
     "direction": "증가",
     "conditional": false
    }
   ]
  },
  {
   "name": "백금 천칭",
   "slot": "엠블럼",
   "grade": "전설",
   "desc": "스킬 사용 시, 기본 공격의 추가타 확률이 10초 동안 21% 증가한다.\n기본 공격 사용 시, 적에게 주는 피해가 10초 동안 21% 증가한다.\n두 효과가 모두 활성화될 경우, 증가량이 1.5배가 된다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0
  },
  {
   "name": "빛바랜 별",
   "slot": "엠블럼",
   "grade": "전설",
   "desc": "적에게 주는 피해가 31% 증가한다.\n무방비 피해가 31% 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 31,
   "alwaysOnExtra": {
    "break.vulnerabilityDamagePercent": 31
   }
  },
  {
   "name": "영원한 밤",
   "slot": "엠블럼",
   "grade": "전설",
   "desc": "공격력이 7.0%, 강타 피해, 연타 피해, 치명타 확률, 추가타 확률이 7.0% 증가한다. 오염의 지속 시간이 33% 감소한다.",
   "alwaysOnAttackPercent": 7,
   "alwaysOnDamagePercent": 0,
   "alwaysOnExtra": {
    "enhancement.heavyDamagePercent": 7,
    "enhancement.rapidDamagePercent": 7,
    "critical.runeCriticalRatePercent": 7,
    "extraHit.runeExtraRatePercent": 7
   },
   "uncountedEffects": [
    {
     "stat": "오염의 지속 시간",
     "value": 33,
     "direction": "감소",
     "conditional": false
    }
   ]
  },
  {
   "name": "위대함",
   "slot": "엠블럼",
   "grade": "전설",
   "desc": "강타 피해가 25% 증가한다.\n밤의 축복 스킬 활성화 시, 15초 동안 강타 피해가 40% 추가로 증가하며, 공격 적중 시 타겟 주변 3m 범위 내의 적들에게 1.70의 피해를 준다. (재사용 대기 시간: 1초)",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "alwaysOnExtra": {
    "enhancement.heavyDamagePercent": 25
   },
   "conditionalRaw": {
    "enhancement.heavyDamagePercent": 40
   }
  },
  {
   "name": "초월",
   "slot": "엠블럼",
   "grade": "전설",
   "desc": "추가타를 5회 적중시킬 경우, 다음 공격 적중 시 4.10의 피해를 주고, 적에게 주는 피해가 10초 동안 15% 증가한다.\n치명타를 5회 적중시킬 경우, 다음 공격 적중 시 4.10의 피해를 주고, 치명타 피해가 10초 동안 15% 증가한다.\n( 재사용 대기 시간: 각 4초 )",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0
  },
  {
   "name": "침묵",
   "slot": "엠블럼",
   "grade": "전설",
   "desc": "적에게 주는 피해가 33% 증가한다.\n밤의 축복 스킬 활성화 시, 자신 주변 12m 범위 내의 모든 적에게  (공격력×125%)의 피해를 준다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 33
  },
  {
   "name": "태초",
   "slot": "엠블럼",
   "grade": "전설",
   "desc": "스킬 피해가 20% 증가한다.\n밤의 축복 스킬 활성화 시, 모든 스킬의 재사용 대기 시간이 초기화된다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "alwaysOnExtra": {
    "damageIncrease.skillDamagePercent": 20
   }
  },
  {
   "name": "해방",
   "slot": "엠블럼",
   "grade": "전설",
   "desc": "연타 피해가 25% 증가한다.\n밤의 축복 스킬 활성화 시, 15초 동안 연타 피해가 40% 추가로 증가하며, 공격 적중 시 타겟에게 2.20의 피해를 준다. (재사용 대기 시간: 1초)",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "alwaysOnExtra": {
    "enhancement.rapidDamagePercent": 25
   },
   "conditionalRaw": {
    "enhancement.rapidDamagePercent": 40
   }
  },
  {
   "name": "간결함+",
   "slot": "장신구",
   "grade": "전설",
   "desc": "댄서의 피루엣 스킬에 변화를 준다.\n피루엣 사용 이후, 다음 스킬이 주는 피해가 증가한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "class": "댄서"
  },
  {
   "name": "갈채+",
   "slot": "장신구",
   "grade": "전설",
   "desc": "댄서의 애드리브 스킬에 변화를 준다.\n일정 범위 내의 아군에게 스킬 공격 시 추가 공격 효과를 부여한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "class": "댄서"
  },
  {
   "name": "나비+",
   "slot": "장신구",
   "grade": "전설",
   "desc": "댄서의 내추럴 턴 스킬에 변화를 준다.\n내추럴 턴 사용 시, 적을 추적하는 3마리의 나비가 나타나 날아간다.\n추가로, 항상 타겟을 향해 돌진하는 형태로 사용한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "class": "댄서"
  },
  {
   "name": "다가옴+",
   "slot": "장신구",
   "grade": "전설",
   "desc": "댄서의 프론트 스텝 스킬에 변화를 준다.\n프론트 스텝으로 이동한 거리에 비례하여 재사용 대기 시간이 감소한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "class": "댄서"
  },
  {
   "name": "발걸음+",
   "slot": "장신구",
   "grade": "전설",
   "desc": "댄서의 프론트 스텝 스킬에 변화를 준다.\n정열 상태 돌입 시, 더 강력한 범위 피해를 입히는 강화 : 프론트 스텝을 1회 사용할 수 있다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "class": "댄서"
  },
  {
   "name": "산뜻함+",
   "slot": "장신구",
   "grade": "전설",
   "desc": "댄서의 피루엣 스킬에 변화를 준다.\n피루엣으로 강화된 원거리 공격 피해량이 일정 횟수 동안 증가하며 해당 효과를 보유하는 동안 공격 속도가 빨라진다. 또한 강화된 기본 공격이 적중한 적은 일정 시간 동안 자신에게 더 큰 피해를 받는다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "class": "댄서"
  },
  {
   "name": "전환+",
   "slot": "장신구",
   "grade": "전설",
   "desc": "댄서의 내추럴 턴 스킬에 변화를 준다.\n내추럴 턴 스킬 사용 시, 현재 영감 상태에 따라서 지속 피해: 화상 혹은 지속 피해: 빙결을 적용시키고 상태를 전환한다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "class": "댄서"
  },
  {
   "name": "정열+",
   "slot": "장신구",
   "grade": "전설",
   "desc": "댄서의 윈드밀 스킬에 변화를 준다.\n윈드밀 사용 시 적에게 지속 피해를 주며 해당 효과는 정열 타입의 스킬로 지속 시간이 연장된다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "class": "댄서"
  },
  {
   "name": "환호+",
   "slot": "장신구",
   "grade": "전설",
   "desc": "댄서의 애드리브 스킬에 변화를 준다.\n애드리브 스킬 사용 시, 하나의 자세만을 취하는 스킬로 변화시킨다. 마지막 포즈를 취할 때, 취한 포즈에 따라서 다른 효과를 가진다.",
   "alwaysOnAttackPercent": 0,
   "alwaysOnDamagePercent": 0,
   "class": "댄서"
  }
 ]
});

export default RUNES;
