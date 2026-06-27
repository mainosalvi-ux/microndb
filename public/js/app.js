'use strict';
const COLORS=[{bg:'#E6F1FB',txt:'#0C447C'},{bg:'#E1F5EE',txt:'#085041'},{bg:'#FAEEDA',txt:'#633806'},{bg:'#FBEAF0',txt:'#72243E'},{bg:'#EEEDFE',txt:'#3C3489'},{bg:'#FAECE7',txt:'#712B13'},{bg:'#EAF3DE',txt:'#27500A'},{bg:'#F1EFE8',txt:'#444441'}];
const FTYPES=[{v:'text',l:'Text'},{v:'number',l:'Number'},{v:'boolean',l:'Yes/No'},{v:'date',l:'Date'},{v:'email',l:'Email'}];
let currentUser=null,currentNation=null,editingAccUserId=null,editingRecordId=null,userRecords=[],userDocs=[];
let scannerRunning=false;

function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function getColor(i){return COLORS[(i??0)%8]}
function fmtSize(b){return b>1e6?(b/1e6).toFixed(1)+'MB':b>1024?(b/1024).toFixed(0)+'KB':b+'B'}
function fmtDate(d){return d?new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}):'—'}

function showToast(msg,type='ok'){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast show'+(type==='err'?' toast-err':'');
  setTimeout(()=>t.classList.remove('show'),3000);
}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active')}

async function api(method,path,body){
  const opts={method,headers:{'Content-Type':'application/json'},credentials:'same-origin'};
  if(body) opts.body=JSON.stringify(body);
  const res=await fetch('/api'+path,opts);
  const data=await res.json();
  if(!res.ok) throw new Error(data.error||'Server error');
  return data;
}

async function init(){
  try{const{user,nation}=await api('GET','/auth/me');startSession(user,nation)}
  catch{showScreen('screen-login')}
}

async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-pass').value;
  const err=document.getElementById('login-err');
  const btn=document.getElementById('login-btn');
  err.textContent='';
  if(!email||!pass){err.textContent='Enter your email and password';return}
  btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2"></i> Signing in…';
  try{const{user,nation}=await api('POST','/auth/login',{email,password:pass});startSession(user,nation)}
  catch(e){err.textContent=e.message}
  finally{btn.disabled=false;btn.innerHTML='<i class="ti ti-login"></i> Sign in'}
}
document.getElementById('login-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
document.getElementById('login-email').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('login-pass').focus()});

function startSession(user,nation){
  currentUser=user;currentNation=nation;
  if(user.role==='admin'){showScreen('screen-admin');renderAdmin('overview')}
  else{
    document.getElementById('user-nation-name').textContent=nation?.name||'My Collection';
    document.getElementById('user-info-pill').innerHTML=`<i class="ti ti-user" style="font-size:13px"></i>${esc(user.name)}`;
    // Show join link
    if(nation?.join_token){
      const url=`${location.origin}/join/${nation.join_token}`;
      document.getElementById('join-link-url').textContent=url;
      document.getElementById('join-link-banner').style.display='flex';
    }
    showScreen('screen-user');
    userTab('records',document.querySelector('.user-tab'));
  }
}

async function copyJoinLink(){
  const url=document.getElementById('join-link-url').textContent;
  try{await navigator.clipboard.writeText(url);showToast('Link copied ✓')}
  catch{showToast('Copy failed','err')}
}

async function doLogout(){
  stopScanner();
  await api('POST','/auth/logout');
  currentUser=null;currentNation=null;
  document.getElementById('login-email').value='';
  document.getElementById('login-pass').value='';
  document.getElementById('login-err').textContent='';
  showScreen('screen-login');
}

// ── ADMIN ──────────────────────────────────────────
function adminTab(tab,el){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  el?.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  renderAdmin(tab);
}
async function renderAdmin(tab){
  if(tab==='overview') await renderOverview();
  else if(tab==='nations') await renderNations();
  else await renderAccounts();
}

