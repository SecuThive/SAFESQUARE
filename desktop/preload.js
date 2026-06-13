const { contextBridge, ipcRenderer } = require('electron');

// 서버 주소 설정 모달에서만 쓰는 최소 API
contextBridge.exposeInMainWorld('api', {
  save: (url) => ipcRenderer.send('set-url', url),
  cancel: () => ipcRenderer.send('cancel-url'),
});
