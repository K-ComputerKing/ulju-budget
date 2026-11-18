
'use strict';
const BUDGET=JSON.parse(document.getElementById('budget-data').textContent);
const PAGES=JSON.parse(document.getElementById('page-data').textContent);
const IMAGES=JSON.parse(document.getElementById('vector-data').textContent);
const PHASE_BANDS=JSON.parse(document.getElementById('phase-data').textContent);
const FISCAL_BANDS=JSON.parse(document.getElementById('fiscal-band-data').textContent);
const FUNDING=JSON.parse(document.getElementById('funding-data').textContent);
const OWNER_PALETTE=['#347cc7','#ad69c8','#e18a61','#2ca88b','#bb9a31','#7e8eaf'];
const DEFAULT_AVATARS=['🐻','🦊','🐧','🐱','🐸','🐯'];
const AVAILABLE_AVATARS=['🐻','🦊','🐧','🐱','🐸','🐯','🦉','🐨','🐼','🐰','🦋','🌻'];
const ownerColor=name=>OWNER_PALETTE[Math.max(0,S.owners.indexOf(name))%OWNER_PALETTE.length];
const MAP=new Map(BUDGET.map(x=>[x.key,x]));
const GROUPS=JSON.parse(document.getElementById('group-data').textContent);
const DETAIL_CHILDREN=JSON.parse(document.getElementById('child-data').textContent);
const REGION=new Map(PAGES.flatMap(x=>x.map(z=>[z.id,z])));
const ANCHOR=new Map(PAGES.flatMap(x=>x.filter(z=>z.type==='stat').map(z=>[z.budget,z.id])));
// A supplementary budget revises an existing line. This links its printed
// appearances, not the fiscal line's amount to another year or another project.
const DETAILS=PAGES.flatMap(p=>p.filter(r=>r.type==='detail'));
const AMEND_CANON=new Map(), AMEND_GROUPS=new Map();
const normalizeBudgetTitle=s=>String(s||'').replace(/\s+/g,' ').trim();
const amendmentOrder=phase=>phase==='본예산'?0:(Number((String(phase).match(/추경\s*(\d+)회/)||[])[1])||-1);
const potentialAmendments=new Map();
for(const r of DETAILS){const k=[r.budget,r.marker,normalizeBudgetTitle(r.title)].join('||');if(!potentialAmendments.has(k))potentialAmendments.set(k,[]);potentialAmendments.get(k).push(r);}
for(const variants of potentialAmendments.values()){
  if(new Set(variants.map(r=>r.phase)).size<2)continue;
  // The same phase can contain an old item's cancellation (0) and
  // reclassification (+amount). Both are one latest-phase adjustment.
  const ordered=variants.slice().sort((a,b)=>amendmentOrder(a.phase)-amendmentOrder(b.phase)||a.page-b.page||a.y-b.y);
  const key=ordered[0].id;
  const latestOrder=Math.max(...ordered.map(r=>amendmentOrder(r.phase)));
  const current=ordered.filter(r=>amendmentOrder(r.phase)===latestOrder);
  const total=current.reduce((sum,r)=>sum+Number(r.amount||0),0);
  const info={key,ids:ordered.map(r=>r.id),rows:ordered,phase:current[0].phase,amount:total,initial:ordered.find(r=>r.phase==='본예산')?.amount??null,revision:current.length>1};
  AMEND_GROUPS.set(key,info);
  for(const r of ordered)AMEND_CANON.set(r.id,key);
}
const canonDetail=id=>AMEND_CANON.get(id)||id;
const amendmentInfo=id=>AMEND_GROUPS.get(canonDetail(id));
const linkedDetailIds=id=>amendmentInfo(id)?.ids||[id];
const latestDetailAmount=id=>amendmentInfo(id)?.amount??REGION.get(id)?.amount??0;
const lastDetailPhase=id=>amendmentInfo(id)?.phase??REGION.get(id)?.phase??'';
// Use canonical IDs for all future selections; migrate saved older selections.
const DETAIL_PARENTS=new Map();
for(const [p,children] of Object.entries(DETAIL_CHILDREN))for(const c of children){const child=canonDetail(c);if(!DETAIL_PARENTS.has(child))DETAIL_PARENTS.set(child,new Set());DETAIL_PARENTS.get(child).add(canonDetail(p));}

// V16: Every selectable budget line is represented by canonical terminal
// 산출내역 IDs. Parents are derived views, not separately summed selections.
// The budget revision alias (AMEND_CANON) is resolved before building this DAG.
const CANON_CHILDREN=new Map(), STAT_DETAIL_NODES=new Map(), NODE_LEAVES=new Map(), STAT_LEAVES=new Map();
for(const r of DETAILS){
 const id=canonDetail(r.id);
 if(!CANON_CHILDREN.has(id))CANON_CHILDREN.set(id,new Set());
 if(!STAT_DETAIL_NODES.has(r.budget))STAT_DETAIL_NODES.set(r.budget,new Set());
 STAT_DETAIL_NODES.get(r.budget).add(id);
}
for(const [rawParent,rawChildren] of Object.entries(DETAIL_CHILDREN)){
 const parent=canonDetail(rawParent), children=CANON_CHILDREN.get(parent);
 if(!children)continue;
 for(const rawChild of rawChildren){
  const child=canonDetail(rawChild);
  if(parent!==child && CANON_CHILDREN.has(child) && REGION.get(parent)?.budget===REGION.get(child)?.budget)children.add(child);
 }
}
function descendantLeaves(id,stack=new Set()){
 if(NODE_LEAVES.has(id))return NODE_LEAVES.get(id);
 // Defensive cycle guard for imperfect source-document grouping.
 if(stack.has(id))return new Set([id]);
 stack.add(id);
 const result=new Set(),children=CANON_CHILDREN.get(id)||new Set();
 for(const child of children)for(const leaf of descendantLeaves(child,stack))result.add(leaf);
 if(!result.size)result.add(id);
 stack.delete(id);NODE_LEAVES.set(id,result);return result;
}
for(const [budget,nodes] of STAT_DETAIL_NODES){
 const all=new Set();for(const id of nodes)for(const leaf of descendantLeaves(id))all.add(leaf);
 STAT_LEAVES.set(budget,all);
}

const KEY='ulju-wallet-pdf-highlighter-2026-v4';
const fmt=n=>new Intl.NumberFormat('ko-KR').format(n||0);
const money=n=>fmt(n)+'원';
const abbrev=n=>{const neg=n<0?'-':'';n=Math.abs(n);return neg+(n>=100000000?fmt(Math.round(n/1000000)/100)+'억원':n>=10000?fmt(Math.round(n/100)/100)+'만원':money(n))};
// Unit-aware totals retain exact won values below as a cross-check.
const formatBudgetTotal=n=>{const unit=S.amountUnit==='백만원'?'백만원':'천원',scale=unit==='백만원'?1000000:1000;return new Intl.NumberFormat('ko-KR',{maximumFractionDigits:unit==='백만원'?6:3}).format((n||0)/scale)+unit;};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=()=>({version:8,draftKeys:[],draftDetails:[],draftsByOwner:{},owners:['나','담당자 B','담당자 C'],profileIcons:{'나':'🐻','담당자 B':'🦊','담당자 C':'🐧'},selectedOwner:'나',adminOwner:'나',teams:[{id:'team-main',name:'질병관리팀',members:['나','담당자 B','담당자 C'],admin:'나'}],amountUnit:'천원',allocs:[],history:[],spendingEntries:[],executionShares:[],executionIgnored:[],spendingPlans:[]});
let S=fresh();
try{
 let d=JSON.parse(localStorage.getItem(KEY)||'null');
 if(!d){const v=JSON.parse(localStorage.getItem('ulju-wallet-pdf-highlighter-2026-v3')||localStorage.getItem('ulju-wallet-2026-v1')||'null');if(v?.allocs&&Array.isArray(v.allocs)){d={...v,version:4,draftKeys:[],draftDetails:[]}}}
 if(d&&Array.isArray(d.allocs)&&Array.isArray(d.owners)&&d.owners.includes(d.selectedOwner)){S=d;S.spendingEntries=Array.isArray(d.spendingEntries)?d.spendingEntries:[];S.spendingPlans=Array.isArray(d.spendingPlans)?d.spendingPlans:[];S.draftKeys=Array.isArray(d.draftKeys)?d.draftKeys:[];S.draftDetails=Array.isArray(d.draftDetails)?[...new Set(d.draftDetails.map(canonDetail))]:[];S.amountUnit=d.amountUnit==='백만원'?'백만원':'천원';}
 }catch(e){}
S.draftsByOwner=S.draftsByOwner&&typeof S.draftsByOwner==='object'?S.draftsByOwner:{};
S.profileIcons=S.profileIcons&&typeof S.profileIcons==='object'?S.profileIcons:{};
S.adminOwner=typeof S.adminOwner==='string'&&S.owners.includes(S.adminOwner)?S.adminOwner:(S.owners.includes('나')?'나':S.owners[0]);

function normalizeTeams(){
 const existing=Array.isArray(S.teams)?S.teams:[];
 const owners=Array.isArray(S.owners)?S.owners:[];
 const seenIds=new Set(),seenOwners=new Set(),teams=[];
 for(const raw of existing){
  if(!raw||typeof raw!=='object')continue;
  let id=typeof raw.id==='string'&&raw.id.trim()?raw.id.trim():`team-${teams.length+1}`;
  while(seenIds.has(id))id+=`-${teams.length+1}`;
  seenIds.add(id);
  const members=[];
  for(const member of Array.isArray(raw.members)?raw.members:[]){
   if(owners.includes(member)&&!seenOwners.has(member)){members.push(member);seenOwners.add(member);}
  }
  const name=String(raw.name||`팀 ${teams.length+1}`).trim().slice(0,30)||`팀 ${teams.length+1}`;
  teams.push({id,name,members,admin:members.includes(raw.admin)?raw.admin:(members[0]||null)});
 }
 if(!teams.length)teams.push({id:'team-main',name:'질병관리팀',members:[],admin:null});
 for(const owner of owners)if(!seenOwners.has(owner))teams[0].members.push(owner);
 for(const team of teams){
  if(!team.members.includes(team.admin))team.admin=team.members[0]||null;
 }
 // Legacy single administrator is kept when upgrading v34, and later mirrored for old backup clients.
 if(!existing.length && owners.includes(S.adminOwner)){const primary=teams.find(t=>t.members.includes(S.adminOwner));if(primary)primary.admin=S.adminOwner;}
 S.teams=teams;
 S.adminOwner=teams[0]?.admin||owners[0]||null;
}
function teamFor(owner){return (S.teams||[]).find(team=>team.members.includes(owner))||null;}
function teamById(id){return (S.teams||[]).find(team=>team.id===id)||null;}
function teamNameFor(owner){return teamFor(owner)?.name||'소속 팀 없음';}
function refreshCurrentTeamLabels(){
 const teamName=teamNameFor(S.selectedOwner);
 document.querySelectorAll('.dash-team-name').forEach(el=>el.textContent=teamName);
 document.querySelectorAll('#dashboard-home .dash-chip').forEach(el=>el.textContent=teamName+' · 공유 예산함');
 const brandTeam=document.querySelector('.brand p');if(brandTeam)brandTeam.textContent=teamName+' · 공유 예산관리';
}

