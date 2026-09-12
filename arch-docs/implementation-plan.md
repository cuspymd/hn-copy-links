# HN Copy Links — 구현 계획

Hacker News 목록에서 기사 제목 오른쪽의 버튼 한 번으로 **기사 링크 + 코멘트 링크**를
클립보드에 복사하고, 이미 복사한 항목을 시각적으로 구분해 주는 확장.
Chrome / Firefox / Firefox for Android 지원.

참고 기준 프로젝트: `../text-highlighter` (폴더 구조, 빌드/배포 스크립트, 스킬 구성)

## 1. 동작 정의

### 버튼 위치
목록 행(`tr.athing`) 안의 `span.titleline` 끝에 버튼을 삽입한다.
도메인 표시(`span.sitebit.comhead`) 뒤에 오므로 제목 오른쪽에 자연스럽게 붙는다.

### 링크 계산
- 코멘트 링크: 행의 `id` 속성에서 item id를 얻어 `https://news.ycombinator.com/item?id=<id>` 로 조립.
  DOM의 "N comments" 앵커를 찾는 방식보다 견고하다 (코멘트 0개면 "discuss"로 바뀜).
- 기사 링크: `span.titleline > a` 의 `href` 를 `new URL(href, location.href)` 로 절대화.
- Ask HN / 텍스트 글은 기사 링크가 코멘트 페이지와 동일하다. 이때는 링크를 한 번만 넣는다.

### 클립보드 형식 (기본값, 조정 가능)
```
<제목>
Article: <기사 URL>
HN discussion: <코멘트 URL>
```
AI 채팅에 붙였을 때 두 URL의 역할이 구분되도록 레이블을 붙인다.
형식은 `shared/copy-format.js` 한 곳에서만 만들고 테스트로 고정한다.

### 클립보드 쓰기
`navigator.clipboard.writeText` 우선, 실패 시 숨은 textarea + `execCommand('copy')` 폴백.
text-highlighter의 `shared/clipboard.js` 를 그대로 가져온다 (Firefox Android 대응이 이미 들어있음).
클릭 핸들러는 사용자 제스처이므로 권한 문제는 없다.

### 복사 완료 표시
- 클릭 직후 버튼에 짧은 "복사됨" 피드백 (툴팁 또는 아이콘 전환, 1.5초).
- 영구 표시는 버튼에 `hncl-copied` 클래스: 색/투명도를 낮추고 체크 아이콘으로 바꾼다.
  제목 자체는 건드리지 않는다 (HN의 visited link 색과 섞이면 오히려 혼란).
- 다시 누르면 다시 복사되고 표시는 유지한다. 표시 해제는 제공하지 않는다(단순하게).

### 저장
`browser.storage.local` (동기화 없음 = 기기 한정, 요구사항과 일치).
- 키: `copiedItems`, 값: `{ "<itemId>": <복사 시각 ms> }`
- 쓰기 시 정리: 180일 경과 항목 삭제 + 최대 5000개 유지(오래된 것부터 버림).
  정리 규칙은 순수 함수로 분리해 단위 테스트한다.

## 2. 적용 페이지
`https://news.ycombinator.com/*` 전체에 content script를 주입하고,
`tr.athing` + `span.titleline` 이 있는 행에만 버튼을 붙인다.
이 조건으로 news / newest / best / ask / show / front / from?site= / 사용자 submissions 가 모두 자동 커버된다.
item 상세 페이지의 최상단 글에도 동일하게 붙는다(해가 없고 유용).

HN은 서버 렌더링이라 초기 1회 주입으로 충분하다. 안전장치로 `tr.athing` 추가를 감시하는
가벼운 MutationObserver 를 두고, 이미 버튼이 있는 행은 `data-hncl` 로 건너뛴다.

## 3. 폴더 구조

