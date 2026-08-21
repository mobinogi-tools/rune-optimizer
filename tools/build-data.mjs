// data/*.json → src/gen/*.mjs
//
// 편집 대상은 JSON, 런타임은 생성된 ESM 이다. 런타임 fetch 를 없애려고
// JSON 을 fetch 하지 않는다 — build-web-data.mjs 가 룬 데이터에 쓰는 것과 같은 판단이다.
//
// 생성물은 커밋한다. clone 해서 runes.html 을 바로 열면 돌아가야 하기 때문이다.
//
// evidence 는 생성물에서 뺀다. 근거는 리뷰와 검증을 위한 것이지 브라우저가 쓰지 않는다.
// 원본 data/ 에는 항상 남으므로 사라지는 게 아니다.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
// missingBranches 는 여기서 정적으로 import 하지 않는다. 사슬이
//   build-data → validate-data → rune-conditionals → src/gen/*
// 이라서, 데이터에 키를 새로 넣고 그것을 rune-conditionals 가 쓰기 시작하면
// **생성기가 자기 출력물을 필요로 해서** 빌드가 막힌다(실제로 막혔다).
// 생성물을 다 쓴 뒤에 동적으로 불러오면 그 순서 문제가 사라진다.

// 출력 위치를 인자로 받는다. 신선도 테스트가 임시 디렉터리에 다시 생성해
// 커밋된 것과 비교하기 위해서다.
const OUT = process.argv[2] ?? 'src/gen';
const HELP_OUT = process.argv[3] ?? 'HELP-WANTED.md';
const LIMITS_OUT = process.argv[4] ?? 'LIMITS.md';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const HEAD = (src) => `// 자동 생성 파일 — 직접 수정하지 마라.\n// 생성: node tools/build-data.mjs\n// 원본: ${src}\n\n`;
const lit = (v) => JSON.stringify(v, null, 2);

mkdirSync(OUT, { recursive: true });

const effectFields = read('data/effect-fields.json');
const masteries = read('data/masteries.json');
const jobFiles = readdirSync('data/jobs').filter((f) => f.endsWith('.json')).sort();
const jobs = jobFiles.map((f) => read(`data/jobs/${f}`));

// ── effect-fields ────────────────────────────────────────
writeFileSync(`${OUT}/effect-fields.mjs`,
  HEAD('data/effect-fields.json') +
  `/** 데미지 공식에 배선된 effects 경로 → 표시 라벨. 여기 없는 경로는 계산에서 조용히 죽는다. */\n` +
  `export const EFFECT_FIELDS = Object.freeze(${lit(effectFields)});\n\n` +
  `export const EFFECT_PATHS = Object.freeze(Object.keys(EFFECT_FIELDS));\n\n` +
  `/** 경로 → 한국어 라벨. 모르는 경로는 경로 그대로 돌려준다. */\n` +
  `export const fieldLabel = (path) => EFFECT_FIELDS[path]?.label ?? path;\n`,
  'utf8');

// ── masteries ────────────────────────────────────────────
const masteryOut = Object.fromEntries(Object.entries(masteries).map(([name, m]) => [name, {
  label: name, jobs: m.jobs, desc: m.desc, effects: m.effects, uncounted: m.uncounted,
}]));
writeFileSync(`${OUT}/masteries-data.mjs`,
  HEAD('data/masteries.json') +
  `export const COMBAT_MASTERIES = Object.freeze(${lit(masteryOut)});\n`,
  'utf8');