normalizeTeams();
S.executionIgnored=Array.isArray(S.executionIgnored)?S.executionIgnored.filter(x=>x&&typeof x.row==='string'&&typeof x.owner==='string'):[];
const avatarFor=owner=>S.profileIcons[owner]||DEFAULT_AVATARS[Math.max(0,S.owners.indexOf(owner))%DEFAULT_AVATARS.length];
const profileTiny=owner=>`<span class="profile-pill-avatar" style="--member-color:${ownerColor(owner)}" aria-hidden="true">${esc(avatarFor(owner))}</span>`;
for(const a of S.allocs){if(typeof a.locked!=='boolean')a.locked=true;}
// Preserve old saved draft selections, including parent-detail selections.
// Convert them once to terminal selections and collapse completely chosen
// statistics into S.draftKeys. No committed allocations are modified.
normalizeDraftSelection();
const byId=id=>document.getElementById(id);
const now=()=>new Date().toLocaleString('ko-KR');
const uid=()=>Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
const used=key=>S.allocs.filter(a=>a.key===key).reduce((t,a)=>t+a.amount,0);
const rest=key=>Math.max(0,MAP.get(key).won-used(key));
const mine=()=>S.allocs.filter(a=>a.owner===S.selectedOwner);
const addHistory=(label,msg)=>S.history.unshift({id:uid(),date:now(),kind:label,message:msg});
let pg=0,lastVisitedPage=0,picked=null,drawer=false,dialog=null,bulk=false,bulkItems=[];
function toast(msg){const t=byId('toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('on'),2700)}
function persist(){try{S.draftsByOwner[S.selectedOwner]={keys:[...S.draftKeys],details:[...S.draftDetails]};localStorage.setItem(KEY,JSON.stringify(S))}catch(e){toast('브라우저 저장이 불가해 백업 파일을 이용해 주세요.')}}
function markedId(a){return REGION.has(a.regionId)?a.regionId:ANCHOR.get(a.key)}
function counts(){byId('mycount').textContent=mine().length;byId('ownerlabel').textContent=S.selectedOwner;byId('selectedcount').textContent=S.allocs.length;byId('currentpage').value=String(pg+1);byId('currentpage-bottom').value=String(pg+1);byId('pagefoot').textContent=String(pg+1);byId('prevbtn').disabled=pg===0;byId('prevbtn-bottom').disabled=pg===0;byId('nextbtn').disabled=pg===IMAGES.length-1;byId('nextbtn-bottom').disabled=pg===IMAGES.length-1}

function leafBudget(id){return REGION.get(id)?.budget;}
function normalizeDraftSelection(){
 const full=new Set((S.draftKeys||[]).filter(k=>MAP.has(k)));
 const chosen=new Set();
 for(const raw of S.draftDetails||[]){
  const id=canonDetail(raw),row=REGION.get(id);
  if(!row||row.type!=='detail'||full.has(row.budget))continue;
  for(const leaf of (NODE_LEAVES.get(id)||[id]))chosen.add(leaf);
 }
 for(const [key,all] of STAT_LEAVES){
  if(full.has(key)||!all.size)continue;
  if([...all].every(id=>chosen.has(id))){full.add(key);for(const id of all)chosen.delete(id);}
 }
 S.draftKeys=[...full];
 S.draftDetails=[...chosen].filter(id=>!full.has(leafBudget(id)));
}
function selectedLeaves(key){
 const all=STAT_LEAVES.get(key)||new Set();
 if(S.draftKeys.includes(key))return new Set(all);
 return new Set(S.draftDetails.filter(id=>leafBudget(id)===key));
}
function selectionOfLeaves(key,target){
 if(!target||!target.size)return '';
 const selected=selectedLeaves(key);
 let n=0;for(const id of target)if(selected.has(id))n++;
 return n===target.size?'draft':n?'partial':'';
}
function statDraftState(key){return selectionOfLeaves(key,STAT_LEAVES.get(key));}
function setBudgetLeaves(key,selected){
 const all=STAT_LEAVES.get(key)||new Set();
 S.draftKeys=S.draftKeys.filter(k=>k!==key);
 S.draftDetails=S.draftDetails.filter(id=>leafBudget(id)!==key);
 if(!selected.size)return;
 if(all.size&&[...all].every(id=>selected.has(id)))S.draftKeys.push(key);
 else for(const id of selected)if(all.has(id))S.draftDetails.push(id);
}
function markedDraft(r){
 if(r.type==='group'){
  const keys=GROUPS[r.groupId]?.keys||[];
  const states=keys.map(statDraftState);
  return states.length&&states.every(s=>s==='draft')?'draft':states.some(Boolean)?'partial':'';
 }
 if(r.type==='stat')return statDraftState(r.budget);
 return selectionOfLeaves(r.budget,NODE_LEAVES.get(canonDetail(r.id)));
}
function updateBulkBar(){
 const full=S.draftKeys.length,details=S.draftDetails.length,count=full+details;
 byId('bulk-status').textContent='형광펜으로 담을 예산을 표시해보세요.';
 byId('bulk-substatus').textContent=count?'여러 페이지의 선택이 모아져 있어요. 금액은 담기 전 확인합니다.':'상위 항목을 누르면 하위 전부 선택 · 여러 쪽 선택 유지';
 byId('open-bulk').disabled=count===0;
 updateAmountSidebar();
}
// V9: ink follows each row's *real available vertical span*. Variable-height
// details include wrapped descriptions/formulas; adjacent rows meet exactly.
function v9InkBottom(rows,i){
 const r=rows[i], next=rows.slice(i+1).find(x=>x.y>r.y+0.1);
 const gap=next?next.y-r.y:Infinity;
 if(r.type==='detail'){
  // Normal 1-line rows have ~14.7 pt separation; two lines ~23.5 pt.
  // Wider gaps include funding sub-lines or section breaks: bound those so
  // the highlight does not run through unrelated empty table space.
  if(gap<=31.0) return Math.min(841.89,next.y);
  const titleLines=(r.title.match(/\n/g)||[]).length+1;
  return Math.min(841.89,r.y+Math.min(41,Math.max(r.h,titleLines*9.0+11,24)));
 }
 if(gap<=18.0) return Math.min(841.89,next.y);
 return Math.min(841.89,r.y+r.h);
}
function v9InkPath(rects){
 // One compound SVG path per color = union of subpaths. Because all subpaths
 // wind the same way, translucent ink is composited ONCE even when rectangles
 // overlap (including parent+child or neighboring rows).
 return rects.map(a=>`M${a.x.toFixed(2)} ${a.y.toFixed(2)}h${a.w.toFixed(2)}v${a.h.toFixed(2)}h${(-a.w).toFixed(2)}Z`).join('');
}
function isClickableRegion(r){return r.type!=='group'||r.level==='project'||r.level==='head';}
// Work with the same candidates used by the batch drawer; cap by each
// statistical-item residual to avoid counting parent/child duplicates.
function chosenAmountSummary(){
 const items=batchCandidates(),perStat=new Map();
 for(const a of items)perStat.set(a.key,(perStat.get(a.key)||0)+Number(a.amount||0));
 let total=0,hasCapped=false;
 for(const [key,raw] of perStat){const available=rest(key);total+=Math.min(raw,available);if(raw>available)hasCapped=true;}
 return {total,count:items.length,hasCapped};
}
const formatSidebarThousands=n=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:3}).format((n||0)/1000)+'천원';
function updateAmountSidebar(){  const c=chosenAmountSummary(),confirmed=mine();
 const confirmedSum=confirmed.reduce((sum,a)=>sum+a.amount,0);
 byId('selected-total').textContent=formatSidebarThousands(c.total);
 byId('selected-total-exact').textContent=money(c.total);
 byId('selected-item-count').textContent=`선택 중인 관리 후보 ${c.count}건 · 전체 페이지 합계`;
 byId('confirmed-total').textContent=formatSidebarThousands(confirmedSum);
 byId('confirmed-total-exact').textContent=money(confirmedSum);
 byId('confirmed-item-count').textContent=`${S.selectedOwner}의 관리 항목 ${confirmed.length}건`;
 byId('selected-cap-notice').hidden=!c.hasCapped;
}
function confirmedOwnersForRegion(r){
 if(r.type==='group'){
  const keys=GROUPS[r.groupId]?.keys||[];
  if(!keys.length)return [];
  return S.owners.filter(owner=>keys.every(key=>S.allocs.filter(a=>a.owner===owner&&a.key===key).reduce((n,a)=>n+a.amount,0)===MAP.get(key).won));
 }
 if(r.type==='stat')return S.owners.filter(owner=>S.allocs.some(a=>a.owner===owner&&a.key===r.budget));
 if(r.type!=='detail')return [];
 const canonical=canonDetail(r.id), target=NODE_LEAVES.get(canonical)||new Set([canonical]);
 return S.owners.filter(owner=>S.allocs.some(a=>{
   if(a.owner!==owner||a.key!==r.budget)return false;
   const alloc=REGION.get(a.regionId);
   if(!alloc)return false;
   if(alloc.type==='stat')return true;
   if(alloc.type!=='detail')return false;
   const cover=NODE_LEAVES.get(canonDetail(alloc.id))||new Set([canonDetail(alloc.id)]);
   return [...target].every(id=>cover.has(id));
 }));
}
function ownerRowWeight(owner,r){
 const matching=S.allocs.filter(a=>a.owner===owner&&(r.budget?a.key===r.budget:(r.type==='group'&&GROUPS[r.groupId]?.keys.includes(a.key))));
 return Math.max(1,matching.reduce((sum,a)=>sum+a.amount,0));
}
function drawColoredCommit(shape,r,shapes){
 const owners=confirmedOwnersForRegion(r);
 if(!owners.length)return owners;
 const weights=owners.map(owner=>ownerRowWeight(owner,r)),total=weights.reduce((a,b)=>a+b,0);
 let left=shape.x;
 owners.forEach((owner,i)=>{
   const width=i===owners.length-1?shape.x+shape.w-left:shape.w*weights[i]/total;
   if(!shapes.has(owner))shapes.set(owner,[]);
   shapes.get(owner).push({...shape,x:left,w:width});left+=width;
 });
 return owners;
}
function renderTeamLegend(){
  const el=byId('team-legend');
  el.innerHTML=S.owners.map(owner=>{
   const n=S.allocs.filter(a=>a.owner===owner).length, sum=S.allocs.filter(a=>a.owner===owner).reduce((t,a)=>t+a.amount,0);
   return `<button type="button" class="member-chip member-click ${owner===S.selectedOwner?'current':''}" data-team-profile="${esc(owner)}" title="${esc(owner)} · ${money(sum)}">${profileTiny(owner)}${esc(owner)} ${n?('🔒 '+n):'· 0'}</button>`;
  }).join('');
  const pick=byId('account-switch');pick.innerHTML=S.owners.map(n=>`<option value="${esc(n)}" ${n===S.selectedOwner?'selected':''}>${esc(n)}</option>`).join('');
  byId('current-profile-avatar').textContent=avatarFor(S.selectedOwner);
  byId('current-profile-avatar').style.setProperty('--member-color',ownerColor(S.selectedOwner));
  byId('current-profile-name').textContent=S.selectedOwner;
}
function switchOwner(owner){
  if(owner===S.selectedOwner||!S.owners.includes(owner))return;
  const wasAdmin=isAdminOwner();
  S.draftsByOwner[S.selectedOwner]={keys:[...S.draftKeys],details:[...S.draftDetails]};
  S.selectedOwner=owner;
  const draft=S.draftsByOwner[owner]||{keys:[],details:[]};
  S.draftKeys=[...(draft.keys||[])];S.draftDetails=[...(draft.details||[])];normalizeDraftSelection();
  persist();showDrawer(false);renderPage();syncAdminAccess();toast(`${owner}의 예산 선택 화면으로 전환했어요. (시연 모드)`);
}
// Local Netflix-like profile chooser. This is a demonstrator, not authentication.
let profileIconChoice='🐻', profileEditOwner=null, profileAddTeamId=null, draggedOwner=null;
function renderProfileGate(){
 normalizeTeams();
 const grid=byId('profile-cards'),picker=byId('profile-picker-cards');
 grid.classList.add('profile-group-stack');picker.classList.add('profile-group-stack');
 picker.innerHTML=S.teams.map(team=>`<section class="profile-group" aria-label="${esc(team.name)} 팀"><div class="profile-group-header"><div class="profile-group-heading"><strong>${esc(team.name)}</strong></div></div><div class="profile-cards" style="--pick-gap:${Math.max(6,Math.min(28,36-Math.max(0,team.members.length-2)*5))}px;--pick-gap-mobile:${Math.max(3,10-Math.max(0,team.members.length-2)*2)}px">${team.members.length?team.members.map(owner=>`<div class="profile-card-wrap"><button type="button" class="profile-card" data-choose-profile="${esc(owner)}" title="${esc(owner)} 프로필 열기"><span class="profile-picture" style="--avatar-color:${ownerColor(owner)}">${esc(avatarFor(owner))}</span><span class="profile-card-name">${esc(owner)}</span>${owner===team.admin?'<small class="profile-admin-badge">🔑 자료관리자</small>':''}</button></div>`).join(''):'<div class="profile-team-empty">팀원이 없습니다</div>'}</div></section>`).join('');
 grid.innerHTML=S.teams.map((team,teamIdx)=>{
  const options=team.members.map(owner=>`<option value="${esc(owner)}" ${owner===team.admin?'selected':''}>${esc(owner)}</option>`).join('');
  return `<section class="profile-group" data-team-id="${esc(team.id)}" aria-label="${esc(team.name)} 팀">
   <div class="profile-group-header"><div class="profile-group-heading" draggable="true" data-team-drag="${esc(team.id)}" tabindex="0" role="button" aria-label="${esc(team.name)} 팀 위치 이동" title="드래그하여 팀 순서 바꾸기"><span class="profile-group-icon" aria-hidden="true">▦</span><div><strong>${esc(team.name)}</strong><small>팀 헤더를 끌면 팀 순서가 변경됩니다</small></div></div>
   <div class="profile-group-tools"><label class="profile-group-admin">🔑 자료관리자 <select data-team-admin="${esc(team.id)}" aria-label="${esc(team.name)} 자료관리자 선택" ${!team.members.length?'disabled':''}>${options||'<option value="">팀원 없음</option>'}</select></label>
   <button type="button" class="profile-icon-button" data-team-rename="${esc(team.id)}" aria-label="${esc(team.name)} 팀 이름 변경" title="팀 이름 변경">✎</button>
   <button type="button" class="profile-icon-button" data-team-delete="${esc(team.id)}" title="빈 팀 삭제" aria-label="${esc(team.name)} 빈 팀 삭제" ${team.members.length||S.teams.length===1?'disabled':''}>×</button></div></div>
   <div class="profile-cards" data-team-members="${esc(team.id)}">${team.members.length?team.members.map(owner=>`<div class="profile-card-wrap" draggable="true" tabindex="0" role="button" aria-label="${esc(owner)} 프로필 편집 또는 드래그 이동" data-drag-owner="${esc(owner)}" title="드래그해 위치 이동 · 클릭해 프로필 변경"><button type="button" class="profile-card" tabindex="-1" data-edit-profile="${esc(owner)}"><span class="profile-picture" style="--avatar-color:${ownerColor(owner)}">${esc(avatarFor(owner))}</span><span class="profile-card-name">${esc(owner)}</span>${owner===team.admin?'<small class="profile-admin-badge">🔑 자료관리자</small>':''}</button></div>`).join(''):'<div class="profile-team-empty">여기로 사용자를 끌어오세요</div>'}</div></section>`;
 }).join('');
 refreshCurrentTeamLabels();
}
function showProfileGate(){byId('profile-manager').hidden=true;renderProfileGate();byId('profile-gate').classList.add('show');byId('profile-create').classList.remove('show');byId('profile-create').dataset.mode='';byId('profile-team-add').hidden=true;}
function openProfileManager(){renderProfileGate();byId('profile-manager').hidden=false;byId('profile-manage-close').focus();}
function closeProfileManager(){byId('profile-create').classList.remove('show');byId('profile-team-add').hidden=true;byId('profile-manager').hidden=true;renderProfileGate();byId('profile-manage-open').focus();}
function pickProfile(owner){if(!S.owners.includes(owner))return;byId('profile-manager').hidden=true;byId('profile-gate').classList.remove('show');if(owner!==S.selectedOwner)switchOwner(owner);else{persist();renderPage();}syncAdminAccess();renderSourceStatus();refreshCurrentTeamLabels();window.scrollTo(0,0);}
function showProfileEditor(mode='add', owner=null, teamId=null){
 if(byId('profile-manager').hidden)openProfileManager();
 profileEditOwner=mode==='edit'?(owner&&S.owners.includes(owner)?owner:S.selectedOwner):null;
 profileIconChoice=profileEditOwner?avatarFor(profileEditOwner):AVAILABLE_AVATARS[(S.owners.length+2)%AVAILABLE_AVATARS.length];
 profileAddTeamId=teamId||teamFor(profileEditOwner||S.selectedOwner)?.id||S.teams[0]?.id;
 byId('profile-create').classList.add('show');byId('profile-create').dataset.mode=mode;
 byId('profile-new-name').value=profileEditOwner||'';byId('profile-new-name').disabled=false;
 byId('profile-create-save').textContent=mode==='edit'?'프로필 저장':'담당자 추가';
 renderAvatarChoices();byId('profile-new-name').focus();byId('profile-new-name').select();
}
function renderAvatarChoices(){byId('profile-icon-choices').innerHTML=AVAILABLE_AVATARS.map(icon=>`<button type="button" class="profile-icon-choice ${icon===profileIconChoice?'active':''}" data-avatar-choice="${icon}" aria-label="${icon} 프로필 아이콘" aria-pressed="${icon===profileIconChoice}">${icon}</button>`).join('');}
function renameProfile(oldName,newName){
 if(oldName===newName)return;
 // Ownership is keyed by profile name in this local-only demo. Preserve allocations,
 // profile icon, and uncommitted selections when changing the display name.
 const idx=S.owners.indexOf(oldName);
 if(idx<0)throw Error('담당자를 찾을 수 없습니다.');
 if(S.selectedOwner===oldName){S.draftsByOwner[oldName]={keys:[...S.draftKeys],details:[...S.draftDetails]};}
 S.owners[idx]=newName;
 if(S.adminOwner===oldName)S.adminOwner=newName;
 for(const team of S.teams){team.members=team.members.map(o=>o===oldName?newName:o);if(team.admin===oldName)team.admin=newName;}
 if(Object.prototype.hasOwnProperty.call(S.draftsByOwner,oldName)){
  S.draftsByOwner[newName]=S.draftsByOwner[oldName];delete S.draftsByOwner[oldName];
 }
 if(Object.prototype.hasOwnProperty.call(S.profileIcons,oldName)){
  S.profileIcons[newName]=S.profileIcons[oldName];delete S.profileIcons[oldName];
 }
 for(const a of S.allocs){if(a.owner===oldName)a.owner=newName;}
 for(const x of S.executionIgnored||[]){if(x.owner===oldName)x.owner=newName;}
 if(S.selectedOwner===oldName)S.selectedOwner=newName;
}
function saveTeamChanges(msg){
 normalizeTeams();
 addHistory('팀 관리',msg);
 persist();renderProfileGate();syncAdminAccess();refreshCurrentTeamLabels();
}
function moveMemberToTeam(owner,targetId,beforeOwner=null){
 const old=teamFor(owner),target=teamById(targetId);
 if(!old||!target)return false;
 if(old.id===target.id){
  if(beforeOwner===owner)return false;
  const from=old.members.indexOf(owner);
  if(from<0)return false;
  if(!beforeOwner){if(from===old.members.length-1)return false;old.members.splice(from,1);old.members.push(owner);return true;}
  const to=old.members.indexOf(beforeOwner);
  if(to<0||from===to)return false;
  old.members.splice(from,1);old.members.splice(old.members.indexOf(beforeOwner),0,owner);
  return true;
 }
 old.members=old.members.filter(x=>x!==owner);
 if(old.admin===owner)old.admin=old.members[0]||null;
 const at=beforeOwner?target.members.indexOf(beforeOwner):-1;
 if(at>=0)target.members.splice(at,0,owner);else target.members.push(owner);
 if(!target.admin)target.admin=owner;
 return true;
}
function moveMemberStep(owner,direction){
 const team=teamFor(owner);if(!team)return;
 const i=team.members.indexOf(owner),j=i+direction;
 if(j<0||j>=team.members.length)return;
 [team.members[i],team.members[j]]=[team.members[j],team.members[i]];
 saveTeamChanges(`${team.name} · ${owner} 순서 변경`);
}
function moveTeamStep(id,direction){
 const i=S.teams.findIndex(t=>t.id===id),j=i+direction;
 if(i<0||j<0||j>=S.teams.length)return;
 [S.teams[i],S.teams[j]]=[S.teams[j],S.teams[i]];
 saveTeamChanges('팀 순서 변경');
}
function createTeam(name){
 name=String(name||'').trim();
 if(!name||name.length>30){toast('팀 이름은 1~30자로 입력해 주세요.');return;}
 if(S.teams.some(t=>t.name===name)){toast('같은 이름의 팀이 있습니다.');return;}
 const id='team_'+uid();
 S.teams.push({id,name,members:[],admin:null});
 saveTeamChanges(`${name} 추가`);
 byId('profile-team-add').hidden=true;
 toast(`${name} 팀을 만들었어요. 팀원을 추가하면 관리자를 지정할 수 있습니다.`);
}
function saveProfileChanges(){
 const name=byId('profile-new-name').value.trim();
 if(!name||name.length>30){toast('담당자 이름은 1~30자로 입력해 주세요.');return;}
 if(S.owners.some(o=>o===name&&o!==profileEditOwner)){toast('동일한 담당자 이름이 이미 등록되어 있어요.');return;}
 const editing=!!profileEditOwner;
 const targetTeam=teamById(profileAddTeamId)||S.teams[0];if(!targetTeam){toast('소속 팀을 확인해 주세요.');return;}
 if(editing){
  const old=profileEditOwner;
  renameProfile(old,name);
  S.profileIcons[name]=profileIconChoice;
  addHistory('프로필 변경',`${old} → ${name} · 프로필 정보 변경`);
 }else{
  S.owners.push(name);S.profileIcons[name]=profileIconChoice;targetTeam.members.push(name);if(!targetTeam.admin)targetTeam.admin=name;addHistory('담당자 추가',name);
 }
 persist();renderProfileGate();renderPage();syncAdminAccess();byId('profile-create').classList.remove('show');
 if(editing){toast('담당자 이름과 아이콘을 저장했어요. 기존 예산도 유지돼요.');}
 else{toast('사용자를 추가했어요. 다른 팀으로 옮기려면 카드를 끌어주세요.');}
}

// Phase subtotal and fiscal source lines are visual children of selected budgets.
// The printed lines are display-only; they never enter the budget amount total.
const DETAIL_BY_PHASE=new Map();
for(const row of DETAILS){const k=row.budget+'||'+row.phase;if(!DETAIL_BY_PHASE.has(k))DETAIL_BY_PHASE.set(k,[]);DETAIL_BY_PHASE.get(k).push(row);}
function phaseDisplayState(key,phase){
 const statState=statDraftState(key);
 if(statState==='draft')return 'draft';
 const rows=DETAIL_BY_PHASE.get(key+'||'+phase)||[];
 return rows.some(r=>markedDraft(r)==='draft')?'draft':rows.some(r=>markedDraft(r)==='partial')?'partial':'';
}
function phaseOwnerState(key,phase){
 const rows=DETAIL_BY_PHASE.get(key+'||'+phase)||[];
 const owners=new Set();
 for(const r of rows)for(const owner of confirmedOwnersForRegion(r))owners.add(owner);
 // Some budgets have phase summaries but no separately parsed child row.
 if(!rows.length)for(const owner of confirmedOwnersForRegion({type:'stat',budget:key}))owners.add(owner);
 return [...owners];
}
function paintFiscalBand(shape,state,owners,paintedDraft,paintedOwners){
 if(state==='draft'){paintedDraft.push(shape);return;}
 if(!owners?.length)return;
 const w=shape.w/owners.length;
 owners.forEach((owner,i)=>{
  if(!paintedOwners.has(owner))paintedOwners.set(owner,[]);
  paintedOwners.get(owner).push({...shape,x:shape.x+i*w,w:i===owners.length-1?shape.w-i*w:w});
 });
}

// v68 — Search text already present in the original 50 vector budget pages.
// No PDF OCR, network call, allocation changes, or alteration of source pages.
let v68FindRows=null, v68FindHits=[], v68FindActive=-1, v68FindQuery='', v68FindTimer=0;
function v68FindNormalize(value){
 return String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('ko-KR');
}
function v68FindBuildIndex(){
 if(v68FindRows)return;
 const parser=new DOMParser();
 v68FindRows=IMAGES.map((svg,page)=>{
  const doc=parser.parseFromString(svg,'image/svg+xml');
  return Array.from(doc.querySelectorAll('text')).map((node,textIndex)=>({
   page,textIndex,text:node.textContent||'',normalized:v68FindNormalize(node.textContent)
  }));
 });
}
function v68FindStatus(){
 const label=byId('v68-find-status');
 const count=v68FindHits.length;
 label.classList.toggle('v68-no-match',!!v68FindQuery && !count);
 label.textContent=!v68FindQuery?'50쪽 전체 검색':!count?'검색 결과 없음':`${v68FindActive+1} / ${count}건 · ${v68FindHits[v68FindActive].page+1}쪽`;
 byId('v68-find-prev').disabled=!count;
 byId('v68-find-next').disabled=!count;
}
function v68FindPaintPage(){
 const svg=byId('paper').querySelector('svg.budget-sheet-svg');
 if(!svg)return;
 const old=svg.querySelector('.v68-find-layer');
 if(old)old.remove();
 if(!v68FindQuery||!v68FindHits.length)return;
 const matches=[];
 for(let i=0;i<v68FindHits.length;i++){
  if(v68FindHits[i].page===pg)matches.push({hit:v68FindHits[i],active:i===v68FindActive});
 }
 if(!matches.length)return;
 const svgNS='http://www.w3.org/2000/svg';
 const layer=document.createElementNS(svgNS,'g');
 layer.setAttribute('class','v68-find-layer');
 layer.setAttribute('aria-hidden','true');
 const nodes=svg.querySelectorAll('text');
 for(const {hit,active} of matches){
  const text=nodes[hit.textIndex];if(!text)continue;
  let bbox;
  try{bbox=text.getBBox()}catch(_){continue}
  if(!bbox||bbox.width<=0||bbox.height<=0)continue;
  const rect=document.createElementNS(svgNS,'rect');
  rect.setAttribute('x',Math.max(0,bbox.x-1.8));
  rect.setAttribute('y',bbox.y-1.4);
  rect.setAttribute('width',bbox.width+3.6);
  rect.setAttribute('height',bbox.height+2.8);
  rect.setAttribute('rx','2');
  rect.setAttribute('fill',active?'#d7eaff':'#b4d7ff');
  rect.setAttribute('fill-opacity',active?'0.37':'0.19');
  rect.setAttribute('stroke',active?'#0750bf':'#268afa');
  rect.setAttribute('stroke-width',active?'1.8':'0.75');
  layer.appendChild(rect);
 }
 svg.appendChild(layer);
}
function v68FindFocus(){
 if(v68FindActive<0||!v68FindHits.length)return;
 const match=v68FindHits[v68FindActive];
 if(match.page!==pg)goPage(match.page);
 else v68FindPaintPage();
 v68FindStatus();
 requestAnimationFrame(()=>{
  const text=byId('paper').querySelectorAll('svg.budget-sheet-svg text')[match.textIndex];
  if(text && typeof text.scrollIntoView==='function')text.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
 });
}
function v68FindApply(){
 clearTimeout(v68FindTimer);
 const term=v68FindNormalize(byId('v68-find-input').value);
 if(term===v68FindQuery)return;
 v68FindQuery=term;
 v68FindHits=[];v68FindActive=-1;
 if(term){
  v68FindBuildIndex();
  for(const pageRows of v68FindRows)for(const row of pageRows){
   if(row.normalized.includes(term))v68FindHits.push(row);
  }
  if(v68FindHits.length){
   const i=v68FindHits.findIndex(r=>r.page>=pg);
   v68FindActive=i>=0?i:0;
  }
 }
 v68FindStatus();
 if(v68FindActive>=0)v68FindFocus();
 else v68FindPaintPage();
}
function v68FindStep(delta){
 v68FindApply();
 if(!v68FindHits.length)return;
 v68FindActive=(v68FindActive+delta+v68FindHits.length)%v68FindHits.length;
 v68FindFocus();
}

