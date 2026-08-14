#!/usr/bin/env bash
# 공개용 dist 를 다시 만든다. 프로젝트 전체가 노출되지 않도록 필요한 파일만 복사한다.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist && mkdir -p dist/src
cp runes.html dist/index.html
# 수치 제보 페이지. Cloudflare Pages 가 /report 로 서빙한다.
cp report.html dist/report.html
# 계산 범위 페이지. 무엇을 재지 않는지와 그 이유가 여기 있다.
cp limits.html dist/limits.html
cp runes.css dist/   # 세 페이지가 같은 CSS 를 쓴다
# 안내용 이미지. 지금은 스탯창 스크린샷 예시 하나뿐이다.
#
# 파비콘처럼 인라인(data URI)으로 넣지 않는 이유: 52K 짜리 사진을 index.html 에 박으면
# 접혀 있는 안내를 아무도 안 펴도 매번 내려받는다. 파일로 두면 <details> 를 펼 때만 온다.
mkdir -p dist/assets && cp -R assets/. dist/assets/
#
# functions/ 는 여기 복사하지 않는다. Cloudflare 가 프로젝트 루트에서 따로 읽어 워커로
# 묶으므로, dist 에 넣으면 서버 코드가 정적 파일로 그대로 공개된다.
# rune-app.mjs 가 실제로 끌어오는 모듈을 따라가며 복사한다.
# 목록을 손으로 관리하면 새 모듈을 추가할 때마다 빠뜨린다(artifacts-data.mjs 가 그랬다).
copy_deps() {
  local f="$1"
  [ -f "dist/src/$f" ] && return
  # 하위 디렉터리(gen/ 등)에 있는 모듈도 있으므로 대상 디렉터리를 먼저 만든다.
  mkdir -p "dist/src/$(dirname "$f")"
  cp "src/$f" "dist/src/$f"
  # import ... from './xxx.mjs' 형태를 재귀로 따라간다.
  # 경로에 / 를 허용한다 — 안 하면 './gen/jobs-data.mjs' 를 놓치고,
  # 빌드는 성공한 척하는데 배포본만 깨진다(실제로 그랬다).
  # import 가 없는 모듈에서 grep 이 1을 반환해도 멈추지 않도록 || true
  local deps dep resolved
  deps=$(grep -oE "from '\./[A-Za-z0-9._/-]+\.mjs'" "src/$f" | sed -E "s/from '\.\///; s/'//" || true)
  for dep in $deps; do
    # 상대 경로는 그 파일이 있는 디렉터리 기준이다. src/ 기준으로 정규화한다.
    resolved=$(cd "src/$(dirname "$f")" && cd "$(dirname "$dep")" 2>/dev/null && pwd)/$(basename "$dep")
    copy_deps "${resolved#"$(pwd)/src/"}"
  done
}
copy_deps rune-app.mjs
copy_deps report-app.mjs
copy_deps limits-app.mjs

# 배포본이 실제로 로드되는지 확인한다. 파일 하나만 빠져도 브라우저에서 빈 화면이 되는데,
# 지금까지는 빌드가 성공으로 끝나 그걸 알 수 없었다.
missing=0
while IFS= read -r f; do
  while IFS= read -r dep; do
    target="dist/src/$(cd "dist/src/$(dirname "${f#dist/src/}")" && cd "$(dirname "$dep")" 2>/dev/null && pwd)/$(basename "$dep")"
    target="dist/src/${target##*/dist/src/}"
    [ -f "$target" ] || { echo "빠진 의존성: $f → $dep"; missing=1; }
  done < <(grep -oE "from '\./[A-Za-z0-9._/-]+\.mjs'" "$f" | sed -E "s/from '//; s/'//" || true)
done < <(find dist/src -name '*.mjs')
[ "$missing" -eq 0 ] || { echo "배포본에 빠진 모듈이 있다"; exit 1; }

# HTML 이 가리키는 자산이 실제로 있는지. 없으면 안내 그림 자리가 빈 채로 나가는데,
# 그건 화면에 에러도 안 뜨고 아무도 신고하지 않는 종류의 고장이다.
for f in dist/index.html dist/report.html dist/limits.html; do
  while IFS= read -r a; do
    [ -f "dist${a}" ] || { echo "빠진 자산: $f → $a"; exit 1; }
  done < <(grep -oE '(data-)?src="/assets/[^"]+"' "$f" | sed -E 's/.*src="//; s/"//' || true)