// ── jobs ─────────────────────────────────────────────────
// 기존 소비자(build-evaluator, rune-app)가 읽던 모양을 그대로 재구성한다.
// 데이터 위치만 옮기는 이주이므로 여기서 shape 을 바꾸면 이주와 리팩터링이 뒤섞인다.
const nightBlessing = {}, uptimePassives = {}, alwaysOn = {}, samples = {}, excluded = {};
const dualWield = [], basicAttack = [];
const resourceShare = {};
for (const j of jobs) {
  const nb = j.nightBlessing;
  nightBlessing[j.job] = {
    trigger: nb.trigger,
    ...(nb.triggerIntervalSeconds ? { triggerIntervalSeconds: nb.triggerIntervalSeconds } : {}),
    effects: nb.effects,
    confidence: nb.confidence,
    note: nb.note,
  };
  // 지금 UI 는 직업당 유지형 패시브 1개만 그린다. 데이터는 배열이지만 생성물은
  // 현행 소비자 모양(단일 객체)에 맞춘다 — 배열 일반화는 UI 배선과 함께 간다.
  const up = j.uptimePassives?.[0];
  if (up) {
    const input = j.inputs?.find((i) => i.key === up.uptimePercentFrom);
    uptimePassives[j.job] = {
      name: up.name,
      label: input?.label ?? up.name,
      effects: up.effects,
      nightBlessingGuarantees: up.nightBlessingGuarantees ?? false,
      defaultUptimePercent: input?.default ?? 100,
      hint: input?.hint ?? '',
    };
  }
  if (j.alwaysOn?.length) {
    alwaysOn[j.job] = j.alwaysOn.map((p) => ({ name: p.name, effects: p.effects, note: p.note }));
  }
  if (j.dualWield) dualWield.push(j.job);
  if (j.basicAttack) basicAttack.push(j.job);
  if (Number.isFinite(j.resourceSkillSharePercent)) resourceShare[j.job] = j.resourceSkillSharePercent;
  if (j.samples) samples[j.job] = j.samples;
  // 이 직업에서 계산에 안 넣은 것. 계산에는 안 쓰이고 계산 범위 페이지가 읽는다.
  if (j.excluded?.length) excluded[j.job] = j.excluded;
}
writeFileSync(`${OUT}/jobs-data.mjs`,
  HEAD('data/jobs/*.json') +
  `export const CLASS_NIGHT_BLESSING = Object.freeze(${lit(nightBlessing)});\n\n` +
  `export const CLASS_UPTIME_PASSIVE = Object.freeze(${lit(uptimePassives)});\n\n` +
  `export const CLASS_ALWAYS_ON = Object.freeze(${lit(alwaysOn)});\n\n` +
  `export const JOB_SAMPLES = Object.freeze(${lit(samples)});\n\n` +
  `/** 직업마다 계산에 안 넣은 것과 그 이유. limits.html 이 읽는다. */\n` +
  `export const JOB_EXCLUSIONS = Object.freeze(${lit(excluded)});\n\n` +
  `/** 양손에 같은 무기를 드는 직업. 두 영웅이 이 조건을 탄다.\n` +
  ` *  게임 툴팁이 명시한 세 직업이다. 목록이 아니라 직업 파일의 dualWield 가 진실이다. */\n` +
  `export const DUAL_WIELD_JOBS = Object.freeze(${lit(dualWield)});\n\n` +
  `/** 기본 공격(평타)을 실제로 섞는 직업. 화면 체크박스의 기본값이고, 사람마다 바꿀 수 있다.\n` +
  ` *  대부분의 직업은 평타를 안 하려고 한다 — 스킬로 채우는 것이 이득이라서다.\n` +
  ` *  그래서 기본은 false 고, 섞는 직업만 여기 들어온다. */\n` +
  `export const BASIC_ATTACK_JOBS = Object.freeze(${lit(basicAttack)});\n\n` +
  `/** 스킬 자원을 소모하는 스킬이 있는 직업과, 그 스킬이 딜에서 차지하는 기본 비중(%).\n` +
  ` *  이 표에 있는 직업에만 화면에 칸이 뜬다 — 없는 직업에게는 물어봐야 뜻이 없다. */\n` +
  `export const RESOURCE_SKILL_SHARE = Object.freeze(${lit(resourceShare)});\n`,
  'utf8');

// ── artifacts ────────────────────────────────────────────
// 아티팩트는 항목마다 evidence 를 요구하지 않는다. 전부 게임 안 도감에 그대로 표시되는
// 것이라, 항목마다 "게임에서 봤다" 를 29번 반복해 적을 뿐이기 때문이다.
const artifacts = read('data/artifacts.json');
writeFileSync(`${OUT}/artifacts-list.mjs`,
  HEAD('data/artifacts.json') +
  `export const ARTIFACTS = Object.freeze(${lit(artifacts.items)});\n`,
  'utf8');