function renderPage(){
 counts();updateBulkBar();renderTeamLegend();renderDashboard();const paper=byId('paper');
 const mineAlloc=S.allocs.filter(a=>a.owner===S.selectedOwner);
 const selectedKeyMine=new Set(mineAlloc.map(a=>a.key));
 const fullMine=new Set(mineAlloc.filter(a=>REGION.get(markedId(a))?.type==='stat').map(a=>a.key));
 const ancestorCommitted=new Set();
 for(const a of mineAlloc){const id=markedId(a),canonical=canonDetail(id);ancestorCommitted.add(canonical);
   for(const version of linkedDetailIds(id))for(const ch of DETAIL_CHILDREN[version]||[])ancestorCommitted.add(canonDetail(ch));}
 const rows=PAGES[pg].filter(r=>!r.header).slice().sort((a,b)=>a.y-b.y||a.x-b.x);
 const paintedDraft=[],paintedOwners=new Map();
 const visualRows=rows.map(r=>{
  const state=markedDraft(r);
  let already=false,partialAlready=false;
  if(r.type==='group'){
   const keys=GROUPS[r.groupId].keys, selected=keys.filter(k=>selectedKeyMine.has(k)).length;
   already=selected===keys.length;partialAlready=selected>0&&!already;
  }else if(r.type==='stat')already=selectedKeyMine.has(r.budget);
  else already=fullMine.has(r.budget)||ancestorCommitted.has(canonDetail(r.id));
  return {r,state,already,partialAlready};
 });
 const buttons=visualRows.map(({r,state,already,partialAlready},i)=>{
  let bottom=v9InkBottom(rows,i);
  const next=visualRows.slice(i+1).find(v=>v.r.y>r.y+0.1);
  if(next && next.r.y-r.y<=36.0 && (
     (state==='draft' && next.state==='draft') ||
     (already && next.already && state!=='draft' && next.state!=='draft')
  )) bottom=Math.max(bottom,next.r.y);
  const shape={x:r.x,y:r.y,w:r.w,h:Math.max(1,bottom-r.y)};
  if(state==='draft')paintedDraft.push(shape);
  else drawColoredCommit(shape,r,paintedOwners);
  if(!isClickableRegion(r))return '';
  const label=r.type==='group'?r.level+' 전체 선택/해제':r.type==='stat'?'통계목 선택/해제':'산출내역 선택/해제';
  return `<button type="button" data-region="${r.id}" class="hotspot ${r.type==='group'?'groupregion level-'+r.level:''} ${state} ${already?'marked':''} ${partialAlready?'partiallymarked':''}" title="${esc(r.title).replace(/\n/g,' ')} · ${label}" style="left:${(100*r.x/595.28).toFixed(3)}%;top:${(100*r.y/841.89).toFixed(3)}%;width:${(100*r.w/595.28).toFixed(3)}%;height:${(100*Math.max(1,bottom-r.y)/841.89).toFixed(3)}%" aria-pressed="${state==='draft'}" aria-label="${esc(r.title).replace(/\n/g,' ')} ${label}"></button>`;
 });
 // Highlight the original budget's phase subtotals as part of the selected
 // item (본예산/추경), including resource rows in between.
 for(const h of PHASE_BANDS[pg]){
  const state=phaseDisplayState(h.key,h.phase);
  const owners=state==='draft'?[]:phaseOwnerState(h.key,h.phase);
  const shape={x:86.2,y:h.y,w:293.8,h:14.8};
  paintFiscalBand(shape,state,owners,paintedDraft,paintedOwners);
 }
 for(const fund of FISCAL_BANDS[pg]){
  let state='',owners=[];
  if(fund.type==='phase'){
   state=phaseDisplayState(fund.key,fund.phase);
   if(state!=='draft')owners=phaseOwnerState(fund.key,fund.phase);
  }else{
   const r=fund.id?REGION.get(fund.id):fund.key?{type:'stat',budget:fund.key}:null;
   if(!r)continue;
   state=markedDraft(r);
   if(state!=='draft')owners=confirmedOwnersForRegion(r);
  }
  paintFiscalBand({x:281,y:fund.y,w:100,h:14.9},state,owners,paintedDraft,paintedOwners);
 }
 const fills=[...paintedOwners.entries()].map(([owner,rects])=>`<path d="${v9InkPath(rects)}" fill="${ownerColor(owner)}" fill-opacity=".25" fill-rule="nonzero"/>`).join('');
 const ink=`<svg class="highlight-layer" viewBox="0 0 595.28 841.89" preserveAspectRatio="none" aria-hidden="true">${fills}<path d="${v9InkPath(paintedDraft)}" fill="rgba(255,217,57,.43)" fill-rule="nonzero"/></svg>`;
  // Profile avatars make ownership visually explicit. They stay entirely
  // inside the blank page margin, leaving amounts and existing hit geometry intact.
  const stamps=visualRows.filter(v=>v.r.type==='stat'||(v.r.type==='detail'&&S.allocs.some(a=>a.key===v.r.budget&&REGION.get(markedId(a))?.type==='detail'&&canonDetail(markedId(a))===canonDetail(v.r.id)))).map(({r})=>{
    const owners=confirmedOwnersForRegion(r);if(!owners.length)return '';
    const summary=owners.map(owner=>`${owner} : ${money(S.allocs.filter(a=>a.owner===owner&&a.key===r.budget).reduce((t,a)=>t+a.amount,0))}`).join(' / ');
    const name=esc(summary);
    const icons=owners.slice(0,2).map(owner=>`<span class="owner-avatar-mini" style="--member-color:${ownerColor(owner)}" title="${esc(owner)} · 확정">${esc(avatarFor(owner))}</span>`).join('');
    return `<button type="button" class="budget-owner-avatars" data-owner-info="${name}" style="right:${(100*8/595.28).toFixed(3)}%;top:${(100*(r.y+0.3)/841.89).toFixed(3)}%" title="🔒 관리 예산 확정 · ${name}" aria-label="관리 예산 확정: ${name}">${icons}${owners.length>2?`<span class="owner-more">+${owners.length-2}</span>`:''}<span class="owner-mini-lock" aria-hidden="true">🔒</span></button>`;
  }).join('');
  paper.innerHTML=IMAGES[pg]+ink+buttons.join('')+stamps;
 v68FindPaintPage();
 byId('pagepicked').textContent=`이 페이지 선택 ${rows.filter(r=>isClickableRegion(r)&&markedDraft(r)==='draft').length}곳`;
}

function toggleDraft(id){
 const r=REGION.get(id);if(!r||!isClickableRegion(r))return;
 if(r.type!=='group'&&rest(r.budget)<=0){toast('이 통계목은 다른 담당자 등에게 전액 확정되어 남은 금액이 없어요.');return;}

 if(r.type==='group'){
  const keys=GROUPS[r.groupId]?.keys||[];
  const full=keys.length>0&&keys.every(k=>statDraftState(k)==='draft');
  const keySet=new Set(keys);
  S.draftKeys=S.draftKeys.filter(k=>!keySet.has(k));
  S.draftDetails=S.draftDetails.filter(d=>!keySet.has(leafBudget(d)));
  if(!full){S.draftKeys.push(...keys.filter(key=>rest(key)>0));if(!keys.some(key=>rest(key)>0))toast('이 사업에는 남은 미배분 예산이 없습니다.');}
 }else if(r.type==='stat'){
  const full=statDraftState(r.budget)==='draft';
  setBudgetLeaves(r.budget,full?new Set():new Set(STAT_LEAVES.get(r.budget)||[]));
 }else{
  // A clicked child of a fully checked parent is the sole exclusion.
  // Remaining siblings stay marked. If the missing leaf is clicked again,
  // its complete branch is restored and ancestors auto-check themselves.
  const target=NODE_LEAVES.get(canonDetail(id))||new Set([canonDetail(id)]);
  const chosen=selectedLeaves(r.budget);
  const fullyChosen=[...target].every(leaf=>chosen.has(leaf));
  for(const leaf of target){if(fullyChosen)chosen.delete(leaf);else chosen.add(leaf);}
  setBudgetLeaves(r.budget,chosen);
 }
 persist();renderPage();
}

function goPage(num){if(!Number.isInteger(num)||num<0||num>=IMAGES.length){toast('1~50쪽 중에서 선택해 주세요.');return}if(num===pg)return;lastVisitedPage=pg;pg=num;picked=null;closeEditor();renderPage();window.scrollTo(0,0)}
function editorOpen(regionId){const r=REGION.get(regionId);if(!r)return;picked=regionId;const b=MAP.get(r.budget);const rem=rest(r.budget);
 const isStat=r.type==='stat',latest=isStat?r.amount:latestDetailAmount(r.id),seed=isStat?rem:Math.min(Math.max(0,latest),rem);
 const revision=!isStat?amendmentInfo(r.id):null;
 byId('editor-overline').textContent=isStat?'통계목 선택':'산출내역 선택';
 byId('editor-title').textContent=r.title.replace(/\s+/g,' ');
 byId('editor-crumb').textContent=b.policy+' / '+b.unit+' / '+b.project+' / '+b.head+' / '+b.stat;
 byId('editor-showamount').textContent=r.amount===null?'표시액 없음':money(isStat?r.amount:latest);
 byId('editor-caption').textContent=isStat?'통계목 최종 예산액':revision?`동일 산출항목의 ${revision.phase} 경정액`:'산출내역 표시액 (참고용)';
 byId('editor-total').textContent=abbrev(b.won);byId('editor-remain').textContent=abbrev(rem);
 byId('entry-label').value=isStat?b.stat.replace(/^\d{2}\s*/,''):r.title.replace(/\s+/g,' ');
 byId('entry-amount').value=seed>=0?String(seed):'';byId('entry-amount').max=isStat?rem:Math.min(rem,Math.max(0,latest));byId('entry-amount').disabled=rem===0||(!isStat&&latest<=0);
 byId('entry-owner').innerHTML=`<option value="${esc(S.selectedOwner)}">${esc(S.selectedOwner)}</option>`;byId('entry-owner').disabled=true;
 byId('editor-note').textContent=revision?`본예산 ${money(revision.initial??0)} → ${revision.phase} ${money(revision.amount)}. 동일 명칭은 연결되며 금액은 최종 경정액을 사용합니다. 공식 배분·집행은 아닙니다.`:!isStat?'표시된 산출내역은 관리용 참고금액입니다. 통계목 최종액 한도 내에서만 선택할 수 있습니다.':b.hasRevision?'추경으로 변경된 예산입니다. 통계목의 최종 기준액 안에서만 관리 금액을 배분합니다.':'관리용 금액을 나누는 기능이며 공식 예산 배정·집행을 의미하지 않습니다.';
 byId('entry-submit').disabled=rem===0||(!isStat&&latest<=0);byId('entry-submit').textContent=latest===0&&!isStat?'최종 경정액 0원 · 담기 불가':rem===0?'모두 배분된 예산입니다':'형광펜 표시하고 내 예산에 담기';
 byId('editor').classList.add('show');renderPage();
}
function closeEditor(){picked=null;byId('editor').classList.remove('show');const el=byId('paper').querySelector('.picked');if(el)el.classList.remove('picked')}
function addPick(){if(!picked)return;const r=REGION.get(picked),b=MAP.get(r.budget),name=byId('entry-label').value.trim(),owner=byId('entry-owner').value,amt=Number(byId('entry-amount').value);
 if(!name){toast('관리 항목 이름을 입력해 주세요.');return}
 if(!S.owners.includes(owner)){toast('담당자를 선택해 주세요.');return}
 if(!Number.isSafeInteger(amt)||amt<=0||amt>rest(b.key)||(r.type==='detail'&&amt>latestDetailAmount(r.id))){toast('금액은 최종 경정액과 통계목 미배분액 이하의 양의 정수로 입력해 주세요.');return}
 S.allocs.push({id:uid(),key:b.key,owner:S.selectedOwner,locked:true,label:name,amount:amt,memo:r.type==='detail'?`${lastDetailPhase(r.id)} 최종 경정 · ${r.page}쪽 산출내역 참고`:'',regionId:r.type==='detail'?canonDetail(r.id):r.id});
 addHistory('내 예산 담기',`${owner} · ${name} · ${money(amt)} · ${b.project}`);persist();closeEditor();renderPage();toast('형광펜 표시와 내 예산 등록을 완료했어요.');
}

function batchCandidates(){
 const rows=[];
 for(const key of S.draftKeys){
  const b=MAP.get(key),rem=rest(key);if(!b||rem<=0)continue;
  rows.push({id:'stat:'+key,key,regionId:ANCHOR.get(key),label:b.project+' · '+b.stat,amount:rem,cap:rem,detail:false});
 }
 const partialKeys=[...new Set(S.draftDetails.map(leafBudget))].filter(k=>k&&!S.draftKeys.includes(k));
 for(const key of partialKeys){
  const b=MAP.get(key),rem=rest(key);if(!b||rem<=0)continue;
  const picked=new Set(S.draftDetails.filter(id=>leafBudget(id)===key));
  const covered=new Set(),selectedNodes=[];
  const nodes=[...(STAT_DETAIL_NODES.get(key)||[])];
  const candidates=nodes.filter(id=>{
   const desc=NODE_LEAVES.get(id)||new Set();
   return desc.size>1&&[...desc].every(leaf=>picked.has(leaf));
  }).sort((a,b)=>NODE_LEAVES.get(b).size-NODE_LEAVES.get(a).size);
  for(const id of candidates){
   const leaves=NODE_LEAVES.get(id);
   if([...leaves].some(leaf=>covered.has(leaf)))continue;
   const sum=[...leaves].reduce((t,leaf)=>t+Math.max(0,latestDetailAmount(leaf)),0);
   const parentAmount=Math.max(0,latestDetailAmount(id));
   if(Math.abs(sum-parentAmount)>1000)continue; // do not consolidate ambiguous 산출기초
   selectedNodes.push(id);for(const leaf of leaves)covered.add(leaf);
  }
  for(const leaf of picked)if(!covered.has(leaf))selectedNodes.push(leaf);
  selectedNodes.sort((a,b)=>{
   const aa=REGION.get(a),bb=REGION.get(b);
   return (aa?.page||0)-(bb?.page||0)||(aa?.y||0)-(bb?.y||0);
  });
  for(const id of selectedNodes){
   const r=REGION.get(id);if(!r)continue;
   const cap=Math.min(Math.max(0,latestDetailAmount(id)),rem);
   if(cap<=0)continue;
   rows.push({id:'detail:'+id,key,regionId:id,label:r.title,amount:cap,cap,detail:true,phase:lastDetailPhase(id),revised:!!amendmentInfo(id)});
  }
 }
 return rows;
}
function showBulk(open=true){bulk=open;byId('bulkmodal').classList.toggle('show',open);byId('veil').classList.toggle('show',open||drawer||!!dialog);if(!open)return;
 closeEditor();bulkItems=batchCandidates();byId('bulk-owner').innerHTML=`<option value="${esc(S.selectedOwner)}">${esc(S.selectedOwner)}</option>`;byId('bulk-owner').disabled=true;renderBulkItems();
}
function renderBulkItems(){
 const list=byId('bulk-list');list.innerHTML=bulkItems.length?bulkItems.map((a,i)=>{
  const b=MAP.get(a.key),r=REGION.get(a.regionId);return `<div class="bulkitem" data-i="${i}"><div><div class="path">${esc(b.project)} / [${esc(b.code)}] ${esc(b.stat)} · ${r?.page||b.page}쪽 ${a.detail?'· 산출내역':''}</div><strong>${esc(a.label)}</strong><span class="amountlimit">${a.detail?'최종 산출액 한도':'현재 통계목 미배분액'} ${money(a.cap)}${a.detail?' · '+esc(a.phase)+(a.revised?' 경정 적용':''):''}</span></div><input data-i="${i}" aria-label="${esc(a.label)} 배분액" type="number" min="1" max="${a.cap}" step="1" value="${a.amount}"><button class="delitem" data-remove="${i}" aria-label="선택 목록에서 제거" title="이 항목 제외">×</button></div>`;
 }).join(''):'<div class="empty">담을 수 있는 미배분 예산이 없어요.<br>이미 배분된 항목을 선택했다면 해제하거나 다른 항목을 선택해 주세요.</div>';
 byId('bulk-count').textContent=bulkItems.length+'개 관리 후보';byId('bulk-error').textContent='';validateBulk();
}
function validateBulk(){
 let errors=[],sum=0,byKey=new Map();
 for(const a of bulkItems){let n=Number(a.amount);if(!Number.isSafeInteger(n)||n<=0)errors.push(`「${a.label}」의 금액을 확인해 주세요.`);
  else{sum+=n;byKey.set(a.key,(byKey.get(a.key)||0)+n);if(n>a.cap)errors.push(`「${a.label}」이 해당 통계목 미배분액을 넘었습니다.`)}
 }
 for(const [key,n] of byKey)if(n>rest(key))errors.push(`「${MAP.get(key).project} / ${MAP.get(key).stat}」에서 선택 금액의 합계가 미배분액을 초과했습니다.`);
 byId('bulk-sum').textContent=money(sum);byId('bulk-valid-count').textContent=bulkItems.length+'개 관리 후보';byId('bulk-error').textContent=[...new Set(errors)].slice(0,3).join('\n');byId('bulk-confirm').disabled=!bulkItems.length||!!errors.length;
 return !errors.length&&bulkItems.length>0;
}
function commitBulk(){if(!validateBulk())return;const owner=byId('bulk-owner').value;if(!S.owners.includes(owner))return;
 // All amounts are validated first, then committed in one atomic operation.
 for(const a of bulkItems){const r=REGION.get(a.regionId),b=MAP.get(a.key);S.allocs.push({id:uid(),key:a.key,owner:S.selectedOwner,locked:true,label:a.label,amount:Number(a.amount),memo:a.detail?`${r?.phase||''} · ${r?.page||b.page}쪽 산출내역 참고`:'',regionId:a.regionId});}
 addHistory('일괄 담기',`${owner} · ${bulkItems.length}개 관리항목 · ${money(bulkItems.reduce((v,a)=>v+Number(a.amount),0))}`);
 S.draftKeys=[];S.draftDetails=[];dashboardSample=false;persist();showBulk(false);renderPage();toast(`${bulkItems.length}개 예산을 내 예산함에 담았어요.`);bulkItems=[];
}
function clearDraft(){if(!S.draftKeys.length&&!S.draftDetails.length)return;S.draftKeys=[];S.draftDetails=[];persist();renderPage();toast('형광펜 선택을 비웠어요.')}

