/* Shared league state is supplied by /api/league. This file intentionally keeps
   the original visual UI while replacing browser-local scoring and passwords. */
let apiReady=false, needsSetup=false;

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
  document.querySelectorAll('[data-admin-episode]').forEach(button=>button.onclick=()=>{activeEpisode=+button.dataset.adminEpisode;selected=[];render()});
  document.querySelector('#new-episode')?.addEventListener('click',()=>{if(Math.max(...db.episodes)>=13)return toast('Season 51 ends at Episode 13.');db.episodes.push(Math.max(...db.episodes)+1);activeEpisode=Math.max(...db.episodes);save();render()});
  document.querySelector('#clear-select')?.addEventListener('click',()=>{selected=[];render()});
  document.querySelectorAll('[data-pick]').forEach(button=>button.onclick=()=>{const id=button.dataset.pick;selected=selected.includes(id)?selected.filter(value=>value!==id):[...selected,id];render()});
  document.querySelector('#mark-out')?.addEventListener('click',()=>{if(!selected.length)return toast('Select a contestant first.');selected.forEach(id=>{const p=person(id);p.status='eliminated';p.eliminatedEpisode=activeEpisode});selected=[];save();render();toast('Contestant status updated.')});
  document.querySelector('#restore-player')?.addEventListener('click',()=>{const p=db.contestants.find(item=>item.status==='eliminated');if(!p)return toast('No eliminated contestant to restore.');p.status='active';p.eliminatedEpisode=null;save();render();toast(p.name+' restored to active.')});
  document.querySelectorAll('[data-rule]').forEach(button=>button.onclick=()=>addEvent(button.dataset.rule));
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