// ── rune conditionals ────────────────────────────────────
// export 이름을 그대로 유지한다. 데이터 위치만 옮기는 이주라, 여기서 이름이나 모양을
// 바꾸면 소비자(rune-app, build-evaluator)까지 같이 흔들려 무엇이 원인인지 못 가린다.
const cond = read('data/rune-conditionals.json');
// evidence 는 여기서도 뺀다 — RUNE_CONDITIONALS 항목만 통째로 복사되므로, 안 걸러내면
// jobs-data 와 달리 evidence 가 그대로 생성물에 새어 들어간다.
const condOut = {
  ...cond,
  RUNE_CONDITIONALS: Object.fromEntries(
    Object.entries(cond.RUNE_CONDITIONALS ?? {}).map(([rune, entries]) => [
      rune,
      entries.map(({ evidence, ...rest }) => rest),
    ]),
  ),
};
writeFileSync(`${OUT}/rune-conditionals-data.mjs`,
  HEAD('data/rune-conditionals.json') +
  Object.keys(condOut).sort()
    .map((k) => `export const ${k} = Object.freeze(${lit(condOut[k])});\n`)
    .join('\n'),
  'utf8');

// ── HELP-WANTED.md ───────────────────────────────────────
// 모집 문서를 손으로 관리하면 데이터와 어긋난다. confidence 에서 뽑는다.
const rows = [];
for (const j of jobs) {
  const push = (what, item) => {
    if (item.confidence === 'high') return;
    rows.push({ job: j.job, what, conf: item.confidence, note: (item.note ?? '').slice(0, 90) });
  };
  push('밤의 축복', j.nightBlessing);
  for (const p of j.uptimePassives ?? []) push(`유지형: ${p.name}`, p);
  for (const p of j.alwaysOn ?? []) push(`상시: ${p.name}`, p);
}
rows.sort((a, b) => (a.conf === b.conf ? a.job.localeCompare(b.job, 'ko') : a.conf === 'low' ? -1 : 1));

// 분기가 비어 있는 룬도 같이 모은다. 검증기는 통과하지만 그 조성에서 0 이 되는 구멍이라
// confidence 로는 안 잡히고, 화면에서도 '수치 옵션 없는 룬'과 구분되지 않는다.
const { missingBranches } = await import('./validate-data.mjs');
const gaps = missingBranches('.');

/* 룬 조건부의 불확실성도 같이 모은다.
 *
 * 조건부의 evidence 는 전부 tooltip 이다 — 수치 자체는 게임에 적혀 있어 의심할 게 없다.
 * 불확실한 것은 basis: 'playstyle' 인 항목의 **기대값**이다. 로테이션·콘텐츠에 따라
 * 실제 가동률이 달라지는데, 그 판단은 그 룬을 실제로 쓰는 사람만 할 수 있다.
 * 그래서 confidence 필드를 새로 만들지 않았다 — 이미 basis 가 그 구분을 하고 있고,
 * 안 쓰이는 필드를 하나 더 만들면 그게 또 죽은 키가 된다(uptime 이 그랬다). */
const playstyle = [];
for (const [rune, entries] of Object.entries(cond.RUNE_CONDITIONALS ?? {})) {
  for (const e of entries) {
    if (e.basis !== 'playstyle') continue;
    playstyle.push({ rune, label: e.label, expected: e.expected, note: (e.note ?? '').slice(0, 80) });
  }
}
playstyle.sort((a, b) => a.rune.localeCompare(b.rune, 'ko'));

