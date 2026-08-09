// 배포본(dist)에서 주석과 출처 표기를 제거한다.
//
// 원본 소스에는 근거와 출처를 남겨두고, 외부로 나가는 파일에서만 지운다.
// 문자열·템플릿·정규식 리터럴 안의 '//' 를 주석으로 오인하면 코드가 깨지므로 상태 기계로 훑는다.

import { readFileSync, writeFileSync } from 'node:fs';

/** 정규식 리터럴이 올 수 있는 자리인지 — 직전 의미 있는 문자로 판별한다. */
function regexAllowed(prev) {
  if (!prev) return true;
  return '=(,:[!&|?{};+-*%~^<>\n'.includes(prev);
}

export function stripJsComments(src) {
  let out = '';
  let i = 0;
  let prev = ''; // 직전 의미 있는 문자

  // 문맥 스택. 'tpl' = 템플릿 본문, 'interp' = ${ } 안, 'brace' = 보통 중괄호.
  //
  // 보간 안을 따로 축약해서 훑으면 거기서만 규칙이 달라진다. 실제로 그래서
  // `${x.replace(/"/g, '&quot;')}` 의 정규식 안 " 를 문자열 시작으로 오인했고,
  // 그 뒤로 파서가 어긋나 파일 나머지의 주석이 통째로 남았다(문법은 멀쩡해서 node --check 도 통과).
  // 보간 안은 그냥 코드다. 같은 루프로 돌리고, 중괄호 짝만 스택으로 세어
  // 어느 } 가 보간을 닫는지 구분한다.
  const stack = [];

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    // 템플릿 본문 — 여기서는 ` 와 ${ 만 의미가 있다.
    if (stack[stack.length - 1] === 'tpl') {
      if (c === '\\') { out += c + (next ?? ''); i += 2; continue; }
      if (c === '`') { stack.pop(); out += c; i++; prev = '`'; continue; }
      if (c === '$' && next === '{') { stack.push('interp'); out += '${'; i += 2; prev = '{'; continue; }
      out += c; i++;
      continue;
    }

    // 주석
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // 따옴표 문자열
    if (c === '"' || c === "'") {
      const quote = c;
      out += c; i++;
      while (i < src.length) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        out += src[i];
        if (src[i] === quote) { i++; break; }
        i++;
      }
      prev = quote;
      continue;
    }

    // 템플릿 리터럴 시작 — 본문 처리는 위쪽 'tpl' 분기가 맡는다.
    if (c === '`') { stack.push('tpl'); out += c; i++; prev = '`'; continue; }

    // 중괄호 짝을 세어 둔다. 짝이 맞아야 보간을 닫는 } 를 알아볼 수 있다.
    if (c === '{') { stack.push('brace'); out += c; i++; prev = '{'; continue; }
    if (c === '}') { stack.pop(); out += c; i++; prev = '}'; continue; }

    // 정규식 리터럴
    if (c === '/' && regexAllowed(prev)) {
      out += c; i++;
      let inClass = false;
      while (i < src.length) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { out += src[i]; i++; break; }
        else if (src[i] === '\n') break;
        out += src[i]; i++;
      }
      while (i < src.length && /[gimsuyd]/.test(src[i])) { out += src[i]; i++; }
      prev = '/';
      continue;
    }

    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }

  // 주석만 있던 줄과 연속 빈 줄 정리
  return out.split('\n').filter((l, idx, arr) => !(l.trim() === '' && arr[idx - 1]?.trim() === '')).join('\n');
}

export const stripCssComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l, i, a) => !(l.trim() === '' && a[i - 1]?.trim() === '')).join('\n');

export const stripHtmlComments = (src) => src.replace(/<!--[\s\S]*?-->/g, '');

/** 데이터에 박혀 있는 출처 필드도 제거한다(주석이 아니라 값이라 따로 지운다). */
export function stripSourceFields(src) {
  return src
    .replace(/^\s*"?source"?:\s*\{[\s\S]*?\},?\s*$/m, '')
    .replace(/^\s*"?(page|api|fetchedAt|filter|totalSeason2)"?:\s*"[^"]*",?\s*$/gm, '')
    .replace(/^\s*"?notes"?:\s*\[[\s\S]*?\],?\s*$/m, '');
}

const files = process.argv.slice(2);
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  let out;
  if (f.endsWith('.css')) out = stripCssComments(src);
  else if (f.endsWith('.html')) out = stripHtmlComments(src);
  else out = stripSourceFields(stripJsComments(src));
  writeFileSync(f, out);
}
