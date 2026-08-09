#!/usr/bin/env node
/* 프로덕션 배포 전 안전장치. `npm run predeploy` 가 테스트보다 먼저 이걸 돌린다.
 *
 * 막으려는 것은 하나다 — **사이트에만 있고 어디에도 없는 코드.**
 * 배포는 로컬 dist 를 직접 올리므로, 커밋도 푸시도 안 한 상태로 배포하면 그 순간
 * 라이브 사이트의 소스가 이 노트북에만 존재하게 된다. 실제로 그런 적이 있다.
 *
 * 그래서 세 가지를 확인한다: main 인가 · 작업트리가 깨끗한가 · 원격과 같은가.
 * 셋이 맞으면 "지금 배포되는 것" 과 "GitHub 에 있는 것" 이 같다는 뜻이다.
 *
 * 급할 때는 ALLOW_DIRTY_DEPLOY=1 로 넘길 수 있다. 다만 그렇게 배포한 것은
 * 되짚을 방법이 없다는 것을 알고 쓸 것.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const problems = [];

/* 배포 설정은 .gitignore 로 빠져 있다. 다시 클론하면 없고, 그러면 D1 바인딩이 없는 채로
 * 올라가 제보 API 만 조용히 503 이 된다. 내용은 (비공개) DEPLOY.md 에 있다. */
if (!existsSync(new URL('../wrangler.toml', import.meta.url))) {
  problems.push(
    'wrangler.toml 이 없다. 추적되지 않는 파일이라 클론에는 안 딸려온다 — ' +
      '비공개 작업공간의 DEPLOY.md 에서 내용을 가져와 만들 것.',
  );
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch !== 'main') {
  problems.push(`지금 브랜치가 ${branch} 다. 프로덕션은 main 에서만 배포한다 ` +
    '(브랜치 확인용 배포는 `npm run deploy:preview`).');
}

const dirty = git('status', '--porcelain');
if (dirty) {
  const files = dirty.split('\n').slice(0, 5).map((l) => `    ${l}`).join('\n');
  const more = dirty.split('\n').length > 5 ? '\n    …' : '';
  problems.push(`커밋 안 된 변경이 있다:\n${files}${more}`);
}

/* 원격과 대조한다. fetch 를 먼저 하지 않으면 로컬의 낡은 origin/main 과 비교하게 되어
 * "푸시했다" 고 착각한 채 통과한다. */
try {
  git('fetch', '--quiet', 'origin', 'main');
} catch {
  problems.push('origin 을 못 읽었다. 연결을 확인할 것 — 원격과 대조하지 못하면 이 검사가 무의미하다.');
}

if (!problems.some((p) => p.startsWith('origin 을'))) {
  const ahead = git('rev-list', '--count', 'origin/main..HEAD');
  const behind = git('rev-list', '--count', 'HEAD..origin/main');
  if (ahead !== '0') {
    problems.push(`푸시 안 된 커밋이 ${ahead}개 있다. 배포하면 사이트에만 있는 코드가 된다.`);
  }
  if (behind !== '0') {
    problems.push(`origin 이 ${behind}개 앞서 있다. 남의 작업을 덮어쓴 배포가 된다 — 먼저 pull 할 것.`);
  }
}

if (problems.length === 0) {
  console.log(`배포 준비 확인: main ${git('rev-parse', '--short', 'HEAD')} — ${git('log', '-1', '--format=%s')}`);
  process.exit(0);
}

const forced = process.env.ALLOW_DIRTY_DEPLOY === '1';
const head = forced ? '⚠ 아래를 무시하고 배포한다 (ALLOW_DIRTY_DEPLOY=1)' : '배포를 멈춘다.';
console.error(`\n${head}\n`);
for (const p of problems) console.error(`  - ${p}`);
console.error(
  forced
    ? '\n지금 올라가는 것은 GitHub 에 없다. 배포 직후 커밋·푸시할 것.\n'
    : '\n이 검사는 "라이브에 있는 것 = GitHub 에 있는 것" 을 지킨다.\n' +
      '정말 지금 올려야 하면 ALLOW_DIRTY_DEPLOY=1 npm run deploy\n',
);
process.exit(forced ? 0 : 1);
