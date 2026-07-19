import {
  registerToolsServiceWorker,
  updateToolsConnectivity,
  watchConnectivity,
} from './core.js';

const root = document.getElementById('tools-app');
const page = document.querySelector('[data-tool-page]')?.dataset.toolPage;

registerToolsServiceWorker(window.navigator?.serviceWorker);

const controllers = {
  hub: () => import('./hub-ui.js').then(({ renderToolsHub }) => renderToolsHub(root)),
  'qr-code': () => import('./qr-ui.js').then(({ renderQrTool }) => renderQrTool(root)),
  'epub-reader': () => import('./epub-reader-ui.js').then(({ renderEpubTool }) => renderEpubTool(root)),
  dilution: () => import('./dilution-ui.js').then(({ renderDilutionTool }) => renderDilutionTool(root)),
  contrast: () => import('./contrast-ui.js').then(({ renderContrastTool }) => renderContrastTool(root)),
  'word-count': () => import('./word-count-ui.js').then(({ renderWordCountTool }) => renderWordCountTool(root)),
  'unit-converter': () => import('./unit-convert-ui.js').then(({ renderUnitTool }) => renderUnitTool(root)),
  passphrase: () => import('./passphrase-ui.js').then(({ renderPassphraseTool }) => renderPassphraseTool(root)),
};

(controllers[page] ?? controllers.hub)()
  .then(() => {
    const stopWatching = watchConnectivity(window, (online) => {
      updateToolsConnectivity(root, online);
    });
    const disposeConnectivity = () => {
      stopWatching();
      window.removeEventListener('pagehide', disposeConnectivity);
    };
    window.addEventListener('pagehide', disposeConnectivity);
  })
  .catch((error) => {
    console.error('tools: failed to start', error);
    const notice = document.createElement('p');
    notice.className = 'tool-error';
    notice.textContent = 'This tool failed to load. Please refresh.';
    root.append(notice);
  });
