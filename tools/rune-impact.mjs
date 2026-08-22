#!/usr/bin/env node
// 이 변경이 **어떤 룬을 움직였는지** 를 룬별로 보여준다.
//
//   node tools/rune-impact.mjs            # HEAD 대비 지금 작업본
//   node tools/rune-impact.mjs main       # 다른 기준과 비교
//   node tools/rune-impact.mjs HEAD~3
//   node tools/rune-impact.mjs --json     # 기계가 읽을 형태
//
// 왜 필요한가. 테스트는 **내가 지킬 생각을 한 것**만 지킨다. 골든 점수는 룬 6개짜리 세트
// 하나를 고정하므로 그 세트에 없는 룬이 통째로 망가져도 초록불이다. 검증기는 데이터의
// 모양을 보지 룬 하나하나가 화면에서 어떻게 보이는지는 안 본다.
//
// 실제로 그렇게 샌 적이 있다. 설명문을 '감소한다' 로 훑어 페널티를 만들던 코드가 공허·
// 위엄·다가옴+·무형에 "계산에 안 들어간 것: 페널티" 를 붙이고 있었다. 점수는 1원도 안
// 움직였고 테스트 190개가 전부 통과했다. 룬별로 늘어놓고 봤다면 첫 줄에 걸렸을 것이다.
//
// 그래서 이 도구는 점수만 보지 않는다. **화면에 나가는 것 전부**를 룬마다 찍어 두 판을
// 비교한다 — 점수, 계산 밖 항목, 부정 효과, 계열, 쿨감 환산, 모델링된 조건부.
//
// 판정하지 않는다. "이건 의도한 변경" 인지는 사람이 안다. 도구는 **빠짐없이 늘어놓기만**
// 한다 — 의도한 3개 옆에 의도 안 한 4개가 같이 보이는 것이 이 도구의 전부다.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** 점수를 낼 때 쓰는 고정 세트. 게임 규칙상 맞는 조합인지는 상관없다 — 재는 자일 뿐이다. */
const PROBE_SET = ['거대한 분노', '계시+', '광채+', '눈부신 잔영', '대군주+', '두 갈래 뿔'];

/** 룬이 들어 있는지 보는 계열 목록. 여기 빠지면 화면의 계열 배지가 조용히 사라진다. */
const MEMBERSHIP = [
  'AWAKENING_RUNES', 'CURSE_RUNES', 'EROSION_RUNES', 'VULNERABLE_RUNES',
  'DOT_APPLIER_RUNES', 'DOT_TRIGGER_RUNES', 'SPECIAL_TRIGGER_RUNES',
];

/**
 * 한 판(= 한 디렉터리)의 룬별 상태를 전부 뽑는다.
 *
 * 재는 자(이 함수)는 항상 지금 판을 쓰고, 재이는 대상(모듈)만 갈아 끼운다. 그래야 두 판을
 * 같은 자로 잰 것이 된다.
 */
async function snapshot(dir) {
  const load = (p) => import(pathToFileURL(join(resolve(dir), p)).href);
  const [{ RUNES }, { uncountedOf }, cond, { evaluate }, { sampleProfile }] = await Promise.all([
    load('src/runes-data.mjs'), load('src/rune-uncounted.mjs'), load('src/rune-conditionals.mjs'),
    load('src/build-evaluator.mjs'), load('tests/sample-profile.mjs'),
  ]);
  const profile = sampleProfile({ assumeVulnerable: false });
  const score = (set) => Number(evaluate(RUNES, set, 'expected', profile).score.toFixed(4));
  const base = score(PROBE_SET);
  const baseName = (n) => n.replace(/\+$/, '');

  const out = {};
  for (const r of RUNES.items) {
    const n = baseName(r.name);
    out[r.name] = {
      단독: score([r.name]),
      // 세트에 끼웠을 때의 변화량. 계열 시너지처럼 혼자서는 안 보이는 것을 잡는다.
      세트기여: Number((score([...PROBE_SET, r.name]) - base).toFixed(4)),
      계산밖: uncountedOf(r).map((u) => `[${u.kind}]${u.neg ? '(부정)' : ''} ${u.text}`),
      부정효과: Object.values(cond.NEGATIVE_TRAITS)
        .filter((t) => t.runes.includes(n)).map((t) => t.label),
      /* 목록이거나 맵이다 — DOT_APPLIER_RUNES 는 "어떤 도트를 남기는가" 를 담게 되면서
       * 배열에서 맵으로 바뀌었다. 둘 다 룬 이름을 갖고 있으므로 키만 보면 된다. */
      계열: MEMBERSHIP.filter((k) => {
        const v = cond[k];
        const names = Array.isArray(v) ? v : Object.keys(v ?? {});
        return names.some((x) => baseName(x) === n);
      }),
      쿨감환산: (cond.UTILITY_DAMAGE_EQUIVALENT[r.name] ?? cond.UTILITY_DAMAGE_EQUIVALENT[n])?.percent ?? null,
      조건부: (cond.RUNE_CONDITIONALS[r.name] ?? cond.RUNE_CONDITIONALS[n] ?? [])
        .map((e) => `${e.id}: ${e.label} ${e.field ?? '(uncounted)'} [${e.min ?? ''}~${e.max ?? ''}]`),
    };
  }
  return out;
}