function showDrawer(on=true){drawer=on;byId('veil').classList.toggle('show',on);byId('drawer').classList.toggle('show',on);if(on){closeEditor();renderDrawer()}}
function renderDrawer(){byId('drawer-summary').textContent=money(mine().reduce((t,a)=>t+a.amount,0));byId('drawer-info').textContent=mine().length+'개 관리 항목 · 확정 시 다른 담당자 편집 불가';
 byId('drawer-owner').innerHTML=S.owners.map(n=>`<option value="${esc(n)}" ${n===S.selectedOwner?'selected':''}>${esc(n)}</option>`).join('');
  byId('drawer-list').innerHTML=`<div class="drawer-class-hint">통계목 코드는 편성목 3자리 + 통계목 2자리예요. 예: <strong>201-01</strong> · 사무관리비</div>`+(mine().length?mine().map(a=>{let b=MAP.get(a.key),locked=a.locked!==false;return `<article class="alloc ${locked?'locked':''}"><div class="allocmeta">${esc(b.project)}<span class="lock-status">${locked?'🔒 확정·잠금':'🔓 임시 잠금 해제'}</span></div><div class="alloc-classification"><span class="budget-code">${esc(b.code)}</span><span>${esc(b.stat.replace(/^\d+\s*/,''))}</span></div><h3>${esc(a.label)}</h3><b>${money(a.amount)}</b><div class="allocactions"><button data-act="goto" data-id="${a.id}">📄 원문 위치</button><button data-act="${locked?'unlock':'lock'}" data-id="${a.id}">${locked?'🔓 수정 허용':'🔒 다시 확정'}</button><button data-act="split" data-id="${a.id}" ${locked?'disabled':''}>✂ 나누기</button><button data-act="transfer" data-id="${a.id}" ${locked?'disabled':''}>↔ 이관</button><button class="red" data-act="release" data-id="${a.id}" ${locked?'disabled':''}>담기 해제</button></div></article>`}).join(''):'<div class="empty"><span>✍️</span>아직 내 예산이 없어요.<br>예산서에서 형광펜으로 표시한 후 한꺼번에 확정해보세요.</div>');
}