```
hn-copy-links/
  manifest.json              # Chrome MV3
  manifest-firefox.json      # Firefox MV3 + browser_specific_settings(gecko, gecko_android)
  content-scripts/
    hn-core.js               # 순수 로직: 행 파싱, URL 조립, 복사 텍스트 생성 (window 네임스페이스 IIFE)
    copied-store-core.js     # 순수 로직: 저장 맵 갱신/정리
    content.js               # DOM 주입, 클릭 핸들러, storage 연결
  shared/
    browser-api.js           # text-highlighter에서 복사
    clipboard.js             # text-highlighter에서 복사
    logger.js                # DEBUG_MODE 단일 소스
  constants/
    storage-keys.js
  styles.css                 # 버튼 + 복사됨 상태 스타일
  images/                    # icon16/48/128
  _locales/en|ko/messages.json
  scripts/
    deploy.cjs
    version-deploy.cjs
    link-skills.cjs
  .agents/skills/version-release/SKILL.md
  tests/                     # Jest (jsdom)
  e2e-tests/                 # Playwright + 로컬 HN HTML 픽스처
  AGENTS.md, CLAUDE.md, README.md, LICENSE, .gitignore, package.json
```

백그라운드 스크립트, 팝업, 옵션 페이지는 없다. 전부 content script에서 처리한다.
권한은 `storage` 하나, host_permissions 는 `https://news.ycombinator.com/*`.

## 4. 테스트

Jest 단위 테스트 (`tests/`):
- 행 파싱: 외부 링크 글, Ask HN 글(기사=코멘트), 제목만 있는 행, id 없는 행
- 상대 URL 절대화
- 복사 텍스트 형식 (중복 링크 제거 포함)
- 저장 맵 정리: 기간 초과, 개수 초과, 빈 맵
- 클립보드 폴백: `navigator.clipboard` 없음/거부 시 execCommand 경로

Playwright E2E (`e2e-tests/`):
- 저장해 둔 HN 목록 HTML 픽스처를 로컬에서 띄우고 확장을 로드
- 버튼이 모든 행에 하나씩 생기는지
- 클릭 시 클립보드 내용이 기대한 두 줄인지 (`navigator.clipboard.readText` 권한 부여)
- 재로드 후에도 복사됨 표시가 남는지

Firefox 스모크: text-highlighter 의 `e2e-tests-firefox/` 방식(Selenium 3개 테스트)을
릴리스 전 수동 실행. Firefox Android 는 실기기/에뮬레이터 수동 확인 체크리스트로 둔다.

## 5. 빌드 / 배포

text-highlighter 의 스크립트를 파일 목록만 바꿔 재사용한다.
- `npm run deploy` → `dist/` (Chrome), `dist-firefox/` (Firefox)
- `npm run version-deploy -- <version> chrome|firefox` → 매니페스트 버전 갱신, DEBUG_MODE 끄기, `outputs/hn-copy-links-<version>-<browser>.zip`
- `npm run link-skills` → `.claude/skills` → `.agents/skills` 링크
- `version-release` 스킬은 zip 이름만 바꿔 그대로 가져온다.

## 6. 작업 순서

1. `git init`, 스캐폴딩(package.json, .gitignore, 매니페스트 2종, 아이콘, 로케일)
2. `scripts/` 3개 이식 + 파일 목록 수정, `npm run deploy` 로 빈 확장이 로드되는지 확인
3. `content-scripts/hn-core.js` + 단위 테스트 (DOM 없이 로직 먼저)
4. `content.js` 버튼 주입 + `styles.css`, Chrome 에서 실제 HN 으로 육안 확인
5. 클립보드 복사 연결
6. `copied-store-core.js` + storage 연동 + 복사됨 표시, 재로드 유지 확인
7. Playwright E2E 픽스처 작성 및 통과
8. `AGENTS.md` / `README.md` 작성 (참고 프로젝트의 함정 섹션 중 해당되는 것만)
9. Firefox / Firefox Android 수동 확인
10. `version-release` 스킬로 0.1.0 릴리스

## 7. 확정된 결정 사항

- 클립보드 형식: 제목, `Article: <url>`, `HN discussion: <url>` 3줄. 텍스트 글은 2줄.
- 버튼 모양: 인라인 SVG 복사 아이콘. 복사 후에는 체크 아이콘으로 전환.
- 다국어: 영어 + 한국어. 단, 클립보드에 들어가는 레이블은 영어로 고정
  (AI 채팅에 붙이는 텍스트이므로 UI 언어와 무관해야 한다).
