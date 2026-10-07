/* Shared league state is supplied by /api/league. This file intentionally keeps
   the original visual UI while replacing browser-local scoring and passwords. */
let apiReady=false, needsSetup=false, stagedRules=[];

async function api(action, payload={}) {
  const response=await fetch('/api/league'+(action==='state'||action==='session'?`?action=${action}`:''),{
    method:action==='state'||action==='session'?'GET':'POST',
    headers:{'Content-Type':'application/json'},
    body:action==='state'||action==='session'?undefined:JSON.stringify({action,...payload})
  });
  const result=await response.json().catch(()=>({error:'The league service did not respond.'}));
  if(!response.ok)throw new Error(result.error||'Something went wrong.');
  return result;
}

function save(){
  if(!apiReady||!isAdmin())return;
  api('adminSync',{state:db}).catch(error=>toast(error.message));
}

function render(){
  const root=document.getElementById('app');
  if(!apiReady){root.innerHTML='<main class="login"><section class="login-card"><div class="brand">FANTASY SURVIVOR<span>PRIVATE LEAGUE • SEASON 51</span></div><h1>Finding the tide…</h1><p>Loading the shared league scoreboard.</p></section></main>';return}
  if(!session){root.innerHTML=loginView();bind();decorateBrand();return}
  const view=page==='home'?home():page==='episodes'?episodes():page==='admin'?admin():page==='settings'?settings():page.startsWith('recap:')?recap(+page.split(':')[1]):page.startsWith('profile:')?profile(page.split(':')[1]):home();
  root.innerHTML=view+(needsSetup?setupModal(current()):'');
  bind();decorateBrand();
}

function decorateBrand(){
  document.querySelectorAll('.brand').forEach(el=>{if(!el.querySelector('.whale-mark'))el.insertAdjacentHTML('afterbegin',whale)});
  document.querySelectorAll('.brand span').forEach(el=>el.textContent='PRIVATE LEAGUE • SEASON 51');
  if(Math.max(...db.episodes)>=13)document.querySelector('#new-episode')?.classList.add('hidden');
}