function openDialog(mode,id){dialog={mode,id};const a=S.allocs.find(v=>v.id===id);const owners=S.owners.filter(n=>n!==(a?.owner));let body='',label='';
 if(mode==='add-owner'){label='담당자 추가';body=`<div class="formfield"><label>표시할 이름</label><input id="dialog-name" placeholder="예: 담당자 D" maxlength="40"></div>`}
 else if(!a)return;
 else if(mode==='split') {label='관리 예산 나누기';body=`<p>현재 ${money(a.amount)}에서 일부 금액을 새 관리 항목으로 나눕니다. 총 관리액은 변하지 않아요.</p><div class="formfield"><label>떼어낼 금액 (원)</label><input type="number" id="dialog-amount" min="1" max="${a.amount-1}" value="${Math.floor(a.amount/2)}"></div><div class="formfield"><label>새 항목 이름</label><input id="dialog-name" value="${esc(a.label+' (분할)')}"></div>`}
 else if(mode==='transfer') {label='다른 담당자에게 관리분 이관';body=`<p>${esc(a.owner)}의 관리금액 ${money(a.amount)}을 전부 또는 일부 넘깁니다.</p><div class="formfield"><label>받을 담당자</label><select id="dialog-owner">${owners.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select></div><div class="formfield"><label>이관할 금액 (원)</label><input type="number" id="dialog-amount" min="1" max="${a.amount}" value="${a.amount}"></div>`}
 else if(mode==='release'){label='담기 해제';body=`<p>「${esc(a.label)}」 ${money(a.amount)}을 내 예산에서 제거하고 미배분으로 되돌릴까요? 원본 예산서 금액에는 영향이 없습니다.</p>`}
 else return;
 byId('dialog-title').textContent=label;byId('dialog-content').innerHTML=body;byId('dialog-fail').textContent='';byId('veil').classList.add('show');byId('dialog').classList.add('show');
}
function closeDialog(){dialog=null;byId('dialog').classList.remove('show');if(!drawer)byId('veil').classList.remove('show')}
function doDialog(){if(!dialog)return;const {mode,id}=dialog,a=S.allocs.find(v=>v.id===id);let amount=Number(byId('dialog-amount')?.value||0),name=byId('dialog-name')?.value?.trim()||'';
 const fail=x=>byId('dialog-fail').textContent=x;
 if(mode!=='add-owner'&&(!a||a.owner!==S.selectedOwner||a.locked!==false))return fail('다른 담당자 예산 또는 잠긴 예산은 수정할 수 없습니다.');
 if(mode==='add-owner'){if(!name||name.length>40)return fail('1~40자로 입력해 주세요.');if(S.owners.includes(name))return fail('이미 등록된 담당자예요.');S.owners.push(name);S.profileIcons[name]=DEFAULT_AVATARS[(S.owners.length-1)%DEFAULT_AVATARS.length];S.draftsByOwner[S.selectedOwner]={keys:[...S.draftKeys],details:[...S.draftDetails]};S.selectedOwner=name;S.draftKeys=[];S.draftDetails=[];addHistory('담당자 추가',name)}
 else if(mode==='split'){if(!a)return fail('관리 항목을 찾을 수 없습니다.');if(!Number.isSafeInteger(amount)||amount<=0||amount>=a.amount)return fail('현재 금액보다 작은 양의 정수를 입력하세요.');if(!name)return fail('새 관리 항목 이름을 입력해 주세요.');a.amount-=amount;S.allocs.push({...a,id:uid(),label:name,amount,locked:false});addHistory('관리분 분할',`${a.owner} · ${money(amount)} 분할`)}
 else if(mode==='transfer'){if(!a)return fail('관리 항목을 찾을 수 없습니다.');const owner=byId('dialog-owner')?.value;if(!owner||owner===a.owner||!S.owners.includes(owner))return fail('받을 담당자를 확인해 주세요.');if(!Number.isSafeInteger(amount)||amount<=0||amount>a.amount)return fail('유효한 이관 금액을 입력해 주세요.');const from=a.owner;if(amount===a.amount){a.owner=owner}else{a.amount-=amount;S.allocs.push({...a,id:uid(),amount,owner,locked:true})}addHistory('담당자 이관',`${from} → ${owner} · ${money(amount)}`)}
 else if(mode==='release'){if(!a)return fail('항목을 찾을 수 없습니다.');S.allocs=S.allocs.filter(v=>v.id!==a.id);addHistory('담기 해제',`${a.label} · ${money(a.amount)}`)}
 persist();closeDialog();renderDrawer();renderPage();toast('관리 내역을 반영했어요.');
}
function saveFile(name,text,mime='application/json'){const blob=new Blob([text],{type:mime+';charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportJson(){saveFile('내예산_형광펜_백업.json',JSON.stringify(S,null,2))}
function csv(){let rows=[['담당자','정책사업','단위사업','세부사업','편성목','통계목','관리항목명','관리금액(원)','PDF쪽']];for(const a of S.allocs){const b=MAP.get(a.key),r=REGION.get(markedId(a));rows.push([a.owner,b.policy,b.unit,b.project,b.head,b.stat,a.label,a.amount,r?.page||b.page])}saveFile('내예산_꾸러미_관리표.csv','\ufeff'+rows.map(r=>r.map(s=>'"'+String(s??'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),'text/csv')}
function importJson(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const d=JSON.parse(reader.result);if(!d||!Array.isArray(d.allocs)||!Array.isArray(d.owners)||!d.owners.includes(d.selectedOwner))throw Error('형식이 맞지 않습니다.');const total=new Map();for(const a of d.allocs){if(!MAP.has(a.key)||!d.owners.includes(a.owner)||!Number.isSafeInteger(a.amount)||a.amount<=0||typeof a.label!=='string')throw Error('손상된 관리 항목이 있습니다.');total.set(a.key,(total.get(a.key)||0)+a.amount)}for(const [k,n] of total)if(n>MAP.get(k).won)throw Error('원본 통계목보다 배분이 많습니다.');S={version:8,owners:d.owners,adminOwner:d.owners.includes(d.adminOwner)?d.adminOwner:(d.owners.includes('나')?'나':d.owners[0]),teams:Array.isArray(d.teams)?d.teams:[],profileIcons:d.profileIcons&&typeof d.profileIcons==='object'?d.profileIcons:{},selectedOwner:d.selectedOwner,allocs:d.allocs.map(a=>({...a,locked:a.locked!==false})),history:Array.isArray(d.history)?d.history:[],amountUnit:d.amountUnit==='백만원'?'백만원':'천원',draftKeys:[],draftDetails:[],draftsByOwner:{},spendingEntries:Array.isArray(d.spendingEntries)?d.spendingEntries:[],executionShares:Array.isArray(d.executionShares)?d.executionShares:[],executionIgnored:Array.isArray(d.executionIgnored)?d.executionIgnored.filter(x=>x&&typeof x.row==='string'&&typeof x.owner==='string'&&d.owners.includes(x.owner)):[],spendingPlans:Array.isArray(d.spendingPlans)?d.spendingPlans:[]};dashboardSample=S.allocs.length===0;normalizeTeams();persist();renderDrawer();renderPage();renderProfileGate();syncAdminAccess();toast('백업을 복원했어요.')}catch(e){toast('가져오기 오류: '+e.message)}};reader.readAsText(file,'utf-8')}


// V21: dashboard is the normal landing screen; the PDF highlighter is a secondary menu.
let dashboardView='home';
let dashboardSample = false; // visually labelled fictional sample; never persisted.
// The date filter changes the report view, never the source expense records or budget allocations.
const REPORT_DATE_STORAGE_KEY='ulju-wallet-report-asof-v29';
function reportValidDate(v){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return false;
 const d=new Date(v+'T12:00:00');return !Number.isNaN(d.valueOf())&&`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`===v;
}
let reportAsOfDate=(()=>{try{const v=localStorage.getItem(REPORT_DATE_STORAGE_KEY);return reportValidDate(v)?v:null;}catch(_){return null;}})();
function reportRowDate(r){
 const primary=String(r.dt||''),secondary=String(r.propdate||'');
 return reportValidDate(primary)?primary:reportValidDate(secondary)?secondary:'';
}
function reportRowIncluded(r){if(!reportAsOfDate)return true;const d=reportRowDate(r);return !!d&&d<=reportAsOfDate;}
function reportLabel(date){return date?date.replaceAll('-','.')+'.':'전체 기간';}
function reportPendingRows(){return exProfilePendingRows().filter(reportRowIncluded);}
function reportSetDate(date){
 const value=String(date||'');
 if(value&&!reportValidDate(value)){toast('올바른 기준일을 선택해 주세요.');return;}
 if(reportAsOfDate===value||(!reportAsOfDate&&!value)){renderSimpleDashboard();return;}
 reportAsOfDate=value||null;
 try{if(reportAsOfDate)localStorage.setItem(REPORT_DATE_STORAGE_KEY,reportAsOfDate);else localStorage.removeItem(REPORT_DATE_STORAGE_KEY);}catch(_){}
 statLedgerYear=null;statLedgerMonth=null;statLedgerPage=0;
 renderDashboard();
 toast(reportAsOfDate?reportLabel(reportAsOfDate)+'까지 누적 집행현황으로 변경했어요.':'전체 기간의 집행현황을 표시해요.');
}
function reportIsAfterSource(){return !!(reportAsOfDate&&reportValidDate(EX_SOURCE.asof)&&reportAsOfDate>EX_SOURCE.asof);}
function reportWarningText(){
 return reportIsAfterSource()?`⚠ 선택한 기준일(${reportLabel(reportAsOfDate)})은 현재 보유 집행자료 기준일(${reportLabel(EX_SOURCE.asof)}) 이후입니다. 신규 자료를 반영하지 않았다면 실제 집행액과 다를 수 있습니다.`:'';
}
const SAMPLE_ROWS=[
 {id:'sample1',code:'201-01',project:'건강관리과 운영',label:'사무관리비',amount:12400000,spent:7200000},
 {id:'sample2',code:'101-04',project:'방역소독',label:'기간제근로자등보수',amount:8500000,spent:4100000},
 {id:'sample3',code:'201-02',project:'건강증진사업',label:'공공운영비',amount:5200000,spent:1300000},
 {id:'sample4',code:'307-02',project:'보건사업 지원',label:'민간경상사업보조',amount:3200000,spent:900000}
];
function displayBudget(n){return formatBudgetTotal(n)}
function ownEntrySum(id){return (S.spendingEntries||[]).filter(e=>e.allocId===id).reduce((sum,e)=>sum+e.amount,0)}
function viewDashboardRows(){
 if(dashboardSample)return SAMPLE_ROWS.map(x=>({...x,isDemo:true,hasSpending:true}));
 return mine().map(a=>{const b=MAP.get(a.key),source=exSpentForAllocation(a.id);return {id:a.id,code:b?.code||'—',project:b?.project||'사업명 확인',label:a.label||b?.stat,amount:a.amount,spent:source.paid,hasSpending:source.n>0,sourcePending:source.pending,autoSource:source.auto,isDemo:false,alloc:a}});
}
// V24: Only the dashboard presentation is grouped; each underlying allocation
// and every imported spending record remains a separate record.
const dashExpandedGroupDetails=new Set();
function groupDashboardByProject(rows){
 const projects=new Map();
 for(const row of rows){
  const projectName=row.project||'세부사업 확인';
  if(!projects.has(projectName))projects.set(projectName,{name:projectName,groups:new Map(),amount:0,spent:0,hasSpending:false});
  const proj=projects.get(projectName);
  const key=row.alloc?.key||('demo::'+projectName+'::'+row.code);
  if(!proj.groups.has(key)){
   const b=row.alloc?MAP.get(row.alloc.key):null;
   proj.groups.set(key,{key,project:projectName,code:row.code,statName:b?.stat?.replace(/^\d+\s*/, '')||row.label||'통계목',budgetWon:b?.won??row.amount,amount:0,spent:0,hasSpending:false,pending:false,items:[],isDemo:!!row.isDemo,others:[],remaining:0});
  }
  const g=proj.groups.get(key);
  g.amount+=row.amount;g.spent+=row.spent;g.hasSpending ||= row.hasSpending;g.pending ||= !row.hasSpending;
  g.items.push(row);
  proj.amount+=row.amount;proj.spent+=row.spent;proj.hasSpending ||= row.hasSpending;
 }
 for(const proj of projects.values()){
  proj.groups=[...proj.groups.values()];
  for(const g of proj.groups){
   if(!g.isDemo){
    g.others=S.allocs.filter(a=>a.key===g.key&&a.owner!==S.selectedOwner);
    const allocated=S.allocs.filter(a=>a.key===g.key).reduce((n,a)=>n+a.amount,0);
    g.remaining=Math.max(0,g.budgetWon-allocated);
   }
  }
 }
 return [...projects.values()];
}
function renderGroupedDashboard(rows){
 const projects=groupDashboardByProject(rows);
 return projects.map(proj=>{
  const projectHasAll=proj.groups.every(g=>g.hasSpending);
  return `<section class="dash-project-group" aria-label="${esc(proj.name)} 예산 현황">
   <div class="dash-project-head"><div><div class="dash-project-name"><span class="dash-project-icon" aria-hidden="true">▣</span>${esc(proj.name)}</div><div class="dash-project-sub">${proj.groups.length}개 통계목 · ${proj.groups.reduce((n,g)=>n+g.items.length,0)}개 관리내역</div></div>
   <div class="dash-project-total"><span>내 관리 예산 합계</span><strong>${displayBudget(proj.amount)}</strong></div></div>
   <div class="dash-project-rows">${proj.groups.map(g=>{
    const pct=g.hasSpending&&g.amount>0?100*g.spent/g.amount:null;
    const otherByOwner=new Map();
    for(const a of g.others)otherByOwner.set(a.owner,(otherByOwner.get(a.owner)||0)+a.amount);
    const otherTotal=g.others.reduce((sum,a)=>sum+a.amount,0);
    const isShared=otherTotal>0;
    const labels=g.items.length>1?`관리내역 ${g.items.length}개`:'관리내역 1개';
    const sharedTags=isShared?[...otherByOwner].map(([name,amount])=>`<span class="dash-coowner-tag" title="${esc(name)} 담당 ${displayBudget(amount)}"><span class="dash-coowner-avatar" style="--avatar-color:${ownerColor(name)}">${esc(avatarFor(name))}</span>${esc(name)} ${displayBudget(amount)}</span>`).join(''):'';
    const isExpanded=dashExpandedGroupDetails.has(g.key);
    return `<div class="dash-stat-row"><div class="dash-stat-main"><div class="dash-stat-title"><span class="dash-code">${esc(g.code)}</span>${esc(g.statName)}</div><div class="dash-stat-caption">${labels}${g.isDemo?' · 가상 시연자료':''}</div>
    ${isShared?`<div class="dash-sharing-info"><span class="dash-coowner-tag">함께 관리 중</span>${sharedTags}</div>`:''}
    ${!g.isDemo?`<div class="dash-collection-foot">이 통계목 전체 ${displayBudget(g.budgetWon)} 중 내 몫 ${displayBudget(g.amount)}${g.remaining>0?' · 미배분 '+displayBudget(g.remaining):''}</div>`:''}
    </div><div><div class="dash-stat-money">${displayBudget(g.amount)} <span>${pct===null?'· 집행 확인 필요':'· '+pct.toFixed(1)+'% 참고'}</span></div><div class="dash-track"><i style="width:${Math.max(0,Math.min(100,pct||0))}%"></i></div>
    <div class="dash-stat-foot">${g.hasSpending?`집행 ${displayBudget(g.spent)} · 잔액 ${displayBudget(g.amount-g.spent)}${g.pending?' · 일부 확인 필요':''}`:'미확인 지출을 연결해 주세요.'}${isShared?' · 다른 담당자 집행액 제외':''}</div></div>
    <div class="dash-stat-actions"><button type="button" class="dash-mini-action" data-dash-key="${esc(g.key)}" ${g.isDemo?'disabled title="가상 시연자료"':''}>${g.isDemo?'예시':'지출 보기'}</button><button type="button" class="dash-stat-expand" data-dash-expand="${esc(g.key)}" aria-expanded="${isExpanded}">${isExpanded?'접기':'상세'}</button></div>
    ${isExpanded?`<div class="dash-detail-lines">${g.items.map(row=>`<div class="dash-detail-line"><span>${esc(row.label)}</span><strong>${displayBudget(row.amount)}</strong></div>`).join('')}</div>`:''}
    </div>`;
   }).join('')}</div></section>`;
 }).join('');
}
function renderDashboard(){
 if(!byId('dash-budget-rows'))return;
 S.spendingEntries=Array.isArray(S.spendingEntries)?S.spendingEntries:[];
 const own=mine();const rows=viewDashboardRows();
 const total=rows.reduce((n,r)=>n+r.amount,0), spent=rows.reduce((n,r)=>n+r.spent,0);
 const hasSpend=dashboardSample||rows.some(r=>r.hasSpending);
 const balance=total-spent,pct=hasSpend&&total>0?100*spent/total:null;
 byId('dash-owner-name').textContent=S.selectedOwner;byId('dash-hero-owner').textContent=S.selectedOwner;
 byId('dash-current-user').textContent=S.selectedOwner;
 byId('dash-current-avatar').textContent=avatarFor(S.selectedOwner);
 byId('dash-current-avatar').style.setProperty('--avatar-color',ownerColor(S.selectedOwner));
 byId('dash-main-total').textContent=displayBudget(total);
 byId('dash-total-caption').textContent=dashboardSample?'2026년 · 가상 예시':'2026년 · 내 예산함 기준';
 byId('dash-paid').textContent=hasSpend?displayBudget(spent):'—';
 byId('dash-paid-foot').textContent=dashboardSample?'가상 집행액':'지급정보 확인 결의액 기준';
 byId('dash-left').textContent=hasSpend?displayBudget(balance):'—';
 byId('dash-left-foot').textContent=hasSpend?'관리용 참고 잔액':'지출을 연결하면 계산';
 byId('dash-item-count').textContent=rows.length+'건';
 byId('dash-count-foot').textContent=dashboardSample?'가상 관리 항목':'확정된 관리 항목';
 byId('dash-rate-num').textContent=pct===null?'—':(pct.toFixed(1)+'%');
 byId('dash-rate-ring').style.setProperty('--dashpct',(pct===null?0:Math.max(0,Math.min(100,pct))).toFixed(2)+'%');
 byId('dash-rate-status').textContent=dashboardSample?'시연용 집행률':pct===null?'집행 귀속 확인 필요':pct>100?'배분액 초과 확인':'지급정보 기준 참고 집행률';
 byId('dash-rate-description').innerHTML=dashboardSample?'가상 예시 화면입니다.':pct===null?'내 예산에 연결할 지출을 확인해 주세요.':'연결된 지출 기준으로 자동 계산합니다.';
 byId('dash-demo-banner').hidden=!dashboardSample;
 
 byId('dash-open-spend').disabled=false;byId('dash-open-spend').title='집행현황 연결 기능을 이용해 주세요. 기존 수기 기록은 보존되지만 자동 합산하지 않습니다.';byId('dash-open-spend').textContent='집행현황 보기';
 const grouped=groupDashboardByProject(rows);
 byId('dash-item-count').textContent=grouped.reduce((n,p)=>n+p.groups.length,0)+'개';
 byId('dash-count-foot').textContent=dashboardSample?'가상 통계목':'통계목 기준 · '+rows.length+'개 관리내역';
 byId('dash-budget-rows').innerHTML=rows.length?renderGroupedDashboard(rows):`<div class="dash-empty"><strong>아직 담은 예산이 없어요.</strong>예산서에서 내 담당 항목을 형광펜으로 선택해 확정하면 이곳에 자동으로 나타납니다.<div style="margin-top:12px"><button class="dash-outline-btn" data-dash-go-picker>예산 선택하러 가기</button></div></div>`;
 const ledger=byId('dash-ledger');
 if(dashboardSample){ledger.hidden=true;ledger.innerHTML='';}else{
  const related=S.spendingEntries.filter(x=>own.some(a=>a.id===x.allocId)).slice().reverse().slice(0,5);
  ledger.hidden=true;
  ledger.innerHTML=related.length?`<div style="color:#7790ac;font-size:12px;font-weight:800;margin-bottom:5px">최근 수기 집행 기록</div>`+related.map(e=>{
   const a=own.find(a=>a.id===e.allocId);return `<div class="dash-entry"><span>${esc(e.date||'')} · ${esc(e.desc||'')} <span style="color:#9aafc1">(${esc(a?.label||'항목')})</span></span><span style="white-space:nowrap;font-weight:800;color:#365b81">${displayBudget(e.amount)} <button data-dash-delete="${esc(e.id)}" title="기록 삭제">삭제</button></span></div>`;
  }).join(''):'';
 }
 renderExecutionPanel();
 const people=S.owners.map(owner=>({owner,items:S.allocs.filter(a=>a.owner===owner)}));
 byId('dash-team-people').innerHTML=people.map(p=>{const total=p.items.reduce((sum,a)=>sum+a.amount,0);return `<div class="dash-person"><span class="dash-person-badge" style="--avatar-color:${ownerColor(p.owner)}">${esc(avatarFor(p.owner))}</span><span style="min-width:0"><strong>${esc(p.owner)}${p.owner===S.selectedOwner?' · 나':''}</strong><small>${displayBudget(total)} · ${p.items.length}개 항목</small></span></div>`}).join('');
}
function setMainView(view){
 dashboardView=view==='select'?'select':'home';
 byId('main-workspace').classList.toggle('dashboard-mode',dashboardView==='home');
 byId('side-home').classList.toggle('active',dashboardView==='home');
 byId('side-highlight').classList.toggle('active',dashboardView==='select');
 if(dashboardView==='home'){closeEditor();renderDashboard();}else{renderPage();}
 window.scrollTo({top:0,behavior:'instant'});
}
function openDashboardSpend(id){
 if(dashboardSample){toast('시연 예시에서는 집행내역을 수정할 수 없어요.');return;}
 const own=mine();if(!own.length){toast('먼저 예산서에서 내 예산을 담아 주세요.');return;}
 byId('dash-spend-budget').innerHTML=own.map(a=>{const b=MAP.get(a.key);return `<option value="${esc(a.id)}">${esc(b?.code||'')} · ${esc(a.label)} (${displayBudget(a.amount)})</option>`;}).join('');
 if(id&&own.some(a=>a.id===id))byId('dash-spend-budget').value=id;
 {const now=new Date(),localDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;byId('dash-spend-date').value=localDate;}
 byId('dash-spend-amount').value='';byId('dash-spend-desc').value='';byId('dash-spend-error').textContent='';
 byId('dash-spend-modal').classList.add('open');
}
function saveDashboardSpend(){
 const allocId=byId('dash-spend-budget').value,a=mine().find(a=>a.id===allocId);
 const amount=Number(byId('dash-spend-amount').value),date=byId('dash-spend-date').value,desc=byId('dash-spend-desc').value.trim();
 if(!a)return byId('dash-spend-error').textContent='내 예산 항목을 다시 확인해 주세요.';
 if(!Number.isSafeInteger(amount)||amount<=0)return byId('dash-spend-error').textContent='양의 정수 금액을 입력해 주세요.';
 if(!date||!desc)return byId('dash-spend-error').textContent='날짜와 지출 내용을 입력해 주세요.';
 S.spendingEntries.push({id:uid(),allocId,amount,date,desc,source:'manual'});
 persist();byId('dash-spend-modal').classList.remove('open');renderDashboard();toast('내 예산의 수기 집행 기록에 반영했어요.');
}
byId('side-home').addEventListener('click',()=>setMainView('home'));
byId('brand-home').addEventListener('click',()=>byId('side-home').click());
byId('dash-go-picker').addEventListener('click',()=>setMainView('select'));
byId('dash-open-wallet').addEventListener('click',()=>showDrawer(true));
byId('dash-user-switch').addEventListener('click',showProfileGate);byId('dash-edit-profile').addEventListener('click',()=>{showProfileGate();showProfileEditor('edit',S.selectedOwner);});
byId('dash-profiles').addEventListener('click',showProfileGate);

byId('dash-open-spend').addEventListener('click',()=>{byId('execution-panel').scrollIntoView({behavior:'smooth',block:'start'});});
byId('dash-budget-rows').addEventListener('click',e=>{
 const toggle=e.target.closest('[data-dash-expand]');
 if(toggle){const key=toggle.dataset.dashExpand;if(dashExpandedGroupDetails.has(key))dashExpandedGroupDetails.delete(key);else dashExpandedGroupDetails.add(key);renderDashboard();return;}
 const button=e.target.closest('[data-dash-key]');
 if(button&&!dashboardSample){const key=button.dataset.dashKey;renderDashboard();const filter=byId('ex-budget-filter');if(filter&&[...exBudgetRelevant()].includes(key)){filter.value=key;exPage=0;renderExecutionPanel();}byId('execution-panel').scrollIntoView({behavior:'smooth',block:'start'});return;}
 const g=e.target.closest('[data-dash-go-picker]');if(g)setMainView('select');
});
byId('dash-ledger').addEventListener('click',e=>{const b=e.target.closest('[data-dash-delete]');if(!b)return;const entry=S.spendingEntries.find(x=>x.id===b.dataset.dashDelete);if(!entry||!mine().some(a=>a.id===entry.allocId))return;if(confirm('이 수기 집행 기록을 삭제할까요?')){S.spendingEntries=S.spendingEntries.filter(x=>x.id!==entry.id);persist();renderDashboard();}});
byId('dash-spend-cancel').addEventListener('click',()=>byId('dash-spend-modal').classList.remove('open'));
byId('dash-spend-modal').addEventListener('click',e=>{if(e.target.id==='dash-spend-modal')e.currentTarget.classList.remove('open');});
byId('dash-spend-form').addEventListener('submit',e=>{e.preventDefault();saveDashboardSpend();});


// V22: Read-only source snapshot; manual allocation changes only a local mapping, not the source file.
const EX_SOURCE=JSON.parse(document.getElementById('execution-data').textContent);
const EX_ROWS=EX_SOURCE.rows;
const EX_GROUPS=new Map();const EX_ID=new Map();
for(const r of EX_ROWS){EX_ID.set(r.i,r);if(!EX_GROUPS.has(r.k))EX_GROUPS.set(r.k,[]);EX_GROUPS.get(r.k).push(r);}
let exPage=0,exModalRecord=null,exModalAllowMore=false;
function exShares(){S.executionShares=(Array.isArray(S.executionShares)?S.executionShares:[]).filter(x=>{const r=EX_ID.get(x.row);return r&&S.allocs.some(a=>a.id===x.allocId&&a.key===r.k)&&Number.isSafeInteger(x.amount);});return S.executionShares;}
function exPerCategory(key){return EX_GROUPS.get(key)||[];}
function exFullOwner(key){
 const b=MAP.get(key),allocs=S.allocs.filter(a=>a.key===key);
 return b&&allocs.length===1&&allocs[0].amount===b.won?allocs[0].id:null;
}
function exAssignedForRecord(r){return exShares().filter(s=>s.row===r.i).reduce((n,s)=>n+s.amount,0);}
function exRemainingForRecord(r){return Math.max(0,Math.abs(r.v||0)-exShares().filter(s=>s.row===r.i).reduce((n,s)=>n+Math.abs(s.amount),0));}
function exRecordSharesForAllocation(r,allocation){
 if(r.paid && exFullOwner(r.k)===allocation.id)return r.v||0;
 const shares=exShares().filter(s=>s.row===r.i);
 const minePart=shares.filter(s=>s.allocId===allocation.id).reduce((n,s)=>n+s.amount,0);
 if(minePart)return minePart;
 if(shares.length||!r.paid||!r.v)return 0;
 return exFullOwner(r.k)===allocation.id?r.v:0;
}
function exSpentForAllocation(allocId){
 const a=S.allocs.find(x=>x.id===allocId);if(!a)return {paid:0,pending:0,n:0,auto:false,manual:false};
 let paid=0,pending=0,n=0;const auto=exFullOwner(a.key)===a.id;
 for(const r of exPerCategory(a.key)){
   if(!reportRowIncluded(r))continue;
   const v=exRecordSharesForAllocation(r,a);if(!v)continue;
   if(r.paid){paid+=v;n++;}else pending+=v;
 }
 return {paid,pending,n,auto,manual:exShares().some(s=>s.allocId===allocId)};
}
function exBudgetRelevant(){return new Set(mine().map(a=>a.key));}
function exSourceSummary(){let k=exBudgetRelevant(),paid=0,n=0,pending=0;for(const key of k){for(const r of exPerCategory(key)){if(r.paid){paid+=r.v||0;n++;}else pending++;}}return {paid,n,pending};}
function exStatusForAllocation(a){return exSpentForAllocation(a.id);}
// The decision is personal to a team profile. Ignore records never mutate fiscal source data.
function exMyAssignedRows(){
 const myIds=new Set(mine().map(a=>a.id));
 return new Set(exShares().filter(x=>myIds.has(x.allocId)).map(x=>x.row));
}
function exIgnoredRows(){return new Set((S.executionIgnored||[]).filter(x=>x.owner===S.selectedOwner).map(x=>x.row));}
function exIsAuto(r){return !!exFullOwner(r.k);}
function exProfilePendingRows(){
 const relevant=exBudgetRelevant(),mineLinked=exMyAssignedRows(),ignored=exIgnoredRows();
 return EX_ROWS.filter(r=>relevant.has(r.k)&&!exIsAuto(r)&&exRemainingForRecord(r)>0&&!mineLinked.has(r.i)&&!ignored.has(r.i));
}
function exProfileHandledRows(){
 const relevant=exBudgetRelevant(),mineLinked=exMyAssignedRows(),ignored=exIgnoredRows();
 return EX_ROWS.filter(r=>relevant.has(r.k)&&!exIsAuto(r)&&(mineLinked.has(r.i)||ignored.has(r.i)));
}
function exProfileNeedsReview(){
 const pending=exProfilePendingRows();
 return {pendingPaid:pending.filter(r=>r.paid).length,missing:pending.filter(r=>!r.paid).length};
}
let exListMode='review';
function exSetListMode(mode){exListMode=mode==='handled'?'handled':'review';exPage=0;renderExecutionPanel();}
function exRecordActions(r,handled,myShares,ignored){
 if(!handled)return `<button type="button" data-ex-assign="${esc(r.i)}">내 예산 연결</button><button type="button" class="ex-ignore" data-ex-ignore="${esc(r.i)}" title="이 프로필의 알림 목록에서만 제외">내 지출 아님 · 무시</button>`;
 if(ignored)return `<button type="button" class="ex-restore" data-ex-restore="${esc(r.i)}">무시 취소 · 다시 확인</button>`;
 return (exRemainingForRecord(r)>0&&myShares.length?`<button type="button" data-ex-assign-more="${esc(r.i)}">남은 금액 추가 연결</button>`:'')+myShares.map(s=>`<button type="button" class="ex-release" data-ex-release="${esc(s.id)}">연결 해제 (${displayBudget(s.amount)})</button>`).join('');
}
function renderExecutionPanel(){
 const panel=byId('execution-panel');if(!panel)return;
 const relevant=exBudgetRelevant(),pending=exProfilePendingRows(),handled=exProfileHandledRows(),ignored=exIgnoredRows();
 const review=exProfileNeedsReview();
 byId('ex-review-count').textContent=fmt(pending.length)+'건';
 byId('ex-missing-count').textContent=fmt(review.missing)+'건';
 byId('ex-ignored-count').textContent=fmt([...ignored].filter(id=>EX_ID.has(id)).length)+'건';
 byId('ex-match-note').textContent=!relevant.size?'내 예산함에 예산을 먼저 담아 주세요. 예산에 해당하는 지출만 확인할 수 있습니다.':
   pending.length?`확인할 지출 ${fmt(pending.length)}건(지급정보 확인 ${fmt(review.pendingPaid)}건 · 미확인 ${fmt(review.missing)}건). 내 예산에 연결하거나 내 지출이 아니면 무시하세요. 자동 반영된 지출은 이 화면에 표시하지 않습니다.`:
   `현재 프로필의 미확인 지출을 모두 처리했어요. 연결과 무시 내역은 ‘내 처리 내역’에서 확인할 수 있어요. 다만 자료 기준일 이후의 지출은 이 목록에 포함되지 않을 수 있습니다.`;
 byId('ex-tab-review').classList.toggle('active',exListMode==='review');
 byId('ex-tab-review').setAttribute('aria-pressed',String(exListMode==='review'));
 byId('ex-tab-processed').classList.toggle('active',exListMode==='handled');
 byId('ex-tab-processed').setAttribute('aria-pressed',String(exListMode==='handled'));
 byId('ex-tab-review').textContent=`확인 필요한 지출 · ${fmt(pending.length)}`;
 byId('ex-tab-processed').textContent=`내 처리 내역 · ${fmt(handled.length)}`;
 const sel=byId('ex-budget-filter'),keep=sel.value;
 const options=[...relevant].map(k=>MAP.get(k)).filter(Boolean).sort((a,b)=>a.project.localeCompare(b.project,'ko'));
 const signature=options.map(b=>b.key).join('::');
 if(sel.dataset.budgetSignature!==signature){sel.innerHTML='<option value="">내 예산 전체</option>'+options.map(b=>`<option value="${esc(b.key)}">${esc(b.project)} · ${esc(b.code)}</option>`).join('');sel.dataset.budgetSignature=signature;sel.value=relevant.has(keep)?keep:'';}
 const state=byId('ex-state-filter').value,term=byId('ex-search').value.trim().toLowerCase();
 const eligible=exListMode==='review'?pending:handled;
 const filtered=eligible.filter(r=>(!sel.value||sel.value===r.k)&&(state==='all'||(state==='paid')===r.paid)&&(!term||(r.d||'').toLowerCase().includes(term)||(MAP.get(r.k)?.project||'').toLowerCase().includes(term)));
 filtered.sort((a,b)=>String(b.dt||b.propdate||'').localeCompare(String(a.dt||a.propdate||''))||String(b.i).localeCompare(String(a.i)));
 const pageSize=10,totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));exPage=Math.max(0,Math.min(totalPages-1,exPage));
 byId('ex-page-label').textContent=filtered.length?`${fmt(filtered.length)}건 · ${exPage+1}/${totalPages}쪽`:'0건';
 byId('ex-prev').disabled=exPage===0;byId('ex-next').disabled=exPage>=totalPages-1;
 const pageRows=filtered.slice(exPage*pageSize,(exPage+1)*pageSize);
 byId('ex-records').innerHTML=pageRows.length?pageRows.map(r=>{
  const b=MAP.get(r.k),myShares=exShares().filter(s=>s.row===r.i&&mine().some(a=>a.id===s.allocId)),remain=exRemainingForRecord(r);
  const isIgnored=ignored.has(r.i),status=exListMode==='review'?'확인 필요':isIgnored?'내 지출 아님':'내 예산 연결됨';
  const cl=exListMode==='review'?'ex-awaiting':isIgnored?'ex-ignored':'ex-handled';
  return `<div class="ex-record"><div class="ex-record-main"><b>${esc(r.d)}</b><small>${esc(b?.project||'')} · ${esc(b?.code||'')} · ${esc(r.dt||r.propdate||'')} · 원본 ${esc(String(r.i).replace('-', '쪽 '))}행 <span class="ex-linked ${cl}">${esc(status)}</span></small></div><div class="ex-record-amt">${displayBudget(r.v||0)}<small>${r.paid?'지급정보 확인':'지급정보 미확인 · '+esc(r.state||'처리중')}</small>${exListMode==='review'&&remain!==Math.abs(r.v||0)?`<small class="ex-remain">남은 연결 가능액 ${displayBudget(remain)}</small>`:''}</div><div class="ex-record-actions">${exRecordActions(r,exListMode==='handled',myShares,isIgnored)}</div></div>`;
 }).join(''):!relevant.size?'<div class="ex-empty">아직 내 예산이 없어요. 먼저 예산을 담아 주세요.</div>':exListMode==='review'&&!sel.value&&state==='all'&&!term?'<div class="ex-empty">✓ 지금 확인할 지출이 없습니다.<br>모든 연결·무시 처리 내역은 ‘내 처리 내역’에서 다시 볼 수 있어요.</div>':'<div class="ex-empty">이 조건에 해당하는 지출이 없습니다. 예산·상태·검색 조건을 변경해 보세요.</div>';
}
function exIgnore(id){
 const r=EX_ID.get(id);if(!r||!exBudgetRelevant().has(r.k)||!exProfilePendingRows().some(x=>x.i===id)){toast('이미 처리된 지출이거나 내 검토 대상이 아닙니다.');return;}
 S.executionIgnored=Array.isArray(S.executionIgnored)?S.executionIgnored:[];
 S.executionIgnored.push({row:id,owner:S.selectedOwner,at:now()});
 persist();renderDashboard();toast('내 지출이 아닌 건으로 무시했어요. 처리 내역에서 복구할 수 있어요.');
}
function exRestore(id){
 if(!exIgnoredRows().has(id))return;
 S.executionIgnored=S.executionIgnored.filter(x=>!(x.row===id&&x.owner===S.selectedOwner));
 persist();renderDashboard();toast('무시를 취소했어요. 확인 필요한 지출에 다시 표시됩니다.');
}
function exHandleRecordClick(e){
 const assign=e.target.closest('[data-ex-assign]'),more=e.target.closest('[data-ex-assign-more]'),ignore=e.target.closest('[data-ex-ignore]'),restore=e.target.closest('[data-ex-restore]'),release=e.target.closest('[data-ex-release]');
 if(assign)exOpenAssign(assign.dataset.exAssign);
 else if(more)exOpenAssign(more.dataset.exAssignMore,true);
 else if(ignore)exIgnore(ignore.dataset.exIgnore);
 else if(restore)exRestore(restore.dataset.exRestore);
 else if(release)exRelease(release.dataset.exRelease);
}
function exOpenAssign(id,allowMore=false){
 const r=EX_ID.get(id);if(!r)return;
 const own=mine().filter(a=>a.key===r.k),remain=exRemainingForRecord(r);
 if(!own.length||remain<=0||exIsAuto(r)||exIgnoredRows().has(r.i)||(!allowMore&&exMyAssignedRows().has(r.i))||(allowMore&&!exMyAssignedRows().has(r.i))){toast('이미 처리되었거나 검토할 수 없는 지출입니다.');return;}
 exModalAllowMore=allowMore;exModalRecord=r.i;
 byId('ex-modal-desc').textContent=`${r.d} · ${r.paid?'지급정보 확인':'지급정보 미확인'} · 결의금액 ${money(r.v||0)}`;
 byId('ex-modal-alloc').innerHTML=own.map(a=>`<option value="${esc(a.id)}">${esc(a.label)} (${displayBudget(a.amount)})</option>`).join('');
 byId('ex-modal-amount').value=String(remain);byId('ex-modal-amount').max=String(remain);byId('ex-modal-error').textContent='';
 byId('ex-assign-modal').classList.add('open');
}
function exCloseAssign(){exModalRecord=null;exModalAllowMore=false;byId('ex-assign-modal').classList.remove('open');}
function exCommitAssign(){
 const r=EX_ID.get(exModalRecord);if(!r)return;
 const alloc=S.allocs.find(a=>a.id===byId('ex-modal-alloc').value&&a.owner===S.selectedOwner&&a.key===r.k);
 const n=Number(byId('ex-modal-amount').value),rem=exRemainingForRecord(r);
 if(!alloc||exIsAuto(r)||exIgnoredRows().has(r.i)||(!exModalAllowMore&&exMyAssignedRows().has(r.i))){byId('ex-modal-error').textContent='내 예산 또는 이미 처리된 건인지 확인해 주세요.';return;}
 if(!Number.isSafeInteger(n)||n<=0||n>rem){byId('ex-modal-error').textContent='남은 결의금액 이하의 양의 정수를 입력해 주세요.';return;}
 exShares().push({id:uid(),row:r.i,allocId:alloc.id,amount:Math.sign(r.v||1)*n});
 persist();exCloseAssign();renderDashboard();toast('집행현황의 내 관리분에 연결했어요.');
}
function exRelease(id){
 const share=exShares().find(s=>s.id===id),alloc=S.allocs.find(a=>a.id===share?.allocId);
 if(!share||alloc?.owner!==S.selectedOwner)return;
 S.executionShares=S.executionShares.filter(s=>s.id!==id);persist();renderDashboard();toast('내 연결을 해제했어요.');
}
byId('ex-budget-filter').addEventListener('change',()=>{exPage=0;renderExecutionPanel();});
byId('ex-state-filter').addEventListener('change',()=>{exPage=0;renderExecutionPanel();});
byId('ex-search').addEventListener('input',()=>{exPage=0;renderExecutionPanel();});
byId('ex-prev').addEventListener('click',()=>{exPage--;renderExecutionPanel();});
byId('ex-next').addEventListener('click',()=>{exPage++;renderExecutionPanel();});
byId('ex-records').addEventListener('click',exHandleRecordClick);
byId('ex-tab-review').addEventListener('click',()=>exSetListMode('review'));
byId('ex-tab-processed').addEventListener('click',()=>exSetListMode('handled'));
byId('ex-modal-cancel').addEventListener('click',exCloseAssign);
byId('ex-modal-confirm').addEventListener('click',exCommitAssign);
byId('ex-assign-modal').addEventListener('click',e=>{if(e.target.id==='ex-assign-modal')exCloseAssign();});

// Team profile screen and owner badges (local-browser demonstration only).
byId('profile-picker-cards').addEventListener('click',e=>{const b=e.target.closest('[data-choose-profile]');if(b)pickProfile(b.dataset.chooseProfile);});
byId('profile-cards').addEventListener('click',e=>{
 if(Date.now()<profileSuppressClickUntil)return;
 const renameTeam=e.target.closest('[data-team-rename]');if(renameTeam){const team=teamById(renameTeam.dataset.teamRename);if(!team)return;const name=prompt('변경할 팀 이름을 입력해 주세요.',team.name)?.trim();if(name===undefined||name===team.name)return;if(!name||name.length>30||S.teams.some(t=>t!==team&&t.name===name)){toast('팀 이름을 확인해 주세요.');return;}team.name=name;saveTeamChanges(`팀 이름 변경: ${name}`);return;}
 const deleteTeam=e.target.closest('[data-team-delete]');if(deleteTeam){const team=teamById(deleteTeam.dataset.teamDelete);if(!team||team.members.length||S.teams.length===1)return;if(confirm(`빈 팀 '${team.name}'을 삭제할까요?`)){S.teams=S.teams.filter(t=>t!==team);saveTeamChanges(`${team.name} 삭제`);}return;}
 const edit=e.target.closest('[data-edit-profile]');if(edit){showProfileEditor('edit',edit.dataset.editProfile);return;}
 const wrap=e.target.closest('[data-drag-owner]');if(wrap){showProfileEditor('edit',wrap.dataset.dragOwner);return;}
});
byId('profile-cards').addEventListener('change',e=>{
 const role=e.target.closest('[data-team-admin]');if(role){const team=teamById(role.dataset.teamAdmin),next=role.value;if(!team||!team.members.includes(next)||team.admin===next)return;const previous=team.admin;team.admin=next;saveTeamChanges(`${team.name}: ${previous||'없음'} → ${next} 관리자`);toast(`${team.name} 자료관리자는 ${next}입니다.`);}
});
let draggedTeam=null,profileSuppressClickUntil=0;
function clearDragFeedback(){byId('profile-cards').querySelectorAll('.dragover,.dragging,.dropbefore,.dropafter').forEach(el=>el.classList.remove('dragover','dragging','dropbefore','dropafter'));}
function moveTeamBefore(sourceId,targetId,after=false){const from=S.teams.findIndex(t=>t.id===sourceId),to=S.teams.findIndex(t=>t.id===targetId);if(from<0||to<0||from===to)return false;const [team]=S.teams.splice(from,1);S.teams.splice(S.teams.findIndex(t=>t.id===targetId)+(after?1:0),0,team);return true;}
function placeDraggedAt(target,owner,teamId){
 const section=target?.closest('[data-team-id]');if(!section)return false;
 const before=target.closest('[data-drag-owner]')?.dataset.dragOwner||null;
 if(moveMemberToTeam(owner,section.dataset.teamId,before)){saveTeamChanges(`${owner} 팀/위치 변경`);toast('위치를 변경했어요.');return true;}
 return false;
}
byId('profile-cards').addEventListener('dragstart',e=>{
 const header=e.target.closest('[data-team-drag]');if(header){draggedTeam=header.dataset.teamDrag;draggedOwner=null;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','team:'+draggedTeam);header.classList.add('dragging');return;}
 const wrap=e.target.closest('[data-drag-owner]');if(!wrap)return;draggedOwner=wrap.dataset.dragOwner;draggedTeam=null;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedOwner);wrap.classList.add('dragging');
});
byId('profile-cards').addEventListener('dragover',e=>{
 if(!draggedOwner&&!draggedTeam)return;
 const target=e.target.closest('[data-team-id]');if(!target)return;
 e.preventDefault();e.dataTransfer.dropEffect='move';
 clearDragFeedback();
 target.classList.add('dragover');
 if(draggedTeam)target.classList.add('dropbefore');
 else{const wrap=e.target.closest('[data-drag-owner]');if(wrap&&wrap.dataset.dragOwner!==draggedOwner)wrap.classList.add('dropbefore');}
});
byId('profile-cards').addEventListener('drop',e=>{
 const target=e.target.closest('[data-team-id]');if(!target||(!draggedOwner&&!draggedTeam))return;e.preventDefault();
 const owner=draggedOwner,team=draggedTeam;draggedOwner=null;draggedTeam=null;clearDragFeedback();profileSuppressClickUntil=Date.now()+330;
 if(team){const bounds=target.getBoundingClientRect(),after=e.clientY>bounds.top+bounds.height/2;if(moveTeamBefore(team,target.dataset.teamId,after)){saveTeamChanges('팀 순서 변경');toast('팀 순서를 변경했어요.');}else renderProfileGate();return;}
 if(!placeDraggedAt(e.target,owner,target.dataset.teamId))renderProfileGate();
});
byId('profile-cards').addEventListener('dragend',()=>{draggedOwner=null;draggedTeam=null;clearDragFeedback();});
// Keyboard access: arrows reorder team members; up/down move between teams.
byId('profile-cards').addEventListener('keydown',e=>{
 const wrap=e.target.closest('[data-drag-owner]'),head=e.target.closest('[data-team-drag]');
 if(head&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();moveTeamStep(head.dataset.teamDrag,e.key==='ArrowUp'?-1:1);const next=byId('profile-cards').querySelector(`[data-team-drag="${CSS.escape(head.dataset.teamDrag)}"]`);next?.focus();return;}
 if(!wrap||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(e.key))return;
 e.preventDefault();const owner=wrap.dataset.dragOwner,team=teamFor(owner);if(!team)return;
 if(e.key==='Enter'){showProfileEditor('edit',owner);return;}
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){moveMemberStep(owner,e.key==='ArrowLeft'?-1:1);}
 else{const idx=S.teams.findIndex(t=>t.id===team.id),dest=S.teams[idx+(e.key==='ArrowUp'?-1:1)];if(dest&&moveMemberToTeam(owner,dest.id))saveTeamChanges(`${owner} 팀 이동`);}
 const next=[...byId('profile-cards').querySelectorAll('[data-drag-owner]')].find(x=>x.dataset.dragOwner===owner);next?.focus();
});
// Mobile: long press a card to drag across or within teams; avoids accidental scroll gestures.
let profileTouchPending=null,profileTouchActive=null,profileTouchTimer=null,profileTouchGhost=null;
function touchDragCleanup(){clearTimeout(profileTouchTimer);profileTouchPending=null;profileTouchActive=null;profileTouchGhost?.remove();profileTouchGhost=null;clearDragFeedback();}
byId('profile-cards').addEventListener('touchstart',e=>{
 if(e.touches.length!==1)return;const wrap=e.target.closest('[data-drag-owner]');if(!wrap||e.target.closest('button')&&!e.target.closest('[data-edit-profile]'))return;
 const t=e.touches[0];profileTouchPending={owner:wrap.dataset.dragOwner,x:t.clientX,y:t.clientY,wrap};
 clearTimeout(profileTouchTimer);profileTouchTimer=setTimeout(()=>{if(!profileTouchPending)return;profileTouchActive=profileTouchPending;profileTouchGhost=wrap.cloneNode(true);profileTouchGhost.classList.add('profile-touch-ghost');profileTouchGhost.removeAttribute('draggable');profileTouchGhost.style.width=wrap.offsetWidth+'px';document.body.appendChild(profileTouchGhost);profileTouchGhost.style.left=profileTouchActive.x+'px';profileTouchGhost.style.top=profileTouchActive.y+'px';wrap.classList.add('dragging');},360);
},{passive:true});
byId('profile-cards').addEventListener('touchmove',e=>{
 const t=e.touches[0];if(!t||!profileTouchPending)return;
 if(!profileTouchActive){if(Math.hypot(t.clientX-profileTouchPending.x,t.clientY-profileTouchPending.y)>10)touchDragCleanup();return;}
 e.preventDefault();profileTouchGhost.style.left=t.clientX+'px';profileTouchGhost.style.top=t.clientY+'px';clearDragFeedback();
 const under=document.elementFromPoint(t.clientX,t.clientY);const team=under?.closest('[data-team-id]');if(team){team.classList.add('dragover');const wrap=under.closest('[data-drag-owner]');if(wrap&&wrap.dataset.dragOwner!==profileTouchActive.owner)wrap.classList.add('dropbefore');}
},{passive:false});
byId('profile-cards').addEventListener('touchend',e=>{
 if(!profileTouchActive){touchDragCleanup();return;}
 e.preventDefault();const t=e.changedTouches[0],under=document.elementFromPoint(t.clientX,t.clientY),owner=profileTouchActive.owner;
 profileSuppressClickUntil=Date.now()+450;touchDragCleanup();if(!under||!placeDraggedAt(under,owner))renderProfileGate();
},{passive:false});
byId('profile-cards').addEventListener('touchcancel',touchDragCleanup,{passive:true});
byId('profile-add-open').addEventListener('click',()=>showProfileEditor('add'));
byId('profile-manage-open').addEventListener('click',openProfileManager);
byId('profile-manage-close').addEventListener('click',closeProfileManager);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!byId('profile-manager').hidden){if(byId('profile-create').classList.contains('show'))byId('profile-create').classList.remove('show');else closeProfileManager();}});
byId('profile-team-add-open').addEventListener('click',()=>{const box=byId('profile-team-add');box.hidden=!box.hidden;if(!box.hidden){byId('profile-team-new-name').value='';byId('profile-team-new-name').focus();}});
byId('profile-team-create').addEventListener('click',()=>createTeam(byId('profile-team-new-name').value));
byId('profile-team-new-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();createTeam(e.target.value);}});
byId('profile-team-cancel').addEventListener('click',()=>byId('profile-team-add').hidden=true);
byId('profile-create-cancel').addEventListener('click',()=>byId('profile-create').classList.remove('show'));
byId('profile-create-save').addEventListener('click',saveProfileChanges);
byId('profile-icon-choices').addEventListener('click',e=>{const b=e.target.closest('[data-avatar-choice]');if(b){profileIconChoice=b.dataset.avatarChoice;renderAvatarChoices();}});
byId('open-profile-picker').addEventListener('click',showProfileGate);
byId('team-legend').addEventListener('click',e=>{if(e.target.closest('[data-team-profile]'))showProfileGate();});
byId('side-highlight').addEventListener('click',()=>{showDrawer(false);setMainView('select');});

byId('side-recent').addEventListener('click',()=>{setMainView('select');goPage(lastVisitedPage);document.querySelector('#paper').scrollIntoView({behavior:'smooth',block:'center'});});
byId('prevbtn').addEventListener('click',()=>goPage(pg-1));byId('nextbtn').addEventListener('click',()=>goPage(pg+1));
byId('currentpage').addEventListener('change',e=>goPage(Number(e.target.value)-1));
byId('pagefirst').addEventListener('click',()=>goPage(0));byId('pagelast').addEventListener('click',()=>goPage(49));
byId('prevbtn-bottom').addEventListener('click',()=>goPage(pg-1));byId('nextbtn-bottom').addEventListener('click',()=>goPage(pg+1));
byId('currentpage-bottom').addEventListener('change',e=>goPage(Number(e.target.value)-1));
byId('pagefirst-bottom').addEventListener('click',()=>goPage(0));byId('pagelast-bottom').addEventListener('click',()=>goPage(IMAGES.length-1));
byId('paper').addEventListener('click',e=>{const stamp=e.target.closest('[data-owner-info]');if(stamp){toast('🔒 담당자 확정 예산 · '+stamp.dataset.ownerInfo);return;}let r=e.target.closest('[data-region]');if(r)toggleDraft(r.dataset.region)});
byId('editor-close').addEventListener('click',closeEditor);
byId('entry-submit').addEventListener('click',addPick);
byId('entry-all').addEventListener('click',()=>{if(picked)byId('entry-amount').value=rest(REGION.get(picked).budget)});
byId('entry-half').addEventListener('click',()=>{if(picked)byId('entry-amount').value=Math.floor(rest(REGION.get(picked).budget)*.5)});
byId('open-wallet').addEventListener('click',()=>showDrawer(true));byId('drawer-close').addEventListener('click',()=>showDrawer(false));
byId('veil').addEventListener('click',()=>{showBulk(false);closeDialog();showDrawer(false)});
byId('drawer-owner').addEventListener('change',e=>switchOwner(e.target.value));
byId('account-switch').addEventListener('change',e=>switchOwner(e.target.value));
byId('demo-reset').addEventListener('click',()=>{if(confirm('이 브라우저의 모든 시연 담당자·선택·확정 예산을 초기화할까요?')){S=fresh();persist();showDrawer(false);renderPage();toast('시연 데이터를 초기화했어요.');}});
byId('add-owner').addEventListener('click',()=>openDialog('add-owner'));
byId('drawer-list').addEventListener('click',e=>{let b=e.target.closest('[data-act]');if(!b)return;const id=b.dataset.id,a=S.allocs.find(x=>x.id===id);if(!a||a.owner!==S.selectedOwner)return;if(b.dataset.act==='unlock'||b.dataset.act==='lock'){a.locked=b.dataset.act==='lock';addHistory(a.locked?'관리분 재확정':'수정 허용',`${a.owner} · ${a.label}`);persist();renderDrawer();renderPage();toast(a.locked?'내 예산을 다시 확정·잠금했어요.':'현재 담당자에게만 수정이 허용됐어요.');return;}if(b.dataset.act==='goto'){const r=REGION.get(markedId(a));showDrawer(false);goPage((r?.page||MAP.get(a.key).page)-1);editorOpen(markedId(a))}else openDialog(b.dataset.act,id)});
byId('dialog-close').addEventListener('click',closeDialog);byId('dialog-cancel').addEventListener('click',closeDialog);byId('dialog-ok').addEventListener('click',doDialog);
byId('export-json').addEventListener('click',exportJson);byId('export-csv').addEventListener('click',csv);
byId('import-json').addEventListener('click',()=>byId('file-restore').click());byId('file-restore').addEventListener('change',e=>{importJson(e.target.files?.[0]);e.target.value=''})
window.addEventListener('keydown',e=>{if(e.key==='Escape'){showBulk(false);closeDialog();showDrawer(false);closeEditor()}else if(!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!drawer&&!dialog&&!bulk&&dashboardView==='select'){if(e.key==='ArrowLeft')goPage(Math.max(0,pg-1));if(e.key==='ArrowRight')goPage(Math.min(IMAGES.length-1,pg+1))}});

byId('amount-unit').value=S.amountUnit;
byId('amount-unit').addEventListener('change',e=>{S.amountUnit=e.target.value==='백만원'?'백만원':'천원';persist();updateAmountSidebar();});
byId('open-bulk').addEventListener('click',()=>showBulk(true));
byId('clear-draft').addEventListener('click',clearDraft);
byId('bulk-close').addEventListener('click',()=>showBulk(false));
byId('bulk-cancel').addEventListener('click',()=>showBulk(false));
byId('bulk-confirm').addEventListener('click',commitBulk);
byId('bulk-list').addEventListener('input',e=>{if(e.target.matches('input[data-i]')){bulkItems[Number(e.target.dataset.i)].amount=Number(e.target.value);validateBulk()}});
byId('bulk-list').addEventListener('click',e=>{
 const btn=e.target.closest('[data-remove]');if(!btn)return;
 const removed=bulkItems[Number(btn.dataset.remove)];if(!removed)return;
 const previousAmounts=new Map(bulkItems.map(item=>[item.id,item.amount]));
 // A bulk row may represent several canonical child lines. Remove the entire
 // row's selection, not merely the grouping ID, and preserve other edits.
 toggleDraft(removed.regionId);
 bulkItems=batchCandidates().map(item=>({...item,amount:previousAmounts.has(item.id)?previousAmounts.get(item.id):item.amount}));
 renderBulkItems();
});

// V25 — Source freshness and admin demonstration. This is a browser-local demo,
// not access control and not a replacement for the official finance system.
const SOURCE_OVERRIDE_KEY='ulju-budget-v25-execution-json-override';
const BUDGET_SOURCE_EDITION='2026년 제3회 추경 · 성립전 4차';
function isAdminOwner(){return teamFor(S.selectedOwner)?.admin===S.selectedOwner;}
function syncAdminAccess(){
 const el=byId('side-import');if(!el)return;
 const allowed=isAdminOwner();
 // An aria-disabled button is still focusable and clickable to explain WHY access is restricted.
 // Native disabled=true would prevent the explanatory click handler from running.
 el.hidden=false;
 el.disabled=false;
 el.classList.toggle('access-locked',!allowed);
 el.setAttribute('aria-disabled',String(!allowed));
 el.setAttribute('aria-label',allowed?'집행자료 업데이트':'집행자료 업데이트 (자료관리자 전용)');
 el.title=allowed?'누적 엑셀 업데이트':'자료관리자만 이용할 수 있습니다';
 // This is UI separation in a local-only HTML demo, not protected authentication.
 if(!allowed){
  const modal=byId('v32-modal');if(modal&&!modal.hidden){modal.hidden=true;document.body.classList.remove('v32-open');}
  el.classList.remove('active');
 }
}
const padDate=(v)=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?String(v).replaceAll('-','.')+'.':String(v||'기준일 미상');
function renderSourceStatus(){
 document.querySelectorAll('[data-snapshot-budget]').forEach(e=>e.textContent=BUDGET_SOURCE_EDITION);
 document.querySelectorAll('[data-snapshot-execution]').forEach(e=>e.textContent=padDate(EX_SOURCE.asof));
 const budgetChoice=byId('budget-snapshot-select'), executionChoice=byId('execution-snapshot-select');
 if(budgetChoice) budgetChoice.options[0].textContent=BUDGET_SOURCE_EDITION;
 if(executionChoice) executionChoice.options[0].textContent=padDate(EX_SOURCE.asof);
 syncAdminAccess();

}
function rebuildExecutionIndexes(){
 EX_ID.clear();EX_GROUPS.clear();
 for(const r of EX_ROWS){EX_ID.set(r.i,r);if(!EX_GROUPS.has(r.k))EX_GROUPS.set(r.k,[]);EX_GROUPS.get(r.k).push(r);}
}
function validateExecutionJson(src){
 if(!src||typeof src!=='object'||!/^\d{4}-\d{2}-\d{2}$/.test(src.asof||'')||!Array.isArray(src.rows))throw Error('asof(YYYY-MM-DD)와 rows 배열이 필요합니다.');
 if(src.rows.length===0||src.rows.length>50000)throw Error('행 수는 1~50,000건 사이여야 합니다.');
 const seen=new Set();const cleaned=[];
 for(const [index,item] of src.rows.entries()){
  if(!item||typeof item!=='object'||!item.k||!MAP.has(item.k)||item.i===undefined||item.i===null||!Number.isSafeInteger(Number(item.v))||Math.abs(Number(item.v))>1e14)throw Error(`${index+1}번째 집행자료의 사업·통계목, 번호 또는 금액이 올바르지 않습니다.`);
  const i=String(item.i);if(seen.has(i))throw Error('중복된 집행자료 번호가 있습니다: '+i);seen.add(i);
  cleaned.push({...item,i,k:String(item.k),d:String(item.d||''),v:Number(item.v),a:Number.isFinite(Number(item.a))?Number(item.a):Number(item.v),dt:String(item.dt||''),paid:item.paid===true,state:String(item.state||'')});
 }
 return {asof:src.asof,rows:cleaned};
}
function useExecutionSnapshot(p,save=false,resetDecisions=true){
 const snapshot=validateExecutionJson(p);
 if(save){localStorage.setItem(SOURCE_OVERRIDE_KEY,JSON.stringify(snapshot));}
 EX_SOURCE.asof=snapshot.asof;EX_ROWS.splice(0,EX_ROWS.length,...snapshot.rows);
 rebuildExecutionIndexes();
 if(resetDecisions){S.executionShares=[];S.executionIgnored=[];}
 persist();exPage=0;exListMode='review';renderSourceStatus();renderDashboard();
}
try{const stored=localStorage.getItem(SOURCE_OVERRIDE_KEY);if(stored)useExecutionSnapshot(JSON.parse(stored),false,false);}
catch(e){try{localStorage.removeItem(SOURCE_OVERRIDE_KEY)}catch(_){}console.warn('Stored execution snapshot was ignored:',e);}
renderSourceStatus();

renderPage();renderDashboard();renderProfileGate();refreshCurrentTeamLabels();

// V28 extends the V27 review-first dashboard. Existing fiscal records and save keys are unchanged.
let simpleProjectName=null;
let simpleStatKey=null;
let statLedgerMonth=null; // null = every month
let statLedgerYear=null;
let statLedgerPage=0;
const STAT_LEDGER_PAGE_SIZE=12;
function renderReviewQuick(){
 const title=byId('review-quick-title');if(!title)return;
 const pending=exProfilePendingRows(),own=mine(),paid=pending.filter(r=>r.paid).length;
 const description=byId('review-quick-description'),preview=byId('review-quick-items'),done=byId('review-quick-done'),action=byId('review-quick-open');
 if(!own.length){
  title.textContent='내 예산을 먼저 담아 주세요';
  description.textContent='예산서에서 담당 예산을 선택하면, 연결이 필요한 지출만 이곳에 나타납니다.';
  preview.innerHTML='';done.hidden=true;action.textContent='예산 선택하러 가기';return;
 }
 action.textContent=pending.length?'미확인 지출 모두 보기':'처리 내역 확인';
 if(!pending.length){
  title.textContent='현재 미확인 지출 0건';
  description.textContent='현재 자료 기준으로 자동 연결 외에 판단할 지출이 남지 않았어요.';
  preview.innerHTML='';done.hidden=false;
  done.textContent='✓ 미확인 지출 정리 완료 · 이후 집행자료가 갱신되면 새 항목이 나타날 수 있습니다. 공식 잔액은 별도로 확인해 주세요.';return;
 }
 done.hidden=true;
 title.innerHTML=`내가 확인할 지출 <strong>${fmt(pending.length)}건</strong>`;
 description.textContent=`지급정보 확인 ${fmt(paid)}건 · 지급정보 미확인 ${fmt(pending.length-paid)}건 · 내 예산에 연결하거나 내 지출이 아니면 무시하세요.`;
 const rows=pending.slice().sort((a,b)=>String(b.dt||b.propdate||'').localeCompare(String(a.dt||a.propdate||''))||String(b.i).localeCompare(String(a.i))).slice(0,3);
 preview.innerHTML=rows.map(r=>{const b=MAP.get(r.k);return `<div class="review-quick-item"><span><b>${esc(r.d)}</b><small>${esc(b?.project||'')} · ${esc(b?.code||'')} · ${esc(r.dt||r.propdate||'')} · ${r.paid?'지급정보 확인':'지급정보 미확인'}</small></span><span class="rq-amount">${displayBudget(r.v||0)}</span><span class="rq-actions"><button type="button" data-ex-assign="${esc(r.i)}">예산 연결</button><button type="button" class="rq-ignore" data-ex-ignore="${esc(r.i)}">내 지출 아님 · 무시</button></span></div>`}).join('');
}
function openReviewFromQuick(){
 if(!mine().length){setMainView('select');return;}
 exSetListMode(exProfilePendingRows().length?'review':'handled');
 showSimpleExecution();
}
byId('review-quick-open').addEventListener('click',openReviewFromQuick);
byId('review-quick-items').addEventListener('click',exHandleRecordClick);
function renderSimpleDashboard(){
 renderReviewQuick();
 const root=byId('simple-overview');if(!root)return;
 const rows=viewDashboardRows();
 const groups=groupDashboardByProject(rows);
 const total=rows.reduce((n,r)=>n+r.amount,0);
 const spent=rows.reduce((n,r)=>n+r.spent,0);
  const allConnected=dashboardSample||(rows.length>0&&reportPendingRows().length===0);
 const hasAny=rows.some(r=>r.hasSpending)||allConnected;
  const moneyFmt=n=>displayBudget(n);
  byId('report-date').value=reportAsOfDate||'';
  byId('report-source-stamp').textContent=`집행자료 ${reportLabel(EX_SOURCE.asof)} 기준`;
  byId('report-date-status').textContent=dashboardSample?'시연 예시의 금액에는 실제 날짜 정보가 없어 날짜 필터가 적용되지 않습니다.':reportAsOfDate?`${reportLabel(reportAsOfDate)} 당일까지의 누적 지출만 집행액·잔액·집행률에 반영합니다. 예산은 현재 관리금액을 기준으로 합니다.`:'전체 기간의 지급정보 확인 결의액을 표시합니다. 날짜를 선택하면 그날까지의 누적 집행현황으로 바뀝니다.';
  byId('report-date-warning').hidden=!reportWarningText();
  byId('report-date-warning').textContent=reportWarningText();
  byId('simple-total').textContent=moneyFmt(total);
 byId('simple-rate').textContent=total>0&&hasAny?(100*spent/total).toFixed(1)+'%':'—';
 byId('simple-balance').textContent=allConnected?moneyFmt(total-spent):'—';
 byId('simple-rate-caption').textContent=dashboardSample?'가상 집행액 · 시연 예시':!rows.length?'내 예산을 먼저 담아 주세요':!hasAny?'미확인 지출 연결 후 계산':allConnected?(reportAsOfDate?'기준일 이전 미확인 지출 0건 · 참고':'미확인 지출 0건 · 결의액 참고'):(reportAsOfDate?'기준일 이전 확인된 지출만 반영':'확인된 지출만 일부 반영');
 byId('simple-balance-caption').textContent=dashboardSample?'가상 참고 잔액':allConnected?(reportAsOfDate?'기준일 대상 검토 완료 · 공식 잔액 아님':'검토 완료 · 공식 잔액 아님'):'미확인 지출 연결 후 확인';
 byId('simple-rate-mark').hidden=allConnected||!rows.length;
 byId('simple-bar').style.width=total>0&&hasAny?Math.min(100,Math.max(0,100*spent/total))+'%':'0%';
 
 const box=byId('simple-projects');
 box.innerHTML=groups.length?groups.map((proj,i)=>{
  const codes=[...new Set(proj.groups.map(g=>g.code+' '+g.statName))];
  const caption=codes.slice(0,2).join(' · ')+(codes.length>2?' 외 '+(codes.length-2)+'개':'');
  const head=`<button type="button" class="simple-project" data-simple-project="${i}" aria-label="${esc(proj.name)} 예산 상세 보기"><span><span class="simple-project-title">${esc(proj.name)}</span><span class="simple-project-code">${esc(caption)}</span></span><span class="simple-project-right"><span class="simple-project-sum">${moneyFmt(proj.amount)}<small>${reportAsOfDate?'기준일 누적 집행':'확인 집행'} ${moneyFmt(proj.spent)}</small></span><span class="simple-project-chevron" aria-hidden="true">›</span></span></button>`;
  if(!simpleBudgetEditMode)return head;
  const projectCanRemove=proj.groups.some(g=>g.items.some(item=>item.alloc?.owner===S.selectedOwner));
  const projectMinus=projectCanRemove?`<button type="button" class="simple-remove-minus" data-simple-remove-project="${i}" aria-label="${esc(proj.name)} 세부사업 전체 담기 해제" title="이 세부사업의 내 예산 전체 해제">−</button>`:'';
  const subrows=proj.groups.map((g,j)=>{
   const removable=g.items.some(item=>item.alloc?.owner===S.selectedOwner);
   const minus=removable?`<button type="button" class="simple-remove-minus" data-simple-remove-project="${i}" data-simple-remove-stat="${j}" aria-label="${esc(g.code+' '+g.statName)} 통계목 담기 해제" title="이 통계목만 담기 해제">−</button>`:'<span class="simple-remove-placeholder" aria-hidden="true"></span>';
   return `<div class="simple-stat-removal-row">${minus}<span class="simple-stat-removal-name"><strong>${esc(g.code+' '+g.statName)}</strong><small>내 관리 항목 ${g.items.length}개</small></span><strong class="simple-stat-removal-money">${moneyFmt(g.amount)}</strong></div>`;
  }).join('');
  return `<div class="simple-project-edit-group"><div class="simple-project-edit-head">${projectMinus}${head}</div><div class="simple-stat-removal-list">${subrows}</div></div>`;
 }).join(''):`<div class="simple-empty"><strong>아직 담은 예산이 없어요.</strong>예산서에서 내 담당 예산을 선택해 주세요.<br><button type="button" data-simple-picker>예산 선택·변경</button></div>`;
 // Update an open detail after allocation, team, or snapshot changes, while retaining drilldown.
 if(!byId('simple-modal').hidden&&simpleProjectName){
  const current=groups.find(p=>p.name===simpleProjectName);
  if(current)fillSimpleDetail(current);else closeSimpleDetail();
 }
}
// A paid transaction contributes exactly the same share as the existing dashboard does.
// Manual spendingEntries are retained by the app but intentionally not double-counted.
function statLedgerRows(g){
 if(g.isDemo)return [];
 const allocs=g.items.map(row=>row.alloc).filter(Boolean);
  return exPerCategory(g.key).filter(reportRowIncluded).map(r=>{
   let amount=0;
  for(const allocation of allocs)amount+=exRecordSharesForAllocation(r,allocation);
  if(!amount)return null;
   return {id:r.i,date:reportRowDate(r),desc:r.d||'(적요 없음)',amount,paid:!!r.paid};
 }).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
}
function statYearOf(date){const m=/^(\d{4})-(\d{2})-\d{2}$/.exec(date||'');return m&&Number(m[2])>=1&&Number(m[2])<=12?Number(m[1]):null;}
function statMonthOf(date){return statYearOf(date)?Number(date.slice(5,7)):null;}
function statCompactAmount(n){
 if(n===0)return '0';
 const sign=n<0?'−':'',v=Math.abs(n);
 if(v>=100000000)return sign+(v/100000000).toLocaleString('ko-KR',{maximumFractionDigits:1})+'억';
 if(v>=10000)return sign+(v/10000).toLocaleString('ko-KR',{maximumFractionDigits:1})+'만';
 return sign+fmt(v);
}
function fillSimpleStatDetail(project,g){
 const entries=statLedgerRows(g);
 const yearFromSnapshot=Number(String(EX_SOURCE.asof||'').slice(0,4));
  const chosenYear=reportAsOfDate?Number(reportAsOfDate.slice(0,4)):yearFromSnapshot;
  const years=[...new Set(entries.map(r=>statYearOf(r.date)).filter(Boolean).concat(Number.isInteger(chosenYear)&&chosenYear>1900?[chosenYear]:[]))].sort((a,b)=>b-a);
 if(!years.length)years.push(new Date().getFullYear());
 if(!years.includes(statLedgerYear))statLedgerYear=years[0];
 const paidEntries=entries.filter(r=>r.paid);
 const unpaidEntries=entries.filter(r=>!r.paid);
  const unreviewed=g.isDemo?0:reportPendingRows().filter(r=>r.k===g.key).length;
 const balance=g.amount-g.spent,rate=g.amount>0?100*g.spent/g.amount:0;
 byId('simple-modal-eyebrow').textContent=project.name+' · 통계목별 상세';
 byId('simple-modal-title').textContent=g.code+' '+g.statName;
 const action=byId('simple-execution-from-modal');
 action.textContent=g.isDemo?'시연 예시':unreviewed?'이 통계목의 미확인 지출 연결':'이 통계목 집행내역 확인';
 action.disabled=!!g.isDemo;
 action.title=g.isDemo?'시연 예시는 실제 결의자료가 없습니다.':'';
 const monthly=Array.from({length:12},()=>0);
 for(const r of paidEntries){if(statYearOf(r.date)===statLedgerYear)monthly[statMonthOf(r.date)-1]+=r.amount;}
 const monthMax=Math.max(1,...monthly.map(Math.abs));
 const shown=entries.filter(r=>statYearOf(r.date)===statLedgerYear&&(statLedgerMonth===null||statMonthOf(r.date)===statLedgerMonth));
 const paidShown=shown.filter(r=>r.paid),paidShownTotal=paidShown.reduce((a,r)=>a+r.amount,0);
 const pages=Math.max(1,Math.ceil(shown.length/STAT_LEDGER_PAGE_SIZE));
 statLedgerPage=Math.min(Math.max(0,statLedgerPage),pages-1);
 const items=shown.slice(statLedgerPage*STAT_LEDGER_PAGE_SIZE,(statLedgerPage+1)*STAT_LEDGER_PAGE_SIZE);
 const percentage=g.amount>0?Math.max(0,Math.min(100,rate)):0;
 const monthButtons=monthly.map((amount,i)=>{
  const month=i+1,active=statLedgerMonth===month;
  const height=amount?Math.max(6,Math.round(Math.abs(amount)/monthMax*118)):2;
  return `<button type="button" class="stat-month ${active?'active':''}" data-stat-month="${month}" aria-pressed="${active}" title="${month}월 지급정보 확인 결의액 ${esc(money(amount))}"><span class="stat-month-barbox"><i class="stat-month-bar ${amount<0?'negative':amount===0?'zero':''}" style="height:${height}px"></i></span><span class="stat-month-label">${month}월</span><span class="stat-month-amount">${esc(statCompactAmount(amount))}</span></button>`;
 }).join('');
 byId('simple-modal-body').innerHTML=`
 <button class="stat-back" type="button" data-stat-back>← ${esc(project.name)}의 통계목 목록</button>
  <p class="stat-subtitle">내 담당 예산만 계산한 통계목 현황입니다. 다른 담당자의 예산·결의액은 포함하지 않습니다.</p>
  <div class="stat-report-panel"><div class="stat-report-controls"><label for="stat-report-date">집행 조회 기준일</label><input id="stat-report-date" data-report-asof-input type="date" value="${esc(reportAsOfDate||'')}" aria-label="통계목 집행 조회 기준일"><button type="button" class="report-apply" data-report-asof-apply>조회</button><button type="button" data-report-asof-reset>전체 기간</button></div><p class="stat-report-description"><span class="report-date-strong">${reportAsOfDate?esc(reportLabel(reportAsOfDate))+'까지 누적':'전체 기간'}</span> · 선택한 날짜 당일까지의 지급정보 확인 결의액을 합산합니다. 예산은 현재 담은 관리금액입니다.</p>${reportWarningText()?`<p class="report-date-warning">${esc(reportWarningText())}</p>`:''}</div>
  <div class="stat-kpis" aria-label="통계목 예산·집행·잔액·집행률">
   <div class="stat-kpi"><span>현재 내 관리 예산</span><strong>${displayBudget(g.amount)}</strong><small>${esc(money(g.amount))}</small></div>
  <div class="stat-kpi stat-spent"><span>확인된 집행액</span><strong>${displayBudget(g.spent)}</strong><small>지급정보 확인 ${fmt(paidEntries.length)}건</small></div>
  <div class="stat-kpi"><span>참고 잔액</span><strong>${displayBudget(balance)}</strong><small>예산 − 확인 집행액</small></div>
  <div class="stat-kpi stat-rate"><span>참고 집행률</span><strong>${rate.toFixed(1)}%</strong><small>관리 예산 대비</small></div>
 </div>
 <div class="stat-progress" role="progressbar" aria-label="집행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage.toFixed(1)}"><span style="width:${percentage.toFixed(1)}%"></span></div>
 ${unreviewed?`<p class="stat-attention">⚠ 이 통계목에 연결 확인이 필요한 지출 ${fmt(unreviewed)}건이 있어요. 아래 집행액과 잔액은 아직 달라질 수 있습니다.</p>`:''}
 ${unpaidEntries.length?`<p class="stat-attention">지급정보가 확인되지 않은 연결 내역 ${fmt(unpaidEntries.length)}건은 집행액·월별 그래프에 합산하지 않았습니다.</p>`:''}
  <p class="stat-note">${g.isDemo?'시연 수치는 날짜별 원본 결의자료가 없어 월별 및 건별 내역을 표시하지 않습니다.':'자료에 기록된 결의 날짜를 조회 기준으로 사용합니다(실제 이체·지급일과 다를 수 있음). 선택 기준일 이후 지출은 모든 합계와 그래프에서 제외합니다. 과거 예산 배분 변경은 재구성하지 않으므로 잔액·집행률은 현재 관리 예산을 분모로 한 참고값이며 공식 회계잔액과 다를 수 있습니다.'}</p>
 <section class="stat-section" aria-label="월별 지출 그래프">
  <div class="stat-section-head"><h3>월별 지출현황</h3><select class="stat-year-select" data-stat-year aria-label="집행연도 선택">${years.map(y=>`<option value="${y}" ${y===statLedgerYear?'selected':''}>${y}년</option>`).join('')}</select></div>
  <p class="stat-section-sub">막대를 누르면 해당 월의 건별 내역만 볼 수 있습니다. 금액은 지급정보 확인 결의액입니다.</p>
  <div class="stat-chart" role="group" aria-label="${statLedgerYear}년 월별 집행액">${monthButtons}</div>
  <div class="stat-chart-actions"><button type="button" class="stat-filter-all ${statLedgerMonth===null?'active':''}" data-stat-month="all" aria-pressed="${statLedgerMonth===null}">전체 월 보기</button><span class="stat-month-summary">${statLedgerMonth===null?'연간':statLedgerMonth+'월'} ${fmt(paidShown.length)}건 · ${esc(money(paidShownTotal))}</span></div>
 </section>
 <section class="stat-section" aria-label="건별 지출 내역">
  <div class="stat-section-head"><h3>건별 집행내역</h3><span class="stat-month-summary">${statLedgerYear}년${statLedgerMonth===null?' 전체':' '+statLedgerMonth+'월'} · ${fmt(shown.length)}건</span></div>
  <p class="stat-section-sub">날짜 내림차순 · 연결된 내 담당 결의액만 표시 · 지급정보 미확인 건은 별도 표시</p>
  <div class="stat-ledger"><div class="stat-ledger-heading"><span>자료상 날짜</span><span>지출 적요</span><span style="text-align:right">내 예산 반영 금액</span></div>
  ${items.length?items.map(r=>`<div class="stat-ledger-item ${r.paid?'':'unpaid'}"><span class="stat-ledger-date">${esc(r.date||'미기재')}</span><span class="stat-ledger-description">${esc(r.desc)}<small>${esc(r.id)} · ${r.paid?'지급정보 확인':'지급정보 미확인 · 집행액 제외'}</small></span><span class="stat-ledger-money">${esc(money(r.amount))}</span></div>`).join(''):'<div class="stat-ledger-empty">선택한 기간에 내 예산에 반영된 지출이 없습니다.<br>미확인 지출이 있다면 아래에서 예산에 연결해 주세요.</div>'}
  </div>
  ${shown.length>STAT_LEDGER_PAGE_SIZE?`<div class="stat-ledger-pager"><button type="button" data-stat-page="prev" ${statLedgerPage===0?'disabled':''}>이전</button><span>${statLedgerPage+1} / ${pages}쪽</span><button type="button" data-stat-page="next" ${statLedgerPage>=pages-1?'disabled':''}>다음</button></div>`:''}
 </section>`;
}
function fillSimpleDetail(project){
 const groups=project.groups;
 if(simpleStatKey!==null){const target=groups.find(g=>g.key===simpleStatKey);if(target){fillSimpleStatDetail(project,target);return;}simpleStatKey=null;}
  const projectKeys=new Set(groups.map(g=>g.key));
  const allConnected=dashboardSample||(groups.length>0&&!reportPendingRows().some(r=>projectKeys.has(r.k)));
  const anyConnected=groups.some(g=>g.hasSpending)||allConnected;
 const spent=groups.reduce((n,g)=>n+g.spent,0);
 const fmtMoney=n=>displayBudget(n);
 byId('simple-modal-eyebrow').textContent='세부사업 예산현황';
 byId('simple-modal-title').textContent=project.name;
 byId('simple-execution-from-modal').textContent='집행내역 연결하기';
 byId('simple-execution-from-modal').disabled=dashboardSample;
  byId('simple-modal-body').innerHTML=`<div class="stat-report-panel"><div class="stat-report-controls"><label for="stat-report-date">집행 조회 기준일</label><input id="stat-report-date" data-report-asof-input type="date" value="${esc(reportAsOfDate||'')}" aria-label="세부사업 집행 조회 기준일"><button type="button" class="report-apply" data-report-asof-apply>조회</button><button type="button" data-report-asof-reset>전체 기간</button></div><p class="stat-report-description"><span class="report-date-strong">${reportAsOfDate?esc(reportLabel(reportAsOfDate))+'까지 누적':'전체 기간'}</span> · 집행액은 해당 날짜까지, 예산은 현재 관리 예산 기준입니다.</p>${reportWarningText()?`<p class="report-date-warning">${esc(reportWarningText())}</p>`:''}</div><div class="simple-detail-summary"><div class="simple-detail-card"><span>관리 예산</span><strong>${fmtMoney(project.amount)}</strong></div><div class="simple-detail-card"><span>연결된 결의액</span><strong>${anyConnected?fmtMoney(spent):'—'}</strong></div><div class="simple-detail-card"><span>참고 잔액</span><strong>${allConnected?fmtMoney(project.amount-spent):'—'}</strong></div></div><p class="simple-detail-note">${dashboardSample?'가상 시연 수치입니다.':allConnected?'지급정보 확인 결의액 기준 · 공식 잔액은 별도 확인':anyConnected?'일부 지출은 담당자 확인이 필요합니다.':'아직 연결된 집행내역이 없거나 담당자별 귀속 확인이 필요합니다.'} · 통계목을 누르면 월별·건별 집행 내역을 확인할 수 있어요.</p><div class="simple-detail-list">${groups.map(g=>{
   const connected=dashboardSample||!reportPendingRows().some(r=>r.k===g.key);
  const names=g.items.map(r=>r.label).filter(Boolean);
  const differentOwners=g.others||[];
  const otherNames=[...new Set(differentOwners.map(a=>a.owner))];
  return `<button type="button" class="simple-stat-select" data-simple-stat="${esc(g.key)}" aria-label="${esc(g.code+' '+g.statName)} 월별·건별 지출 상세"><span><span class="simple-detail-item-title"><span class="simple-detail-code">${esc(g.code)}</span>${esc(g.statName)}</span><span class="simple-detail-item-sub">${esc(names.slice(0,2).join(' · '))}${names.length>2?' 외 '+(names.length-2)+'건':''}${otherNames.length?' · 공동 관리: '+esc(otherNames.join(', ')):''}</span></span><span style="display:flex;align-items:center;gap:6px"><span class="simple-detail-item-value">${fmtMoney(g.amount)}<small>${connected?'확인액 '+fmtMoney(g.spent):'집행 확인 필요'}</small></span><span class="simple-stat-chevron" aria-hidden="true">›</span></span></button>`;
 }).join('')}</div>`;
}
function openSimpleDetail(index){
 const groups=groupDashboardByProject(viewDashboardRows());
 const project=groups[index];if(!project)return;
 simpleProjectName=project.name;simpleStatKey=null;statLedgerMonth=null;statLedgerYear=null;statLedgerPage=0;
 fillSimpleDetail(project);
 byId('simple-modal').hidden=false;
 byId('simple-close').focus();
}
function closeSimpleDetail(){byId('simple-modal').hidden=true;simpleProjectName=null;simpleStatKey=null;statLedgerMonth=null;statLedgerYear=null;statLedgerPage=0;}
function rerenderSimpleOpenDetail(){
 if(!simpleProjectName)return;
 const project=groupDashboardByProject(viewDashboardRows()).find(p=>p.name===simpleProjectName);
 if(!project){closeSimpleDetail();return;}
 fillSimpleDetail(project);
}
function showSimpleExecution(){
 const key=!dashboardSample?simpleStatKey:null;
 closeSimpleDetail();setMainView('home');
 byId('dashboard-home').classList.add('show-execution');
 byId('side-execution').classList.add('active');
 byId('side-home').classList.remove('active');
 if(key){exSetListMode(exProfilePendingRows().some(r=>r.k===key)?'review':'handled');}
 renderExecutionPanel();
 if(key&&exBudgetRelevant().has(key)){byId('ex-budget-filter').value=key;exPage=0;renderExecutionPanel();}
 byId('execution-panel').scrollIntoView({behavior:'smooth',block:'start'});
}
// v70 — edit inside the existing project rows; no extra management panel.
let simpleBudgetEditMode=false;
byId('simple-budget-gear').addEventListener('click',()=>{
 simpleBudgetEditMode=!simpleBudgetEditMode;
 const gear=byId('simple-budget-gear');
 gear.setAttribute('aria-pressed',String(simpleBudgetEditMode));
 gear.setAttribute('aria-expanded',String(simpleBudgetEditMode));
 gear.title=simpleBudgetEditMode?'예산 해제 모드 끄기':'예산 해제 모드 켜기';
 renderSimpleDashboard();
});
function simpleRemoveOwnBudget(projectIndex,statIndex){
 if(!simpleBudgetEditMode)return;
 const projects=groupDashboardByProject(viewDashboardRows());
 const project=projects[projectIndex];
 if(!project)return;
 const g=statIndex===null?null:project.groups[statIndex];
 if(statIndex!==null&&!g)return;
 const chosen=g?[g]:project.groups;
 const ids=new Set(chosen.flatMap(group=>group.items.map(item=>item.alloc?.id).filter(Boolean)));
 const owned=S.allocs.filter(a=>a.owner===S.selectedOwner&&ids.has(a.id));
 if(!owned.length){toast('해제할 내 예산 항목이 없어요.');return;}
 // Immediate removal affects only the current owner's allocations. Underlying source budgets stay intact.
 const total=owned.reduce((sum,a)=>sum+a.amount,0);
 const label=g?`${project.name} · ${g.code} ${g.statName}`:project.name;
 S.allocs=S.allocs.filter(a=>!(a.owner===S.selectedOwner&&ids.has(a.id)));
 addHistory('담기 해제',`${label} · ${owned.length}개 · ${money(total)}`);
 persist();
 renderPage();
 toast(`${g?'통계목':'세부사업'} 내 예산 ${owned.length}건을 해제했어요.`);
}

byId('simple-projects').addEventListener('click',e=>{
 const minus=e.target.closest('[data-simple-remove-project]');
 if(minus){
  const projectIndex=Number(minus.dataset.simpleRemoveProject);
  const statIndex=minus.hasAttribute('data-simple-remove-stat')?Number(minus.dataset.simpleRemoveStat):null;
  simpleRemoveOwnBudget(projectIndex,statIndex);
  return;
 }
 const pick=e.target.closest('[data-simple-picker]');if(pick){setMainView('select');return;}
 const row=e.target.closest('[data-simple-project]');if(row)openSimpleDetail(Number(row.dataset.simpleProject));
});
byId('simple-modal-body').addEventListener('click',e=>{
 const stat=e.target.closest('[data-simple-stat]');
 if(stat){simpleStatKey=stat.dataset.simpleStat;statLedgerMonth=null;statLedgerPage=0;rerenderSimpleOpenDetail();byId('simple-modal').querySelector('.simple-dialog').scrollTop=0;return;}
 if(e.target.closest('[data-stat-back]')){simpleStatKey=null;statLedgerMonth=null;statLedgerPage=0;rerenderSimpleOpenDetail();byId('simple-modal').querySelector('.simple-dialog').scrollTop=0;return;}
 const month=e.target.closest('[data-stat-month]');
 if(month){statLedgerMonth=month.dataset.statMonth==='all'?null:Number(month.dataset.statMonth);statLedgerPage=0;rerenderSimpleOpenDetail();return;}
 const page=e.target.closest('[data-stat-page]');
  if(page){statLedgerPage=Math.max(0,statLedgerPage+(page.dataset.statPage==='next'?1:-1));rerenderSimpleOpenDetail();return;}
  if(e.target.closest('[data-report-asof-apply]')){reportSetDate(byId('stat-report-date').value);return;}
  if(e.target.closest('[data-report-asof-reset]')){reportSetDate('');return;}
 });
 byId('simple-modal-body').addEventListener('change',e=>{
  if(e.target.matches('[data-stat-year]')){statLedgerYear=Number(e.target.value);statLedgerPage=0;rerenderSimpleOpenDetail();}
  if(e.target.matches('[data-report-asof-input]'))reportSetDate(e.target.value);
 });
 byId('report-date-apply').addEventListener('click',()=>reportSetDate(byId('report-date').value));
 byId('report-date-reset').addEventListener('click',()=>reportSetDate(''));
 byId('report-date').addEventListener('change',e=>reportSetDate(e.target.value));

byId('simple-close').addEventListener('click',closeSimpleDetail);
byId('simple-dismiss').addEventListener('click',closeSimpleDetail);
byId('simple-modal').addEventListener('click',e=>{if(e.target.closest('[data-simple-close]'))closeSimpleDetail();});
byId('simple-execution-from-modal').addEventListener('click',showSimpleExecution);
byId('side-execution').addEventListener('click',showSimpleExecution);
byId('side-home').addEventListener('click',()=>{
 byId('dashboard-home').classList.remove('show-execution');
 byId('side-execution').classList.remove('active');
});
byId('side-highlight').addEventListener('click',()=>{byId('side-execution').classList.remove('active');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!byId('simple-modal').hidden){closeSimpleDetail();}});
// Preserve the dashboard renderer and wrap it so the simplified presentation stays in sync.
const v25RenderDashboard=renderDashboard;
renderDashboard=function(){v25RenderDashboard();renderSimpleDashboard();};
renderSimpleDashboard();


