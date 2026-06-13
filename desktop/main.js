const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ----- 설정(서버 주소) 영속화 -----
const DEFAULT_URL = 'http://thive.iptime.org:4000';
const configPath = () => path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf-8'));
  } catch {
    return { serverUrl: DEFAULT_URL };
  }
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('config save failed', e);
  }
}

let mainWindow = null;
let config = { serverUrl: DEFAULT_URL };

function loadServer() {
  if (!mainWindow) return;
  mainWindow.loadURL(config.serverUrl).catch(() => showErrorPage());
}

function showErrorPage() {
  if (!mainWindow) return;
  const html = `
    <html lang="ko"><head><meta charset="utf-8"/>
    <style>
      body{font-family:-apple-system,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;
        display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
      .box{max-width:420px}
      h1{font-size:20px;margin-bottom:8px}
      p{color:#94a3b8;font-size:14px;line-height:1.6}
      code{background:#1e293b;padding:2px 6px;border-radius:4px;color:#7dd3fc}
      button{margin-top:20px;padding:10px 20px;border:0;border-radius:8px;background:#2563eb;
        color:#fff;font-size:14px;cursor:pointer}
      button:hover{background:#1d4ed8}
    </style></head>
    <body><div class="box">
      <h1>서버에 연결할 수 없습니다</h1>
      <p>SafeSquare 서버(<code>${config.serverUrl}</code>)에 접속하지 못했습니다.<br/>
      서버가 켜져 있는지, 네트워크가 연결됐는지 확인해 주세요.</p>
      <button onclick="location.reload()">다시 시도</button>
    </div></body></html>`;
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

function promptServerUrl() {
  // 간단한 입력창을 별도 BrowserWindow로 띄움
  const input = new BrowserWindow({
    width: 460, height: 200, parent: mainWindow, modal: true,
    resizable: false, minimizable: false, maximizable: false,
    title: '서버 주소 설정',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  const html = `
    <html lang="ko"><head><meta charset="utf-8"/>
    <style>
      body{font-family:-apple-system,'Segoe UI',sans-serif;padding:18px;margin:0;background:#f8fafc}
      label{font-size:13px;color:#334155;display:block;margin-bottom:6px}
      input{width:100%;box-sizing:border-box;padding:9px;font-size:14px;border:1px solid #cbd5e1;border-radius:6px}
      .row{margin-top:16px;text-align:right}
      button{padding:8px 16px;border:0;border-radius:6px;font-size:13px;cursor:pointer;margin-left:8px}
      .ok{background:#2563eb;color:#fff} .cancel{background:#e2e8f0;color:#334155}
    </style></head>
    <body>
      <label>SafeSquare 서버 주소</label>
      <input id="u" value="${config.serverUrl}" />
      <div class="row">
        <button class="cancel" onclick="window.api.cancel()">취소</button>
        <button class="ok" onclick="window.api.save(document.getElementById('u').value)">저장 후 접속</button>
      </div>
      <script>
        document.getElementById('u').focus();
        document.getElementById('u').select();
      </script>
    </body></html>`;
  input.setMenu(null);
  input.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  const { ipcMain } = require('electron');
  const cleanup = () => {
    ipcMain.removeAllListeners('set-url');
    ipcMain.removeAllListeners('cancel-url');
  };
  ipcMain.once('set-url', (_e, url) => {
    const trimmed = (url || '').trim();
    if (trimmed) {
      config.serverUrl = trimmed;
      saveConfig(config);
      loadServer();
    }
    cleanup();
    if (!input.isDestroyed()) input.close();
  });
  ipcMain.once('cancel-url', () => {
    cleanup();
    if (!input.isDestroyed()) input.close();
  });
}

function buildMenu() {
  const template = [
    {
      label: '파일',
      submenu: [
        { label: '서버 주소 변경…', click: promptServerUrl },
        { label: '새로고침', accelerator: 'F5', click: () => mainWindow && mainWindow.reload() },
        { type: 'separator' },
        { label: '종료', role: 'quit' },
      ],
    },
    {
      label: '보기',
      submenu: [
        { label: '강제 새로고침', role: 'forceReload' },
        { label: '확대', role: 'zoomIn' },
        { label: '축소', role: 'zoomOut' },
        { label: '기본 배율', role: 'resetZoom' },
        { type: 'separator' },
        { label: '전체화면', role: 'togglefullscreen' },
        { label: '개발자 도구', role: 'toggleDevTools' },
      ],
    },
    {
      label: '도움말',
      submenu: [
        {
          label: 'SafeSquare 정보',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'SafeSquare',
              message: 'SafeSquare 데스크톱 클라이언트',
              detail: `버전: ${app.getVersion()}\n서버: ${config.serverUrl}`,
              buttons: ['확인'],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'SafeSquare',
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.on('did-fail-load', (_e, errorCode, _desc, validatedURL) => {
    // -3(ABORTED)은 정상적인 리다이렉트 등에서도 발생하므로 무시
    if (errorCode === -3) return;
    if (validatedURL && validatedURL.startsWith('data:')) return;
    showErrorPage();
  });

  // 외부 링크는 기본 브라우저로
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  loadServer();
}

app.whenReady().then(() => {
  config = loadConfig();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