/** 기준 커밋을 임시 디렉터리에 펼친다. 작업본을 건드리지 않으려고 checkout 대신 archive 를 쓴다. */
function checkout(ref, dir) {
  const tar = execFileSync('git', ['archive', ref], { maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar, maxBuffer: 1 << 28 });
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 한 룬의 두 상태를 항목별로 비교해 달라진 것만 문장으로 만든다. */
function diffRune(before, after) {
  const lines = [];
  for (const key of Object.keys(after)) {
    const [a, b] = [before?.[key], after[key]];
    if (same(a, b)) continue;
    if (Array.isArray(b)) {
      // 목록은 사라진 것과 생긴 것을 나눠 보여준다. 통째로 두 줄 찍으면 뭐가 바뀌었는지 안 보인다.
      const [aa, bb] = [a ?? [], b];
      for (const x of aa.filter((x) => !bb.includes(x))) lines.push(`    − ${key}  ${x}`);
      for (const x of bb.filter((x) => !aa.includes(x))) lines.push(`    + ${key}  ${x}`);
    } else if (typeof b === 'number' && typeof a === 'number') {
      const pct = a === 0 ? '' : ` (${((b / a - 1) * 100).toFixed(2)}%)`;
      lines.push(`    ~ ${key}  ${a} → ${b}${pct}`);
    } else {
      lines.push(`    ~ ${key}  ${a ?? '(없음)'} → ${b ?? '(없음)'}`);
    }
  }
  return lines;
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const ref = args.find((a) => !a.startsWith('--')) ?? 'HEAD';

const dir = mkdtempSync(join(tmpdir(), 'rune-impact-'));
let before;
try {
  checkout(ref, dir);
  before = await snapshot(dir);
} catch (e) {
  // 기준 판에 모듈이 아예 없거나 API 가 다르면 비교가 성립하지 않는다. 조용히 0건으로
  // 끝내면 "아무것도 안 바뀌었다" 로 읽히므로 여기서 멈춘다.
  console.error(`기준 ${ref} 을 읽지 못했다 — 비교할 수 없다.\n${e.message}`);
  process.exit(2);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
const after = await snapshot('.');

const changed = [];
for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
  if (!after[name]) { changed.push([name, ['    − 룬이 없어졌다']]); continue; }
  if (!before[name]) { changed.push([name, ['    + 룬이 새로 생겼다']]); continue; }
  const lines = diffRune(before[name], after[name]);
  if (lines.length) changed.push([name, lines]);
}

if (asJson) {
  console.log(JSON.stringify({ ref, total: Object.keys(after).length, changed: Object.fromEntries(changed) }, null, 2));
} else if (!changed.length) {
  console.log(`${ref} 대비 달라진 룬 없음 (룬 ${Object.keys(after).length}개 전부 그대로)`);
} else {
  console.log(`${ref} 대비 ${changed.length}개 룬이 달라졌다 (전체 ${Object.keys(after).length}개)\n`);
  for (const [name, lines] of changed) console.log(`  ${name}\n${lines.join('\n')}`);
  console.log('\n의도한 변경인지는 사람이 판단한다. 위 목록에 예상 못 한 룬이 있으면 그게 이 도구의 용건이다.');
}