// V30 onboarding guide: concise on-screen copy + animated tutorial modal.
const GUIDE_STORAGE_KEY='ulju-wallet-guide-v30';
const GUIDE_AUTO_KEY='ulju-wallet-guide-v30-auto';
let guideIndex=0,guidePendingAuto=true;
const GUIDE_SPEECH=[
 '꾸러미 곰: 지금은 화면의 글을 다 읽지 않아도 괜찮아요. 필요한 설명은 여기서 짧게 알려드릴게요.',
 '안내 여우: 예산서는 고르고 담기만 기억하세요. 긴 안내 대신 버튼 이름을 중심으로 따라오면 됩니다.',
 '도우미 펭귄: 미확인 지출은 연결하거나 무시하면 끝! 자동 반영된 건은 따로 안 보여도 됩니다.',
 '꾸러미 곰: 제출용 자료가 필요하면 기준일을 선택하고 통계목 상세에서 월별·건별 내역을 확인하세요.'
];
function guideSeen(){try{return localStorage.getItem(GUIDE_STORAGE_KEY)==='seen';}catch(_){return false;}}
function guideAutoDisabled(){try{return localStorage.getItem(GUIDE_AUTO_KEY)==='off';}catch(_){return false;}}
function guideRemember(){try{localStorage.setItem(GUIDE_STORAGE_KEY,'seen');if(byId('guide-hide-auto')?.checked)localStorage.setItem(GUIDE_AUTO_KEY,'off');}catch(_){}}
function guideSlides(){return [...document.querySelectorAll('[data-guide-slide]')];}
function guideSetStep(next){const slides=guideSlides();guideIndex=Math.max(0,Math.min(slides.length-1,next));slides.forEach((el,i)=>el.classList.toggle('active',i===guideIndex));const dots=[...byId('guide-dots').children];dots.forEach((el,i)=>el.classList.toggle('active',i===guideIndex));byId('guide-progress-bar').style.width=((guideIndex+1)/slides.length*100).toFixed(0)+'%';byId('guide-prev').disabled=guideIndex===0;byId('guide-next').textContent=guideIndex===slides.length-1?'시작하기':'다음';byId('guide-speech').innerHTML='<b>'+GUIDE_SPEECH[guideIndex].split(':')[0]+':</b>'+GUIDE_SPEECH[guideIndex].split(':').slice(1).join(':');}
function openGuide(step=0){guideIndex=step;guideSetStep(guideIndex);if(byId('guide-hide-auto'))byId('guide-hide-auto').checked=guideAutoDisabled();byId('guide-modal').classList.add('show');document.body.style.overflow='hidden';}
function closeGuide(){guideRemember();byId('guide-modal').classList.remove('show');document.body.style.overflow='';}
function maybeAutoOpenGuide(force=false){if(document.getElementById('v32-modal')&&!document.getElementById('v32-modal').hidden)return;if(!guidePendingAuto&&!force)return; if(byId('guide-modal').classList.contains('show'))return; if(byId('profile-gate')?.classList.contains('show')&&!force)return; if(force || (!guideSeen() && !guideAutoDisabled())){guidePendingAuto=false;setTimeout(()=>openGuide(0),180);} }
byId('open-guide-top').addEventListener('click',()=>openGuide(0));
byId('guide-fab').addEventListener('click',()=>openGuide(0));
byId('guide-close').addEventListener('click',closeGuide);
byId('guide-skip').addEventListener('click',closeGuide);
byId('guide-prev').addEventListener('click',()=>guideSetStep(guideIndex-1));
byId('guide-next').addEventListener('click',()=>{const slides=guideSlides();if(guideIndex>=slides.length-1){closeGuide();return;}guideSetStep(guideIndex+1);});
byId('guide-modal').addEventListener('click',e=>{if(e.target.id==='guide-modal')closeGuide();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&byId('guide-modal').classList.contains('show'))closeGuide();});
const v30PickProfile=pickProfile;pickProfile=function(owner){v30PickProfile(owner);setTimeout(()=>maybeAutoOpenGuide(),260);};
const v30SetMainView=setMainView;setMainView=function(view){v30SetMainView(view);if(view==='home')setTimeout(()=>maybeAutoOpenGuide(),120);};
setTimeout(()=>maybeAutoOpenGuide(),700);

