// 정적 파일 서버. '항상 최신 + 트래픽 절약' 정책이다.
//
//   node tools/serve.mjs            저장소 루트 — 원본 소스를 그대로 띄운다 (npm run dev)
//   node tools/serve.mjs 8124 dist  배포본 확인 (npm run serve)
//
// **브라우저로 파일을 직접 열면(file://) 안 된다.** runes.html 과 report.html 이
// <script type="module"> 을 쓰는데, 모듈은 file:// 에서 CORS 로 막혀 빈 화면이 된다.
// 의존성 없이 개발하려고 서버를 안 쓰는 것이 아니라, 서버가 이 20줄이면 되기 때문이다.
//
// python3 -m http.server 는 캐시 제어를 하지 않아 고친 내용이 반영되지 않는다.
// ESM 은 import 한 모듈까지 URL 단위로 캐시되므로 index.html 에 쿼리를 붙이는 것만으로는 부족하다.
//
// no-store 로 막으면 확실하지만 매번 전량 재전송이라 낭비다. 그래서:
//   Cache-Control: no-cache  → 캐시는 하되 매 요청 재검증
//   ETag                     → 안 바뀌었으면 304(본문 0바이트)
// 신선함은 그대로 보장하면서 재방문 트래픽만 줄인다.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// pathname 을 그대로 쓰면 경로의 공백이 %20 으로 남아 파일을 못 찾는다.
// 서빙할 디렉터리. 저장소 루트가 기본이라 data/ 를 고치고 새로고침하면 바로 보인다.
const DIR = process.argv[3] ?? '.';
const ROOT = fileURLToPath(new URL(`../${DIR}/`, import.meta.url));
const PORT = Number(process.argv[2] ?? 8124);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    // 첫 화면의 파일 이름이 서빙 대상마다 다르다. 배포본은 index.html 이고
    // 저장소 루트는 runes.html 이다 — 둘 다 받아준다.
    if (rel === '/' || rel === '') {
      rel = (await stat(join(ROOT, 'index.html')).catch(() => null))?.isFile()
        ? '/index.html'
        : '/runes.html';
    }
    // 제보 API 는 Pages Function 이라 이 정적 서버에는 없다. 404 대신 그렇다고 말해준다.
    // stat 보다 먼저 봐야 한다 — 뒤에 두면 파일이 없어서 404 로 먼저 끝난다.
    if (rel.startsWith('/api/')) {
      res.writeHead(501, { 'Content-Type': 'application/json; charset=utf-8' })
        .end(JSON.stringify({
          error: '이 서버는 정적 파일만 줍니다. 제보 목록은 `npx wrangler pages dev dist` 로 확인하세요.',
        }));
      return;
    }
    let file = join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    let info = await stat(file).catch(() => null);
    // Cloudflare Pages 처럼 확장자 없는 주소도 .html 로 찾아본다. 이게 없으면
    // 배너의 /report 링크가 로컬 확인에서만 404 가 나고, 배포하고 나서야 된다.
    if (!info?.isFile() && !extname(file)) {
      const asHtml = `${file}.html`;
      const alt = await stat(asHtml).catch(() => null);
      if (alt?.isFile()) { file = asHtml; info = alt; }
    }
    if (!info?.isFile()) { res.writeHead(404).end('not found'); return; }
    // 내용이 바뀌면 mtime 이나 크기가 바뀌므로 이걸로 ETag 를 만든다.
    const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(36)}"`;
    const headers = {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ETag: etag,
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }
    res.writeHead(200, headers).end(await readFile(file));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`${DIR} → http://127.0.0.1:${PORT}`));
