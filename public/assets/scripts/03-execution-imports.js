/* V32: cumulative expenditure imports. The built-in budget remains unchanged.
   JSZip v3.10.1 is embedded in the single HTML (see its included license). */
(()=>{
'use strict';
const $=id=>document.getElementById(id),safe=s=>esc(s),number=n=>Number.isFinite(n)?new Intl.NumberFormat('ko-KR').format(n):'—';
const STORAGE_BACKUP='ulju-wallet-v32-exec-backup';
const DATA_FIELDS=['reference','project','stat','head','description','amount','proposalAmount','date','proposalDate','paid','paidDate','status'];
const FIELD_LABELS={reference:'결의번호 (가능하면 선택)',project:'세부사업명 *',stat:'통계목 코드 *',head:'편성목 (선택)',description:'지출 적요 *',amount:'결의금액 (원) *',proposalAmount:'원인행위금액 (선택)',date:'결의일자 *',proposalDate:'원인행위일자 (선택)',paid:'지급정보 확인여부 (선택)',paidDate:'지급일자 (선택)',status:'결의상태 (선택)'};
const CANDIDATES={
 reference:['지출결의번호','지출결의서번호','결의문서번호','결의번호','전표번호','지출번호','문서번호','거래id','관리번호','결의id','회계일련번호'],
 project:['세부사업명','세부사업','사업명','예산사업명','사업'],stat:['통계목코드','통계목명','통계목','목세목','목-세목','세출과목','예산과목','과목코드','과목'],head:['편성목코드','편성목','목코드','목'],
 description:['지출적요','결의적요','집행내용','사업내용','지출내용','적요','품명','거래내용','내용'],
 amount:['결의금액','지출결의금액','결의액','결정금액','지출금액','집행금액','금액'],
 proposalAmount:['원인행위금액','품의금액','원인행위액','요구금액'],
 date:['결의일자','지출결의일자','결의일','지출일자','지출일','집행일자','발생일자','거래일자','날짜'],
 proposalDate:['원인행위일자','품의일자','원인행위일'],paid:['지급정보확인','지급확인여부','지급확인','지급여부','지급상태','지급구분','지급처리','지급정보'],
 paidDate:['지급일자','지급일','이체일자','이체일'],status:['결의상태','처리상태','결의진행상태','진행상태','상태']
};
const MUST=['project','stat','description','amount','date'];
let uploadFile=null,parsedSheets=[],chosenRows=[],headerRowIndex=0,columns=[],preview=null,compare=null;
const NOTE='새 파일에서 빠진 거래는 자동 삭제하지 않습니다. 주간 조회 엑셀도 누적 반영할 수 있지만, 그 기간에 포함되지 않은 거래는 추가되지 않습니다.';
function normalizeText(v){return String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').replace(/[‐‑‒–—−]/g,'-');}
function tight(v){return normalizeText(v).replace(/[\s·•._()\[\]]/g,'').toLowerCase();}
function normDesc(v){return tight(v).replace(/[“”"'`]/g,'');}
function trimCell(v){return String(v??'').trim();}
function dateOf(v){
 if(v===null||v===undefined||String(v).trim()==='')return '';
 if(typeof v==='number'&&!Number.isNaN(v)){
  if(v>20000&&v<90000){const d=new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000);return d.toISOString().slice(0,10);}
  if(v>=19000101&&v<=21991231)v=String(v);
 }
 if(v instanceof Date&&!Number.isNaN(v.valueOf()))return v.toISOString().slice(0,10);
 let s=normalizeText(v).replace(/[년월]/g,'-').replace(/일/g,'').replace(/[.\/]/g,'-').replace(/\s.*$/,'').replace(/-+$/,'');
 if(/^\d{4}-\d{2}-\d{2}T/.test(s))s=s.slice(0,10);
 if(/^\d{8}$/.test(s))s=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6);
 if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)){let [y,m,d]=s.split('-');s=y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');}
 return /^\d{4}-\d{2}-\d{2}$/.test(s)&&reportValidDate(s)?s:'';
}
function integerOf(v){
 if(typeof v==='number')return Number.isSafeInteger(v)?v:null;
 const s=String(v??'').replace(/[₩원,\s]/g,'').replace(/^\((.+)\)$/,'-$1');if(!s)return null;
 const n=Number(s);return Number.isSafeInteger(n)?n:null;
}
function paidState(row,sel){
 if(sel.paid<0&&sel.paidDate<0&&sel.status<0)return null;
 const p=sel.paid>=0?normalizeText(row[sel.paid]||''):'';
 const paidDate=sel.paidDate>=0?dateOf(row[sel.paidDate]):'';
 const state=sel.status>=0?normalizeText(row[sel.status]||''):'';
 if(p){if(/^(미확인|미지급|아니오|아니요|n|no|false|0|대기|지급대기|미처리)$/i.test(p)||/미지급|지급전|미확인|미처리/.test(p))return false;
  if(/^(확인|예|y|yes|true|1|완료|지급|지급완료)$/i.test(p)||/지급완료|지급확인|이체완료|지급처리완료/.test(p))return true;
  if(dateOf(p))return true;
 }
 if(paidDate)return true;
 if(/취소|반려|삭제|무효/.test(state))return false;
 if(/지급완료|이체완료|지급확인/.test(state))return true;
 if(/미지급|지급대기|지급전|미확인/.test(state))return false;
 return null; // 결의확정 alone is not proof of 지급정보 확인.
}
function headersScore(row){
 const cells=row.map(tight);let n=0;for(const k of ['project','stat','description','amount','date'])if(cells.some(c=>CANDIDATES[k].some(a=>tight(a)===c)))n+=2;
 for(const k of ['reference','paid','paidDate','status','head'])if(cells.some(c=>CANDIDATES[k].some(a=>tight(a)===c)))n++;
 return n;
}
function discoverSheetRows(){
 if(!parsedSheets.length)return;
 const select=$('v32-sheet');select.innerHTML=parsedSheets.map((sh,i)=>`<option value="${i}">${safe(sh.name)} (${number(sh.rows.length)}행)</option>`).join('');
 let winner={idx:0,score:-1};parsedSheets.forEach((sh,i)=>{let score=Math.max(...sh.rows.slice(0,35).map(headersScore),0);if(score>winner.score)winner={idx:i,score};});select.value=String(winner.idx);
 chooseSheet(winner.idx);
}
function chooseSheet(i){
 chosenRows=parsedSheets[i]?.rows||[];
 const maxN=Math.max(...chosenRows.slice(0,75).map(r=>r.length),0);
 if(!chosenRows.length||maxN<4)throw Error('선택한 시트에서 표 형태의 데이터를 찾지 못했습니다.');
 const idx=chosenRows.slice(0,35).reduce((best,row,j)=>headersScore(row)>best.score?{i:j,score:headersScore(row)}:best,{i:0,score:-1}).i;
 const h=$('v32-header');h.innerHTML=chosenRows.slice(0,Math.min(35,chosenRows.length)).map((r,j)=>`<option value="${j}">${j+1}행 — ${safe(r.slice(0,6).map(trimCell).join(' | ').slice(0,105))}</option>`).join('');h.value=String(idx);chooseHeader(idx);
}
function chooseHeader(idx){
 headerRowIndex=idx;
 const head=chosenRows[idx]||[];const maxN=Math.min(90,Math.max(head.length,...chosenRows.slice(idx,idx+4).map(r=>r.length),0));
 columns=Array.from({length:maxN},(_,j)=>({idx:j,label:trimCell(head[j])||`열 ${j+1}`}));
 const names=columns.map(c=>tight(c.label));
 const picks={};const used=new Set();
 for(const k of ['reference','project','stat','head','description','amount','proposalAmount','date','proposalDate','paid','paidDate','status']){
  let j=names.findIndex((s,i)=>!used.has(i)&&CANDIDATES[k].some(a=>tight(a)===s));
  if(j<0)j=names.findIndex((s,i)=>!used.has(i)&&CANDIDATES[k].some(a=>tight(a).length>=3&&(s.includes(tight(a))||tight(a).includes(s)&&s.length>=3)));
  picks[k]=j;if(j>=0)used.add(j);
 }
 const list=$('v32-map-fields');list.innerHTML=DATA_FIELDS.map(k=>`<label class="v32-field"><span>${safe(FIELD_LABELS[k])}</span><select id="v32-field-${k}" aria-label="${safe(FIELD_LABELS[k])}"><option value="-1">사용 안 함</option>${columns.map(c=>`<option value="${c.idx}" ${c.idx===picks[k]?'selected':''}>${safe(c.label)} (${c.idx+1}열)</option>`).join('')}</select></label>`).join('');
 updatePreview();
}
function selectedColumns(){let p={};for(const k of DATA_FIELDS)p[k]=Number($('v32-field-'+k)?.value??-1);return p;}
function projectKey(project,rawStat,rawHead){
 const p=tight(project),ss=normalizeText(rawStat),hs=normalizeText(rawHead);
 if(!p||!ss)return {error:'세부사업 또는 통계목이 비어 있음'};
 let code=(ss.match(/(?<!\d)(\d{3})\s*[-‐–— ]\s*(\d{2})(?!\d)/)||[]);
 let c=code[1]?code[1]+'-'+code[2]:'';
 if(!c){let major=(hs.match(/(?<!\d)(\d{3})(?!\d)/)||[])[1];let minor=(ss.match(/^(\d{2})(?!\d)/)||[])[1];if(major&&minor)c=major+'-'+minor;}
 if(!c){ // Stat name is accepted only when unique within this project
  const filtered=BUDGET.filter(b=>tight(b.project)===p&&tight(b.stat.replace(/^\d+\s*/,''))===tight(ss.replace(/^\d+\s*/,'')));
  if(filtered.length===1)return {key:filtered[0].key};
  return {error:'통계목 코드 확인 필요'};
 }
 const matches=BUDGET.filter(b=>tight(b.project)===p&&b.code===c);
 if(matches.length===1)return {key:matches[0].key};
 return {error:matches.length?'예산 과목 중복':'현재 예산서에 없는 사업·통계목'};
}
function importRows(){
 const sel=selectedColumns();const missing=MUST.filter(k=>sel[k]<0);
 if(missing.length)throw Error('필수 열을 선택해 주세요: '+missing.map(k=>FIELD_LABELS[k]).join(', '));
 const rows=[],issues=[],skip=[];
 const body=chosenRows.slice(headerRowIndex+1);
 body.forEach((row,offset)=>{
  const index=headerRowIndex+offset+2;
  if(!row.some(v=>trimCell(v)!==''))return;
  const project=row[sel.project],stat=row[sel.stat],head=sel.head>=0?row[sel.head]:'';
  const description=trimCell(row[sel.description]),amount=integerOf(row[sel.amount]),dt=dateOf(row[sel.date]);
  if(!trimCell(project)&&!trimCell(stat)&&!description&&amount===null)return; // Footer/blank
  const found=projectKey(project,stat,head);
  if(found.error||amount===null||Math.abs(amount)>1e14||!description||!dt){issues.push({line:index,reason:found.error||(!dt?'날짜 형식 확인 필요':!description?'지출 적요 누락':'결의금액 확인 필요'),what:`${trimCell(project)} / ${trimCell(stat)} · ${description.slice(0,36)}`});return;}
  const ref=sel.reference>=0?trimCell(row[sel.reference]):'';
  const state=sel.status>=0?trimCell(row[sel.status]):null;
  const a=sel.proposalAmount>=0?integerOf(row[sel.proposalAmount]):null;
  const propdate=sel.proposalDate>=0?dateOf(row[sel.proposalDate]):null;
  rows.push({i:'',k:found.key,d:description,v:amount,a,dt,propdate,paid:paidState(row,sel),state,sourceRef:ref,sourceFileRow:index});
 });
 if(!rows.length)throw Error('연결 가능한 거래가 없습니다. 열 선택과 예산 과목을 확인해 주세요.');
 return {rows,issues,skipped:skip};
}
function identExact(r){return [r.k,normDesc(r.d),r.dt,r.v].join('|');}
function identApprox(r){return [r.k,normDesc(r.d),r.dt].join('|');}
function identRef(r){return String(r.sourceRef||'').trim()?`${r.k}|${tight(r.sourceRef)}`:'';}
function indexOfRows(rows,fn){const map=new Map();for(const r of rows){const k=fn(r);if(!k)continue;if(!map.has(k))map.set(k,[]);map.get(k).push(r);}return map;}
function identicalMain(a,b){return a.k===b.k&&normDesc(a.d)===normDesc(b.d)&&a.dt===b.dt&&a.v===b.v&&a.paid===b.paid&&a.state===b.state&&a.a===b.a;}
function checkDiff(original,latest){let fields=[];for(const k of ['k','d','v','a','dt','paid','state','propdate'])if(String(original[k]??'')!==String(latest[k]??''))fields.push(k);return fields;}
function stableUniqueTag(row){let s=identRef(row)||identExact(row);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return 'import_'+(h>>>0).toString(36);}
function simulateUpdate(newRows){
 const base=EX_ROWS;const exMap=indexOfRows(base,identExact),approxMap=indexOfRows(base,identApprox),refMap=indexOfRows(base,identRef);
 const newRefs=indexOfRows(newRows,identRef),newExact=indexOfRows(newRows,identExact),newApprox=indexOfRows(newRows,identApprox);
 const consumed=new Set(),actions=[],ambiguous=[],updated=[],added=[],unchanged=[];
 const oldRefGlobal=indexOfRows(base,r=>tight(r.sourceRef||''));
 const warnings=[],usedIds=new Set(base.map(r=>r.i));
 const addAmbiguous=(r,reason)=>ambiguous.push({r,reason});
 for(const r of newRows){
  const ref=identRef(r),exact=identExact(r),app=identApprox(r);
  if(ref&&(newRefs.get(ref)||[]).length>1){addAmbiguous(r,'파일 안에서 결의번호가 중복됨');continue;}
  if(ref && (oldRefGlobal.get(tight(r.sourceRef))||[]).some(x=>x.k!==r.k)){addAmbiguous(r,'같은 결의번호가 다른 예산과목에 있음. 수동 확인 필요');continue;}
  // If duplicate descriptors exist without a strong ref, require user verification.
  if(!ref&&(newExact.get(exact)||[]).length>1){addAmbiguous(r,'같은 날짜·적요·금액이 중복되고 결의번호가 없음');continue;}
  let old=null;
  if(ref){const refs=refMap.get(ref)||[];if(refs.length>1){addAmbiguous(r,'기존 결의번호가 중복됨');continue;}if(refs.length===1)old=refs[0];}
  if(!old){const exacts=(exMap.get(exact)||[]).filter(x=>!consumed.has(x.i));
   if(exacts.length===1)old=exacts[0];else if(exacts.length>1){addAmbiguous(r,'기존에 동일 거래가 여러 건 있음');continue;}
  }
  if(!old){const approximates=(approxMap.get(app)||[]).filter(x=>!consumed.has(x.i));
   if(approximates.length===1 && (newApprox.get(app)||[]).length===1)old=approximates[0];
   else if(approximates.length>1||(newApprox.get(app)||[]).length>1){addAmbiguous(r,'금액 변경 여부를 안전하게 판별할 수 없음');continue;}
  }
  if(old){
   if(consumed.has(old.i)){addAmbiguous(r,'동일 기존 거래에 중복 연결 시도');continue;}
   if(ref&&old.sourceRef&&identRef(old)!==ref){addAmbiguous(r,'기존 결의번호가 달라서 자동 연결 불가');continue;}
   consumed.add(old.i);
   const next={...old,...r,i:old.i,a:r.a===null?old.a:r.a,paid:r.paid===null?old.paid:r.paid,state:r.state===null?old.state:r.state,propdate:r.propdate===null?old.propdate:r.propdate,sourceRef:r.sourceRef||old.sourceRef||'',sourceFileRow:undefined};
   const diff=checkDiff(old,next);
   if(diff.length){if(diff.some(f=>['v','k','d','dt'].includes(f))&&(S.executionShares||[]).some(x=>x.row===old.i))next.needsReview=true;updated.push({before:old,after:next,fields:diff});actions.push({kind:'change',r:next});}
   else {unchanged.push(old.i);if(!old.sourceRef&&r.sourceRef)actions.push({kind:'stamp',r:next});}
  }else{
   let id=stableUniqueTag(r),suffix=0;while(usedIds.has(id)){suffix++;id=stableUniqueTag(r)+'_'+suffix;}
   usedIds.add(id);const next={...r,i:id,a:r.a??r.v,paid:r.paid??false,state:r.state??'',propdate:r.propdate??'',sourceFileRow:undefined};
   added.push(next);actions.push({kind:'new',r:next});
  }
 }
 const missing=base.filter(r=>!consumed.has(r.i));
 const changedAssign=updated.filter(x=>x.fields.some(f=>['v','k','d','dt'].includes(f))&&S.executionShares?.some(s=>s.row===x.before.i));
 return {actions,ambiguous,updated,added,unchanged,missing,changedAssign,oldCount:base.length,baseAsOf:EX_SOURCE.asof,inputCount:newRows.length};
}
function latestDate(rows){return rows.reduce((best,r)=>r.dt>best?r.dt:best,'');}
function reveal(text,error=false){const el=$('v32-alert');el.textContent=text;el.classList.toggle('error',error);el.hidden=false;}
function updatePreview(){
 if(!chosenRows.length)return;
 const p=$('v32-raw-preview'),sel=selectedColumns();
 p.innerHTML=`<table><thead><tr>${columns.slice(0,12).map(c=>`<th>${safe(c.label)}</th>`).join('')}</tr></thead><tbody>${chosenRows.slice(headerRowIndex+1,headerRowIndex+5).map(row=>`<tr>${columns.slice(0,12).map(c=>`<td>${safe(trimCell(row[c.idx]).slice(0,75))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 $('v32-preview-meta').textContent=`${number(Math.max(0,chosenRows.length-headerRowIndex-1))}행 · 열 구성을 확인하고 [비교하기]를 누르세요.`;
 $('v32-preview').hidden=false;preview=null;compare=null;$('v32-result').hidden=true;
}
function displayCompare(){
 const result=$('v32-result');result.hidden=false;
 $('v32-summary').innerHTML=[['기존 유지',compare.unchanged.length],['신규',compare.added.length],['변경',compare.updated.length],['확인 필요',compare.ambiguous.length+preview.issues.length]].map(([label,count])=>`<div class="v32-kpi"><small>${label}</small><strong>${number(count)}건</strong></div>`).join('');
 const pieces=[];
 if(compare.missing.length)pieces.push(`새 파일에서 찾지 못한 기존 거래 ${number(compare.missing.length)}건은 삭제하지 않습니다.`);
 if(compare.ambiguous.length)pieces.push(`동일 거래인지 불확실한 ${number(compare.ambiguous.length)}건은 반영하지 않았습니다.`);
 if(preview.issues.length)pieces.push(`예산 과목·필수값 문제로 ${number(preview.issues.length)}행을 반영하지 않습니다.`);
 if(compare.changedAssign.length)pieces.push(`이미 예산에 연결한 거래 중 금액·사업·날짜 등이 바뀐 ${number(compare.changedAssign.length)}건은 연결 금액을 재확인해야 합니다.`);
 if(compare.added.length>30&&compare.added.length>compare.unchanged.length*3)pieces.push('신규가 유난히 많습니다. 기준일·사업·통계목·날짜 열을 다시 확인하세요. 다른 방식으로 추출한 동일 지출이 중복될 수 있습니다.');
 $('v32-result-notes').textContent=pieces.join(' ')||'확인되지 않은 충돌이 발견되지 않았습니다.';
 const issueList=[...preview.issues.map(i=>`엑셀 ${i.line}행: ${i.reason} — ${i.what}`),...compare.ambiguous.map(i=>`중복/불확실: ${i.reason} — ${i.r.d.slice(0,45)}`),...compare.changedAssign.map(i=>`연결 재확인: ${i.before.i} · ${i.after.d.slice(0,40)}`)];
 $('v32-issue-details').hidden=!issueList.length;
 $('v32-issue-list').textContent=issueList.slice(0,70).join('\n')+(issueList.length>70?`\n… 외 ${issueList.length-70}건`: '');
 const date=latestDate(preview.rows);const today=new Date();const d=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 const asof=$('v32-asof');if(!asof.value)asof.value=EX_SOURCE.asof>date?EX_SOURCE.asof:date||d;
 const newDateRange=preview.rows.reduce((p,r)=>({min:!p.min||r.dt<p.min?r.dt:p.min,max:!p.max||r.dt>p.max?r.dt:p.max}),{min:'',max:''});
 $('v32-file-range').textContent=`업로드 파일의 거래일: ${newDateRange.min||'—'} ~ ${newDateRange.max||'—'}`;
 $('v32-commit').disabled=!(compare.added.length+compare.updated.length+compare.actions.filter(a=>a.kind==='stamp').length);
 $('v32-result').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function backupSource(){
 const snapshot={savedAt:new Date().toISOString(),source:{asof:EX_SOURCE.asof,rows:EX_ROWS.map(r=>({...r}))},decisions:{executionShares:structuredClone(S.executionShares||[]),executionIgnored:structuredClone(S.executionIgnored||[])}};
 localStorage.setItem(STORAGE_BACKUP,JSON.stringify(snapshot));
 return snapshot;
}
function applyComparison(){
 if(!isAdminOwner()){reveal('자료관리자만 집행자료를 업데이트할 수 있어요.',true);return;}
 if(!preview||!compare)return;
 const asof=$('v32-asof').value;
 if(!reportValidDate(asof)){reveal('올바른 자료 기준일을 선택해 주세요.',true);return;}
 if(asof<EX_SOURCE.asof && !confirm('현재 자료 기준일보다 이전 날짜입니다. 기존 자료를 유지하면서 거래만 비교 반영할까요?'))return;
 if(!confirm(`${number(compare.added.length)}건 신규 · ${number(compare.updated.length)}건 변경을 적용할까요?\n기존 연결·무시 기록은 유지하고 누락 거래는 삭제하지 않습니다.`))return;
 const prev=JSON.stringify({asof:EX_SOURCE.asof,rows:EX_ROWS});
 try{
  backupSource();
  const map=new Map(EX_ROWS.map(r=>[r.i,{...r}]));
  for(const action of compare.actions)map.set(action.r.i,action.r);
  const next={asof:asof>EX_SOURCE.asof?asof:EX_SOURCE.asof,rows:[...map.values()]};
  const snapshot=validateExecutionJson(next);
  localStorage.setItem(SOURCE_OVERRIDE_KEY,JSON.stringify(snapshot));
  EX_SOURCE.asof=snapshot.asof;EX_ROWS.splice(0,EX_ROWS.length,...snapshot.rows);
  rebuildExecutionIndexes();exPage=0;renderSourceStatus();renderDashboard();
  $('v32-current-date').textContent=padDate(EX_SOURCE.asof);$('v32-current-count').textContent=number(EX_ROWS.length)+'건';
  $('v32-undo').disabled=false;
  $('v32-commit').disabled=true;
  reveal(`업데이트 완료 · 신규 ${number(compare.added.length)}건, 변경 ${number(compare.updated.length)}건. 기존 처리기록을 보존했습니다.`,false);
  preview=null;compare=null;
 }catch(e){
  try{const old=JSON.parse(prev);EX_SOURCE.asof=old.asof;EX_ROWS.splice(0,EX_ROWS.length,...old.rows);rebuildExecutionIndexes();localStorage.setItem(SOURCE_OVERRIDE_KEY,prev);renderDashboard();}catch(_){}
  reveal('저장하지 못했습니다. 브라우저 저장공간을 확인하고 백업을 이용해 주세요. '+String(e.message||e),true);
 }
}
function undoLast(){if(!isAdminOwner()){reveal('자료관리자 전용 기능입니다.',true);return;}const raw=localStorage.getItem(STORAGE_BACKUP);if(!raw){reveal('복원할 직전 백업이 없습니다.',true);return;}
 if(!confirm('직전 업데이트 이전 집행자료와 연결·무시 기록으로 되돌릴까요?'))return;
 try{const item=JSON.parse(raw),src=validateExecutionJson(item.source);localStorage.setItem(SOURCE_OVERRIDE_KEY,JSON.stringify(src));EX_SOURCE.asof=src.asof;EX_ROWS.splice(0,EX_ROWS.length,...src.rows);rebuildExecutionIndexes();S.executionShares=item.decisions.executionShares||[];S.executionIgnored=item.decisions.executionIgnored||[];persist();localStorage.removeItem(STORAGE_BACKUP);$('v32-undo').disabled=true;renderSourceStatus();renderDashboard();$('v32-current-date').textContent=padDate(src.asof);$('v32-current-count').textContent=number(EX_ROWS.length)+'건';reveal('직전 자료로 복원했습니다.');
 }catch(e){reveal('복원 실패: '+String(e.message||e),true);}
}
function downloadBackup(){
 if(!isAdminOwner())return;
 const obj={note:'집행자료와 담당자별 지출 연결·무시 기록 백업',source:{asof:EX_SOURCE.asof,rows:EX_ROWS},decisions:{executionShares:S.executionShares||[],executionIgnored:S.executionIgnored||[]}};
 const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='내예산꾸러미_집행자료백업_'+EX_SOURCE.asof+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function parseCSV(text){
 let lines=[],row=[],word='',quote=false;
 const delim=(text.split(/\r?\n/).slice(0,5).join('\n').match(/\t/g)||[]).length>(text.split(/\r?\n/).slice(0,5).join('\n').match(/,/g)||[]).length?'\t':',';
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){word+='"';i++;}else quote=!quote;}
 else if(!quote&&c===delim){row.push(word);word='';}else if(!quote&&(c==='\r'||c==='\n')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(word);word='';if(row.some(x=>x.trim()))lines.push(row);row=[];}else word+=c;
 }
 row.push(word);if(row.some(x=>x.trim()))lines.push(row);return lines;
}
function parseXML(s){const doc=new DOMParser().parseFromString(s,'application/xml');if(doc.querySelector('parsererror'))throw Error('엑셀 내부 XML을 읽을 수 없습니다.');return doc;}
function localNameElements(parent,name){return [...parent.getElementsByTagName('*')].filter(el=>el.localName===name);}
async function parseXlsx(file){
 if(typeof JSZip==='undefined')throw Error('엑셀 파일을 읽는 모듈이 준비되지 않았습니다.');
 const zip=await JSZip.loadAsync(await file.arrayBuffer());
 if(!zip.file('xl/workbook.xml'))throw Error('올바른 .xlsx 파일이 아닙니다. .xls 파일은 엑셀에서 .xlsx로 다시 저장해 주세요.');
 const workbook=parseXML(await zip.file('xl/workbook.xml').async('string'));
 const relFile=zip.file('xl/_rels/workbook.xml.rels');if(!relFile)throw Error('시트 연결정보를 찾을 수 없습니다.');
 const relDoc=parseXML(await relFile.async('string'));
 const rels=new Map(localNameElements(relDoc,'Relationship').map(e=>[e.getAttribute('Id'),e.getAttribute('Target')]));
 let strs=[];
 if(zip.file('xl/sharedStrings.xml')){const doc=parseXML(await zip.file('xl/sharedStrings.xml').async('string'));strs=localNameElements(doc,'si').map(si=>localNameElements(si,'t').map(t=>t.textContent).join(''));}
 const sheets=[];
 for(const sh of localNameElements(workbook,'sheet')){
  const id=sh.getAttribute('r:id')||sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  let target=rels.get(id);if(!target)continue;
  target=target.replace(/^\//,'').replace(/\\/g,'/');if(!target.startsWith('xl/'))target='xl/'+target;target=target.replace(/^xl\/\.\.\//,'');
  const filePart=zip.file(target);if(!filePart)continue;
  const doc=parseXML(await filePart.async('string'));
  const rows=[];
  let prev=0;
  for(const node of localNameElements(doc,'row')){
   const index=Number(node.getAttribute('r'))||prev+1;prev=index;
   if(index>100000)throw Error('행이 너무 많은 파일입니다. 조회 범위를 줄여 주세요.');
   let cells=[];
   for(const cell of [...node.children].filter(el=>el.localName==='c')){
    const addr=cell.getAttribute('r')||'';const letters=(addr.match(/^[A-Z]+/)||[])[0]||'';
    let col=0;for(const ch of letters)col=col*26+ch.charCodeAt(0)-64;col=Math.max(0,col-1);
    const type=cell.getAttribute('t');const val=localNameElements(cell,'v')[0]?.textContent;
    let parsed='';
    if(type==='inlineStr')parsed=localNameElements(cell,'t').map(n=>n.textContent).join('');
    else if(type==='s')parsed=strs[Number(val)]??'';
    else if(type==='b')parsed=val==='1';
    else if(type==='str'||type==='e')parsed=val||'';
    else if(val!==undefined&&val!==null)parsed=val!==''&&!Number.isNaN(Number(val))?Number(val):val;
    cells[col]=parsed;
   }
   if(cells.some(v=>v!==undefined&&String(v)!==''))rows.push(cells);
  }
  sheets.push({name:sh.getAttribute('name')||'시트',rows});
 }
 return sheets;
}
async function parseFile(file){
 if(!isAdminOwner())return;
 if(!file) return;
 try{
  $('v32-result').hidden=true;$('v32-preview').hidden=true;preview=null;compare=null;
  reveal('엑셀을 읽고 있습니다…');
  if(file.size>18*1024*1024)throw Error('파일 크기는 18MB 이하여야 합니다.');
  const type=file.name.toLowerCase();
  if(type.endsWith('.xlsx'))parsedSheets=await parseXlsx(file);
  else if(type.endsWith('.csv')||type.endsWith('.tsv')){
   const buf=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(buf);
   if((text.match(/\uFFFD/g)||[]).length>1)text=new TextDecoder('euc-kr').decode(buf);
   parsedSheets=[{name:'CSV / 텍스트',rows:parseCSV(text.replace(/^\uFEFF/,''))}];
  }else throw Error('지원 형식은 .xlsx 또는 .csv입니다. 오래된 .xls는 .xlsx로 변환해 주세요.');
  if(!parsedSheets.length)throw Error('표가 들어 있는 시트를 찾지 못했습니다.');
  uploadFile=file;discoverSheetRows();reveal(`파일을 읽었습니다: ${file.name}. 열을 확인한 후 비교를 실행하세요.`);
 }catch(e){reveal('파일을 읽을 수 없습니다: '+String(e.message||e),true);}
}
function runCompare(){if(!isAdminOwner())return;try{preview=importRows();compare=simulateUpdate(preview.rows);displayCompare();reveal(`비교 완료 · 신규 ${number(compare.added.length)}건, 변경 ${number(compare.updated.length)}건, 검토 필요 ${number(compare.ambiguous.length+preview.issues.length)}건.`);}
 catch(e){preview=null;compare=null;$('v32-result').hidden=true;reveal('비교할 수 없습니다: '+String(e.message||e),true);}}
function showAdminAccessNotice(){
 const team=teamFor(S.selectedOwner);
 $('admin-access-owner').textContent=team?`${team.name} 자료관리자: ${team.admin||'미지정'}`:'소속 팀 자료관리자가 지정되지 않았습니다.';
 $('admin-access-dialog').hidden=false;
 $('admin-access-dismiss').focus();
}
function closeAdminAccessNotice(){$('admin-access-dialog').hidden=true;}
$('admin-access-dismiss').addEventListener('click',closeAdminAccessNotice);
$('admin-access-switch').addEventListener('click',()=>{closeAdminAccessNotice();showProfileGate();});
$('admin-access-dialog').addEventListener('click',e=>{if(e.target.id==='admin-access-dialog')closeAdminAccessNotice();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('admin-access-dialog').hidden)closeAdminAccessNotice();});
function openModal(){
 if(!isAdminOwner()){syncAdminAccess();showAdminAccessNotice();return;}
 if(typeof closeGuide==='function'&&document.getElementById('guide-modal')?.classList.contains('show'))closeGuide();
 $('v32-modal').hidden=false;document.body.classList.add('v32-open');$('v32-current-date').textContent=padDate(EX_SOURCE.asof);$('v32-current-count').textContent=number(EX_ROWS.length)+'건';try{$('v32-undo').disabled=!localStorage.getItem(STORAGE_BACKUP);}catch(_){$('v32-undo').disabled=true;}$('side-import').classList.add('active');$('v32-close').focus();
}
function closeModal(){$('v32-modal').hidden=true;document.body.classList.remove('v32-open');$('side-import').classList.remove('active');}
$('side-import').addEventListener('click',openModal);$('v32-close').addEventListener('click',closeModal);
$('v32-modal').addEventListener('click',e=>{if(e.target.id==='v32-modal')closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('v32-modal').hidden){closeModal();}});
$('v32-file').addEventListener('change',e=>parseFile(e.target.files?.[0]));
$('v32-sheet').addEventListener('change',e=>chooseSheet(Number(e.target.value)));
$('v32-header').addEventListener('change',e=>chooseHeader(Number(e.target.value)));
$('v32-map-fields').addEventListener('change',updatePreview);
$('v32-compare').addEventListener('click',runCompare);
$('v32-commit').addEventListener('click',applyComparison);
$('v32-undo').addEventListener('click',undoLast);
$('v32-backup').addEventListener('click',downloadBackup);
$('v32-guide-toggle').addEventListener('click',()=>{$('v32-guide').hidden=!$('v32-guide').hidden;});
syncAdminAccess();
// Changed monetary allocations remain linked but are flagged until explicitly rechecked.
const oldRenderExV32=renderExecutionPanel;
renderExecutionPanel=function(){
 oldRenderExV32();
 const relevant=exBudgetRelevant();const ownedIds=new Set(mine().map(a=>a.id));
 const n=EX_ROWS.filter(r=>r.needsReview&&relevant.has(r.k)&&(S.executionShares||[]).some(x=>x.row===r.i&&ownedIds.has(x.allocId))).length;
 if(n){const note=$('ex-match-note');if(note)note.textContent=`⚠ 금액 등 변경으로 연결 금액 재확인 ${n}건 · ‘내 처리 내역’에서 확인하세요. `+note.textContent;}
};
const oldRecordActionsV32=exRecordActions;
exRecordActions=function(r,handled,myShares,ignored){
 const actions=oldRecordActionsV32(r,handled,myShares,ignored);
 if(handled&&r.needsReview&&!ignored&&myShares.length)return `<button type="button" class="v32-review-action" data-ex-recheck="${safe(r.i)}">변경 확인 완료</button>`+actions;
 return actions;
};
$('ex-records').addEventListener('click',e=>{
 const btn=e.target.closest('[data-ex-recheck]');if(!btn)return;
 e.stopImmediatePropagation();
 const r=EX_ID.get(btn.dataset.exRecheck);if(!r||!r.needsReview)return;
 const shares=(S.executionShares||[]).filter(x=>x.row===r.i);
 if(shares.reduce((n,x)=>n+Math.abs(x.amount),0)>Math.abs(r.v)){
  toast('연결 금액이 변경된 결의금액을 초과합니다. 연결을 먼저 조정해 주세요.');return;
 }
 if(!confirm('변경된 거래의 연결 금액을 확인했나요? 확인 상태로 표시할까요?'))return;
 try{r.needsReview=false;localStorage.setItem(SOURCE_OVERRIDE_KEY,JSON.stringify({asof:EX_SOURCE.asof,rows:EX_ROWS}));renderDashboard();toast('변경된 연결 금액을 확인했어요.');}
 catch(err){r.needsReview=true;reveal('확인 상태를 저장하지 못했습니다.',true);}
},true);


// V38: Historical years are read-only. All owner allocation and editing state remains tied to 2026.
const HIST_SOURCE=JSON.parse(document.getElementById('historical-data').textContent);
const HIST_TEXT=(v)=>String(v??'').replace(/\s+/g,'').replace(/[‐‑–—]/g,'-');
function histCanonical(name){const v=HIST_TEXT(name);if(v==='방역소독'||v==='빈대방제대책비')return '방역소독';if(v==='영유아검진비지원')return '영유아 검진비 지원';if(v.startsWith('코로나19예방접종실시'))return '코로나19 예방접종 실시';if(v.startsWith('생물테러초동대응요원교육및훈련지원'))return '생물테러초동대응요원 교육 및 훈련지원';return name;}
const histCanonKey=(name)=>HIST_TEXT(histCanonical(name));
const HIST_YEARS=['2024','2025','2026'];
const histFmt=n=>{const sign=n<0?'−':'',v=Math.abs(n);if(v>=1e8)return sign+(v/1e8).toLocaleString('ko-KR',{maximumFractionDigits:2})+'억 원';if(v>=1e4)return sign+(v/1e4).toLocaleString('ko-KR',{maximumFractionDigits:1})+'만 원';return sign+v.toLocaleString('ko-KR')+'원';};
let histSelectedYear='2026',histProjectOpen=null,histSearch='',histCutoffs={'2024':'','2025':''},histStatItem=null,histMonth=null,histLedgerPage=0,histDetailFocus=null,histProjectChoice='';
const HIST_SOURCE_BY_YEAR={};
function histBuild(y){const h=HIST_SOURCE[y];const projectMap=new Map();
 function getP(name){let key=histCanonKey(name);if(!projectMap.has(key))projectMap.set(key,{key,name:histCanonical(name),budget:0,transactions:[],stats:new Map(),unmapped:false});return projectMap.get(key);}
 for(const p of h.projects){getP(p.canonical||p.name).budget+=p.amount;}
 for(const stat of h.stats){const p=getP(stat.canonical||stat.project);let key=HIST_TEXT(stat.name);let g=p.stats.get(key);if(!g){g={key,code:stat.code,name:stat.name,budget:0,transactions:[],isMissing:false};p.stats.set(key,g);}g.budget+=stat.amount;}
 for(const t of h.transactions){const p=getP(t.canonical||t.project);if(!t.refund){p.transactions.push(t);const key=HIST_TEXT(t.stat);let g=p.stats.get(key);if(!g){g={key,name:t.stat,code:'—',budget:0,transactions:[],isMissing:true};p.stats.set(key,g);p.unmapped=true;}g.transactions.push(t);}}
 HIST_SOURCE_BY_YEAR[y]=[...projectMap.values()].sort((a,b)=>b.budget-a.budget||a.name.localeCompare(b.name,'ko'));
}
for(const y of ['2024','2025'])histBuild(y);

// V39: compare the current user's *selected* program + statistical category
// against prior years' department-wide history. Do not infer historical owners.
function v39HistLookupProject(y,projectName){
 const key=histCanonKey(projectName);
 return (HIST_SOURCE_BY_YEAR[y]||[]).find(p=>p.key===key)||null;
}
function v39PastProject(y,projectName){
 const p=v39HistLookupProject(y,projectName);
 return p?{present:true,budget:p.budget,spent:histSum(histDateFiltered(p.transactions,y))}:{present:false,budget:0,spent:0};
}
function v39PastStat(y,projectName,code,statName){
 const p=v39HistLookupProject(y,projectName);
 if(!p)return {present:false,budget:0,spent:0};
 const stats=[...p.stats.values()];
 let matched=stats.filter(g=>g.code===code);
 let fallback=false;
 if(!matched.length){
  // A classification may have moved to another code. Only match by name when unique.
  const sameName=stats.filter(g=>HIST_TEXT(g.name)===HIST_TEXT(statName));
  if(sameName.length===1){matched=sameName;fallback=true;}
 }
 if(!matched.length)return {present:false,budget:0,spent:0};
 return {present:true,budget:matched.reduce((a,g)=>a+g.budget,0),spent:matched.reduce((a,g)=>a+histSum(histDateFiltered(g.transactions,y)),0),fallback};
}
function v39CurrentComparison(projectName,code=''){
 const budgets=BUDGET.filter(b=>histCanonKey(b.project)===histCanonKey(projectName)&&(!code||b.code===code));
 if(!budgets.length)return {present:false,budget:0,spent:0};
 const keys=new Set(budgets.map(b=>b.key));
 const spent=EX_ROWS.reduce((total,r)=>total+(r.paid&&keys.has(r.k)&&!String(r.d||'').includes('반납')&&reportRowIncluded(r)?Number(r.v||0):0),0);
 return {present:true,budget:budgets.reduce((a,b)=>a+b.won,0),spent};
}
function v39BuildComparison(projectName,code,statName){
 const stat=!!code;
 const data=['2024','2025'].map(y=>({year:y,...(stat?v39PastStat(y,projectName,code,statName):v39PastProject(y,projectName))}));
 data.push({year:'2026',...v39CurrentComparison(projectName,code)});
 const label=stat?'통계목':'세부사업';
 const rows=data.map(r=>{
  const pct=r.present&&r.budget>0?100*r.spent/r.budget:null;
  const displayRate=pct===null?'—':pct.toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
  const width=pct===null?0:Math.max(0,Math.min(100,pct));
  return `<article class="v39-year ${r.year==='2026'?'current':''}" aria-label="${r.year}년 ${label} 비교"><div class="v39-year-top"><b>${r.year}</b><strong>${displayRate}</strong></div><div class="v39-percent-track" role="progressbar" aria-label="${r.year}년 예산 대비 결의율" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.max(0,Math.min(100,pct||0)).toFixed(1)}"><span style="width:${width}%"></span></div><div class="v39-moneyline"><span>예산액</span><strong>${r.present?histFmt(r.budget):'—'}</strong></div><div class="v39-moneyline"><span>${r.year==='2026'?'확인 집행':'결의액'}</span><strong>${r.present?histFmt(r.spent):'—'}</strong></div>${!r.present?'<div class="v39-no-year">이 연도에는 대응 사업·과목이 없습니다.</div>':r.fallback?'<div class="v39-no-year">통계목 이름 기준 연결 · 코드 확인 필요</div>':''}</article>`;
 }).join('');
 return `<section class="v39-comparison" aria-label="${label} 3개년 집행률·예산 비교"><div class="v39-header"><h3>${label} 3개년 예산·집행 추이</h3><span class="v39-range">2024 — 2026</span></div><div class="v39-grid">${rows}</div><details class="v39-note"><summary>ⓘ 연도별 집계 기준</summary><p>2024·2025년은 당시 담당자와 무관한 <b>부서 전체 ${label} 예산</b>과 반납을 제외한 결의액(과목경정 순액 포함)입니다. 2026년은 <b>같은 ${label}의 부서 전체 예산</b>과 ${esc(reportAsOfDate||EX_SOURCE.asof)}까지 지급정보가 확인된 결의액(반납 적요 제외)을 보여 줍니다. 위의 2026년 개인 관리 예산 카드와 범위가 다를 수 있습니다. 예산 집행 기준이 연도별로 달라 공식 집행률 비교가 아닙니다.</p></details></section>`;
}
// v40: The comparison-by-cards was superseded by a compact fiscal-year selector
// in project and statistic drilldowns. Leave the separate history dashboard intact.
const v39BaseFillStat=fillSimpleStatDetail;
fillSimpleStatDetail=function(project,g){v39BaseFillStat(project,g);};
const v39BaseFillProject=fillSimpleDetail;
fillSimpleDetail=function(project){v39BaseFillProject(project);};

const histDateFiltered=(rows,y,cutoff='')=>rows.filter(r=>r.date&&r.date.startsWith(y)&&(!cutoff||r.date<=cutoff));
const histSum=rows=>rows.reduce((sum,r)=>sum+r.amount,0);
const histProjectBudget=(y,key)=>HIST_SOURCE_BY_YEAR[y].find(p=>p.key===key)?.budget||0;
const histProjectSpent=(y,key)=>{const p=HIST_SOURCE_BY_YEAR[y].find(p=>p.key===key);return p?histSum(histDateFiltered(p.transactions,y)):0;};
const histTotalSpent=(y,cutoff='')=>histSum(histDateFiltered(HIST_SOURCE[y].transactions.filter(r=>!r.refund),y,cutoff));
function hist2026Totals(key=''){
 const relevant=key?BUDGET.filter(b=>histCanonKey(b.project)===key):BUDGET;
 const budget=relevant.reduce((n,b)=>n+b.won,0);const keys=new Set(relevant.map(b=>b.key));
 let spent=0;for(const r of EX_ROWS){if(!r.paid||!keys.has(r.k)||String(r.d||'').includes('반납')||!reportRowIncluded(r))continue;spent+=Number(r.v||0);}
 return {budget,spent};
}
function histYearTotals(y,key=''){
 if(y==='2026')return hist2026Totals(key);
 if(!key)return {budget:HIST_SOURCE[y].budgetTotal,spent:histTotalSpent(y)};
 return {budget:histProjectBudget(y,key),spent:histProjectSpent(y,key)};
}
function histCompareHTML(key='',title='최근 3개년 예산·결의 추이'){
 const all=HIST_YEARS.map(y=>({year:y,...histYearTotals(y,key)}));const max=Math.max(1,...all.flatMap(x=>[x.budget,Math.abs(x.spent)]));
 return `<div class="hist-compare-header"><strong>${esc(title)}</strong><span class="hist-compare-legend"><span><i></i>예산액</span><span><i class="spent"></i>${key?'집행/결의액':'결의/집행액'}</span></span></div>`+all.map(a=>`<div class="hist-compare-year ${a.year===histSelectedYear?'current':''}"><b class="year-label">${a.year}</b><div class="hist-bar-stack"><div class="hist-bar-track"><span style="width:${Math.max(0,a.budget/max*100).toFixed(2)}%"></span></div><div class="hist-bar-track spent"><span style="width:${Math.max(0,Math.abs(a.spent)/max*100).toFixed(2)}%"></span></div></div><div class="hist-year-total">${histFmt(a.budget)}<small>집행 ${histFmt(a.spent)}</small></div></div>`).join('')+`<div class="hist-compare-caption">2024·2025: 연간 결의액(반납 제외·과목경정 순액) / 2026: ${esc(reportAsOfDate||EX_SOURCE.asof)} 기준 지급정보 확인 결의액(반납 적요 제외). 집계 기준이 달라 비교용 참고 수치입니다.</div>`;
}
function histRenderCurrentComparison(){const box=byId('hist-current-bars'), sel=byId('hist-current-project');if(!box||!sel)return;
 const names=new Map();for(const y of ['2024','2025'])for(const p of HIST_SOURCE_BY_YEAR[y])names.set(p.key,p.name);
 for(const b of BUDGET)names.set(histCanonKey(b.project),histCanonical(b.project));
 const options=[...names.entries()].sort((a,b)=>a[1].localeCompare(b[1],'ko'));
 const val=sel.value||histProjectChoice;
 sel.innerHTML='<option value="">부서 전체</option>'+options.map(([k,n])=>`<option value="${esc(k)}">${esc(n)}</option>`).join('');
 if(options.some(([k])=>k===val)){sel.value=val;histProjectChoice=val;}else{sel.value='';histProjectChoice='';}
 box.innerHTML=histCompareHTML(histProjectChoice,histProjectChoice?options.find(([k])=>k===histProjectChoice)?.[1]+' · 연도별 추이':'최근 3개년 부서 예산·집행 추이');
}
function histRenderYear(){const y=histSelectedYear;if(y==='2026')return;const h=HIST_SOURCE[y];
 const list=HIST_SOURCE_BY_YEAR[y],cutoff=histCutoffs[y]||'',spent=histTotalSpent(y,cutoff),budget=h.budgetTotal;
 byId('hist-title').textContent=`${y}년 예산·집행현황`;byId('hist-source').textContent=`${h.budgetSource} · 건강관리과 전체 · ${h.transactions.length.toLocaleString('ko-KR')}건 자료`;
 byId('hist-budget').textContent=histFmt(budget);byId('hist-spent').textContent=histFmt(spent);byId('hist-balance').textContent=histFmt(budget-spent);byId('hist-rate').textContent=(spent/budget*100).toFixed(1)+'%';
 const input=byId('hist-cutoff');input.min=y+'-01-01';input.max=y+'-12-31';input.value=cutoff;
 byId('history-compare').innerHTML=histCompareHTML('','최근 3개년 부서 예산·집행 추이');
 const term=HIST_TEXT(histSearch).toLowerCase();
 const shown=list.filter(p=>!term||HIST_TEXT(p.name).toLowerCase().includes(term)||[...p.stats.values()].some(x=>HIST_TEXT(x.name).toLowerCase().includes(term)));
 byId('history-projects').innerHTML=shown.length?shown.map(p=>{const open=histProjectOpen===p.key,tx=histDateFiltered(p.transactions,y,cutoff),spent=histSum(tx),stats=[...p.stats.values()].sort((a,b)=>b.budget-a.budget),extra=stats.filter(x=>x.isMissing).length;
 return `<article class="hist-project ${open?'open':''}"><button type="button" class="hist-project-toggle" data-hist-project="${esc(p.key)}" aria-expanded="${open}"><span class="hist-project-title"><strong>${esc(p.name)}</strong><small>${stats.length}개 통계목${extra?' · 예산서 대응 확인 필요':''}</small></span><span class="hist-project-amount"><b>${histFmt(p.budget)}</b><small>결의액 ${histFmt(spent)}</small></span><span class="hist-project-chevron" aria-hidden="true">›</span></button>${open?`<div class="hist-stat-list"><div class="hist-compare">${histCompareHTML(p.key,esc(p.name)+' · 3개년 비교')}</div>${stats.map(g=>{const trans=histDateFiltered(g.transactions,y,cutoff);return `<button type="button" class="hist-stat-row" data-hist-stat="${esc(p.key)}|${esc(g.key)}"><span class="hist-stat-label"><strong>${esc(g.code)} ${esc(g.name)}</strong><small>${g.isMissing?'⚠ 예산서 대응 미확인':'통계목 상세 보기'}</small></span><span class="hist-stat-value">${histFmt(g.budget)}<small>결의액 ${histFmt(histSum(trans))}</small></span><span class="arrow" aria-hidden="true">›</span></button>`;}).join('')}</div>`:''}</article>`;}).join(''):'<div class="hist-empty">검색 결과가 없습니다.</div>';
}
function histSelectYear(y){if(!HIST_YEARS.includes(String(y)))return;histSelectedYear=String(y);histProjectOpen=null;histStatItem=null;histMonth=null;histLedgerPage=0;histSearch='';
 byId('fiscal-year').value=histSelectedYear;byId('hist-search').value='';document.body.classList.toggle('history-year',y!=='2026');
 if(y!=='2026'){
  if(dashboardView!=='home')v38MainSetView('home');
  byId('history-view').hidden=false;histRenderYear();
 }else{byId('history-view').hidden=true;renderDashboard();}
 window.scrollTo({top:0,behavior:'instant'});
}
function histOpenDetail(key,statKey){const p=HIST_SOURCE_BY_YEAR[histSelectedYear]?.find(p=>p.key===key);const g=p?.stats.get(statKey);if(!g)return;histStatItem={project:p,stat:g};histMonth=null;histLedgerPage=0;histRenderDetail();byId('history-detail').hidden=false;byId('hist-detail-close').focus();}
function histCloseDetail(){byId('history-detail').hidden=true;histStatItem=null;}
function histRenderDetail(){if(!histStatItem)return;const y=histSelectedYear,{project:p,stat:g}=histStatItem,cutoff=histCutoffs[y]||'';
 const tx=histDateFiltered(g.transactions,y,cutoff).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));const spent=histSum(tx);const months=Array(12).fill(0);for(const t of tx)months[Number(t.date.slice(5,7))-1]+=t.amount;const max=Math.max(1,...months.map(Math.abs));
 const filtered=histMonth===null?tx:tx.filter(t=>Number(t.date.slice(5,7))===histMonth);const pages=Math.max(1,Math.ceil(filtered.length/12));histLedgerPage=Math.min(histLedgerPage,pages-1);const rows=filtered.slice(histLedgerPage*12,(histLedgerPage+1)*12);
 byId('hist-detail-crumb').textContent=p.name+' · '+y+'년';byId('hist-detail-title').textContent=g.code+' '+g.name;
 byId('hist-detail-body').innerHTML=`<div class="hist-detail-kpis"><div class="hist-detail-kpi"><span>통계목 예산</span><strong>${histFmt(g.budget)}</strong></div><div class="hist-detail-kpi"><span>반납 제외 결의액</span><strong>${histFmt(spent)}</strong></div><div class="hist-detail-kpi"><span>잔액(차액)</span><strong>${histFmt(g.budget-spent)}</strong></div><div class="hist-detail-kpi"><span>예산 대비 결의율</span><strong>${g.budget?(100*spent/g.budget).toFixed(1)+'%':'—'}</strong></div></div>${g.isMissing?'<p style="font-size:12px;color:#a96923">⚠ 해당 지출이 제공된 예산서의 통계목과 대응되지 않아 예산액은 0원으로 남겼습니다.</p>':''}<div class="hist-detail-section-title">월별 지출현황</div><div class="hist-month-grid">${months.map((a,i)=>`<button type="button" class="hist-month ${histMonth===i+1?'selected':''}" data-hist-month="${i+1}" title="${i+1}월 결의액 ${histFmt(a)}"><span class="hist-month-tower"><i class="${a<0?'negative':''}" style="height:${Math.abs(a)>0?Math.max(4,Math.round(Math.abs(a)/max*100)):2}%"></i></span><span class="hist-month-label">${i+1}월</span><span class="hist-month-money">${histFmt(a).replace(' 원','')}</span></button>`).join('')}</div><div class="hist-ledger-title"><strong>건별 결의내역 · ${filtered.length.toLocaleString('ko-KR')}건</strong>${histMonth!==null?'<button data-hist-month="all">전체 월 보기</button>':''}</div><div class="hist-ledger">${rows.length?rows.map(t=>`<div class="hist-ledger-row"><span class="date">${esc(t.date)}</span><span class="detail">${esc(t.desc)}<small>${esc(t.kind||'결의확정')}</small></span><span class="amount">${histFmt(t.amount)}</span></div>`).join(''):'<div class="hist-empty">해당 월의 집행내역이 없습니다.</div>'}</div>${pages>1?`<div class="hist-ledger-pager"><button type="button" data-hist-page="prev" ${histLedgerPage===0?'disabled':''}>이전</button><span>${histLedgerPage+1} / ${pages}쪽</span><button type="button" data-hist-page="next" ${histLedgerPage===pages-1?'disabled':''}>다음</button></div>`:''}<p class="hist-footnote">반납으로 식별된 거래는 분석에서 제외했으며, 과목경정은 음수·양수를 그대로 반영했습니다. 표시된 날짜는 결의승인일이며 공식 지급일이 아닐 수 있습니다.</p>`;
}
byId('fiscal-year').addEventListener('change',e=>histSelectYear(e.target.value));
// Editing the latest source always returns to 2026 before opening its panel.
for(const id of ['side-execution','side-import'])byId(id)?.addEventListener('click',()=>{if(histSelectedYear!=='2026')histSelectYear('2026');},true);
byId('hist-current-project').addEventListener('change',e=>{histProjectChoice=e.target.value;histRenderCurrentComparison();});
byId('hist-cutoff').addEventListener('change',e=>{const y=histSelectedYear;let v=e.target.value;if(v&&(v<y+'-01-01'||v>y+'-12-31')){toast('해당 회계연도 안의 날짜를 선택해 주세요.');return;}histCutoffs[y]=v;histRenderYear();if(histStatItem)histRenderDetail();});
byId('hist-all').addEventListener('click',()=>{histCutoffs[histSelectedYear]='';histRenderYear();});
byId('hist-search').addEventListener('input',e=>{histSearch=e.target.value;histRenderYear();});
byId('history-projects').addEventListener('click',e=>{const stat=e.target.closest('[data-hist-stat]');if(stat){const ix=stat.dataset.histStat.indexOf('|');histOpenDetail(stat.dataset.histStat.slice(0,ix),stat.dataset.histStat.slice(ix+1));return;}const project=e.target.closest('[data-hist-project]');if(project){const key=project.dataset.histProject;histProjectOpen=histProjectOpen===key?null:key;histRenderYear();}});
byId('hist-detail-close').addEventListener('click',histCloseDetail);
byId('history-detail').addEventListener('click',e=>{if(e.target.closest('[data-hist-close]'))histCloseDetail();const month=e.target.closest('[data-hist-month]');if(month){histMonth=month.dataset.histMonth==='all'?null:Number(month.dataset.histMonth);histLedgerPage=0;histRenderDetail();}const page=e.target.closest('[data-hist-page]');if(page){histLedgerPage=Math.max(0,histLedgerPage+(page.dataset.histPage==='next'?1:-1));histRenderDetail();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!byId('history-detail').hidden)histCloseDetail();});
// Home remains the only year-aware view; editing functions safely return to the current year.
const v38MainSetView=setMainView;
setMainView=function(view){if(view!=='home'&&histSelectedYear!=='2026')histSelectYear('2026');v38MainSetView(view);if(view==='home'&&histSelectedYear!=='2026')histRenderYear();};
const v38RenderDashboard=renderDashboard;
renderDashboard=function(){v38RenderDashboard();histRenderCurrentComparison();};
// Prepopulate latest 2026 comparison without touching persisted user data.
histRenderCurrentComparison();