done
# dist 정리: 캐시 무효화 쿼리 삽입
STAMP=$(date +%Y%m%d%H%M%S)
python3 - "$STAMP" <<'PY'
import sys, re

stamp = sys.argv[1]
home = open('dist/index.html', encoding='utf-8').read()
report = open('dist/report.html', encoding='utf-8').read()
limits = open('dist/limits.html', encoding='utf-8').read()

# 바깥으로 나가는 링크가 죽은 채로 배포되지 않게 여기서 확인한다. 저장소를 옮기거나
# 이름을 바꾸면 404 가 되는데, 그건 아무도 신고해 주지 않아 안 드러난다.
REPO = 'github.com/mobinogi-tools/rune-optimizer"'

# 창구가 둘이고 역할이 다르다. 하나로 합치거나 한쪽이 사라지면 여기서 멈춘다.
if home.count(REPO) != 1:
    sys.exit('첫 화면의 오픈소스 링크를 1개 찾지 못했다 — runes.html 헤더를 확인할 것')
if home.count('href="/report"') != 1:
    sys.exit('첫 화면에 수치 제보 링크(/report)가 1개 있어야 한다 — runes.html 헤더를 확인할 것')

# 계산 범위 페이지로 가는 길. 이 링크가 없으면 "왜 이건 계산 안 하냐" 에 답할 데가
# 저장소밖에 안 남는데, 사이트만 쓰는 사람은 저장소를 열지 않는다.
#
# 개수를 1로 못박지 않는다 — 진입점이 둘이다(배너, 결과 패널). 배너는 "그런 페이지가
# 있다", 결과 옆은 "지금 그 답이 필요하다" 로 역할이 다르다. 하나로 합치지 마라.
if home.count('href="/limits"') < 1:
    sys.exit('첫 화면에 계산 범위 링크(/limits)가 없다 — runes.html 을 확인할 것')

# 이슈 작성 화면으로 보내는 것은 제보 창구인 척하는 것이다. 게임을 아는 사람 대다수는
# GitHub 계정이 없고, 있어도 이슈를 열지 않는다. 좋은 뜻으로 되돌리지 마라.
for name, text in (('첫 화면', home), ('제보 페이지', report), ('계산 범위 페이지', limits)):
    if '/issues' in text:
        sys.exit(f'{name}이 이슈 화면을 가리키고 있다 — 제보 창구는 이슈가 아니다')

# 제보 페이지가 추천기로 돌아갈 길을 잃으면 막다른 골목이 된다.
if report.count('href="/"') != 1:
    sys.exit('제보 페이지에 추천기로 돌아가는 링크가 1개 있어야 한다')
if report.count(REPO) != 1:
    sys.exit('제보 페이지의 오픈소스 링크를 1개 찾지 못했다')

# 계산 범위 페이지도 막다른 골목이 되면 안 된다.
if limits.count('href="/"') != 1:
    sys.exit('계산 범위 페이지에 추천기로 돌아가는 링크가 1개 있어야 한다')

# 브라우저가 옛 파일을 계속 쓰지 않도록 매 빌드마다 쿼리를 바꾼다.
def bust(text, entry):
    text = re.sub(r'(href="runes\.css)"', rf'\1?v={stamp}"', text)
    return re.sub(rf'(src="src/{entry}\.mjs)"', rf'\1?v={stamp}"', text)

for path, text, entry in (
    ('dist/index.html', home, 'rune-app'),
    ('dist/report.html', report, 'report-app'),
    ('dist/limits.html', limits, 'limits-app'),
):
    out = bust(text, entry)
    # 치환이 안 먹었으면 캐시버스트가 조용히 빠진 채로 배포된다.
    if f'?v={stamp}' not in out:
        sys.exit(f'{path} 에 캐시버스트를 넣지 못했다 — 파일명이 바뀌었는지 확인할 것')
    open(path, 'w', encoding='utf-8').write(out)

print('cache-bust', stamp)
PY
# 외부로 나가는 파일에서는 주석과 출처 표기를 지운다. 원본 소스에는 그대로 남는다.
node tools/strip-comments.mjs dist/index.html dist/report.html dist/limits.html dist/runes.css $(find dist/src -name '*.mjs')

