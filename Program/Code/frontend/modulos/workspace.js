// ══════════════════════════════════════════════════════════════ WORKSPACE ══
async function loadWorkspace() {
  const r = await window.pywebview.api.load_workspace(currentProject);
  if (r.success) { workspaceConfig = r.config; renderWorkspace(); }
}

function renderWorkspace() {
  const rootEl = document.getElementById('root-folder-display');
  if (workspaceConfig.root_folder) {
    rootEl.textContent = workspaceConfig.root_folder;
    rootEl.classList.remove('hidden');
  } else {
    rootEl.classList.add('hidden');
  }

  renderPathList('working-folders-list', workspaceConfig.working_folders, removeWorkingFolder);
  renderMainFile();
  renderIgnoreList();
  renderContextList();
  loadSummary();
  loadEstrutura();
  loadLsp();
  loadSymbolIndex();
  loadMapaIO();
}

function renderPathList(id, items, onRemove) {
  const container = document.getElementById(id);
  container.innerHTML = '';
  (items || []).forEach((path, i) => {
    const div = document.createElement('div');
    div.className = 'path-item';
    div.innerHTML = `<span class="path-item-text">${escapeHtml(path)}</span><button class="path-item-remove" title="Remover">✕</button>`;
    div.querySelector('.path-item-remove').addEventListener('click', () => onRemove(i));
    container.appendChild(div);
  });
}

function renderMainFile() {
  const display  = document.getElementById('main-file-display');
  const clearBtn = document.getElementById('btn-clear-main-file');
  if (workspaceConfig.main_file) {
    display.textContent = workspaceConfig.main_file;
    display.classList.remove('hidden');
    clearBtn.classList.remove('hidden');
  } else {
    display.classList.add('hidden');
    clearBtn.classList.add('hidden');
  }
}

async function browseAndSetMainFile() {
  const r = await window.pywebview.api.browse_path('file');
  if (r.success && r.path) {
    workspaceConfig.main_file = r.path;
    await saveWorkspace();
    renderMainFile();
    showToast('Arquivo principal definido.');
  }
}

async function clearMainFile() {
  workspaceConfig.main_file = null;
  await saveWorkspace();
  renderMainFile();
}

async function saveWorkspace() {
  await window.pywebview.api.save_workspace(currentProject, workspaceConfig);
}

// Browse buttons — Trabalho
async function browseAndSetRoot() {
  const r = await window.pywebview.api.browse_path('folder');
  if (r.success && r.path) { workspaceConfig.root_folder = r.path; await saveWorkspace(); renderWorkspace(); }
}
async function browseAndAddWorking() {
  const r = await window.pywebview.api.browse_path('folder');
  if (r.success && r.path && !workspaceConfig.working_folders.includes(r.path)) {
    workspaceConfig.working_folders.push(r.path); await saveWorkspace(); renderWorkspace();
  }
}

// Remove
async function removeWorkingFolder(i) { workspaceConfig.working_folders.splice(i, 1); await saveWorkspace(); renderWorkspace(); }