function tribeNames(){return [...new Set(db.contestants.map(person=>person.tribe).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}

function admin(){
  const available=db.contestants.filter(person=>person.status==='active');
  const updateCount=selected.length*stagedRules.length;
  const tribes=tribeNames();
  return `<div class="shell">${nav()}<div class="admin-wrap" style="margin-top:28px"><aside class="card admin-side"><h3 style="margin-top:0">Episodes</h3><div class="episode-list">${db.episodes.map(number=>`<button data-admin-episode="${number}" class="${activeEpisode===number?'active':''}">Episode ${number}</button>`).join('')}</div></aside><main class="card admin-content"><div class="admin-header"><div><div class="eyebrow">Score episode</div><h2>Episode ${activeEpisode}</h2></div><button class="ghost" id="clear-draft">Clear draft</button></div><div class="small">1. SELECT CONTESTANT${selected.length>1?'S':''} — ${selected.length} SELECTED</div><section class="contestant-picker">${available.map(person=>`<button class="contestant-btn ${selected.includes(person.id)?'selected':''}" data-pick="${person.id}">${esc(person.name)}<small>${esc(team(person.teamId).name)}${person.tribe?` · ${esc(person.tribe)}`:''} · ${score(person.id)} pts</small></button>`).join('')}</section><section class="tribe-tools"><div><div class="small">TRIBE MANAGER</div><strong>Assign selected contestants</strong></div><div class="tribe-controls"><input id="tribe-name" list="tribe-list" placeholder="Enter tribe name"><datalist id="tribe-list">${tribes.map(name=>`<option value="${esc(name)}">`).join('')}</datalist><button class="ghost" id="assign-tribe">Assign tribe</button></div><div class="tribe-controls"><select id="select-tribe"><option value="">Select a tribe to score</option>${tribes.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select><button class="primary" id="select-tribe-members">Select whole tribe</button></div></section><div style="display:flex;gap:9px;margin-top:13px"><button class="danger" id="mark-out">Mark selected eliminated</button><button class="ghost" id="restore-player">Restore eliminated contestant</button></div><div class="small" style="margin-top:24px">2. TOGGLE EVERY EVENT THAT HAPPENED — ${stagedRules.length} SELECTED</div><section class="event-grid">${Object.entries(RULES).map(([key,rule])=>`<button class="event-btn ${stagedRules.includes(key)?'selected':''}" data-rule="${key}" aria-pressed="${stagedRules.includes(key)}">${rule.label}<b>${rule.pts>0?'+':''}${rule.pts} PTS</b></button>`).join('')}</section><button class="primary" id="submit-draft" style="margin-top:20px;width:100%;padding:14px" ${updateCount?'':'disabled'}>${updateCount?`Enter ${updateCount} scoring update${updateCount===1?'':'s'}`:'Select a contestant and event'}</button><section class="history"><div class="section-title">Episode history <span class="small">UNDO OR CORRECT</span></div><table><thead><tr><th>CONTESTANT</th><th>EVENT</th><th>POINTS</th><th></th></tr></thead><tbody>${db.events.filter(event=>event.episode===activeEpisode).slice().reverse().map(event=>`<tr><td>${esc(person(event.contestantId).name)}</td><td>${esc(event.label)}</td><td style="color:${event.points<0?'#ec6e57':'var(--gold)'}">${event.points>0?'+':''}${event.points}</td><td><button class="danger" data-delete="${event.id}">Undo</button></td></tr>`).join('')||'<tr><td colspan="4" class="small">No events recorded for this episode.</td></tr>'}</tbody></table></section></main></div></div>`;
}

function submitDraft(){
  if(!selected.length||!stagedRules.length)return toast('Select a contestant and at least one event.');
  let applied=0;
  for(const contestantId of selected){
    for(const rule of stagedRules){
      const definition=RULES[rule],contestant=person(contestantId);
      if(definition.uniqueEpisode&&db.events.some(event=>event.episode===activeEpisode&&event.contestantId===contestantId&&event.rule===rule)){toast(`Cry is already recorded for ${contestant.name}.`);continue}
      if(definition.once&&contestant[definition.once]){toast(`${contestant.name} already has that milestone.`);continue}
      db.events.push({id:crypto.randomUUID(),episode:activeEpisode,contestantId,rule,label:definition.label,points:definition.pts});
      if(definition.once)contestant[definition.once]=true;
      if(rule==='coinLoss'){contestant.status='eliminated';contestant.eliminatedEpisode=activeEpisode}
      applied++;
    }
  }
  if(applied){selected=[];stagedRules=[];save();render();toast(`${applied} scoring update${applied===1?'':'s'} submitted.`)}
}

function bind(){
  document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>{page=button.dataset.page;render()});
  document.querySelectorAll('[data-contestant]').forEach(button=>button.onclick=()=>{page='profile:'+button.dataset.contestant;render()});
  document.querySelectorAll('[data-episode]').forEach(button=>button.onclick=()=>{page='recap:'+button.dataset.episode;render()});
  document.querySelector('#logout')?.addEventListener('click',async()=>{await api('logout');session=null;needsSetup=false;page='home';render()});
  document.querySelector('#login-form')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const teamId=document.querySelector('#login-team').value,secret=document.querySelector('#login-secret').value;
    try{const result=await api('login',{teamId,secret});session=result.teamId;needsSetup=result.needsSetup;render()}catch(error){toast(error.message)}
  });
  document.querySelector('#setup-form')?.addEventListener('submit',async event=>{
    event.preventDefault();const form=new FormData(event.target);
    try{await api('setup',{name:form.get('name').trim(),password:form.get('password')});current().name=form.get('name').trim();needsSetup=false;render();toast('Your team is ready.')}catch(error){toast(error.message)}
  });
  document.querySelector('#settings-form')?.addEventListener('submit',async event=>{
    event.preventDefault();const form=new FormData(event.target),name=form.get('name').trim(),password=form.get('password');
    try{await api('settings',{name,password});current().name=name;render();toast('Settings saved.')}catch(error){toast(error.message)}
  });
  document.querySelectorAll('[data-admin-episode]').forEach(button=>button.onclick=()=>{activeEpisode=+button.dataset.adminEpisode;selected=[];stagedRules=[];render()});
  document.querySelector('#new-episode')?.addEventListener('click',()=>{if(Math.max(...db.episodes)>=13)return toast('Season 51 ends at Episode 13.');db.episodes.push(Math.max(...db.episodes)+1);activeEpisode=Math.max(...db.episodes);save();render()});
  document.querySelector('#clear-draft')?.addEventListener('click',()=>{selected=[];stagedRules=[];render()});
  document.querySelectorAll('[data-pick]').forEach(button=>button.onclick=()=>{const id=button.dataset.pick;selected=selected.includes(id)?selected.filter(value=>value!==id):[...selected,id];render()});
  document.querySelector('#assign-tribe')?.addEventListener('click',()=>{const name=document.querySelector('#tribe-name').value.trim().replace(/\s+/g,' ').slice(0,28);if(!selected.length)return toast('Select at least one contestant first.');if(!name)return toast('Enter a tribe name.');selected.forEach(id=>person(id).tribe=name);save();render();toast(`${selected.length} contestant${selected.length===1?'':'s'} assigned to ${name}.`)});
  document.querySelector('#select-tribe-members')?.addEventListener('click',()=>{const name=document.querySelector('#select-tribe').value;if(!name)return toast('Choose a tribe first.');selected=db.contestants.filter(person=>person.status==='active'&&person.tribe===name).map(person=>person.id);stagedRules=[];render();toast(`${selected.length} active tribe member${selected.length===1?'':'s'} selected.`)});
  document.querySelector('#mark-out')?.addEventListener('click',()=>{if(!selected.length)return toast('Select a contestant first.');selected.forEach(id=>{const p=person(id);p.status='eliminated';p.eliminatedEpisode=activeEpisode});selected=[];save();render();toast('Contestant status updated.')});
  document.querySelector('#restore-player')?.addEventListener('click',()=>{const p=db.contestants.find(item=>item.status==='eliminated');if(!p)return toast('No eliminated contestant to restore.');p.status='active';p.eliminatedEpisode=null;save();render();toast(p.name+' restored to active.')});
  document.querySelectorAll('[data-rule]').forEach(button=>button.onclick=()=>{const rule=button.dataset.rule;stagedRules=stagedRules.includes(rule)?stagedRules.filter(value=>value!==rule):[...stagedRules,rule];render()});
  document.querySelector('#submit-draft')?.addEventListener('click',submitDraft);
  document.querySelectorAll('[data-delete]').forEach(button=>button.onclick=()=>{const entry=db.events.find(item=>item.id===button.dataset.delete),rule=RULES[entry.rule];if(rule.once)person(entry.contestantId)[rule.once]=db.events.some(item=>item.id!==entry.id&&item.contestantId===entry.contestantId&&item.rule===entry.rule);if(entry.rule==='coinLoss'){const p=person(entry.contestantId);p.status='active';p.eliminatedEpisode=null}db.events=db.events.filter(item=>item.id!==entry.id);save();render();toast('Event removed — totals updated.')});
}

async function boot(){
  try{
    const [state,login]=await Promise.all([api('state'),api('session')]);
    db=state;session=login.teamId||null;apiReady=true;render();
  }catch(error){
    document.getElementById('app').innerHTML=`<main class="login"><section class="login-card"><div class="brand">FANTASY SURVIVOR<span>SEASON 51</span></div><h1>League connection needed</h1><p>${esc(error.message)}</p><div class="notice">Add the Supabase database schema and Vercel environment variables, then redeploy.</div></section></main>`;decorateBrand();
  }
}
boot();