# 지우고 나서도 문법이 깨지지 않았는지 확인한다.
# gen/ 안의 모듈까지 봐야 한다 — dist/src/*.mjs 만 보면 하위 디렉터리를 통째로 놓친다.
while IFS= read -r f; do
  node --check "$f" || { echo "문법 오류: $f"; exit 1; }
done < <(find dist/src -name '*.mjs')

# import 경로에도 같은 캐시버스트를 심는다.
#
# HTML 이 부르는 진입점(rune-app.mjs)에만 ?v= 를 붙이면, 그 진입점이 import 하는 모듈은
# 주소가 그대로라 브라우저가 옛것을 계속 쓴다. 새 앱 + 낡은 데이터 조합이 나오고,
# 화면에는 에러가 없어서 고친 사람도 쓰는 사람도 눈치채지 못한다 — 2026-08-15 에
# 실제로 두 사람이 하루에 물었다. no-cache 로도 안 막혔다(탭이 이미 들고 있는 모듈
# 그래프는 재검증 없이 재사용된다). 주소 자체를 바꾸는 것 말고는 방법이 없다.
#
# 이 치환은 dist 안에서만 일어난다. 원본 src/ 의 import 는 그대로여서 npm run dev 는
# 영향을 안 받는다.
python3 - "$STAMP" <<'PY'
import re, sys
from pathlib import Path

stamp = sys.argv[1]
IMPORT = re.compile(r"""(from\s*['"]\./[A-Za-z0-9._/-]+\.mjs)(['"])""")
touched = 0
for p in Path('dist/src').rglob('*.mjs'):
    src = p.read_text(encoding='utf-8')
    out = IMPORT.sub(rf'\1?v={stamp}\2', src)
    # 치환하고도 ?v= 없는 import 가 남아 있으면 그 모듈만 낡은 채로 배포된다.
    # 조용히 넘어가면 하필 그 하나가 데이터 모듈일 때 가장 크게 틀린다.
    leftover = [m.group(0) for m in re.finditer(r"""from\s*['"]\./[^'"]+\.mjs['"]""", out)]
    if leftover:
        sys.exit(f'{p}: 캐시버스트가 안 붙은 import 가 남았다 — {leftover[0]}')
    if out != src:
        p.write_text(out, encoding='utf-8')
        touched += 1
print(f'import cache-bust: {touched}개 모듈')
PY

# 정적 호스팅용 헤더. Cloudflare Pages 는 _headers 를 읽고, 다른 호스트는 무시한다.
#
# 캐시버스트 쿼리는 index.html 이 직접 부르는 두 파일에만 붙는다.
# rune-app.mjs 가 import 하는 모듈들은 URL 이 그대로라, 오래 캐시하면
# 새 앱 + 낡은 데이터 조합이 나온다. 그래서 전부 매 요청 재검증(no-cache)하고
# 안 바뀌었으면 304 로 끝낸다 — serve.mjs 와 같은 정책이다.
cat > dist/_headers <<'HEADERS'
/*
  Cache-Control: no-cache
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN

# 안내 이미지는 코드와 달리 내용이 바뀌지 않는다. 매번 재검증할 이유가 없다.
/assets/*
  Cache-Control: public, max-age=604800, immutable

# 검색에 잡히는 주소는 rune.askhyung.com 하나여야 한다.
#
# *.pages.dev 도 같은 내용을 그대로 서빙한다 — 프리뷰(아직 안 올린 작업)와 배포별 해시
# 주소까지 전부. 색인되면 같은 글이 여러 주소로 잡히고, 검색에서 프리뷰가 먼저 나올 수도
# 있다. 프리뷰를 공개로 열면 그때부터 실제로 일어나는 일이다.
#
# canonical 만으로는 부족하다. 그건 "정본은 저쪽" 이라는 힌트일 뿐 색인 자체를 막지 않는다.
https://mabinogi-rune-optimizer.pages.dev/*
  X-Robots-Tag: noindex
https://*.mabinogi-rune-optimizer.pages.dev/*
  X-Robots-Tag: noindex
HEADERS

echo "dist 갱신: $(find dist -type f | wc -l | tr -d ' ')개 파일, $(du -sh dist | cut -f1)"
