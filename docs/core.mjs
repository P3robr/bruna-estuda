export const APP='bruna-estuda';
export const FORMAT=1;
export const blankState=()=>({app:APP,version:FORMAT,revision:0,sessions:[],active:null,favorites:[],doubts:[],reports:[],cards:{},goal:20,cardIntervals:[1,3,7],lastExport:null});
export const clone=x=>structuredClone(x);
export const localDay=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function elapsed(session,now=Date.now()){
  return Math.max(0,session.accumulated+(session.paused||session.finishedAt?0:Math.max(0,now-session.resumedAt)));
}
export function pause(session,now=Date.now()){
  if(session.paused||session.finishedAt)return;
  session.accumulated=elapsed(session,now);session.paused=true;session.pauses++;
}
export function resume(session,now=Date.now()){
  if(!session.paused||session.finishedAt)return;
  session.paused=false;session.resumedAt=now;
}
export const expired=(s,now=Date.now())=>s.limitMs>0&&elapsed(s,now)>=s.limitMs;
export function shuffle(items,random=Math.random){
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export function choose(questions,count){
  if(!Number.isInteger(count)||count<1||count>questions.length)throw new Error(`Disponíveis: ${questions.length} questões. Ajuste a quantidade.`);
  if(new Set(questions.map(q=>q.id)).size!==questions.length)throw new Error('Acervo com identificadores duplicados.');
  return shuffle(questions).slice(0,count);
}
export function newSession(questions,config,now=Date.now(),id=crypto.randomUUID()){
  if(!questions.length||new Set(questions.map(q=>q.id)).size!==questions.length)throw new Error('Sessão vazia ou com questões repetidas.');
  const rules={penalty:config.penalty??0,weights:config.weights??{}};
  if(!Number.isFinite(rules.penalty)||rules.penalty<0||Object.values(rules.weights).some(w=>!Number.isFinite(w)||w<=0))throw new Error('Pontuação inválida.');
  return {id,mode:config.mode,questions:clone(questions),answers:{},drafts:{},marked:[],index:0,startedAt:now,resumedAt:now,accumulated:0,limitMs:config.limitMs||0,paused:false,pauses:0,finishedAt:null,finishReason:null,rules,preset:config.preset||null};
}
export function confirmAnswer(s,now=Date.now()){
  if(s.paused||s.finishedAt||expired(s,now))throw new Error('Sessão indisponível para responder.');
  const q=s.questions[s.index],option=s.drafts[q.id];
  if(!Number.isInteger(option)||!q.options[option])throw new Error('Selecione uma alternativa.');
  if(s.mode==='study'&&s.answers[q.id])return false;
  s.answers[q.id]={option,confirmedAt:now,localDate:localDay(new Date(now))};return true;
}
export function score(s){
  let correct=0,wrong=0,blank=0,net=0,max=0;const subjects={};
  for(const q of s.questions){
    const w=s.rules.weights[q.subject]??1;max+=w;
    const subject=subjects[q.subject]??={correct:0,wrong:0,blank:0,total:0};subject.total++;
    const a=s.answers[q.id];
    if(!a){blank++;subject.blank++;}
    else if(a.option===q.answer){correct++;subject.correct++;net+=w;}
    else{wrong++;subject.wrong++;net-=w*s.rules.penalty;}
  }
  return {correct,wrong,blank,total:s.questions.length,net,max,answeredRate:correct+wrong?correct/(correct+wrong):null,totalRate:s.questions.length?correct/s.questions.length:null,subjects};
}
export function finish(state,reason='manual',now=Date.now()){
  const s=state.active;if(!s||s.finishedAt)return false;
  const duration=elapsed(s,now);s.accumulated=s.limitMs?Math.min(duration,s.limitMs):duration;
  s.finishedAt=now;s.finishReason=reason;s.paused=false;
  if(!state.sessions.some(x=>x.id===s.id))state.sessions.push(clone(s));
  state.active=null;return s;
}
export function attempts(state,mode='all'){
  const sessions=[...state.sessions,...(state.active?.mode==='study'?[state.active]:[])];
  const result=[];
  for(const s of sessions){
    if(mode!=='all'&&s.mode!==mode)continue;
    for(const q of s.questions){const a=s.answers[q.id];if(a)result.push({questionId:q.id,version:q.version,subject:q.subject,correct:a.option===q.answer,time:a.confirmedAt,day:a.localDate,mode:s.mode,pauses:s.pauses,sessionId:s.id});}
  }
  return result.sort((a,b)=>a.time-b.time);
}
export function statistics(rows){
  const correct=rows.filter(r=>r.correct).length;return {total:rows.length,unique:new Set(rows.map(r=>r.questionId)).size,correct,wrong:rows.length-correct,rate:rows.length?correct/rows.length:null};
}
export function streak(rows,today=new Date()){
  const days=new Set(rows.map(r=>r.day));let n=0;const date=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12);
  if(!days.has(localDay(date)))date.setDate(date.getDate()-1);
  while(days.has(localDay(date))){n++;date.setDate(date.getDate()-1);}return n;
}
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const integer=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const string=(x,max=20000)=>typeof x==='string'&&x.length<=max;
const id=x=>string(x,120)&&/^[a-zA-Z0-9_-]+$/.test(x)&&!['__proto__','prototype','constructor'].includes(x);
const timestamp=x=>Number.isFinite(x)&&x>=0&&x<=8640000000000000;
export function validateQuestion(q){
  if(!record(q)||!id(q.id)||!integer(q.version,1,100000)||!['mcq','boolean'].includes(q.type)||!['real','authorial'].includes(q.origin)||!string(q.subject,100)||!q.subject||['__proto__','constructor','prototype'].includes(q.subject)||!string(q.topic,150)||!['easy','medium','hard'].includes(q.difficulty)||!string(q.prompt)||!Array.isArray(q.options)||q.options.length<2||q.options.length>6||!q.options.every(o=>string(o)&&o.length>0)||!integer(q.answer,0,q.options.length-1)||!Array.isArray(q.explanations)||q.explanations.length!==q.options.length||!q.explanations.every(e=>string(e)&&e.length>10)||!Array.isArray(q.references)||!q.references.length||!q.references.every(r=>record(r)&&string(r.title,500)&&string(r.url,2000)&&(/^(https:\/\/)/.test(r.url)||r.url==='./data/editorial-notes.html')&&string(r.location,500))||!string(q.checkedAt,20)||!['approved','pending','historical','excluded'].includes(q.status))throw new Error('Questão inválida ou incompleta.');
  if(q.passage!==undefined&&!string(q.passage,50000))throw new Error('Texto de apoio inválido.');
  if(q.table!==undefined&&(!record(q.table)||!string(q.table.caption,500)||!Array.isArray(q.table.headers)||q.table.headers.length>20||!q.table.headers.every(v=>string(v,500))||!Array.isArray(q.table.rows)||q.table.rows.length>100||!q.table.rows.every(r=>Array.isArray(r)&&r.length===q.table.headers.length&&r.every(v=>string(v,1000)))))throw new Error('Tabela inválida.');
  if(q.image!==undefined&&(!record(q.image)||!string(q.image.src,500)||!/^\.\/assets\/[a-zA-Z0-9_/-]+\.(svg|png|jpg|webp)$/.test(q.image.src)||!string(q.image.alt,1000)||!q.image.alt))throw new Error('Imagem inválida.');
  return q;
}
function validateSession(s){
  if(!record(s)||!id(s.id)||!['study','exam'].includes(s.mode)||!Array.isArray(s.questions)||s.questions.length<1||s.questions.length>1500||!record(s.answers)||!record(s.drafts)||!Array.isArray(s.marked)||!integer(s.index,0,s.questions.length-1)||!timestamp(s.startedAt)||!timestamp(s.resumedAt)||!Number.isFinite(s.accumulated)||s.accumulated<0||!Number.isFinite(s.limitMs)||s.limitMs<0||typeof s.paused!=='boolean'||!integer(s.pauses,0,1000000)||!(s.finishedAt===null||timestamp(s.finishedAt))||!record(s.rules)||!Number.isFinite(s.rules.penalty)||s.rules.penalty<0||s.rules.penalty>100||!record(s.rules.weights)||Object.entries(s.rules.weights).some(([k,v])=>!string(k,100)||['__proto__','constructor','prototype'].includes(k)||!Number.isFinite(v)||v<=0||v>100))throw new Error('Sessão inválida no backup.');
  s.questions.forEach(validateQuestion);
  const questions=new Map(s.questions.map(q=>[q.id,q]));if(questions.size!==s.questions.length)throw new Error('Questões repetidas no backup.');
  if(!s.marked.every(k=>questions.has(k)))throw new Error('Marcação inválida.');
  for(const [k,v] of Object.entries(s.answers))if(!questions.has(k)||!record(v)||!integer(v.option,0,questions.get(k).options.length-1)||!timestamp(v.confirmedAt)||!/^\d{4}-\d{2}-\d{2}$/.test(v.localDate))throw new Error('Resposta inválida no backup.');
  for(const [k,v] of Object.entries(s.drafts))if(!questions.has(k)||!integer(v,0,questions.get(k).options.length-1))throw new Error('Seleção inválida.');
}
export function validateState(data){
  if(!record(data)||data.app!==APP||data.version!==FORMAT||!integer(data.revision,0,Number.MAX_SAFE_INTEGER)||!Array.isArray(data.sessions)||data.sessions.length>10000||!Array.isArray(data.favorites)||!data.favorites.every(id)||!Array.isArray(data.doubts)||!data.doubts.every(id)||!Array.isArray(data.reports)||data.reports.length>50000||!record(data.cards)||!integer(data.goal,1,1000)||!Array.isArray(data.cardIntervals)||data.cardIntervals.length!==3||!data.cardIntervals.every(n=>integer(n,1,365))||!(data.lastExport===null||timestamp(data.lastExport)))throw new Error('Arquivo incompatível: formato ou versão inválida. Nada foi substituído.');
  data.sessions.forEach(s=>{validateSession(s);if(s.finishedAt===null)throw new Error('Histórico não finalizado.');});
  if(new Set(data.sessions.map(s=>s.id)).size!==data.sessions.length)throw new Error('Sessões duplicadas.');
  if(data.active!==null){validateSession(data.active);if(data.active.finishedAt!==null||data.sessions.some(s=>s.id===data.active.id))throw new Error('Sessão em andamento inválida.');}
  for(const r of data.reports)if(!record(r)||!id(r.id)||!id(r.questionId)||!integer(r.questionVersion,1,100000)||!string(r.text,3000)||!timestamp(r.createdAt))throw new Error('Sinalização inválida.');
  for(const [k,v] of Object.entries(data.cards))if(!id(k)||!record(v)||!integer(v.step,0,3)||!timestamp(v.due)||typeof v.revealed!=='boolean')throw new Error('Cartão inválido.');
  return clone(data);
}
export function parseBackup(text){
  if(typeof text!=='string'||text.length>100*1024*1024)throw new Error('Backup maior que 100 MB.');
  let data;try{data=JSON.parse(text);}catch{throw new Error('Arquivo não contém JSON válido. Nada foi substituído.');}
  return validateState(data);
}
export function openDatabase(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(APP,FORMAT);
    request.onupgradeneeded=()=>request.result.createObjectStore('state');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Feche a outra aba para atualizar o armazenamento.'));
  });
}
export function readState(db){return new Promise((resolve,reject)=>{const t=db.transaction('state','readonly'),r=t.objectStore('state').get('progress');r.onsuccess=()=>resolve(r.result?validateState(r.result):blankState());r.onerror=()=>reject(r.error);});}
export function writeState(db,state){
  validateState(state);
  return new Promise((resolve,reject)=>{const t=db.transaction('state','readwrite');t.objectStore('state').put(state,'progress');t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error||new Error('Gravação cancelada.'));t.onerror=()=>reject(t.error);});
}
