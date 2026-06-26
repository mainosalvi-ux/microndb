'use strict';

const COLORS = [
  { bg: '#E6F1FB', txt: '#0C447C' }, { bg: '#E1F5EE', txt: '#085041' },
  { bg: '#FAEEDA', txt: '#633806' }, { bg: '#FBEAF0', txt: '#72243E' },
  { bg: '#EEEDFE', txt: '#3C3489' }, { bg: '#FAECE7', txt: '#712B13' },
  { bg: '#EAF3DE', txt: '#27500A' }, { bg: '#F1EFE8', txt: '#444441' },
];
const FTYPES = [
  { v: 'text', l: 'Text' }, { v: 'number', l: 'Number' },
  { v: 'boolean', l: 'Yes / No' }, { v: 'date', l: 'Date' }, { v: 'email', l: 'Email' },
];

let currentUser = null, currentNation = null;
let editingAccUserId = null, editingRecordId = null;
let userRecords = [];

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function getColor(idx) { return COLORS[(idx ?? 0) % COLORS.length]; }
function getBase() { return location.origin; }

function showToast(msg, type='ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type==='err'?' toast-err':'');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Server error');
  return data;
}

async function init() {
  try {
    const { user, nation } = await api('GET', '/auth/me');
    startSession(user, nation);
  } catch { showScreen('screen-login'); }
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const err = document.getElementById('login-err');
  const btn = document.getElementById('login-btn');
  err.textContent = '';
  if (!email || !pass) { err.textContent = 'Enter your email and password'; return; }
  btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> Signing in…';
  try {
    const { user, nation } = await api('POST', '/auth/login', { email, password: pass });
    startSession(user, nation);
  } catch(e) {
    err.textContent = e.message;
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="ti ti-login"></i> Sign in';
  }
}

document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
document.getElementById('login-email').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('login-pass').focus(); });

function startSession(user, nation) {
  currentUser = user; currentNation = nation;
  if (user.role === 'admin') {
    showScreen('screen-admin');
    renderAdmin('overview');
  } else {
    document.getElementById('user-nation-name').textContent = nation?.name || 'My Collection';
    document.getElementById('user-info-pill').innerHTML = `<i class="ti ti-user" style="font-size:13px"></i>${esc(user.name)}`;
    showScreen('screen-user');
    loadAndRenderRecords();
  }
}

async function doLogout() {
  await api('POST', '/auth/logout');
  currentUser = null; currentNation = null;
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-err').textContent = '';
  showScreen('screen-login');
}

// ── ADMIN ──────────────────────────────────────────────
function adminTab(tab, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el?.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  renderAdmin(tab);
}

async function renderAdmin(tab) {
  if (tab==='overview') await renderOverview();
  else if (tab==='nations') await renderNations();
  else await renderAccounts();
}

