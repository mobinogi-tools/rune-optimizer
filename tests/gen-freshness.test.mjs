// 생성물 신선도.
//
// src/gen/*.mjs 는 data/ 에서 만들어지지만 저장소에 커밋한다(clone 해서 바로 열려야 하므로).
// 그래서 두 가지가 어긋날 수 있다:
//   1. data/ 만 고치고 재생성을 잊은 PR — 앱은 옛 값으로 계속 돈다
//   2. src/gen/ 을 직접 고친 PR — 다음 재생성 때 조용히 되돌아간다
// 둘 다 "고쳤는데 왜 안 바뀌지" 로 이어진다. 여기서 잡는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// 생성기의 출력 인자는 **전부** 넘겨야 한다. 하나라도 빠뜨리면 그 산출물은 기본 경로로
// 떨어지는데, 기본 경로는 저장소 루트다 — 검사한다고 돌린 임시 실행이 진짜 파일을 덮어쓴다.
// 그러면 이 테스트는 무엇을 고치든 항상 통과한다(자기가 방금 덮어쓴 것과 비교하므로).
const OUTPUTS = (dir) => [dir, join(dir, 'HELP-WANTED.md'), join(dir, 'LIMITS.md')];

test('커밋된 src/gen 이 data/ 에서 다시 만든 것과 같다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rune-gen-'));
  try {
    execFileSync(process.execPath, ['tools/build-data.mjs', ...OUTPUTS(dir)], {
      cwd: process.cwd(), stdio: 'pipe',
    });
    const stale = readdirSync(dir)
      .filter((f) => f.endsWith('.mjs'))
      .filter((f) => readFileSync(join(dir, f), 'utf8') !== readFileSync(join('src/gen', f), 'utf8'));

    assert.deepEqual(stale, [],
      `src/gen 이 data/ 와 어긋난다: ${stale.join(', ')}\n` +
      `→ \`node tools/build-data.mjs\` 를 돌리고 결과를 커밋할 것.`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('HELP-WANTED.md 도 최신이다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rune-help-'));
  try {
    execFileSync(process.execPath, ['tools/build-data.mjs', ...OUTPUTS(dir)], { cwd: process.cwd(), stdio: 'pipe' });
    assert.equal(readFileSync(join(dir, 'HELP-WANTED.md'), 'utf8'), readFileSync('HELP-WANTED.md', 'utf8'),
      'HELP-WANTED.md 가 data/ 의 confidence 와 어긋난다 — build-data.mjs 를 다시 돌릴 것');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('LIMITS.md 도 최신이다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rune-limits-'));
  try {
    execFileSync(process.execPath, ['tools/build-data.mjs', ...OUTPUTS(dir)], { cwd: process.cwd(), stdio: 'pipe' });
    assert.equal(readFileSync(join(dir, 'LIMITS.md'), 'utf8'), readFileSync('LIMITS.md', 'utf8'),
      'LIMITS.md 가 data/limits.json 과 어긋난다 — build-data.mjs 를 다시 돌릴 것');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