writeFileSync(HELP_OUT,
  `# 검증이 필요한 항목\n\n` +
  `이 문서는 \`node tools/build-data.mjs\` 가 \`data/\` 에서 자동 생성한다. 직접 고치지 마라.\n\n` +
  `수치를 바꿀 때는 \`evidence\` 에 어떻게 확인했는지 함께 적어야 한다 — 근거 없는 변경은 테스트가 막는다.\n` +
  `게임에 적혀 있는 값이면 \`{ "type": "tooltip", "date": "2026-08-08" }\` 두 칸이면 된다.\n\n` +
  (gaps.length
    ? `## 아예 비어 있는 분기\n\n` +
      `세트 조성에 따라 효과가 갈리는 룬인데, 어떤 조성의 값이 아예 없다.\n` +
      `**그 조성에서는 이 룬이 0 으로 계산된다.** 화면에는 '수치 옵션이 없는 룬'과 똑같이 보여서\n` +
      `아무 신호가 없다 — 가장 찾기 어려운 종류의 구멍이라 제보가 특히 반갑다.\n\n` +
      `| 룬 | 비어 있는 분기 |\n|---|---|\n` +
      gaps.map((g) => `| ${g.rune} | ${g.missing.join(', ')} |`).join('\n') + '\n\n'
    : '') +
  (playstyle.length
    ? `## 로테이션에 따라 달라지는 값\n\n` +
      `수치 자체는 게임에 적혀 있어 맞습니다. 모르는 것은 **실제로 얼마나 켜져 있느냐** 입니다.\n` +
      `아래 기대값은 "이 정도겠지" 로 잡은 것이라, 그 룬을 실제로 쓰는 분의 감각이 가장 정확합니다.\n` +
      `화면에서 직접 조절할 수도 있습니다(조정 배지).\n\n` +
      `| 룬 | 항목 | 잡아둔 기대값 | 메모 |\n|---|---|---|---|\n` +
      playstyle.map((p) => `| ${p.rune} | ${p.label} | ${p.expected ?? '—'} | ${p.note.replace(/\|/g, '\\|')} |`).join('\n') +
      '\n\n'
    : '') +
  `## 신뢰도가 낮은 항목\n\n` +
  `\`high\` 가 아닌 항목만 나온다. 자기 직업이 여기 있으면 \`data/jobs/<직업>.json\` 을 고쳐 PR 을 열어주면 된다.\n\n` +
  `| 직업 | 항목 | 신뢰도 | 메모 |\n|---|---|---|---|\n` +
  rows.map((r) => `| ${r.job} | ${r.what} | ${r.conf} | ${r.note.replace(/\|/g, '\\|')} |`).join('\n') + '\n',
  'utf8');

// ── limits ───────────────────────────────────────────────
// 도구 전체에 걸리는 한계. 화면(limits.html)과 저장소(LIMITS.md) 양쪽이 여기서 나온다.
// 손으로 쓰는 표현을 두 벌 두면 갈라지고, 갈라진 쪽이 늘 이용자가 보는 쪽이었다.
const limits = read('data/limits.json').limits;
writeFileSync(`${OUT}/limits-data.mjs`,
  HEAD('data/limits.json') +
  `/** 이 도구가 재지 않는 것. 항목 하나가 빠지는 것(uncounted)이 아니라 전체에 걸리는 한계다. */\n` +
  `export const LIMITS = Object.freeze(${lit(limits)});\n`,
  'utf8');

const KIND_LABEL = {
  structural: '비교 방식 자체',
  unmodeled: '아직 안 만듦',
  unverified: '확증 못 함',
};
const OPEN_LABEL = {
  report: '[/report](https://rune.askhyung.com/report) 로 제보',
  pr: 'PR 환영',
};
writeFileSync(LIMITS_OUT,
  `# 이 도구가 재지 않는 것\n\n` +
  `이 문서는 \`node tools/build-data.mjs\` 가 \`data/limits.json\` 에서 자동 생성한다. 직접 고치지 마라.\n` +
  `사이트의 같은 내용(\`limits.html\`)도 같은 파일에서 나온다.\n\n` +
  `**항목 하나가 계산에서 빠지는 것은 여기가 아니다.** 그건 그 데이터 옆의 \`uncounted\` 에 적고,\n` +
  `사이트가 항목마다 그때그때 보여준다. 여기 적는 것은 도구 전체에 걸리는 한계뿐이다.\n\n` +
  limits.map((l) =>
    `## ${l.title}\n\n` +
    `**성격** ${KIND_LABEL[l.kind]}` +
    (l.openTo ? ` · **채워줄 수 있다** ${OPEN_LABEL[l.openTo]}` : '') + `\n\n` +
    `${l.why}\n\n` +
    `**그래서** ${l.effect}\n`,
  ).join('\n') +
  `\n---\n\n` +
  `수치의 신뢰도가 항목마다 다른 것은 [HELP-WANTED.md](HELP-WANTED.md) 에 따로 있다.\n`,
  'utf8');

console.log(`생성: 직업 ${jobs.length} · 숙련 ${Object.keys(masteries).length} · 경로 ${Object.keys(effectFields).length} · HELP-WANTED ${rows.length}건 + 빈 분기 ${gaps.length}건 · LIMITS ${limits.length}건`);
