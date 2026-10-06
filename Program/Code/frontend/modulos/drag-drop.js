// ── Drag & drop ───────────────────────────────────────────────────────────────

// decodeURIComponent falha com encoding Latin-1 (ex: %E9 para é).
// Essa função tenta UTF-8 primeiro, depois faz decode byte-a-byte como fallback.
function _decodeUriPath(encoded) {
  try {
    return decodeURIComponent(encoded);
  } catch (_) {
    return encoded.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
  }
}

// Deve ser chamado SINCRONAMENTE dentro do handler de drop (antes de qualquer
// await, senão o dataTransfer é neutralizado). Posta os File objects pro WebView2,
// que entrega os caminhos completos (CoreWebView2File) pro backend via pywebview.
// Retorna a lista de nomes pra casar com os caminhos no backend, ou null.
function postNativeDropFiles(e) {
  try {
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return null;
    if (!window.chrome?.webview?.postMessageWithAdditionalObjects) return null;
    const names = Array.from(files).map(f => f.name);
    chrome.webview.postMessageWithAdditionalObjects('FilesDropped', files);
    return names;
  } catch (_) { return null; }
}

async function getNativeDropPaths(names) {
  if (!names) return null;
  try {
    const r = await window.pywebview.api.get_dropped_paths(names);
    if (r.success && r.paths.length > 0) return r.paths;
  } catch (_) {}
  return null;
}

async function getDroppedPath(e, nativeNames) {
  // Método 0: caminho nativo do WebView2 — fonte confiável, funciona pra
  // arquivo E pasta, sempre retorna o item realmente arrastado.
  const nativePaths = await getNativeDropPaths(nativeNames);
  if (nativePaths) {
    const path = nativePaths[0];
    const r = await window.pywebview.api.check_is_dir(path);
    if (r.success) return { path, isDirectory: r.is_dir };
  }

  // Método 1: file.path — funciona no Electron; em WebView2 normalmente undefined
  try {
    const f = e.dataTransfer.files?.[0];
    if (f?.path && f.path.length > 2) {
      const r = await window.pywebview.api.check_is_dir(f.path);
      if (r.success) return { path: f.path, isDirectory: r.is_dir };
    }
  } catch (_) {}

  // Método 2: text/uri-list — fonte principal no WebView2.
  // Não filtra por r.exists: o caminho da uri-list é confiável (mesma abordagem
  // de getDroppedPaths, que já funciona para Remover e Contexto).
  try {
    const uriList = e.dataTransfer.getData('text/uri-list');
    if (uriList?.trim()) {
      const line = uriList.split(/\r?\n/).find(l => l.trim() && !l.startsWith('#'));
      const uri = line?.trim();
      if (uri?.startsWith('file:///')) {
        const raw = _decodeUriPath(uri.slice(8));
        const path = raw.replace(/\//g, '\\').replace(/\\+$/, '');
        if (path.length > 2) {
          const r = await window.pywebview.api.check_is_dir(path);
          if (r.success) return { path, isDirectory: r.is_dir };
        }
      }
    }
  } catch (_) {}

  // Método 3: text/plain
  try {
    const plain = e.dataTransfer.getData('text/plain')?.trim();
    if (plain && (/^[A-Za-z]:[\\\/]/.test(plain) || plain.startsWith('\\\\'))) {
      const path = plain.replace(/\//g, '\\');
      const r = await window.pywebview.api.check_is_dir(path);
      if (r.success) return { path, isDirectory: r.is_dir };
    }
  } catch (_) {}

  // Método 4: Explorer selection via PowerShell — necessário para pasta no WebView2
  // (text/uri-list fica vazio para drags de pasta). O cache foi pré-aquecido no
  // dragenter. O drag monitor captura o cursor e identifica a janela correta.
  try {
    const promise = _explorerSelectionCache
      ? _explorerSelectionCache.promise
      : window.pywebview.api.get_explorer_selection();
    const r = await promise;
    _explorerSelectionCache = null;
    if (r.success && r.paths.length > 0) {
      const path = r.paths[0];
      const rd = await window.pywebview.api.check_is_dir(path);
      if (rd.success) return { path, isDirectory: rd.is_dir };
    }
  } catch (_) {}

  return null;
}

let _explorerSelectionCache = null; // {promise, ts}

function prefetchExplorerSelection() {
  // Sempre cria Promise nova no dragenter — nunca reutiliza cache de drag anterior.
  // Cache antigo causa retorno do item ERRADO (seleção prévia do Explorer).
  _explorerSelectionCache = {
    ts: Date.now(),
    promise: window.pywebview.api.get_explorer_selection()
  };
}

function setupDropZone(el, onDrop) {
  el.addEventListener('dragenter', e => {
    if (!e.dataTransfer.types.some(t => t.toLowerCase() === 'files')) return;
    prefetchExplorerSelection(); // inicia consulta PowerShell cedo
  });
  el.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.some(t => t.toLowerCase() === 'files')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    el.classList.add('drop-active');
  });
  el.addEventListener('dragleave', e => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('drop-active');
  });
  el.addEventListener('drop', async e => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drop-active');
    const nativeNames = postNativeDropFiles(e); // síncrono, antes de qualquer await
    const result = await getDroppedPath(e, nativeNames);
    _explorerSelectionCache = null; // invalida sempre após o drop
    if (result && result.path) {
      onDrop(result.path, result.isDirectory);
    } else {
      showToast('Não foi possível obter o caminho. Use o botão Selecionar.', true);
    }
  });
}