byId('v68-find-input').addEventListener('input',()=>{
 clearTimeout(v68FindTimer);
 v68FindTimer=setTimeout(v68FindApply,180);
});
byId('v68-find-input').addEventListener('keydown',e=>{
 if(e.key==='Enter'){
  e.preventDefault();
  if(v68FindNormalize(e.currentTarget.value)!==v68FindQuery)v68FindApply();
  else v68FindStep(e.shiftKey?-1:1);
 }else if(e.key==='Escape'){
  e.currentTarget.blur();
 }
});
byId('v68-find-prev').addEventListener('click',()=>v68FindStep(-1));
byId('v68-find-next').addEventListener('click',()=>v68FindStep(1));
byId('v71-find-submit').addEventListener('click',()=>{
  const button=byId('v71-find-submit');
  const term=v68FindNormalize(byId('v68-find-input').value);
  if(term!==v68FindQuery)v68FindApply();
  if(!v68FindHits.length)return;
  if(button.dataset.lastQuery===term)v68FindStep(1);
  else{button.dataset.lastQuery=term;v68FindFocus();}
});
document.addEventListener('keydown',e=>{
 // Reserve Ctrl+F / Cmd+F for this viewer only, not on the dashboard or in dialogs.
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f' &&
   dashboardView==='select' && !byId('profile-gate').classList.contains('show') &&
   !byId('guide-modal').classList.contains('show') && !drawer && !dialog && !bulk){
  e.preventDefault();byId('v68-find-input').focus();byId('v68-find-input').select();
 }
});
v68FindStatus();

