/* DOS Asset Manager - demo/localStorage */

const el = sel => document.querySelector(sel);
const els = sel => Array.from(document.querySelectorAll(sel));
const state = {
  assets: [],
  theme: localStorage.getItem('theme') || 'green',
  history: [],
};

/* Init */
document.addEventListener('DOMContentLoaded', () => {
  load();
  bindNav();
  bindForms();
  bindAssets();
  bindCmd();
  bindSettings();
  renderAll();
});

function load() {
  try {
    state.assets = JSON.parse(localStorage.getItem('assets') || '[]');
    state.history = JSON.parse(localStorage.getItem('history') || '[]');
  } catch { state.assets = []; state.history = []; }
  applyTheme(state.theme);
}

function save() {
  localStorage.setItem('assets', JSON.stringify(state.assets));
  localStorage.setItem('history', JSON.stringify(state.history));
}

function renderAll() {
  renderStats();
  renderRecent();
  renderAssets();
}

/* Navigation */
function bindNav() {
  els('.menu .btn').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
}
function showView(id) {
  els('.panel').forEach(p => p.classList.remove('visible'));
  el('#' + id).classList.add('visible');
}

/* Dashboard */
function renderStats() {
  const total = state.assets.length;
  const active = state.assets.filter(a => a.status === 'active').length;
  const repair = state.assets.filter(a => a.status === 'repair').length;
  const retired = state.assets.filter(a => a.status === 'retired').length;
  el('#stat-total').textContent = total;
  el('#stat-active').textContent = active;
  el('#stat-repair').textContent = repair;
  el('#stat-retired').textContent = retired;
}
function renderRecent() {
  const list = el('#recent');
  list.innerHTML = '';
  state.history.slice(-8).reverse().forEach(h => {
    const li = document.createElement('li');
    li.textContent = `${h.timestamp} :: ${h.actor || 'system'} :: ${h.action} :: ${h.details || ''}`;
    list.appendChild(li);
  });
}

/* Forms */
function bindForms() {
  el('#addForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const asset = {
      id: crypto.randomUUID(),
      tag: fd.get('tag')?.trim(),
      type: fd.get('type'),
      model: fd.get('model')?.trim(),
      serial: fd.get('serial')?.trim(),
      owner: fd.get('owner')?.trim(),
      location: fd.get('location')?.trim(),
      status: fd.get('status'),
      purchaseDate: fd.get('purchaseDate') || '',
      notes: fd.get('notes')?.trim(),
      audit: [],
    };
    state.assets.push(asset);
    logEvent('add', `tag=${asset.tag} owner=${asset.owner}`);
    save(); renderAll();
    e.target.reset();
    showView('assets');
  });
}

/* Assets list & actions */
function bindAssets() {
  el('#q').addEventListener('input', renderAssets);
  el('#status').addEventListener('change', renderAssets);
  el('#type').addEventListener('change', renderAssets);
  el('#clearFilters').addEventListener('click', () => {
    el('#q').value = ''; el('#status').value = ''; el('#type').value = ''; renderAssets();
  });
  el('#exportCsv').addEventListener('click', exportCsv);
  el('#selectAll').addEventListener('change', e => {
    els('#assetRows input[type="checkbox"]').forEach(cb => cb.checked = e.target.checked);
  });
  el('#batchRetire').addEventListener('click', batchRetire);
  el('#batchAssign').addEventListener('click', batchAssign);
}

function renderAssets() {
  const tbody = el('#assetRows');
  tbody.innerHTML = '';
  const query = el('#q').value.trim();
  const status = el('#status').value;
  const type = el('#type').value;

  const filtered = state.assets.filter(a => {
    let ok = true;
    if (status) ok = ok && a.status === status;
    if (type) ok = ok && a.type === type;
    if (query) ok = ok && queryMatch(a, query);
    return ok;
  });

  filtered.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" data-id="${a.id}"></td>
      <td>${a.tag}</td><td>${a.type}</td><td>${a.model}</td><td>${a.serial}</td>
      <td>${a.owner || ''}</td><td>${a.location || ''}</td><td>${a.status}</td><td>${a.purchaseDate || ''}</td>
      <td>
        <div class="row-actions">
          <button class="btn" data-action="edit" data-id="${a.id}">Edit</button>
          <button class="btn" data-action="retire" data-id="${a.id}">Retire</button>
          <button class="btn danger" data-action="delete" data-id="${a.id}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button').forEach(b => b.addEventListener('click', rowAction));
}

function queryMatch(asset, query) {
  // support: free-text and key=value terms
  const terms = query.split(/\s+/).filter(Boolean);
  return terms.every(t => {
    const kv = t.match(/^(\w+)=(.+)$/);
    if (kv) {
      const [, k, v] = kv;
      return String(asset[k] || '').toLowerCase().includes(v.toLowerCase());
    }
    const blob = `${asset.tag} ${asset.type} ${asset.model} ${asset.serial} ${asset.owner} ${asset.location} ${asset.status}`.toLowerCase();
    return blob.includes(t.toLowerCase());
  });
}