async function getDroppedPaths(e, nativeNames) {
  // Método 0: caminhos nativos do WebView2 (arquivos e pastas, na ordem certa)
  const nativePaths = await getNativeDropPaths(nativeNames);
  if (nativePaths) {
    const results = [];
    for (const p of nativePaths) {
      const r = await window.pywebview.api.check_is_dir(p);
      results.push({ path: p, isDirectory: r.is_dir });
    }
    return results;
  }

  // Tenta uri-list com múltiplas linhas
  try {
    const uriList = e.dataTransfer.getData('text/uri-list');
    if (uriList && uriList.trim()) {
      const lines = uriList.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
      if (lines.length > 0) {
        const paths = [];
        for (const line of lines) {
          if (line.trim().startsWith('file:///')) {
            const raw = _decodeUriPath(line.trim().slice(8));
            const p = raw.replace(/\//g, '\\').replace(/\\+$/, '');
            if (p.length > 2) paths.push(p);
          }
        }
        if (paths.length > 0) {
          const results = [];
          for (const p of paths) {
            const r = await window.pywebview.api.check_is_dir(p);
            results.push({ path: p, isDirectory: r.is_dir });
          }
          return results;
        }
      }
    }
  } catch (_) {}

  // Fallback: Explorer selection (retorna todos os selecionados no Explorer)
  try {
    const promise = _explorerSelectionCache
      ? _explorerSelectionCache.promise
      : window.pywebview.api.get_explorer_selection();
    const r = await promise;
    _explorerSelectionCache = null;
    if (r.success && r.paths.length > 0) {
      const results = [];
      for (const p of r.paths) {
        const rd = await window.pywebview.api.check_is_dir(p);
        results.push({ path: p, isDirectory: rd.is_dir });
      }
      return results;
    }
  } catch (_) {}

  // Fallback final: tenta o método original (single)
  const single = await getDroppedPath(e);
  return single ? [single] : [];
}

function setupDropZoneMulti(el, onDrop) {
  el.addEventListener('dragenter', e => {
    if (!e.dataTransfer.types.some(t => t.toLowerCase() === 'files')) return;
    prefetchExplorerSelection();
  });
  el.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.some(t => t.toLowerCase() === 'files')) return;
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    el.classList.add('drop-active');
  });
  el.addEventListener('dragleave', e => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('drop-active');
  });
  el.addEventListener('drop', async e => {
    e.preventDefault(); e.stopPropagation();
    el.classList.remove('drop-active');
    const nativeNames = postNativeDropFiles(e); // síncrono, antes de qualquer await
    const items = await getDroppedPaths(e, nativeNames);
    _explorerSelectionCache = null; // invalida sempre após o drop
    if (items.length > 0) {
      onDrop(items);
    } else {
      showToast('Não foi possível obter o caminho. Use o botão Selecionar.', true);
    }
  });
}
