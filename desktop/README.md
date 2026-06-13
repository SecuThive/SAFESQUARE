# SafeSquare 데스크톱 클라이언트

SafeSquare 웹앱에 접속하는 Electron 기반 Windows 데스크톱 클라이언트(thin client)입니다.
백엔드/프론트 서버는 그대로 두고, 전용 앱 창에서 웹 화면을 띄웁니다.

## 동작 방식
- 기본 서버 주소: `http://thive.iptime.org:4000`
- 앱 메뉴 **파일 → 서버 주소 변경…** 에서 접속 주소를 바꿀 수 있고, 설정은 사용자 폴더에 저장됩니다.
- 서버에 연결되지 않으면 안내 화면과 "다시 시도" 버튼이 표시됩니다.

## 로컬 실행 (개발/테스트)
```bash
cd desktop
npm install
npm start
```

## Windows 설치 파일(.exe) 만들기

### 방법 A — GitHub Actions (권장, macOS에서 권장)
1. 커밋/푸시 후 태그를 만듭니다:
   ```bash
   git tag desktop-v1.0.0
   git push origin desktop-v1.0.0
   ```
2. GitHub의 **Actions** 탭에서 `Build Windows Desktop (.exe)` 워크플로우가 실행됩니다.
3. 빌드가 끝나면 **Releases**에 `SafeSquare Setup x.x.x.exe`가 첨부됩니다.
   (태그 없이 Actions 탭에서 수동 실행하면 Artifact로 내려받을 수 있습니다.)

### 방법 B — Windows PC에서 직접 빌드
```bash
cd desktop
npm install
npm run dist          # release/ 폴더에 NSIS 설치 파일 생성
# 또는 무설치 단일 실행 파일:
npm run dist:portable
```

## 아이콘 적용(선택)
`desktop/assets/icon.ico` (256x256 권장)를 추가한 뒤 `package.json`의 `build.win`에
`"icon": "assets/icon.ico"` 를 다시 넣으면 앱 아이콘이 적용됩니다.