async function renderOverview(){
  const panel=document.getElementById('tab-overview');
  panel.innerHTML='<div class="empty"><i class="ti ti-loader-2"></i><p>Loading…</p></div>';
  const{nations,users,records,citizens}=await api('GET','/admin/stats');
  panel.innerHTML=`
    <div class="page-header"><div><div class="page-title">Overview</div><div class="page-sub">Global stats</div></div></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-val">${nations}</div><div class="stat-lbl">Nations</div></div>
      <div class="stat-card"><div class="stat-val">${users}</div><div class="stat-lbl">Accounts</div></div>
      <div class="stat-card"><div class="stat-val">${records}</div><div class="stat-lbl">Total records</div></div>
      <div class="stat-card"><div class="stat-val">${citizens}</div><div class="stat-lbl">Citizens</div></div>
    </div>`;
}

async function renderNations(){
  const panel=document.getElementById('tab-nations');
  panel.innerHTML='<div class="empty"><i class="ti ti-loader-2"></i><p>Loading…</p></div>';
  const nations=await api('GET','/admin/nations');
  let html=`<div class="page-header"><div><div class="page-title">Nations</div><div class="page-sub">Join links and citizen counts</div></div></div>`;
  if(!nations.length) html+='<div class="empty"><i class="ti ti-map"></i><p>No nations yet.</p></div>';
  else nations.forEach(n=>{
    const c=getColor(n.color_idx);
    const joinUrl=n.join_token?`${location.origin}/join/${n.join_token}`:'';
    html+=`<div class="record-row" style="flex-wrap:wrap;gap:10px">
      <div class="record-avatar" style="background:${c.bg};color:${c.txt};width:36px;height:36px">${n.name[0]}</div>
      <div class="record-body">
        <div class="record-title">${esc(n.name)}</div>
        <div class="record-meta">${n.total} records · ${n.citizens} citizens</div>
        ${joinUrl?`<div class="join-url" style="margin-top:4px;font-size:11px;font-family:monospace">${esc(joinUrl)}</div>`:''}
      </div>
      ${joinUrl?`<button class="btn sm" onclick="copyLink('${esc(joinUrl)}',this)"><i class="ti ti-copy"></i> Copy</button>
      <button class="btn icon sm" onclick="regenToken('${n.id}')" title="Regenerate link"><i class="ti ti-refresh"></i></button>`:''}
    </div>`;
  });
  panel.innerHTML=html;
}

async function copyLink(url,btn){
  try{await navigator.clipboard.writeText(url);const o=btn.innerHTML;btn.innerHTML='<i class="ti ti-check"></i> Copied!';setTimeout(()=>btn.innerHTML=o,2000)}
  catch{showToast('Copy failed','err')}
}
async function regenToken(nationId){
  if(!confirm('Invalidate current link and generate a new one?')) return;
  await api('POST','/admin/nations/'+nationId+'/regen-token');
  showToast('New link generated');renderNations();
}

async function renderAccounts(){
  const panel=document.getElementById('tab-accounts');
  panel.innerHTML='<div class="empty"><i class="ti ti-loader-2"></i><p>Loading…</p></div>';
  const users=await api('GET','/admin/users');
  let html=`<div class="page-header">
    <div><div class="page-title">Accounts</div><div class="page-sub">Manage user access</div></div>
    <button class="btn primary" onclick="openNewAccount()"><i class="ti ti-user-plus"></i> Create account</button>
  </div>`;
  if(!users.length) html+='<div class="empty"><i class="ti ti-users"></i><p>No accounts yet</p><button class="btn primary" onclick="openNewAccount()">Create first</button></div>';
  else users.forEach(u=>{
    const c=getColor(u.nation?.color_idx);
    html+=`<div class="record-row">
      <div class="record-avatar" style="background:${c.bg};color:${c.txt}">${(u.name||u.email)[0].toUpperCase()}</div>
      <div class="record-body"><div class="record-title">${esc(u.name)}</div><div class="record-meta">${esc(u.email)} · ${esc(u.nation?.name||'No nation')}</div></div>
      <div class="record-actions" style="opacity:1"><button class="btn sm" onclick="openEditAccount('${u.id}')"><i class="ti ti-edit"></i> Edit</button></div>
    </div>`;
  });
  panel.innerHTML=html;
}