// v40: Choose one of 2024, 2025, or 2026 in the existing project / statistic dialogs.
// Historical rows are read-only and are matched by canonical project + statistic code.
// No past staff ownership is inferred and no fiscal source or allocation is modified.
const V40_YEARS=[2026,2025,2024];
const v40YearSelect=(attr,year)=>`<select ${attr} aria-label="월별 집행현황 회계연도">${V40_YEARS.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}년</option>`).join('')}</select>`;
function v40StatHistory(y,projectName,code,statName){
 const p=v39HistLookupProject(String(y),projectName);
 if(!p)return {present:false,budget:0,spent:0,entries:[],fallback:false};
 const stats=[...p.stats.values()];
 let found=stats.filter(g=>g.code===code),fallback=false;
 if(!found.length){
  const sameName=stats.filter(g=>HIST_TEXT(g.name)===HIST_TEXT(statName));
  if(sameName.length===1){found=sameName;fallback=true;}
 }
 if(!found.length)return {present:false,budget:0,spent:0,entries:[],fallback:false};
 const entries=histDateFiltered(found.flatMap(g=>g.transactions),String(y)).map(t=>({
  id:t.id,date:t.date||'',desc:t.desc||'(적요 없음)',amount:Number(t.amount)||0,paid:true,kind:t.kind||'결의확정'
 })).sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
 return {present:true,budget:found.reduce((total,g)=>total+g.budget,0),spent:entries.reduce((total,r)=>total+r.amount,0),entries,fallback};
}
function v40HistoryStatDetail(project,g,y){
 const data=v40StatHistory(y,project.name,g.code,g.statName);
 const monthly=Array(12).fill(0);
 for(const r of data.entries){const m=statMonthOf(r.date);if(m)monthly[m-1]+=r.amount;}
 const max=Math.max(1,...monthly.map(v=>Math.abs(v)));
 const shown=data.entries.filter(r=>statLedgerMonth===null||statMonthOf(r.date)===statLedgerMonth);
 const pages=Math.max(1,Math.ceil(shown.length/STAT_LEDGER_PAGE_SIZE));
 statLedgerPage=Math.max(0,Math.min(statLedgerPage,pages-1));
 const items=shown.slice(statLedgerPage*STAT_LEDGER_PAGE_SIZE,(statLedgerPage+1)*STAT_LEDGER_PAGE_SIZE);
 const shownTotal=shown.reduce((sum,r)=>sum+r.amount,0);
 const rate=data.present&&data.budget>0?100*data.spent/data.budget:null;
 const pct=rate===null?0:Math.max(0,Math.min(100,rate));
 byId('simple-modal-eyebrow').textContent=project.name+' · '+y+'년 통계목 상세';
 byId('simple-modal-title').textContent=g.code+' '+g.statName;
 const action=byId('simple-execution-from-modal');
 action.textContent='과거 자료 · 조회 전용';action.disabled=true;action.title='과거 회계연도 자료는 조회만 가능합니다.';
 const monthButtons=monthly.map((amount,i)=>{
  const m=i+1,active=statLedgerMonth===m,height=amount?Math.max(6,Math.round(Math.abs(amount)/max*118)):2;
  return `<button type="button" class="stat-month ${active?'active':''}" data-stat-month="${m}" aria-pressed="${active}" title="${m}월 반납 제외 결의액 ${esc(money(amount))}"><span class="stat-month-barbox"><i class="stat-month-bar ${amount<0?'negative':amount===0?'zero':''}" style="height:${height}px"></i></span><span class="stat-month-label">${m}월</span><span class="stat-month-amount">${esc(statCompactAmount(amount))}</span></button>`;
 }).join('');
 const fmtValue=(n)=>data.present?displayBudget(n):'—';
 const emptyMessage=data.present?'선택한 기간에 해당 통계목의 결의내역이 없습니다.':'해당 연도에 연결되는 세부사업·통계목 자료가 없습니다.';
 byId('simple-modal-body').innerHTML=`
  <button class="stat-back" type="button" data-stat-back>← ${esc(project.name)}의 통계목 목록</button>
  <p class="v40-history-intro"><span class="v40-historical-tag">${y}년 · 과거 부서 전체</span> 담당자 구분 없이 동일 사업·통계목의 결의내역을 보여줍니다.</p>
  <div class="stat-kpis" aria-label="${y}년 통계목 예산·결의·차액·집행률">
   <div class="stat-kpi"><span>${y}년 통계목 예산</span><strong>${fmtValue(data.budget)}</strong><small>${data.present?esc(money(data.budget)):'해당 과목 없음'}</small></div>
   <div class="stat-kpi stat-spent"><span>반납 제외 결의액</span><strong>${fmtValue(data.spent)}</strong><small>${data.entries.length}건 · 과목경정 순액 포함</small></div>
   <div class="stat-kpi"><span>예산·결의 차액</span><strong>${fmtValue(data.budget-data.spent)}</strong><small>연간 예산 − 결의액</small></div>
   <div class="stat-kpi stat-rate"><span>예산 대비 결의율</span><strong>${rate===null?'—':rate.toFixed(1)+'%'}</strong><small>부서 전체 기준</small></div>
  </div>
  <div class="stat-progress" role="progressbar" aria-label="${y}년 예산 대비 결의율" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct.toFixed(1)}"><span style="width:${pct.toFixed(1)}%"></span></div>
  ${data.fallback?'<p class="stat-attention">ⓘ 이 연도의 통계목 코드는 다르지만 명칭이 같아 연결했습니다. 코드 확인이 필요합니다.</p>':''}
  <section class="stat-section" aria-label="${y}년 월별 지출 그래프">
   <div class="stat-section-head"><h3>월별 지출현황</h3>${v40YearSelect('class="stat-year-select" data-stat-year',y)}</div>
   <p class="stat-section-sub">${y}년 반납 제외 결의액 · 월을 누르면 그 달의 지출만 볼 수 있어요.</p>
   <div class="stat-chart" role="group" aria-label="${y}년 월별 결의액">${monthButtons}</div>
   <div class="stat-chart-actions"><button type="button" class="stat-filter-all ${statLedgerMonth===null?'active':''}" data-stat-month="all" aria-pressed="${statLedgerMonth===null}">전체 월 보기</button><span class="stat-month-summary">${statLedgerMonth===null?'연간':statLedgerMonth+'월'} ${fmt(shown.length)}건 · ${esc(money(shownTotal))}</span></div>
  </section>
  <section class="stat-section" aria-label="${y}년 건별 지출 내역">
   <div class="stat-section-head"><h3>건별 집행내역</h3><span class="stat-month-summary">${y}년${statLedgerMonth===null?' 전체':' '+statLedgerMonth+'월'} · ${fmt(shown.length)}건</span></div>
   <div class="stat-ledger"><div class="stat-ledger-heading"><span>결의일자</span><span>지출 적요</span><span style="text-align:right">결의금액</span></div>
   ${items.length?items.map(r=>`<div class="stat-ledger-item"><span class="stat-ledger-date">${esc(r.date)}</span><span class="stat-ledger-description">${esc(r.desc)}<small>${esc(r.id)} · ${esc(r.kind)}</small></span><span class="stat-ledger-money">${esc(money(r.amount))}</span></div>`).join(''):`<div class="stat-ledger-empty">${emptyMessage}</div>`}
   </div>
   ${shown.length>STAT_LEDGER_PAGE_SIZE?`<div class="stat-ledger-pager"><button type="button" data-stat-page="prev" ${statLedgerPage===0?'disabled':''}>이전</button><span>${statLedgerPage+1} / ${pages}쪽</span><button type="button" data-stat-page="next" ${statLedgerPage>=pages-1?'disabled':''}>다음</button></div>`:''}
  </section>
  <details class="v40-history-note"><summary>ⓘ 집계 기준</summary><p>2024·2025년은 당시 담당자와 관계없이 부서 전체의 동일 세부사업·통계목 기준입니다. 반납 거래는 제외했고, 과목경정 금액은 부호대로 반영했습니다. 기록된 결의일자는 실제 지급일과 다를 수 있습니다. 과거 자료는 조회 전용이며 회계연도별 집행률은 참고값입니다.</p></details>`;
}
const v40BaseFillStat=fillSimpleStatDetail;
fillSimpleStatDetail=function(project,g){
 if(!g.isDemo&&(statLedgerYear===2024||statLedgerYear===2025)){
  v40HistoryStatDetail(project,g,statLedgerYear);return;
 }
 v40BaseFillStat(project,g);
 // The original v28 selector contains only source years. Display the requested three years.
 const select=byId('simple-modal-body').querySelector('[data-stat-year]');
 if(select){select.outerHTML=v40YearSelect('class="stat-year-select" data-stat-year',2026);}
};
const v40BaseFillProject=fillSimpleDetail;
fillSimpleDetail=function(project){
 v40BaseFillProject(project);
 if(simpleStatKey!==null)return;
 const y=V40_YEARS.includes(statLedgerYear)?statLedgerYear:2026;
 const body=byId('simple-modal-body');
 const existing=body.querySelector('.stat-report-panel');
 if(existing)existing.insertAdjacentHTML('beforebegin',`<div class="v40-fiscal-choice"><span>조회 연도</span>${v40YearSelect('data-project-stat-year',y)}</div>`);
 if(y===2026||dashboardSample)return;
 const data=v39PastProject(String(y),project.name);
 byId('simple-modal-eyebrow').textContent=y+'년 세부사업 조회';
 const action=byId('simple-execution-from-modal');action.textContent='과거 자료 · 조회 전용';action.disabled=true;
 if(existing)existing.outerHTML=`<p class="v40-history-intro">${y}년 부서 전체 예산·결의액 기준 · 과거 자료는 수정할 수 없습니다.</p>`;
 const cards=body.querySelectorAll('.simple-detail-summary .simple-detail-card');
 if(cards.length>=3){
  cards[0].innerHTML=`<span>${y}년 예산</span><strong>${data.present?displayBudget(data.budget):'—'}</strong>`;
  cards[1].innerHTML=`<span>반납 제외 결의액</span><strong>${data.present?displayBudget(data.spent):'—'}</strong>`;
  cards[2].innerHTML=`<span>예산·결의 차액</span><strong>${data.present?displayBudget(data.budget-data.spent):'—'}</strong>`;
 }
 const note=body.querySelector('.simple-detail-note');
 if(note)note.textContent=data.present?'2026년 현재 내가 관리하는 통계목 중 동일한 과목을 찾아 보여줍니다. 통계목을 누르면 월별·건별 지출내역을 볼 수 있어요.':'해당 연도에 대응하는 세부사업이 없습니다. 통계목별 자료도 확인할 수 있습니다.';
 for(const g of project.groups){
  const row=[...body.querySelectorAll('[data-simple-stat]')].find(el=>el.dataset.simpleStat===g.key);
  if(!row)continue;
  const past=v40StatHistory(y,project.name,g.code,g.statName);
  const value=row.querySelector('.simple-detail-item-value');
  if(value)value.innerHTML=past.present?`${displayBudget(past.budget)}<small>결의액 ${displayBudget(past.spent)}</small>`:'—<small>해당 연도 자료 없음</small>';
 }
};
byId('simple-modal-body').addEventListener('change',e=>{
 if(!e.target.matches('[data-stat-year]'))return;
 // The original v28 handler retains a previously selected month. Reset the
 // month when moving across years, and handle the event only once.
 e.stopImmediatePropagation();
 const year=Number(e.target.value);
 if(!V40_YEARS.includes(year))return;
 statLedgerYear=year;statLedgerMonth=null;statLedgerPage=0;
 rerenderSimpleOpenDetail();
},true);
byId('simple-modal-body').addEventListener('change',e=>{
 if(!e.target.matches('[data-project-stat-year]'))return;
 const year=Number(e.target.value);
 if(!V40_YEARS.includes(year))return;
 statLedgerYear=year;statLedgerMonth=null;statLedgerPage=0;
 rerenderSimpleOpenDetail();
});

// V41 — Forecast reservations, safe matching to already imported 2026 expenditure.
// Planning information is user-owned, independent of fiscal source transactions.
const PLAN_MATCH_STOP=new Set(['지급','비용','사업','내역','금액','집행','결의','관련','예산','구입비','지출','일반','대상','2026','2025','위탁']);
S.spendingPlans=Array.isArray(S.spendingPlans)?S.spendingPlans:[];
let planEditorId=null,planMatchId=null,planMatchRow=null,planMatchAlloc=null,planCandidateOpen=new Set();
function planAll(){S.spendingPlans=Array.isArray(S.spendingPlans)?S.spendingPlans:[];return S.spendingPlans;}
function planOwned(p){return p&&p.owner===S.selectedOwner&&S.allocs.some(a=>a.id===p.allocId&&a.owner===S.selectedOwner);}
function planForGroup(g){return planAll().filter(p=>p.owner===S.selectedOwner&&g.items.some(x=>x.alloc?.id===p.allocId));}
function planUsedRows(){return new Set(planAll().filter(p=>p.linkedRow).map(p=>String(p.linkedRow)+'::'+String(p.allocId)));}
function planLinkValid(p){
 if(!p.linkedRow)return false;
 const a=S.allocs.find(x=>x.id===p.allocId&&x.owner===p.owner);
 const r=EX_ID.get(p.linkedRow);
 if(!a||!r||!r.paid||r.k!==a.key||r.v<=0)return false;
 return exRecordSharesForAllocation(r,a)>0;
}
function planReserved(p){return planLinkValid(p)?0:Number(p.amount)||0;}
function planAvailableForGroup(g){return g.amount-g.spent-planForGroup(g).reduce((n,p)=>n+planReserved(p),0);}
function planWords(v){return [...new Set(String(v||'').replace(/\d{4}년|\d+월|[()[\]{}.,\-/]/g,' ').split(/\s+/).map(s=>s.trim()).filter(s=>s.length>1&&!PLAN_MATCH_STOP.has(s)))];}
function planScore(p,r){
 const amount=Math.abs(Number(r.v)||0),target=Number(p.amount)||0;
 if(!amount||!target)return -Infinity;
 const diff=Math.abs(amount-target)/Math.max(amount,target);
 const tokens=planWords(p.title);const desc=String(r.d||'');
 const overlap=tokens.filter(t=>desc.includes(t));
 const sameMonth=String(r.dt||r.propdate||'').slice(0,7)===String(p.date||'').slice(0,7);
 const days=Math.abs((new Date(r.dt+'T00:00:00')-new Date(p.date+'T00:00:00'))/86400000);
 // Recommending needs substantial overlap or a genuinely close financial/date match.
 if(!overlap.length&&!(diff<=.10&&days<=31))return -Infinity;
 return overlap.length*38+(overlap.length===tokens.length&&tokens.length?12:0)+(diff<=.05?30:diff<=.2?17:diff<=.4?6:0)+(sameMonth?16:Number.isFinite(days)&&days<=45?5:0)-Math.min(30,diff*23);
}
function planCandidates(p){
 const a=S.allocs.find(x=>x.id===p.allocId&&x.owner===S.selectedOwner);
 if(!a)return [];
 const linked=planUsedRows(),ignored=exIgnoredRows();
 return exPerCategory(a.key).filter(r=>r.paid&&r.v>0&&!r.needsReview&&!ignored.has(r.i)&&!linked.has(r.i+'::'+a.id)&&
  (exRecordSharesForAllocation(r,a)>0||(!exIsAuto(r)&&exRemainingForRecord(r)>0)))
  .map(r=>({r,score:planScore(p,r)})).filter(x=>Number.isFinite(x.score)&&x.score>0)
  .sort((x,y)=>y.score-x.score||String(y.r.dt).localeCompare(String(x.r.dt))).slice(0,6);
}
function planRenderPanel(project,g){
 const plans=planForGroup(g).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const reserved=plans.reduce((n,p)=>n+planReserved(p),0),available=planAvailableForGroup(g);
 const matched=plans.filter(planLinkValid).length;
 return `<section class="plan-section" id="plan-section" aria-label="예산 사용계획">
  <div class="plan-title-row"><div><span class="plan-kicker">2026 · 내 관리분</span><h3>예산 사용계획 <span class="plan-count">${plans.length}건</span></h3></div><button type="button" class="plan-primary" data-plan-add="${esc(g.key)}">＋ 계획 추가</button></div>
  <div class="plan-summary">
   <div><small>확인 집행</small><strong>${displayBudget(g.spent)}</strong></div>
   <div><small>사용 예정</small><strong class="plan-amber">${displayBudget(reserved)}</strong></div>
   <div><small>계획 후 가용</small><strong class="${available<0?'plan-red':'plan-green'}">${displayBudget(available)}</strong></div>
  </div>
  ${available<0?'<p class="plan-warning">⚠ 계획 금액이 확인된 잔액을 초과했습니다. 금액을 다시 확인하세요.</p>':''}
  ${reportAsOfDate?'<p class="plan-fine">집행액에는 선택한 조회 기준일이 적용됩니다. 사용계획은 현재 등록된 전체 계획 기준입니다.</p>':''}
  ${plans.length?`<div class="plan-items">${plans.map(p=>{
    const done=planLinkValid(p),orphan=!!p.linkedRow&&!done;
    const a=S.allocs.find(x=>x.id===p.allocId),r=EX_ID.get(p.linkedRow);
    const candidates=done?[]:planCandidates(p);
    const expanded=planCandidateOpen.has(p.id);
    return `<article class="plan-item ${done?'plan-done':''}">
     <div class="plan-item-top"><div class="plan-item-main"><span class="plan-status ${done?'done':orphan?'attention':'ready'}">${done?(r?.needsReview?'집행 연결 · 거래 변경 확인':'집행 연결 완료'):orphan?'연결 재확인 필요':'사용 예정'}</span><strong>${esc(p.title)}</strong><small>${esc(p.date||'')} 예정 · ${esc(a?.label||'예산 항목')}</small></div><div class="plan-item-money">${displayBudget(Number(p.amount)||0)}${done?`<small>실제 ${displayBudget(exRecordSharesForAllocation(r,a))}</small>`:''}</div></div>
     ${done?`<p class="plan-linked">✓ ${esc(r.dt||r.propdate||'')} · ${esc(r.d||'결의내역')} (${esc(money(exRecordSharesForAllocation(r,a)))})</p>`:''}
     ${orphan?'<p class="plan-warning">연결한 지출이 변경·삭제되었거나 지급 미확인 상태입니다. 사용 예정액을 다시 예약해 두었습니다.</p>':''}${done&&r?.needsReview?'<p class="plan-warning">연결한 거래에 변경 사항이 있어 집행내역 연결 화면에서 금액을 확인해 주세요. 실제 집행액은 중복 차감하지 않습니다.</p>':''}
     <div class="plan-actions">${!done?`<button type="button" data-plan-suggest="${esc(p.id)}">${candidates.length?'추천 지출 '+candidates.length+'건 확인':'지출 연결 확인'}</button><button type="button" data-plan-edit="${esc(p.id)}">수정</button>`:`<button type="button" data-plan-unmatch="${esc(p.id)}">계획 연결 해제</button>`}<button type="button" data-plan-delete="${esc(p.id)}">삭제</button></div>
     ${!done&&expanded?`<div class="plan-candidates"><div class="plan-candidate-title">일치 가능성이 있는 지출 · 자동 확정하지 않습니다</div>${candidates.length?candidates.map(({r,score})=>`<div class="plan-candidate"><div><b>${esc(r.d)}</b><small>${esc(r.dt||r.propdate||'날짜 미기재')} · ${score>=75?'높은 유사도':'검토 권장'} · 결의액 ${esc(money(r.v))}</small></div><button type="button" data-plan-pick="${esc(p.id)}" data-plan-row="${esc(r.i)}">연결</button></div>`).join(''):'<p class="plan-fine">적요·금액·예정일이 비슷한 지급 확인 거래가 아직 없습니다. 새 집행자료를 올리거나 먼저 집행내역에서 예산을 연결한 후 다시 확인하세요.</p>'}</div>`:''}
    </article>`;
   }).join('')}</div>`:'<div class="plan-empty">아직 사용계획이 없어요. 언제, 얼마를 쓸지 미리 예약해 보세요.</div>'}
  <p class="plan-fine">ⓘ 사용 예정액은 실제 집행액에 더하지 않습니다. 연결 승인 후에만 계획 예약을 해제하며, 실제 집행액은 기존 결의자료 기준으로 계산합니다. 과거 연도는 조회 전용입니다.</p>
 </section>`;
}
function planInjectIntoCurrent(project,g){
 if(g.isDemo||Number(statLedgerYear)!==2026)return;
 const target=byId('simple-modal-body')?.querySelector('.stat-section');
 if(!target)return;
 target.insertAdjacentHTML('beforebegin',planRenderPanel(project,g));
}
const v41PrevFillStat=fillSimpleStatDetail;
fillSimpleStatDetail=function(project,g){v41PrevFillStat(project,g);planInjectIntoCurrent(project,g);};
function planRefresh(){
 renderDashboard();
 if(simpleProjectName&&!byId('simple-modal').hidden)rerenderSimpleOpenDetail();
}
function planOpenEditor(id=null){
 const group=groupDashboardByProject(viewDashboardRows()).find(p=>p.name===simpleProjectName)?.groups.find(g=>g.key===simpleStatKey);
 if(!group||dashboardSample||Number(statLedgerYear)!==2026){toast('2026년 내 관리 예산에서만 사용계획을 등록할 수 있어요.');return;}
 const existing=id?planAll().find(p=>p.id===id&&planOwned(p)&&group.items.some(row=>row.alloc?.id===p.allocId)):null;
 if(id&&!existing)return;
 if(existing&&planLinkValid(existing)){toast('완료된 계획은 연결을 해제한 후 수정할 수 있어요.');return;}
 planEditorId=existing?.id||null;
 byId('plan-edit-title').textContent=existing?'사용계획 수정':'사용계획 추가';
 const sel=byId('plan-edit-alloc');sel.innerHTML=group.items.filter(row=>row.alloc).map(row=>`<option value="${esc(row.alloc.id)}">${esc(row.label||group.statName)} (${displayBudget(row.amount)})</option>`).join('');
 sel.value=existing?.allocId||sel.options[0]?.value||'';
 byId('plan-edit-name').value=existing?.title||'';
 byId('plan-edit-amount').value=existing?existing.amount:'';
 const d=new Date();const today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 byId('plan-edit-date').value=existing?.date||today;
 byId('plan-edit-error').textContent='';
 byId('plan-edit-dialog').hidden=false;byId('plan-edit-name').focus();
}
function planCloseEditor(){byId('plan-edit-dialog').hidden=true;planEditorId=null;}
function planSave(e){e.preventDefault();
 const a=S.allocs.find(x=>x.id===byId('plan-edit-alloc').value&&x.owner===S.selectedOwner);
 const group=groupDashboardByProject(viewDashboardRows()).find(p=>p.name===simpleProjectName)?.groups.find(g=>g.key===simpleStatKey);
 const title=byId('plan-edit-name').value.trim(),date=byId('plan-edit-date').value,amount=Number(byId('plan-edit-amount').value);
 const err=byId('plan-edit-error');
 if(!group||!a||a.key!==group.key){err.textContent='연결할 예산을 다시 선택해 주세요.';return;}
 if(!title||title.length>80){err.textContent='사용 목적은 1~80자로 입력해 주세요.';return;}
 if(!/^2026-\d{2}-\d{2}$/.test(date)||!reportValidDate(date)){err.textContent='2026년의 올바른 예정일을 선택해 주세요.';return;}
 if(!Number.isSafeInteger(amount)||amount<=0){err.textContent='양의 정수 금액(원)을 입력해 주세요.';return;}
 const current=planAll().find(p=>p.id===planEditorId&&planOwned(p));
 const balance=group.amount-group.spent-planForGroup(group).filter(p=>p.id!==planEditorId).reduce((sum,p)=>sum+planReserved(p),0);
 if(amount>balance&&!confirm(`계획한 금액이 현재 가용 예산 ${money(balance)}을 초과합니다. 초과 계획으로 등록할까요?`))return;
 if(current){if(planLinkValid(current)){err.textContent='완료된 계획은 수정할 수 없습니다.';return;}Object.assign(current,{title,date,amount,allocId:a.id,linkedRow:null,linkedAt:null});}
 else planAll().push({id:uid(),owner:S.selectedOwner,allocId:a.id,title,date,amount,linkedRow:null,linkedAt:null,createdAt:new Date().toISOString()});
 persist();planCloseEditor();planRefresh();toast('예산 사용계획을 저장했어요.');
}
function planDelete(id){const p=planAll().find(x=>x.id===id&&planOwned(x));if(!p)return;
 if(!confirm('이 사용계획을 삭제할까요? 실제 지출내역과 예산 연결은 삭제되지 않습니다.'))return;
 S.spendingPlans=S.spendingPlans.filter(x=>x.id!==id);planCandidateOpen.delete(id);persist();planRefresh();toast('사용계획을 삭제했어요.');
}
function planUnmatch(id){const p=planAll().find(x=>x.id===id&&planOwned(x));if(!p)return;
 if(!confirm('계획과 지출의 연결을 해제할까요? 기존 실제 지출액은 그대로 유지하고 예정액이 다시 예약됩니다.'))return;
 p.linkedRow=null;p.linkedAt=null;persist();planRefresh();toast('계획 연결만 해제했어요. 실제 지출은 유지됩니다.');
}
function planOpenMatch(id,rowId){
 const p=planAll().find(x=>x.id===id&&planOwned(x)),a=S.allocs.find(x=>x.id===p?.allocId),r=EX_ID.get(rowId);
 if(!p||!a||!r||!planCandidates(p).some(x=>x.r.i===rowId)){toast('현재 연결할 수 없는 거래입니다. 목록을 다시 확인해 주세요.');planRefresh();return;}
 planMatchId=id;planMatchRow=rowId;planMatchAlloc=a.id;
 const credited=exRecordSharesForAllocation(r,a),remain=exRemainingForRecord(r);
 const willAllocate=credited<=0&&!exIsAuto(r);
 byId('plan-match-title').textContent=p.title;
 byId('plan-match-detail').textContent=`${r.dt||r.propdate||''} · ${r.d} · 결의액 ${money(r.v)}`;
 byId('plan-match-note').textContent=willAllocate?'이 지출을 내 예산에 연결하고 사용계획을 완료합니다. 확정 이후 실제 집행액은 기존 집계 방식대로 한 번만 반영됩니다.':'이미 내 예산에 반영된 지출입니다. 집행액은 추가하지 않고 계획 예약만 해제합니다.';
 const input=byId('plan-match-amount'),holder=byId('plan-match-entry');holder.hidden=!willAllocate;
 input.value=String(willAllocate?Math.min(remain,p.amount):Math.max(0,credited));input.max=String(remain);
 byId('plan-match-error').textContent='';byId('plan-match-dialog').hidden=false;
 if(willAllocate)input.focus();else byId('plan-match-yes').focus();
}
function planCloseMatch(){byId('plan-match-dialog').hidden=true;planMatchId=null;planMatchRow=null;planMatchAlloc=null;}
function planCommitMatch(){
 const p=planAll().find(x=>x.id===planMatchId&&planOwned(x)),a=S.allocs.find(x=>x.id===planMatchAlloc&&x.owner===S.selectedOwner),r=EX_ID.get(planMatchRow);
 const error=byId('plan-match-error');
 if(!p||!a||p.allocId!==a.id||!r||!r.paid||r.v<=0||r.needsReview||r.k!==a.key||planUsedRows().has(r.i+'::'+a.id)){error.textContent='거래 또는 예산 상태가 변경됐습니다. 다시 확인해 주세요.';return;}
 if(planLinkValid(p)){error.textContent='이미 완료한 계획입니다.';return;}
 if(exIgnoredRows().has(r.i)){error.textContent='내 지출이 아니라고 무시한 거래는 연결할 수 없습니다.';return;}
 const credited=exRecordSharesForAllocation(r,a);
 if(credited<=0){
  if(exIsAuto(r)){error.textContent='자동 연결 예산과 일치하지 않습니다.';return;}
  const n=Number(byId('plan-match-amount').value),rem=exRemainingForRecord(r);
  if(!Number.isSafeInteger(n)||n<=0||n>rem){error.textContent='남은 결의금액 내에서 연결할 금액을 입력해 주세요.';return;}
  // Reserve safely before writing the new plan link. The source row is not modified.
  exShares().push({id:uid(),row:r.i,allocId:a.id,amount:n});
 }
 p.linkedRow=r.i;p.linkedAt=new Date().toISOString();
 persist();planCloseMatch();planCandidateOpen.delete(p.id);planRefresh();toast('실제 지출과 연결했어요. 사용 예정액은 해제되고 지출은 한 번만 반영됩니다.');
}
byId('simple-modal-body').addEventListener('click',e=>{
 const add=e.target.closest('[data-plan-add]'),edit=e.target.closest('[data-plan-edit]'),del=e.target.closest('[data-plan-delete]'),unmatch=e.target.closest('[data-plan-unmatch]'),suggest=e.target.closest('[data-plan-suggest]'),pick=e.target.closest('[data-plan-pick]');
 if(add){planOpenEditor();return;}if(edit){planOpenEditor(edit.dataset.planEdit);return;}
 if(del){planDelete(del.dataset.planDelete);return;}if(unmatch){planUnmatch(unmatch.dataset.planUnmatch);return;}
 if(suggest){const id=suggest.dataset.planSuggest; if(planCandidateOpen.has(id))planCandidateOpen.delete(id);else planCandidateOpen.add(id);rerenderSimpleOpenDetail();return;}
 if(pick){planOpenMatch(pick.dataset.planPick,pick.dataset.planRow);return;}
});
byId('plan-edit-form').addEventListener('submit',planSave);
byId('plan-edit-cancel').addEventListener('click',planCloseEditor);
byId('plan-edit-x').addEventListener('click',planCloseEditor);
byId('plan-match-form').addEventListener('submit',e=>{e.preventDefault();planCommitMatch();});
byId('plan-match-cancel').addEventListener('click',planCloseMatch);
byId('plan-match-x').addEventListener('click',planCloseMatch);
for(const id of ['plan-edit-dialog','plan-match-dialog'])byId(id).addEventListener('click',e=>{if(e.target.id===id){if(id==='plan-edit-dialog')planCloseEditor();else planCloseMatch();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!byId('plan-match-dialog').hidden)planCloseMatch();else if(!byId('plan-edit-dialog').hidden)planCloseEditor();}});

// Surface suggested matches before the user opens the statistic details.
function planUpdateDashboardHints(){
 const projects=groupDashboardByProject(viewDashboardRows());
 for(const [i,project] of projects.entries()){
  const row=byId('simple-projects')?.querySelector(`[data-simple-project="${i}"]`);
  if(!row||dashboardSample)continue;
  const plans=project.groups.flatMap(planForGroup);
  const waiting=plans.filter(p=>!planLinkValid(p));
  const suggestions=waiting.filter(p=>planCandidates(p).length).length;
  if(!plans.length)continue;
  const label=row.querySelector('.simple-project-code');
  if(!label)continue;
  label.insertAdjacentHTML('beforeend',` <span class="plan-mini-hint ${suggestions?'suggest':''}">사용계획 ${plans.length}건${suggestions?' · 지출 연결 추천 '+suggestions+'건':''}</span>`);
 }
}
const v41PreviousRenderSimpleDashboard=renderSimpleDashboard;
renderSimpleDashboard=function(){v41PreviousRenderSimpleDashboard();planUpdateDashboardHints();};
// Refresh the dashboard once when opening v41. Existing allocations / expense records are intact.
renderDashboard();

})();