function rowAction(e) {
  const id = e.target.dataset.id;
  const action = e.target.dataset.action;
  const a = state.assets.find(x => x.id === id);
  if (!a) return;
  if (action === 'edit') return openEdit(a);
  if (action === 'retire') {
    a.status = 'retired';
    logEvent('retire', `tag=${a.tag}`);
  }
  if (action === 'delete') {
    state.assets = state.assets.filter(x => x.id !== id);
    logEvent('delete', `tag=${a.tag}`);
  }
  save(); renderAll();
}

function openEdit(a) {
  const dlg = document.createElement('div');
  dlg.className = 'panel';
  dlg.style.position = 'fixed'; dlg.style.left = '10%'; dlg.style.top = '10%'; dlg.style.right = '10%'; dlg.style.background = '#001a12'; dlg.style.zIndex = 10; dlg.style.border = '2px solid var(--grid)';
  dlg.innerHTML = `
    <div class="panel-title">EDIT ASSET :: ${a.tag}</div>
    <form id="editForm" class="form">
      <div class="form-row"><label>Owner</label><input name="owner" value="${a.owner || ''}" /></div>
      <div class="form-row"><label>Location</label><input name="location" value="${a.location || ''}" /></div>
      <div class="form-row"><label>Status</label>
        <select name="status">
          <option ${a.status==='active'?'selected':''}>active</option>
          <option ${a.status==='repair'?'selected':''}>repair</option>
          <option ${a.status==='retired'?'selected':''}>retired</option>
          <option ${a.status==='lost'?'selected':''}>lost</option>
        </select>
      </div>
      <div class="form-row"><label>Notes</label><textarea name="notes" rows="3">${a.notes || ''}</textarea></div>
      <div class="form-actions">
        <button type="submit" class="btn">Save</button>
        <button type="button" id="cancelEdit" class="btn">Cancel</button>
      </div>
    </form>
  `;
  document.body.appendChild(dlg);
  const onClose = () => document.body.removeChild(dlg);
  dlg.querySelector('#cancelEdit').addEventListener('click', onClose);
  dlg.querySelector('#editForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    a.owner = fd.get('owner')?.trim();
    a.location = fd.get('location')?.trim();
    a.status = fd.get('status');
    a.notes = fd.get('notes')?.trim();
    logEvent('edit', `tag=${a.tag} status=${a.status}`);
    save(); renderAll();
    onClose();
  });
}

/* Batch actions */
function selectedIds() {
  return els('#assetRows input[type="checkbox"]:checked').map(cb => cb.dataset.id);
}
function batchRetire() {
  selectedIds().forEach(id => {
    const a = state.assets.find(x => x.id === id);
    if (a) { a.status = 'retired'; logEvent('retire', `tag=${a.tag}`); }
  });
  save(); renderAll();
}
function batchAssign() {
  const owner = prompt('New owner username:');
  if (!owner) return;
  selectedIds().forEach(id => {
    const a = state.assets.find(x => x.id === id);
    if (a) { a.owner = owner.trim(); logEvent('assign', `tag=${a.tag} owner=${owner}`); }
  });
  save(); renderAll();
}