// ── ACCOUNT MODAL ────────────────────────────────
function openNewAccount(){
  editingAccUserId=null;
  document.getElementById('modal-acc-title').textContent='Create account';
  document.getElementById('del-acc-btn').style.display='none';
  document.getElementById('acc-err').textContent='';
  document.getElementById('acc-email').disabled=false;
  ['acc-name','acc-email','acc-pass','acc-nation'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('acc-fields-list').innerHTML='';
  addAccField('Full name','text');addAccField('Email','email');
  openModal('modal-account');
  setTimeout(()=>document.getElementById('acc-name').focus(),50);
}
async function openEditAccount(userId){
  editingAccUserId=userId;
  document.getElementById('modal-acc-title').textContent='Edit account';
  document.getElementById('del-acc-btn').style.display='';
  document.getElementById('acc-err').textContent='';
  const users=await api('GET','/admin/users');
  const u=users.find(x=>x.id===userId);if(!u) return;
  document.getElementById('acc-name').value=u.name||'';
  document.getElementById('acc-email').value=u.email;
  document.getElementById('acc-email').disabled=true;
  document.getElementById('acc-pass').value='';
  document.getElementById('acc-nation').value=u.nation?.name||'';
  document.getElementById('acc-fields-list').innerHTML='';
  (u.nation?.fields||[]).forEach(f=>addAccField(f.name,f.type));
  openModal('modal-account');
}
function addAccField(name='',type='text'){
  const row=document.createElement('div');row.className='field-row';
  row.innerHTML=`<input placeholder="Field name" value="${esc(name)}">
    <select>${FTYPES.map(t=>`<option value="${t.v}"${t.v===type?' selected':''}>${t.l}</option>`).join('')}</select>
    <button class="btn icon" onclick="this.closest('.field-row').remove()"><i class="ti ti-x"></i></button>`;
  document.getElementById('acc-fields-list').appendChild(row);
}
async function saveAccount(){
  const name=document.getElementById('acc-name').value.trim();
  const email=document.getElementById('acc-email').value.trim().toLowerCase();
  const pass=document.getElementById('acc-pass').value;
  const nationName=document.getElementById('acc-nation').value.trim();
  const err=document.getElementById('acc-err');err.textContent='';
  const rows=[...document.querySelectorAll('#acc-fields-list .field-row')];
  const fields=rows.map(r=>({name:r.querySelector('input').value.trim(),type:r.querySelector('select').value})).filter(f=>f.name);
  if(!name||!email||!nationName||!fields.length){err.textContent='Fill in all fields and add at least one column';return}
  if(!editingAccUserId&&!pass){err.textContent='Password is required';return}
  try{
    if(editingAccUserId) await api('PUT','/admin/users/'+editingAccUserId,{name,password:pass||undefined,nationName,fields});
    else await api('POST','/admin/users',{name,email,password:pass,nationName,fields});
    document.getElementById('acc-email').disabled=false;
    closeModal('modal-account');showToast(editingAccUserId?'Account updated ✓':'Account created ✓');renderAccounts();
  }catch(e){err.textContent=e.message}
}
async function deleteAccount(){
  if(!confirm('Delete this account, its nation, and all records?')) return;
  try{
    await api('DELETE','/admin/users/'+editingAccUserId);
    document.getElementById('acc-email').disabled=false;
    closeModal('modal-account');showToast('Account deleted');renderAccounts();
  }catch(e){alert(e.message)}
}

// ── USER TABS ─────────────────────────────────────
function userTab(tab,el){
  document.querySelectorAll('.user-tab').forEach(t=>t.classList.remove('active'));
  el?.classList.add('active');
  document.getElementById('user-records-panel').style.display=tab==='records'?'block':'none';
  document.getElementById('user-docs-panel').style.display=tab==='docs'?'block':'none';
  document.getElementById('user-scanner-panel').style.display=tab==='scanner'?'block':'none';
  if(tab!=='scanner') stopScanner();
  if(tab==='records') loadAndRenderRecords();
  else if(tab==='docs') loadAndRenderDocs();
}

// ── USER RECORDS ──────────────────────────────────
async function loadAndRenderRecords(){
  try{userRecords=await api('GET','/records');renderUserRecords()}
  catch(e){document.getElementById('user-records').innerHTML=`<div class="empty"><i class="ti ti-alert-circle"></i><p>${esc(e.message)}</p></div>`}
}
function renderUserRecords(){
  const q=document.getElementById('user-search').value.toLowerCase();
  let recs=userRecords;
  if(q) recs=recs.filter(r=>currentNation?.fields?.some(f=>String(r.data?.[f.name]??'').toLowerCase().includes(q)));
  document.getElementById('user-count').textContent=recs.length+' record'+(recs.length!==1?'s':'');
  const fields=currentNation?.fields||[];
  const c=getColor(currentNation?.color_idx);
  if(!recs.length){
    document.getElementById('user-records').innerHTML=`<div class="empty"><i class="ti ti-database"></i><p>${q?'No results':'No records yet'}</p>${!q?'<button class="btn primary" onclick="openNewRecord()"><i class="ti ti-plus"></i> Add first record</button>':''}</div>`;
    return;
  }
  document.getElementById('user-records').innerHTML=recs.map(r=>{
    const data=r.data||{};
    const title=String(data[fields[0]?.name]??'Record');
    const initials=title.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?';
    const meta=fields.slice(1,3).map(f=>{const v=data[f.name];return v!=null&&v!==''?`${esc(f.name)}: ${esc(v)}`:''}).filter(Boolean).join(' · ');
    const isCitizen=r.source==='citizen';
    // Only show citizen number, never date
    const badge=isCitizen&&r.citizen_number
      ?`<span class="badge-citizen">#${String(r.citizen_number).padStart(4,'0')}</span>`
      :isCitizen?'<span class="badge-citizen">citizen</span>':'';
    return`<div class="record-row" onclick="openEditRecord('${r.id}')">
      <div class="record-avatar" style="background:${c.bg};color:${c.txt}">${initials}</div>
      <div class="record-body">
        <div class="record-title">${esc(title)} ${badge}</div>
        <div class="record-meta">${meta||fmtDate(r.created_at)}</div>
      </div>
      <div class="record-actions">
        <button class="btn icon sm" onclick="event.stopPropagation();openEditRecord('${r.id}')"><i class="ti ti-edit"></i></button>
        <button class="btn icon sm danger" onclick="event.stopPropagation();quickDelete('${r.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function openNewRecord(){
  editingRecordId=null;
  document.getElementById('modal-rec-title').textContent='New record';
  document.getElementById('del-rec-btn').style.display='none';
  buildRecordForm({});openModal('modal-record');
  setTimeout(()=>{const f=document.querySelector('#record-form input');if(f)f.focus()},50);
}
function openEditRecord(id){
  editingRecordId=id;
  const rec=userRecords.find(r=>r.id===id);
  document.getElementById('modal-rec-title').textContent='Edit record';
  document.getElementById('del-rec-btn').style.display='';
  buildRecordForm(rec?.data||{});openModal('modal-record');
}
function buildRecordForm(data){
  const fields=currentNation?.fields||[];
  document.getElementById('record-form').innerHTML=fields.map(f=>{
    const v=data[f.name]??'';
    let inp='';
    if(f.type==='boolean') inp=`<select id="rf-${esc(f.name)}"><option value="">(not set)</option><option value="true"${v===true?' selected':''}>Yes</option><option value="false"${v===false?' selected':''}>No</option></select>`;
    else if(f.type==='number') inp=`<input type="number" id="rf-${esc(f.name)}" value="${v}" placeholder="0">`;
    else if(f.type==='date') inp=`<input type="date" id="rf-${esc(f.name)}" value="${esc(v)}">`;
    else if(f.type==='email') inp=`<input type="email" id="rf-${esc(f.name)}" value="${esc(v)}" placeholder="example@email.com">`;
    else inp=`<input type="text" id="rf-${esc(f.name)}" value="${esc(v)}" placeholder="${esc(f.name)}">`;
    return`<div class="form-group"><label>${esc(f.name)}</label>${inp}</div>`;
  }).join('');
}
async function saveRecord(){
  const fields=currentNation?.fields||[];
  const data={};
  fields.forEach(f=>{
    const el=document.getElementById('rf-'+f.name);if(!el)return;
    if(f.type==='number') data[f.name]=el.value===''?'':Number(el.value);
    else if(f.type==='boolean') data[f.name]=el.value===''?null:el.value==='true';
    else data[f.name]=el.value;
  });
  try{
    if(editingRecordId){
      await api('PUT','/records/'+editingRecordId,{data});
      const idx=userRecords.findIndex(r=>r.id===editingRecordId);
      if(idx!==-1) userRecords[idx].data=data;
      showToast('Record updated ✓');
    }else{
      const res=await api('POST','/records',{data});
      userRecords.unshift({id:res.id,nation_id:currentNation.id,data,source:'user',created_at:new Date().toISOString()});
      showToast('Record added ✓');
    }
    closeModal('modal-record');renderUserRecords();
  }catch(e){alert(e.message)}
}
async function deleteRecord(){
  if(!confirm('Delete this record?')) return;
  try{
    await api('DELETE','/records/'+editingRecordId);
    userRecords=userRecords.filter(r=>r.id!==editingRecordId);
    closeModal('modal-record');showToast('Deleted');renderUserRecords();
  }catch(e){alert(e.message)}
}
async function quickDelete(id){
  if(!confirm('Delete?')) return;
  try{await api('DELETE','/records/'+id);userRecords=userRecords.filter(r=>r.id!==id);showToast('Deleted');renderUserRecords()}
  catch(e){alert(e.message)}
}

// ── DOCUMENTS ─────────────────────────────────────
async function loadAndRenderDocs(){
  try{const res=await fetch('/api/documents',{credentials:'same-origin'});userDocs=await res.json();renderDocs()}
  catch(e){document.getElementById('user-docs').innerHTML=`<div class="empty"><i class="ti ti-alert-circle"></i><p>${esc(e.message)}</p></div>`}
}
function renderDocs(){
  const container=document.getElementById('user-docs');
  if(!userDocs.length){container.innerHTML='<div class="empty"><i class="ti ti-file-off"></i><p>No documents yet</p></div>';return}
  const iconFor=m=>m?.includes('pdf')?'ti-file-type-pdf':m?.includes('image')?'ti-photo':m?.includes('word')||m?.includes('document')?'ti-file-type-doc':m?.includes('sheet')||m?.includes('excel')?'ti-file-type-xls':'ti-file';
  container.innerHTML=userDocs.map(d=>`
    <div class="record-row">
      <div class="record-avatar" style="background:var(--bg);color:var(--text2);font-size:18px"><i class="ti ${iconFor(d.mimetype)}"></i></div>
      <div class="record-body"><div class="record-title">${esc(d.original_name)}</div><div class="record-meta">${fmtSize(d.size)} · ${fmtDate(d.created_at)}</div></div>
      <div class="record-actions" style="opacity:1;gap:6px">
        <a href="/api/documents/${d.id}/download" class="btn sm"><i class="ti ti-download"></i> Download</a>
        <button class="btn icon sm danger" onclick="deleteDoc('${d.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('');
}
async function uploadDoc(){
  const input=document.getElementById('doc-input');
  if(!input.files.length) return;
  const form=new FormData();form.append('file',input.files[0]);
  const btn=document.getElementById('upload-btn');
  btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2"></i> Uploading…';
  try{
    const res=await fetch('/api/documents',{method:'POST',body:form,credentials:'same-origin'});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error);
    showToast('Uploaded ✓');input.value='';btn.disabled=true;
    await loadAndRenderDocs();
  }catch(e){showToast(e.message,'err')}
  finally{btn.innerHTML='<i class="ti ti-upload"></i> Upload'}
}
async function deleteDoc(id){
  if(!confirm('Delete this document?')) return;
  try{await api('DELETE','/documents/'+id);userDocs=userDocs.filter(d=>d.id!==id);showToast('Deleted');renderDocs()}
  catch(e){alert(e.message)}
}

// ── SCANNER ───────────────────────────────────────
function startScanner(){
  document.getElementById('scanner-idle').style.display='none';
  document.getElementById('scanner-box').style.display='block';
  document.getElementById('scan-result').style.display='none';

  Quagga.init({
    inputStream:{
      name:'Live',
      type:'LiveStream',
      target:document.getElementById('scanner-viewport'),
      constraints:{facingMode:'environment',width:640,height:480}
    },
    decoder:{readers:['code_128_reader']},
    locate:true,
  }, err=>{
    if(err){showToast('Camera error: '+err.message,'err');stopScanner();return}
    Quagga.start();
    scannerRunning=true;
  });

  Quagga.onDetected(result=>{
    const code=result.codeResult.code;
    if(code){
      stopScanner();
      verifyCitizen(code);
    }
  });
}

function stopScanner(){
  if(scannerRunning){
    try{Quagga.stop()}catch(e){}
    scannerRunning=false;
  }
  const box=document.getElementById('scanner-box');
  const idle=document.getElementById('scanner-idle');
  if(box) box.style.display='none';
  if(idle) idle.style.display='block';
}

function verifyManual(){
  const code=document.getElementById('manual-code').value.trim();
  if(!code){showToast('Enter a code first','err');return}
  verifyCitizen(code);
}

async function verifyCitizen(code){
  const result=document.getElementById('scan-result');
  result.style.display='block';
  result.innerHTML='<div style="padding:16px;text-align:center;color:var(--muted)"><i class="ti ti-loader-2"></i> Verifying…</div>';
  try{
    const data=await api('GET','/records/verify/'+encodeURIComponent(code));
    if(data.valid){
      const fields=Object.entries(data.data||{}).slice(0,4);
      result.innerHTML=`
        <div style="border:2px solid #2B7A4B;border-radius:var(--radius);padding:20px;background:#F0FBF4">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <i class="ti ti-circle-check-filled" style="font-size:28px;color:#2B7A4B"></i>
            <div>
              <div style="font-weight:600;font-size:15px;color:#1A4731">✓ Valid citizen</div>
              <div style="font-size:12px;color:#2B7A4B">Citizen #${String(data.citizenNumber||'?').padStart(4,'0')}</div>
            </div>
          </div>
          ${fields.map(([k,v])=>`<div style="display:flex;gap:8px;font-size:13px;margin-bottom:4px"><span style="color:#2B7A4B;font-weight:500;min-width:80px">${esc(k)}:</span><span>${esc(String(v))}</span></div>`).join('')}
        </div>`;
    } else {
      result.innerHTML=`
        <div style="border:2px solid var(--danger-border);border-radius:var(--radius);padding:20px;background:var(--danger-bg)">
          <div style="display:flex;align-items:center;gap:10px">
            <i class="ti ti-circle-x-filled" style="font-size:28px;color:var(--danger)"></i>
            <div>
              <div style="font-weight:600;font-size:15px;color:var(--danger)">✗ Invalid</div>
              <div style="font-size:13px;color:var(--danger)">${esc(data.message)}</div>
            </div>
          </div>
        </div>`;
    }
  }catch(e){
    result.innerHTML=`<div style="border:2px solid var(--danger-border);border-radius:var(--radius);padding:20px;background:var(--danger-bg);color:var(--danger)"><i class="ti ti-alert-circle"></i> Error: ${esc(e.message)}</div>`;
  }
  // Button to scan again
  result.innerHTML+=`<button class="btn ghost sm" style="margin-top:10px;width:100%;justify-content:center" onclick="resetScanner()"><i class="ti ti-refresh"></i> Scan another</button>`;
}

function resetScanner(){
  document.getElementById('scan-result').style.display='none';
  document.getElementById('manual-code').value='';
}

// ── MODALS ────────────────────────────────────────
function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){
  document.getElementById(id).classList.remove('open');
  if(id==='modal-account') document.getElementById('acc-email').disabled=false;
}
function closeModalOverlay(id,e){if(e.target.id===id) closeModal(id)}

init();