async function renderOverview() {
  const panel = document.getElementById('tab-overview');
  panel.innerHTML = '<div class="empty"><i class="ti ti-loader-2"></i><p>Loading…</p></div>';
  const { nations, users, records, recent } = await api('GET', '/admin/stats');
  panel.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Overview</div><div class="page-sub">Live stats across all micronations</div></div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-val">${nations}</div><div class="stat-lbl">Nations</div></div>
      <div class="stat-card"><div class="stat-val">${users}</div><div class="stat-lbl">Accounts</div></div>
      <div class="stat-card"><div class="stat-val">${records}</div><div class="stat-lbl">Total records</div></div>
    </div>
    <div class="section-label">Recent activity</div>
    ${recent.length ? recent.map(r => {
      const c = getColor(r.color_idx);
      const entries = Object.entries(r.data);
      const title = entries[0]?.[1] ?? 'Record';
      const meta = entries.slice(1,3).map(([k,v])=>`${esc(k)}: ${esc(v)}`).join(' · ');
      const init = String(title).slice(0,2).toUpperCase();
      const isCitizen = r.source === 'citizen';
      return `<div class="record-row">
        <div class="record-avatar" style="background:${c.bg};color:${c.txt}">${init}</div>
        <div class="record-body">
          <div class="record-title">${esc(title)} ${isCitizen ? '<span class="badge-citizen">citizen</span>' : ''}</div>
          <div class="record-meta">${esc(meta)}</div>
        </div>
        <span class="nation-tag">${esc(r.nation_name)}</span>
      </div>`;
    }).join('') : '<div class="empty"><i class="ti ti-activity"></i><p>No activity yet</p></div>'}`;
}

async function renderNations() {
  const panel = document.getElementById('tab-nations');
  panel.innerHTML = '<div class="empty"><i class="ti ti-loader-2"></i><p>Loading…</p></div>';
  const nations = await api('GET', '/admin/nations');
  let html = `<div class="page-header"><div><div class="page-title">Nations</div><div class="page-sub">All micronations, records and join links</div></div></div>`;
  if (!nations.length) {
    html += '<div class="empty"><i class="ti ti-map"></i><p>No nations yet.</p></div>';
  } else {
    nations.forEach(n => {
      const c = getColor(n.color_idx);
      const joinUrl = n.join_token ? `${getBase()}/join/${n.join_token}` : null;
      const citizens = n.records.filter(r=>r.source==='citizen').length;
      html += `<div class="nation-block">
        <div class="nation-block-header" onclick="toggleNation('n${n.id}', this)">
          <div class="record-avatar" style="background:${c.bg};color:${c.txt};width:32px;height:32px;font-size:14px">${n.name[0]}</div>
          <h3>${esc(n.name)}</h3>
          <span style="font-size:12px;color:var(--muted)">${n.records.length} records · ${citizens} citizens</span>
          <i class="ti ti-chevron-down" style="color:var(--muted)"></i>
        </div>
        <div id="n${n.id}" class="nation-block-body" style="display:none">
          ${joinUrl ? `
          <div class="join-link-box">
            <div style="flex:1;min-width:0">
              <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Public registration link</div>
              <div class="join-url" id="jurl-${n.id}">${esc(joinUrl)}</div>
            </div>
            <button class="btn sm" onclick="copyLink('${esc(joinUrl)}', this)"><i class="ti ti-copy"></i> Copy</button>
            <button class="btn sm" onclick="regenToken('${n.id}')"><i class="ti ti-refresh"></i></button>
          </div>` : ''}
          <div style="margin-top:12px">
          ${n.records.length ? n.records.map(r => {
            const entries = Object.entries(r.data);
            const title = entries[0]?.[1] ?? 'Record';
            const meta = entries.slice(1,3).map(([k,v])=>`${esc(k)}: ${esc(v)}`).join(' · ');
            const isCitizen = r.source === 'citizen';
            return `<div class="record-row" style="box-shadow:none;border-color:var(--border-light)">
              <div class="record-body">
                <div class="record-title">${esc(title)} ${isCitizen ? '<span class="badge-citizen">citizen</span>' : ''}</div>
                <div class="record-meta">${esc(meta)||'—'}</div>
              </div>
              <span style="font-size:11px;color:var(--muted)">${new Date(r.created_at).toLocaleDateString()}</span>
            </div>`;
          }).join('') : '<p style="font-size:13px;color:var(--muted)">No records yet.</p>'}
          </div>
        </div>
      </div>`;
    });
  }
  panel.innerHTML = html;
}

async function copyLink(url, btn) {
  try {
    await navigator.clipboard.writeText(url);
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-check"></i> Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  } catch { showToast('Copy failed — select the URL manually', 'err'); }
}

async function regenToken(nationId) {
  if (!confirm('This will invalidate the current link. Regenerate?')) return;
  await api('POST', '/admin/nations/' + nationId + '/regen-token');
  showToast('New link generated');
  renderNations();
}

function toggleNation(id, header) {
  const body = document.getElementById(id);
  const icon = header.querySelector('i.ti-chevron-down, i.ti-chevron-up');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (icon) icon.className = open ? 'ti ti-chevron-down' : 'ti ti-chevron-up';
}

async function renderAccounts() {
  const panel = document.getElementById('tab-accounts');
  panel.innerHTML = '<div class="empty"><i class="ti ti-loader-2"></i><p>Loading…</p></div>';
  const users = await api('GET', '/admin/users');
  let html = `<div class="page-header">
    <div><div class="page-title">Accounts</div><div class="page-sub">Manage user access and their nations</div></div>
    <button class="btn primary" onclick="openNewAccount()"><i class="ti ti-user-plus"></i> Create account</button>
  </div>`;
  if (!users.length) {
    html += '<div class="empty"><i class="ti ti-users"></i><p>No accounts yet</p><button class="btn primary" onclick="openNewAccount()"><i class="ti ti-user-plus"></i> Create first</button></div>';
  } else {
    users.forEach(u => {
      const c = getColor(u.nation?.color_idx);
      const init = (u.name||u.email)[0].toUpperCase();
      html += `<div class="record-row">
        <div class="record-avatar" style="background:${c.bg};color:${c.txt}">${init}</div>
        <div class="record-body">
          <div class="record-title">${esc(u.name)}</div>
          <div class="record-meta">${esc(u.email)} · ${esc(u.nation?.name||'No nation')}</div>
        </div>
        <div class="record-actions" style="opacity:1">
          <button class="btn sm" onclick="openEditAccount('${u.id}')"><i class="ti ti-edit"></i> Edit</button>
        </div>
      </div>`;
    });
  }
  panel.innerHTML = html;
}

// ── ACCOUNT MODAL ──────────────────────────────────────
function openNewAccount() {
  editingAccUserId = null;
  document.getElementById('modal-acc-title').textContent = 'Create account';
  document.getElementById('del-acc-btn').style.display = 'none';
  document.getElementById('acc-err').textContent = '';
  document.getElementById('acc-email').disabled = false;
  ['acc-name','acc-email','acc-pass','acc-nation'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('acc-fields-list').innerHTML = '';
  addAccField('Full name', 'text');
  addAccField('Email', 'email');
  openModal('modal-account');
  setTimeout(() => document.getElementById('acc-name').focus(), 50);
}

async function openEditAccount(userId) {
  editingAccUserId = userId;
  document.getElementById('modal-acc-title').textContent = 'Edit account';
  document.getElementById('del-acc-btn').style.display = '';
  document.getElementById('acc-err').textContent = '';
  const users = await api('GET', '/admin/users');
  const u = users.find(x => x.id === userId);
  if (!u) return;
  document.getElementById('acc-name').value = u.name || '';
  document.getElementById('acc-email').value = u.email;
  document.getElementById('acc-email').disabled = true;
  document.getElementById('acc-pass').value = '';
  document.getElementById('acc-nation').value = u.nation?.name || '';
  document.getElementById('acc-fields-list').innerHTML = '';
  (u.nation?.fields || []).forEach(f => addAccField(f.name, f.type));
  openModal('modal-account');
}

function addAccField(name='', type='text') {
  const row = document.createElement('div');
  row.className = 'field-row';
  row.innerHTML = `<input placeholder="Field name" value="${esc(name)}">
    <select>${FTYPES.map(t=>`<option value="${t.v}"${t.v===type?' selected':''}>${t.l}</option>`).join('')}</select>
    <button class="btn icon" onclick="this.closest('.field-row').remove()" aria-label="Remove"><i class="ti ti-x"></i></button>`;
  document.getElementById('acc-fields-list').appendChild(row);
}

async function saveAccount() {
  const name = document.getElementById('acc-name').value.trim();
  const email = document.getElementById('acc-email').value.trim().toLowerCase();
  const pass = document.getElementById('acc-pass').value;
  const nationName = document.getElementById('acc-nation').value.trim();
  const err = document.getElementById('acc-err');
  err.textContent = '';
  const rows = [...document.querySelectorAll('#acc-fields-list .field-row')];
  const fields = rows.map(r=>({name:r.querySelector('input').value.trim(),type:r.querySelector('select').value})).filter(f=>f.name);
  if (!name||!email||!nationName||!fields.length) { err.textContent='Fill in all fields and add at least one column'; return; }
  if (!editingAccUserId&&!pass) { err.textContent='Password is required for new accounts'; return; }
  try {
    if (editingAccUserId) {
      await api('PUT', '/admin/users/'+editingAccUserId, { name, password: pass||undefined, nationName, fields });
    } else {
      await api('POST', '/admin/users', { name, email, password: pass, nationName, fields });
    }
    document.getElementById('acc-email').disabled = false;
    closeModal('modal-account');
    showToast(editingAccUserId ? 'Account updated ✓' : 'Account created ✓');
    renderAccounts();
  } catch(e) { err.textContent = e.message; }
}

async function deleteAccount() {
  if (!confirm('Delete this account, its nation, and all records?')) return;
  try {
    await api('DELETE', '/admin/users/'+editingAccUserId);
    document.getElementById('acc-email').disabled = false;
    closeModal('modal-account');
    showToast('Account deleted');
    renderAccounts();
  } catch(e) { alert(e.message); }
}

// ── USER RECORDS ───────────────────────────────────────
async function loadAndRenderRecords() {
  try {
    userRecords = await api('GET', '/records');
    renderUserRecords();
  } catch(e) {
    document.getElementById('user-records').innerHTML = `<div class="empty"><i class="ti ti-alert-circle"></i><p>${esc(e.message)}</p></div>`;
  }
}

function renderUserRecords() {
  const q = document.getElementById('user-search').value.toLowerCase();
  let recs = userRecords;
  if (q) recs = recs.filter(r => currentNation?.fields?.some(f => String(r.data[f.name]??'').toLowerCase().includes(q)));
  document.getElementById('user-count').textContent = recs.length + ' record' + (recs.length!==1?'s':'');
  const fields = currentNation?.fields || [];
  const c = getColor(currentNation?.color_idx);
  if (!recs.length) {
    document.getElementById('user-records').innerHTML = `<div class="empty">
      <i class="ti ti-database"></i>
      <p>${q?'No results for "'+esc(q)+'"':'No records yet'}</p>
      ${!q?'<button class="btn primary" onclick="openNewRecord()"><i class="ti ti-plus"></i> Add first record</button>':''}
    </div>`; return;
  }
  document.getElementById('user-records').innerHTML = recs.map(r => {
    const title = String(r.data[fields[0]?.name]??'Record');
    const initials = title.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?';
    const meta = fields.slice(1,3).map(f=>{const v=r.data[f.name];return v!=null&&v!==''?(f.name+': '+esc(v)):''}).filter(Boolean).join(' · ');
    const isCitizen = r.source === 'citizen';
    return `<div class="record-row" onclick="openEditRecord('${r.id}')">
      <div class="record-avatar" style="background:${c.bg};color:${c.txt}">${initials}</div>
      <div class="record-body">
        <div class="record-title">${esc(title)} ${isCitizen?'<span class="badge-citizen">citizen</span>':''}</div>
        <div class="record-meta">${meta||new Date(r.created_at).toLocaleDateString()}</div>
      </div>
      <div class="record-actions">
        <button class="btn icon sm" onclick="event.stopPropagation();openEditRecord('${r.id}')" aria-label="Edit"><i class="ti ti-edit"></i></button>
        <button class="btn icon sm danger" onclick="event.stopPropagation();quickDelete('${r.id}')" aria-label="Delete"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function openNewRecord() {
  editingRecordId = null;
  document.getElementById('modal-rec-title').textContent = 'New record';
  document.getElementById('del-rec-btn').style.display = 'none';
  buildRecordForm({});
  openModal('modal-record');
  setTimeout(() => { const f=document.querySelector('#record-form input'); if(f) f.focus(); }, 50);
}

function openEditRecord(id) {
  editingRecordId = id;
  const rec = userRecords.find(r=>r.id===id);
  document.getElementById('modal-rec-title').textContent = 'Edit record';
  document.getElementById('del-rec-btn').style.display = '';
  buildRecordForm(rec?.data||{});
  openModal('modal-record');
}

function buildRecordForm(data) {
  const fields = currentNation?.fields||[];
  document.getElementById('record-form').innerHTML = fields.map(f => {
    const v = data[f.name]??'';
    let inp = '';
    if (f.type==='boolean') inp=`<select id="rf-${esc(f.name)}"><option value="">(not set)</option><option value="true"${v===true?' selected':''}>Yes</option><option value="false"${v===false?' selected':''}>No</option></select>`;
    else if (f.type==='number') inp=`<input type="number" id="rf-${esc(f.name)}" value="${v}" placeholder="0">`;
    else if (f.type==='date') inp=`<input type="date" id="rf-${esc(f.name)}" value="${esc(v)}">`;
    else if (f.type==='email') inp=`<input type="email" id="rf-${esc(f.name)}" value="${esc(v)}" placeholder="example@email.com">`;
    else inp=`<input type="text" id="rf-${esc(f.name)}" value="${esc(v)}" placeholder="${esc(f.name)}">`;
    return `<div class="form-group"><label>${esc(f.name)}</label>${inp}</div>`;
  }).join('');
}

async function saveRecord() {
  const fields = currentNation?.fields||[];
  const data = {};
  fields.forEach(f=>{
    const el=document.getElementById('rf-'+f.name); if(!el) return;
    if(f.type==='number') data[f.name]=el.value===''?'':Number(el.value);
    else if(f.type==='boolean') data[f.name]=el.value===''?null:el.value==='true';
    else data[f.name]=el.value;
  });
  try {
    if (editingRecordId) {
      await api('PUT','/records/'+editingRecordId,{data});
      const idx=userRecords.findIndex(r=>r.id===editingRecordId);
      if(idx!==-1) userRecords[idx].data=data;
      showToast('Record updated ✓');
    } else {
      const res=await api('POST','/records',{data});
      userRecords.unshift({id:res.id,nation_id:currentNation.id,data,source:'user',created_at:new Date().toISOString()});
      showToast('Record added ✓');
    }
    closeModal('modal-record'); renderUserRecords();
  } catch(e) { alert(e.message); }
}

async function deleteRecord() {
  if(!confirm('Delete this record?')) return;
  try {
    await api('DELETE','/records/'+editingRecordId);
    userRecords=userRecords.filter(r=>r.id!==editingRecordId);
    closeModal('modal-record'); showToast('Record deleted'); renderUserRecords();
  } catch(e) { alert(e.message); }
}

async function quickDelete(id) {
  if(!confirm('Delete this record?')) return;
  try {
    await api('DELETE','/records/'+id);
    userRecords=userRecords.filter(r=>r.id!==id);
    showToast('Record deleted'); renderUserRecords();
  } catch(e) { alert(e.message); }
}

// ── MODALS ─────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if(id==='modal-account') document.getElementById('acc-email').disabled=false;
}
function closeModalOverlay(id,e) { if(e.target.id===id) closeModal(id); }

init();