/* Export */
function exportCsv() {
  const header = ['id','tag','type','model','serial','owner','location','status','purchaseDate','notes'];
  const rows = state.assets.map(a => header.map(h => (a[h] || '').toString().replace(/"/g,'""')));
  const csv = [header.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  download('assets.csv', csv, 'text/csv');
}
function download(name, data, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/* Command prompt */
function bindCmd() {
  const term = el('#terminal');
  const input = el('#cmdInput');
  print(term, 'DOS ASSET MANAGER v1.0\nType "help" for commands.\n');

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const cmd = input.value.trim();
      if (!cmd) return;
      print(term, `C:\\IT\\ASSETS> ${cmd}`);
      runCommand(cmd, term);
      input.value = '';
    }
    if (e.key === 'ArrowUp') input.value = recall(-1);
    if (e.key === 'ArrowDown') input.value = recall(1);
    if (e.key === 'Escape') input.value = '';
  });
}
function print(term, text) {
  const div = document.createElement('div');
  div.textContent = text;
  term.appendChild(div);
  term.scrollTop = term.scrollHeight;
}
function recall(dir) {
  if (!state.cmdHistory) state.cmdHistory = [];
  state.cmdIndex = Math.min(Math.max((state.cmdIndex || state.cmdHistory.length) + dir, 0), state.cmdHistory.length);
  return state.cmdHistory[state.cmdIndex] || '';
}

function runCommand(line, term) {
  if (!state.cmdHistory) state.cmdHistory = [];
  state.cmdHistory.push(line);

  const [name, ...rest] = line.split(' ');
  const args = parseArgs(rest.join(' '));
  const cmds = {
    help() {
      print(term, [
        'Commands:',
        '  help                       Show help',
        '  list [filters]             List assets (e.g., list status=active owner=alice)',
        '  add key=value ...          Add asset (tag, type, model, serial, owner, location, status, purchaseDate)',
        '  edit tag=PC-100 key=value  Edit by tag',
        '  retire tag=PC-100          Retire by tag',
        '  search key=value ...       Search assets',
        '  export csv|json            Export data',
        '  wipe                       Wipe demo data',
      ].join('\n'));
    },
    list() {
      const filtered = state.assets.filter(a => queryMatch(a, Object.entries(args).map(([k,v]) => `${k}=${v}`).join(' ')));
      if (!filtered.length) return print(term, 'No assets found.');
      filtered.forEach(a => print(term, `${a.tag} ${a.type} ${a.model} ${a.serial} owner=${a.owner || ''} status=${a.status}`));
    },
    add() {
      const required = ['tag','type','model','serial','status'];
      for (const r of required) if (!args[r]) return print(term, `Missing ${r}`);
      const asset = {
        id: crypto.randomUUID(),
        tag: args.tag, type: args.type, model: args.model, serial: args.serial,
        owner: args.owner || '', location: args.location || '',
        status: args.status || 'active', purchaseDate: args.purchaseDate || '',
        notes: args.notes || '', audit: [],
      };
      state.assets.push(asset); save(); renderAll();
      logEvent('add', `tag=${asset.tag}`);
      print(term, `Added ${asset.tag}`);
    },
    edit() {
      if (!args.tag) return print(term, 'Specify tag=...');
      const a = state.assets.find(x => x.tag === args.tag);
      if (!a) return print(term, 'Not found.');
      ['owner','location','status','notes','model','serial'].forEach(k => { if (args[k]) a[k] = args[k]; });
      save(); renderAll(); logEvent('edit', `tag=${a.tag}`);
      print(term, `Edited ${a.tag}`);
    },
    retire() {
      if (!args.tag) return print(term, 'Specify tag=...');
      const a = state.assets.find(x => x.tag === args.tag);
      if (!a) return print(term, 'Not found.');
      a.status = 'retired'; save(); renderAll(); logEvent('retire', `tag=${a.tag}`);
      print(term, `Retired ${a.tag}`);
    },
    search() { cmds.list(); },
    export() {
      const fmt = (rest[0] || '').toLowerCase();
      if (fmt === 'csv') exportCsv();
      else {
        download('assets.json', JSON.stringify(state.assets, null, 2), 'application/json');
      }
      print(term, 'Export complete.');
    },
    wipe() {
      if (!confirm('Wipe all demo data?')) return;
      state.assets = []; state.history = []; save(); renderAll();
      print(term, 'Data wiped.');
    }
  };

  if (cmds[name]) cmds[name]();
  else print(term, `Unknown command: ${name}`);
}

function parseArgs(s) {
  const args = {};
  // simple key=value parser; supports quoted values
  const re = /(\w+)=("([^"]+)"|(\S+))/g;
  let m; while ((m = re.exec(s))) args[m[1]] = (m[3] || m[4]);
  return args;
}

/* History log */
function logEvent(action, details, actor = 'admin') {
  const ts = new Date().toISOString().replace('T',' ').slice(0,19);
  state.history.push({ timestamp: ts, actor, action, details });
  save();
}

/* Settings */
function bindSettings() {
  const themeSel = el('#theme');
  themeSel.value = state.theme;
  themeSel.addEventListener('change', () => {
    state.theme = themeSel.value;
    localStorage.setItem('theme', state.theme);
    applyTheme(state.theme);
  });
  el('#exportJson').addEventListener('click', () => download('assets.json', JSON.stringify(state.assets, null, 2), 'application/json'));
  el('#importJson').addEventListener('click', async () => {
    const f = await pickFile('.json');
    if (!f) return;
    const text = await f.text();
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) return alert('Invalid JSON');
      state.assets = data; save(); renderAll();
      alert('Import complete');
    } catch { alert('Invalid JSON'); }
  });
  el('#wipeData').addEventListener('click', () => {
    if (!confirm('Wipe all demo data?')) return;
    state.assets = []; state.history = []; save(); renderAll();
  });

  // Hotkeys
  document.addEventListener('keydown', e => {
    if (e.key === 'F1') { showView('cmd'); print(el('#terminal'), 'Help: use "help"'); }
    if (e.key === 'F2') { cycleTheme(); }
    if (e.key === 'F3') { exportCsv(); }
  });
}

function cycleTheme() {
  const order = ['green','amber','mono'];
  const idx = order.indexOf(state.theme);
  state.theme = order[(idx + 1) % order.length];
  el('#theme').value = state.theme;
  applyTheme(state.theme);
  localStorage.setItem('theme', state.theme);
}

function applyTheme(theme) {
  document.body.classList.remove('theme-amber', 'theme-mono');
  if (theme === 'amber') document.body.classList.add('theme-amber');
  if (theme === 'mono') document.body.classList.add('theme-mono');
}

/* File picker */
async function pickFile(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files[0]);
    input.click();
  });
}
