const releaseQuery=new URL(import.meta.url).search;
const {APP,blankState,clone,localDay,elapsed,pause,resume,expired,choose,newSession,confirmAnswer,score,finish,attempts,statistics,streak,validateQuestion,parseBackup,openDatabase,readState,writeState}=await import(`./core.mjs${releaseQuery}`);
const {oldExams,prepareOldExam}=await import(`./exams.mjs${releaseQuery}`);

const $=s=>document.querySelector(s),main=$('#main');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=n=>n===null?'Sem dados':`${Math.round(n*100)}%`;
const number=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n);
const date=t=>new Date(t).toLocaleString('pt-BR');
const diff={easy:'Fácil',medium:'Média',hard:'Difícil'};
const duration=ms=>{const sec=Math.floor(ms/1000);return `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor(sec/60)%60).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;};
let state=blankState(),bank=[],cards=[],db,canWrite=false,lockRelease,writeQueue=Promise.resolve(),pendingWrites=0,busy=false,viewResult=null,reviewIndex=0,cardVisit=null,cardSaving=false,noticeTimer;
const available=()=>bank.filter(q=>q.status==='approved');
const subjects=()=>[...new Set(available().map(q=>q.subject))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
function notify(text){$('#notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').textContent='',6500);}
function storageMessage(text){$('#storage-status').replaceChildren(document.createTextNode(text));}
function modal(title,body,button='Confirmar'){
  $('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#dialog-confirm').textContent=button;
  const dialog=$('#dialog');dialog.returnValue='';dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true}));
}
async function save(){
  if(!canWrite||!db)throw new Error('Gravação indisponível. Exporte seus dados antes de fechar.');
  state.revision++;const snapshot=clone(state);pendingWrites++;storageMessage('Salvando alterações…');
  const operation=writeQueue.then(()=>writeState(db,snapshot));
  writeQueue=operation.catch(()=>{});
  try{await operation;pendingWrites--;if(!pendingWrites)storageMessage('');}catch(error){pendingWrites--;storageMessage('Não foi possível salvar. Mantenha esta aba aberta e exporte seus dados.');throw error;}
}
function writable(){if(!canWrite)throw new Error('Esta aba está em modo de leitura. Feche a outra aba e use Retomar nesta aba em Seus dados.');}
async function acquire(){
  if(!navigator.locks){storageMessage('Este navegador não oferece proteção entre abas. Use uma versão atual do Chrome. Alterações bloqueadas.');return;}
  await new Promise((ready,reject)=>{
    navigator.locks.request(`${APP}-writer`,{ifAvailable:true},async lock=>{
      if(!lock){storageMessage('Outra aba está usando seus dados. Feche-a e escolha Retomar nesta aba em Seus dados.');ready();return;}
      canWrite=true;state=await readState(db);storageMessage('');ready();await new Promise(resolve=>lockRelease=resolve);
    }).catch(reject);
  });
}
function route(){return (location.hash.slice(1)||'inicio').split('?')[0];}
const studyRoutes=['estudar','treinar','simulados','revisao'];
const studyParams=()=>new URLSearchParams(location.hash.split('?')[1]);
function navigate(path){if(location.hash===`#${path}`)render();else location.hash=path;}
function heading(kicker,title,text=''){return `<div class="intro"><div><p class="eyebrow">${esc(kicker)}</p><h1>${esc(title)}</h1>${text?`<p>${esc(text)}</p>`:''}</div></div>`;}
function metric(label,value,note=''){return `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`;}
function home(){
  const rows=attempts(state),stats=statistics(rows),today=rows.filter(r=>r.day===localDay()).length;
  const errorCounts=new Map();for(const r of rows)if(!r.correct)errorCounts.set(r.subject,(errorCounts.get(r.subject)||0)+1);
  const review=[...errorCounts.entries()].sort((a,b)=>b[1]-a[1])[0];
  main.innerHTML=`<div class="intro"><div><p class="eyebrow">Seu espaço de estudo</p><h1>Vamos dar o próximo passo, Bruna.</h1><p>Cada questão ajuda a entender melhor o que você já sabe e o que merece outra leitura.</p></div><span class="date">${esc(new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'long'}))}</span></div>
  <div class="home-grid"><section class="panel study-start"><div><p class="eyebrow">${state.active?'De onde você parou':'Comece no seu ritmo'}</p><h2>${state.active?`${state.active.mode==='study'?'Treino':'Simulado'} em andamento`:'Um pouco de estudo. Mais perto do seu objetivo.'}</h2><p>${state.active?`${Object.keys(state.active.answers).length} de ${state.active.questions.length} respostas confirmadas. ${state.active.paused?'Sessão pausada.':'Tempo segue contando.'}`:'Escolha entre praticar questões, simular uma prova ou revisar o que já estudou.'}</p><div class="actions">${state.active?'<a class="button primary" href="#sessao">Continuar sessão</a>':''}<a class="button study-cta ${state.active?'':'primary'}" href="#estudar">Estudar</a></div></div><img class="book-art" src="./assets/mark.svg" alt="" width="105" height="105"></section>
  <section class="panel goal-panel"><div class="row"><h3>Seu objetivo de hoje</h3><a href="#ajustes">Editar</a></div><div class="goal-number">${today} <span>/ ${state.goal} respostas</span></div><progress value="${Math.min(today,state.goal)}" max="${state.goal}" aria-label="Progresso da meta diária"></progress><small>${today>=state.goal?'Meta alcançada. Seu esforço conta.':today?'Já começou. Continue no seu ritmo.':'Pode começar com uma questão.'} ${streak(rows)} dia(s) de sequência.</small></section></div>
  <section class="stats" aria-label="Seu progresso">${metric('Questões únicas',stats.unique,'sem contar repetições')}${metric('Tentativas',stats.total,`${stats.correct} acertos · ${stats.wrong} erros`)}${metric('Aproveitamento',percent(stats.rate),'acertos / respostas confirmadas')}${metric('Acervo ativo',available().length,'questões aprovadas para treino')}</section>
  <div class="section-top"><h2>Estudar por matéria</h2></div><div class="subject-list">${subjects().map((s,i)=>`<a class="subject-link" data-subject="${esc(s)}" href="#estudar?materia=${encodeURIComponent(s)}"><span class="subject-icon">${String(i+1).padStart(2,'0')}</span><span>${esc(s)}<small>${available().filter(q=>q.subject===s).length} questões</small></span><span class="chevron" aria-hidden="true">›</span></a>`).join('')}</div>
  <div class="home-grid"><section><div class="section-top"><h2>Uma boa próxima revisão</h2></div><div class="note">${review?`Você teve ${review[1]} erro(s) em ${esc(review[0])}. Vale revisitar as explicações.`:'As sugestões aparecem a partir das suas respostas. Sem pressa: comece por uma matéria.'}</div></section><section><div class="section-top"><h2>Sua evolução</h2><a href="#historico">Ver histórico</a></div><p class="muted">${stats.total?'Veja primeiras tentativas, repetições e resultados separados por modo.':'Seu histórico começa quando você confirmar a primeira resposta.'}</p></section></div>
  ${available().length<300?`<p class="note warning" style="margin-top:28px">Acervo em construção: ${available().length} questões ativas para a meta desta etapa de 300. A ampliação posterior foi adiada. <a href="#acervo">Ver cobertura e pendências</a>.</p>`:''}`;
}
const studyModes={
  study:{title:'Treinar',path:'treinar',icon:'<path d="M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0 0 4h14M8 8h8m-8 4h6"/>',hint:'Veja a correção depois de cada resposta.'},
  exam:{title:'Simulado',path:'simulados',icon:'<path d="M8 3h8v4H8zM8 5H5v16h14V5h-3m-8 6h8m-8 4h8"/>',hint:'Resolva como em uma prova. Veja o gabarito no final.'},
  review:{title:'Revisar',path:'revisao',icon:'<path d="M5 10a7 7 0 1 1 1 7M5 4v6h6m1-3v5l3 2"/>',hint:'Refaça questões ou relembre o conteúdo com cartões.'}
};
const subjectGroups=[
  ['Nutrição clínica e avaliação',['Nutrição clínica','Avaliação nutricional','Nutrição nos ciclos da vida','Bioquímica e fisiologia da nutrição']],
  ['Alimentos e serviços',['Alimentação coletiva','Higiene e segurança dos alimentos','Técnica dietética']],
  ['Saúde pública e legislação',['Sistema Único de Saúde','Saúde coletiva e alimentação','Ética e legislação profissional','Legislação e administração pública']],
  ['Conhecimentos gerais',['Língua Portuguesa','Raciocínio lógico e matemática','Noções de Informática']]
];
const reviewKinds=[
  ['wrong','Errei'],['doubts','Marquei com dúvida'],['favorites','Favoritei'],
  ['correct','Já acertei'],['all','Todas as respondidas']
];
const stageTitles={
  examKind:'Como quer montar seu simulado?',
  examList:'Qual prova quer usar?',
  reviewKind:'Como quer revisar?',
  sources:'O que quer refazer?',
  count:'Quantas questões?',
  time:'Quanto tempo?',
  subjects:'Quais matérias?'
};
const nextLabels={
  sources:'Escolher o que refazer',count:'Escolher quantidade',
  time:'Escolher tempo',subjects:'Escolher matérias',summary:'Conferir escolhas'
};
const countLimit=items=>Math.min(items.length,1500);
const questionLabel=count=>`${count} ${count===1?'questão':'questões'}`;
const timeLabel=minutes=>minutes?`${minutes} min`:'Sem limite';
const issueText=(count,max)=>max===0?'Nenhuma questão com estas escolhas.':count>max?`Você escolheu ${count} questões, mas só há ${max} disponíveis.`:'';
function activeStudyNotice(){
  return state.active?'<p class="note warning">Você tem uma sessão em andamento. <a href="#sessao">Continuar sessão</a></p>':'';
}
function study(){
  const subject=studyParams().get('materia');
  const suffix=subjects().includes(subject)?`?materia=${encodeURIComponent(subject)}`:'';
  main.innerHTML=heading('Estudar','Como você quer estudar?',suffix?`Matéria escolhida: ${subject}.`:'Escolha uma opção para começar.')+
    `<div class="study-modes">${Object.entries(studyModes).map(([mode,{title,path,icon,hint}])=>`<a class="button study-mode" data-mode="${mode}" href="#${path}${suffix}"><span class="study-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg></span><strong>${title}</strong><span class="study-mode-hint">${hint}</span><span class="study-chevron" aria-hidden="true">›</span></a>`).join('')}</div>`+activeStudyNotice();
}
function studyChoice(action,value,label,options={}){
  const {selected,expanded,detail,subject,disabled=false}=options;
  return `<button class="study-option" type="button" data-action="${action}" data-value="${esc(value)}"${subject?` data-subject="${esc(subject)}"`:''}${selected===undefined?'':` aria-pressed="${selected}"`}${expanded===undefined?'':` aria-expanded="${expanded}"`}${disabled?' disabled':''}><span><strong>${esc(label)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</span>${selected===undefined?'':'<span class="study-check" aria-hidden="true"></span>'}${expanded===undefined?'':`<span class="study-toggle" aria-hidden="true">${expanded?'−':'+'}</span>`}</button>`;
}
function reviewCandidates(rows,favorites,doubts,questions){
  const errors=new Map();
  for(const row of rows)if(!row.correct)errors.set(row.questionId,(errors.get(row.questionId)||0)+1);
  const kinds={
    wrong:errors,doubts:new Set(doubts),favorites:new Set(favorites),
    correct:new Set(rows.filter(row=>row.correct).map(row=>row.questionId)),
    all:new Set(rows.map(row=>row.questionId))
  };
  const pool=[...questions].sort((a,b)=>(errors.get(b.id)||0)-(errors.get(a.id)||0));
  return {pool,kinds};
}
function studyPool(pool,selected,kinds,sourceKeys){
  const lists=kinds&&[...sourceKeys].map(key=>kinds[key]);
  return pool.filter(q=>(!selected.size||selected.has(q.subject))&&(!lists||lists.some(list=>list.has(q.id))));
}
function setup(mode){
  const isExam=mode==='exam',isReview=mode==='review';
  const {title}=studyModes[mode];
  const approved=available(),options=subjects();
  const preselected=studyParams().get('materia');
  const selected=new Set(options.includes(preselected)?[preselected]:[]);
  const review=isReview?reviewCandidates(attempts(state),state.favorites,state.doubts,approved):null;
  const sources=new Set();
  const countMax=()=>countLimit(basePool());
  const flow={
    step:isExam?'examKind':isReview?'reviewKind':'count',
    count:Math.min(10,countLimit(matterPool())||countLimit(approved)),group:'',past:false,examId:'',
    timer:'0',minutes:'60',pastTime:'proportional',
    advanced:{topic:'',difficulty:'',order:'errors',penalty:'0'},advancedOpen:false,moreSources:false
  };
  const back=`#estudar${options.includes(preselected)?`?materia=${encodeURIComponent(preselected)}`:''}`;
  const reviewCards=`#revisao?cartoes${options.includes(preselected)?`&materia=${encodeURIComponent(preselected)}`:''}`;
  const stages=()=>isExam
    ?flow.past?['examKind','examList','time','summary']:['examKind','count','time','subjects','summary']
    :isReview?['reviewKind','sources','count','subjects','summary']:['count','subjects','summary'];
  const minutes=()=>Number(flow.timer==='custom'?flow.minutes:flow.timer);
  const currentExam=()=>oldExams.find(exam=>exam.id===flow.examId);
  const pastMinutes=()=>flow.pastTime==='free'?0:flow.pastTime==='original'?currentExam().originalMinutes:Math.ceil(currentExam().originalMinutes*currentExam().numbers.length/currentExam().originalCount);
  const startLabel=isExam?'Começar simulado':isReview?'Começar revisão':'Começar treino';
  function basePool(){
    return review?studyPool(review.pool,new Set(),review.kinds,sources):approved;
  }
  function matterPool(){
    return studyPool(basePool(),selected);
  }
  function filtered(){
    const {topic,difficulty}=flow.advanced;
    return matterPool().filter(q=>(!topic||q.topic===topic)&&(!difficulty||q.difficulty===difficulty));
  }
  function quotaInputs(){
    return options.map((subject,i)=>({
      subject,raw:flow.advanced[`quota-${i}`]??'',weight:Number(flow.advanced[`weight-${i}`]??1)
    }));
  }
  function setStep(step){
    flow.step=step;
    draw();
    $('#study-step-title').focus({preventScroll:true});
    window.scrollTo(0,0);
  }
  function choiceStack(choices){
    return `<div class="study-stack">${choices.join('')}</div>`;
  }
  function renderSources(){
    const counts=reviewKinds.map(([key,label])=>{
      const count=review.pool.filter(q=>review.kinds[key].has(q.id)).length;
      return studyChoice('source',key,label,{selected:sources.has(key),detail:questionLabel(count),disabled:!count});
    });
    return choiceStack(counts.slice(0,3))+
      `<details id="study-more" ${flow.moreSources?'open':''}><summary>Mais opções</summary>${choiceStack(counts.slice(3))}</details>
      <p class="study-available" aria-live="polite">${questionLabel(countMax())} para refazer.</p>`+
      (review.pool.some(q=>Object.values(review.kinds).some(list=>list.has(q.id)))?'':`<p class="note">Suas questões aparecem aqui depois de responder ou marcar alguma. <a href="${reviewCards}">Estudar com cartões</a></p>`);
  }
  function renderCount(){
    const max=countMax();
    return `<p class="muted">Até ${max} questões disponíveis.</p>
      <div class="study-numbers">${[...new Set([1,5,10,20,30,Math.min(10,max)])].filter(n=>n>0&&n<=max).sort((a,b)=>a-b).map(n=>studyChoice('count',n,String(n),{selected:n===flow.count})).join('')}</div>
      <label class="field study-count">Quantidade de questões<input name="count" type="number" min="1" max="${max}" value="${flow.count||''}" required></label>`;
  }
  function renderTime(){
    const choices=flow.past
      ?[['proportional',`Ajustado · ${Math.ceil(currentExam().originalMinutes*currentExam().numbers.length/currentExam().originalCount)} min`],['original',`Tempo do edital · ${currentExam().originalMinutes} min`],['free','Sem limite']]
      :[['0','Sem limite'],['30','30 min'],['60','60 min'],['120','120 min'],['custom','Personalizar']];
    return choiceStack(choices.map(([key,label])=>studyChoice('time',key,label,{selected:key===(flow.past?flow.pastTime:flow.timer)})))+
      (!flow.past&&flow.timer==='custom'?`<label class="field study-count">Duração em minutos<input name="minutes" type="number" min="1" max="600" value="${esc(flow.minutes)}" required></label>`:'')+
      (flow.past?'<p class="muted">O tempo ajustado é proporcional ao recorte. O tempo do edital incluía a redação.</p>':'');
  }
  function renderSubjects(){
    const pool=basePool();
    const eligible=new Set(pool.map(q=>q.subject));
    const listed=new Set(subjectGroups.flatMap(([,list])=>list));
    const groups=[...subjectGroups,['Outras matérias',options.filter(subject=>!listed.has(subject))]];
    return `<p class="muted">Você pode marcar mais de uma matéria, mesmo em grupos diferentes.</p>
      <p class="study-selection" aria-live="polite"><strong>${selected.size?'Marcadas: ':'Seleção: '}</strong>${esc(selected.size?[...selected].join(' · '):'Todas as matérias')}</p>`+
      choiceStack([studyChoice('allSubjects','','Todas as matérias',{selected:!selected.size}),
      ...groups.flatMap(([label,list])=>{
        const choices=list.filter(subject=>eligible.has(subject));
        if(!choices.length)return [];
        const marked=choices.filter(subject=>selected.has(subject)).length;
        const open=flow.group===label;
        return [studyChoice('group',label,label,{expanded:open,detail:marked?`${marked} ${marked===1?'marcada':'marcadas'}`:`${choices.length} ${choices.length===1?'matéria':'matérias'}`}),
          ...(open?[`<div class="study-subjects">${choices.map(subject=>studyChoice('subject',subject,subject,{selected:selected.has(subject),subject,detail:questionLabel(pool.filter(q=>q.subject===subject).length)})).join('')}</div>`]:[])];
      })])+`<p class="study-available">${questionLabel(matterPool().length)} no total.</p>`;
  }
  function selectField(name,label,values){
    return `<label class="field">${label}<select name="${name}">${values.map(([value,text])=>`<option value="${esc(value)}" ${flow.advanced[name]===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
  }
  function renderAdvanced(){
    const topics=[...new Set(matterPool().map(q=>q.topic))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const filters=selectField('topic','Assunto',[['','Todos os assuntos'],...topics.map(t=>[t,t])])+
      selectField('difficulty','Dificuldade',[['','Mista'],...Object.entries(diff)]);
    const order=selectField('order','Ordem',[['errors','Erros recorrentes primeiro'],['random','Aleatória']]);
    return `<details id="study-advanced" ${flow.advancedOpen?'open':''}><summary>Ajustes avançados</summary><div class="fields">${isReview?order:filters}</div>
      ${isReview?'':'<p><small>A dificuldade é uma estimativa editorial.</small></p>'}
      ${isExam?`<p class="muted">Para distribuir quantidades por matéria, use Todas as matérias. A soma deve bater com o total escolhido. Deixe em branco para sortear.</p>
      <div class="table-wrap"><table><thead><tr><th>Matéria</th><th>Quantidade</th><th>Peso</th></tr></thead><tbody>${options.map((subject,i)=>`<tr><th scope="row">${esc(subject)}</th><td><input aria-label="Quantidade: ${esc(subject)}" name="quota-${i}" type="number" min="0" max="1500" value="${esc(flow.advanced[`quota-${i}`]??'')}" placeholder="Automática" ${selected.size?'disabled':''}></td><td><input aria-label="Peso: ${esc(subject)}" name="weight-${i}" type="number" min="0.01" max="100" step="0.01" value="${esc(flow.advanced[`weight-${i}`]??'1')}" required></td></tr>`).join('')}</tbody></table></div>
      <label class="field">Desconto por erro<input name="penalty" type="number" min="0" max="100" step="0.01" value="${esc(flow.advanced.penalty)}"><small>0: sem desconto. 1: cada erro desconta o peso de um acerto.</small></label>`:''}</details>`;
  }
  function renderSummary(){
    const exam=currentExam();
    const items=flow.past
      ?[['Prova',exam.title],['Questões',exam.numbers.length],['Tempo',timeLabel(pastMinutes())]]
      :[['Questões',flow.count],['Matérias',selected.size?[...selected].join(' · '):'Todas as matérias'],
        ...(isExam?[['Tempo',timeLabel(minutes())]]:[]),
        ...(isReview?[['Revisar',reviewKinds.filter(([key])=>sources.has(key)).map(([,label])=>label).join(' · ')]]:[])];
    return `<dl class="study-summary">${items.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`+
      (flow.past?`<details><summary>Sobre este recorte adaptado</summary><p>${esc(exam.note)}</p><p><a href="${esc(exam.sourceURL)}" target="_blank" rel="noreferrer">Consultar edital</a></p></details>`:renderAdvanced());
  }
  function fillCapacity(){
    const panel=$('#study-capacity');
    if(!panel||flow.past||!['subjects','summary'].includes(flow.step))return;
    const max=countLimit(flow.step==='summary'?filtered():matterPool());
    const issue=issueText(flow.count,max);
    panel.innerHTML=issue?`<p class="note warning">${issue} ${flow.step==='subjects'?'Escolha mais matérias ou ajuste a quantidade.':'Ajuste os filtros, as matérias ou a quantidade.'}</p>
      ${max?studyChoice('adjust',max,`Usar ${questionLabel(max)}`):''}`:'';
    $('#study-next').disabled=Boolean(issue)||(flow.step==='summary'&&(!canWrite||Boolean(state.active)||busy));
  }
  function draw(){
    const {step}=flow;
    const steps=stages();
    const index=steps.indexOf(step);
    const firstChoice=['examKind','reviewKind','examList'].includes(step);
    const titles={study:'Confira e comece o treino',exam:'Confira e comece o simulado',review:'Confira e comece a revisão'};
    const bodies={
      examKind:()=>choiceStack([studyChoice('branch','custom','Montar simulado',{detail:'Escolha quantidade, tempo e matérias.'}),studyChoice('branch','past','Usar prova anterior',{detail:'Escolha um recorte adaptado de prova.'})]),
      examList:()=>choiceStack(oldExams.map(exam=>studyChoice('exam',exam.id,exam.title,{detail:`${exam.numbers.length} questões · recorte adaptado`}))),
      reviewKind:()=>choiceStack([studyChoice('branch','questions','Refazer questões',{detail:'Volte às questões que errou ou marcou.'}),`<a class="button study-option" href="${reviewCards}"><span><strong>Estudar com cartões</strong><small>Relembre o conteúdo em cartões rápidos.</small></span><span aria-hidden="true">›</span></a>`]),
      sources:renderSources,count:renderCount,time:renderTime,subjects:renderSubjects,summary:renderSummary
    };
    main.innerHTML=`<div class="study-wizard" data-mode="${mode}">
      ${activeStudyNotice()}
      <form id="study-form" class="panel study-panel">
        <div class="study-step"><p class="eyebrow">${title} · Etapa ${index+1} de ${steps.length}</p>
          <progress value="${index+1}" max="${steps.length}" aria-label="Etapa do estudo"></progress>
          <h1 id="study-step-title" tabindex="-1">${stageTitles[step]??titles[mode]}</h1>
        </div>
        ${bodies[step]()}
        <div id="study-capacity" aria-live="polite"></div>
        <p id="study-error" class="danger" role="alert"></p>
        <div class="actions study-actions">
          ${index===0?`<a class="button" href="${back}">Voltar</a>`:'<button type="button" data-action="back">Voltar</button>'}
          ${firstChoice?'':`<button id="study-next" class="primary" type="submit" ${(step==='sources'&&!countMax())||(step==='summary'&&(!canWrite||state.active))?'disabled':''}>${step==='summary'?startLabel:nextLabels[steps[index+1]]}</button>`}
        </div>
      </form></div>`;
    const form=$('#study-form');
    form.onclick=onChoice;
    form.oninput=onInput;
    form.onsubmit=submit;
    form.addEventListener('invalid',event=>{
      const details=event.target.closest('details');
      if(details)details.open=true;
    },true);
    if($('#study-more'))$('#study-more').ontoggle=event=>{flow.moreSources=event.target.open;};
    if($('#study-advanced'))$('#study-advanced').ontoggle=event=>{flow.advancedOpen=event.target.open;};
    fillCapacity();
  }
  function onChoice(event){
    const button=event.target.closest('[data-action]');
    if(!button)return;
    const {action,value}=button.dataset;
    if(action==='back'){setStep(stages()[stages().indexOf(flow.step)-1]);return;}
    if(action==='branch'){
      flow.past=value==='past';
      setStep(isReview?'sources':flow.past?'examList':'count');
      return;
    }
    if(action==='exam'){flow.examId=value;setStep('time');return;}
    if(action==='count'){
      const input=$('#study-form').elements.count;
      input.value=value;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      return;
    }
    if(action==='time'){
      if(flow.past)flow.pastTime=value;
      else flow.timer=value;
    }
    if(action==='source'){
      if(sources.has(value))sources.delete(value);
      else sources.add(value);
    }
    if(action==='group')flow.group=flow.group===value?'':value;
    if(action==='subject'){
      if(selected.has(value))selected.delete(value);
      else selected.add(value);
    }
    if(action==='allSubjects')selected.clear();
    if(action==='subject'||action==='allSubjects'){
      if(!matterPool().some(q=>q.topic===flow.advanced.topic))flow.advanced.topic='';
    }
    if(action==='adjust')flow.count=Number(value);
    draw();
    const target=Array.from(main.querySelectorAll('[data-action]')).find(node=>node.dataset.action===action&&node.dataset.value===value);
    if(action==='adjust')$('#study-next').focus();
    else target?.focus({preventScroll:true});
  }
  function onInput(event){
    const {name,value}=event.target;
    if(name==='count'){
      flow.count=Number(value);
      main.querySelectorAll('[data-action="count"]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.value)===flow.count)));
    }else if(name==='minutes')flow.minutes=value;
    else if(name){
      flow.advanced[name]=value;
      fillCapacity();
    }
  }
  async function submit(event){
    event.preventDefault();
    const form=event.currentTarget;
    const {step}=flow;
    if(step==='sources'){
      if(!countMax())return;
      flow.count=Math.min(flow.count||10,countMax());
      const eligible=new Set(basePool().map(q=>q.subject));
      for(const subject of selected)if(!eligible.has(subject))selected.delete(subject);
    }
    if(step==='subjects'&&issueText(flow.count,countLimit(matterPool())))return;
    if(step!=='summary'){
      const steps=stages();
      setStep(steps[steps.indexOf(step)+1]);
      return;
    }
    if(busy)return;
    busy=true;
    $('#study-next').disabled=true;
    $('#study-error').textContent='';
    let session;
    try{
      writable();
      if(state.active)throw new Error('Continue ou finalize a sessão em andamento.');
      let questions;
      let config={mode:isExam?'exam':'study'};
      if(flow.past)({questions,config}=prepareOldExam(bank,flow.examId,flow.pastTime));
      else{
        const candidates=filtered();
        const count=flow.count;
        if(isExam){
          const limitMs=minutes()*60000;
          if(!Number.isInteger(limitMs)||limitMs<0||limitMs>36000000)throw new Error('Duração inválida.');
          const quotas=quotaInputs();
          config={...config,limitMs,penalty:Number(flow.advanced.penalty),weights:Object.fromEntries(quotas.map(q=>[q.subject,q.weight]))};
          if(!selected.size&&quotas.some(q=>q.raw!=='')){
            const values=quotas.map(q=>Number(q.raw));
            if(values.some(n=>!Number.isInteger(n)||n<0)||values.reduce((a,b)=>a+b,0)!==count)throw new Error('A soma das quantidades por matéria deve bater com o total.');
            questions=quotas.flatMap(({subject},i)=>values[i]?choose(candidates.filter(q=>q.subject===subject),values[i]):[]);
          }
        }
        questions??=isReview&&flow.advanced.order==='errors'?candidates.slice(0,count):choose(candidates,count);
      }
      session=newSession(questions,config);
      state.active=session;
      await save();
      navigate('sessao');
    }catch(error){
      if(session&&state.active===session)state.active=null;
      if(form.isConnected)$('#study-error').textContent=error.message;
    }finally{
      busy=false;
      if(form.isConnected){
        fillCapacity();
        if(flow.past)$('#study-next').disabled=!canWrite||Boolean(state.active);
      }
    }
  }
  draw();
}
function explanation(q,answer){
  const current=bank.find(item=>item.id===q.id);
  const updated=!current||current.version!==q.version||current.status!=='approved';
  const updateText=!current?'Esta questão não está no acervo atual. O conteúdo e a nota usados nesta tentativa foram mantidos.':`Esta tentativa usa a versão ${q.version}; o acervo atual tem a versão ${current.version}.${current.status!=='approved'?' Este item está fora do treino atual.':''} A resposta e a nota desta tentativa foram preservadas.`;
  return `<section class="explanation"><h3>${answer===undefined?'Não respondida':answer===q.answer?'Resposta correta':'Vamos rever esta questão'}</h3>${updated?`<p class="note warning">${esc(updateText)}${current?.editorialNote?` ${esc(current.editorialNote)}`:''}</p>`:''}<p><strong>Gabarito: ${String.fromCharCode(65+q.answer)}.</strong> Explicação própria; não é comentário oficial.</p>${q.editorialNote?`<p class="note">${esc(q.editorialNote)}</p>`:''}<ol type="A">${q.explanations.map((e,i)=>`<li><strong>${i===q.answer?'Correta.':'Incorreta.'}</strong> ${esc(e)}</li>`).join('')}</ol><details open><summary>Fontes e conferência</summary><ul>${q.references.map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.title)}</a> — ${esc(r.location)}</li>`).join('')}</ul><small>Conferência automática com consulta às fontes: ${esc(q.checkedAt)}. Sem revisão profissional humana declarada.</small></details></section>`;
}
function questionBody(q,s,review=false){
  const a=s.answers[q.id],draft=s.drafts[q.id],show=review||(s.mode==='study'&&a),selected=show?a?.option:(draft??a?.option);
  return `<div class="question-header"><span>Questão ${s.index+1} de ${s.questions.length}<br><small>${esc(q.origin==='real'?`${q.board} · ${q.institution} · ${q.year} · nº ${q.originalNumber}`:'Autoral · Bruna Estuda')} · v${q.version}</small></span><div class="question-taxonomy"><span class="subject-badge" data-subject="${esc(q.subject)}">${esc(q.subject)}</span><small>${esc(q.topic)} · ${diff[q.difficulty]} (editorial)</small></div></div>
  ${q.passage?`<div class="passage">${esc(q.passage)}</div>`:''}${q.table?`<div class="table-wrap"><table><caption>${esc(q.table.caption)}</caption><thead><tr>${q.table.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${q.table.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}${q.image?`<figure><img src="${esc(q.image.src)}" alt="${esc(q.image.alt)}" style="max-width:100%;height:auto"></figure>`:''}<h2 id="question-prompt">${esc(q.prompt)}</h2>
  <fieldset class="options" ${review||show?'disabled':''}><legend>Escolha uma resposta</legend>${q.options.map((o,i)=>`<label class="option ${selected===i?'selected':''} ${a?.option===i?'confirmed-option':''} ${show?(i===q.answer?'correct':a?.option===i?'incorrect':''):''}"><input type="radio" name="answer" value="${i}" ${selected===i?'checked':''}><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${esc(o)}${show&&i===q.answer?'<strong> · Gabarito</strong>':''}${a?.option===i?'<small> · Confirmada</small>':''}</span></label>`).join('')}</fieldset>
  ${review?'':`<p class="answer-status">${a?draft!==undefined&&draft!==a.option?'Nova seleção pendente. A resposta confirmada continua valendo até confirmar novamente.':'Resposta confirmada.':selected!==undefined?'Seleção pendente. Clique em Confirmar resposta para registrar.':'Nenhuma resposta confirmada. Você pode pular e voltar.'}</p><div class="question-actions"><button id="confirm" class="primary" ${selected===undefined||(show&&s.mode==='study')||!canWrite?'disabled':''}>Confirmar resposta</button><div class="actions"><button data-move="-1" ${s.index===0?'disabled':''}>Anterior</button><button data-move="1" ${s.index===s.questions.length-1?'disabled':''}>Próxima</button></div></div>`}
  <div class="minor-actions"><button data-mark="favorites" aria-pressed="${state.favorites.includes(q.id)}">${state.favorites.includes(q.id)?'Favoritada':'Favoritar'}</button><button data-mark="doubts" aria-pressed="${state.doubts.includes(q.id)}">${state.doubts.includes(q.id)?'Dúvida marcada':'Marcar dúvida'}</button>${!review?`<button data-mark="session" aria-pressed="${s.marked.includes(q.id)}">${s.marked.includes(q.id)?'Revisão marcada':'Marcar para revisão'}</button>`:''}<button id="report">Sinalizar problema</button></div>${show?explanation(q,a?.option):''}`;
}
async function questionActions(s,review=false){
  const q=s.questions[s.index];
  main.querySelectorAll('[data-mark]').forEach(b=>b.onclick=async()=>{try{writable();const list=b.dataset.mark==='session'?s.marked:state[b.dataset.mark];const i=list.indexOf(q.id);if(i<0)list.push(q.id);else list.splice(i,1);await save();render(false);}catch(e){notify(e.message);}});
  $('#report').onclick=async()=>{if(!canWrite){notify('Modo de leitura.');return;}if(await modal('Sinalizar problema',`<p>Registro salvo somente neste navegador. Consulte e exporte em Seus dados.</p><label class="field">Descreva o problema<textarea id="report-text" maxlength="3000" required></textarea></label>`,'Salvar sinalização')){const text=$('#report-text').value.trim();if(!text){notify('Descreva o problema antes de salvar.');return;}state.reports.push({id:crypto.randomUUID(),questionId:q.id,questionVersion:q.version,text,createdAt:Date.now()});try{await save();notify('Sinalização salva localmente.');}catch(e){notify(e.message);}}};
  if(review)return;
  main.querySelectorAll('input[name=answer]').forEach(input=>input.onchange=async()=>{try{writable();if(s.paused||expired(s))return; s.drafts[q.id]=Number(input.value);await save();render(false);}catch(e){notify(e.message);}});
  $('#confirm').onclick=async()=>{if(busy)return;busy=true;try{writable();if(expired(s)){await finalize('expired');return;}confirmAnswer(s);await save();render(false);}catch(e){notify(e.message);}finally{busy=false;}};
  main.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>move(Number(b.dataset.move)));
}
async function move(n){try{writable();state.active.index=Math.max(0,Math.min(state.active.questions.length-1,state.active.index+n));await save();render();}catch(e){notify(e.message);}}
function session(){
  const s=state.active;if(!s){main.innerHTML=heading('Sua sessão','Nenhuma sessão em andamento.')+'<a class="button primary" href="#estudar">Estudar</a>';return;}
  main.innerHTML=`<div class="session-top"><div><p class="eyebrow">${s.mode==='study'?'Modo estudo':'Modo simulado · correção ao finalizar'}</p><h1>Uma questão de cada vez.</h1>${s.preset?`<p class="muted">${esc(s.preset.title)} · recorte adaptado</p>`:''}</div><div class="actions"><span id="timer" class="timer" aria-label="Tempo da sessão"></span><button id="pause">${s.paused?'Retomar':'Pausar'}</button><button id="finish">Finalizar</button></div></div>${s.paused?'<section class="panel paused"><p class="eyebrow">Pode respirar</p><h2>Sessão pausada.</h2><p>Questões ocultas. O tempo está congelado.</p><button id="resume" class="primary">Retomar estudo</button></section>':`<div class="session-grid"><aside class="panel map" aria-label="Mapa de questões"><h2>Sua sessão</h2><small>${Object.keys(s.answers).length} de ${s.questions.length} confirmadas</small><div class="map-grid">${s.questions.map((q,i)=>`<button data-index="${i}" class="${i===s.index?'current':''} ${s.answers[q.id]?'confirmed':''} ${s.marked.includes(q.id)?'flagged':''}" aria-label="Questão ${i+1}${s.answers[q.id]?', confirmada':', não respondida'}${s.marked.includes(q.id)?', marcada para revisão':''}" ${i===s.index?'aria-current="step"':''}>${i+1}</button>`).join('')}</div><p class="map-legend">Contorno: atual<br>Fundo azul: confirmada<br>?: marcada para revisão<br>Branco: não respondida</p><a href="#inicio">Voltar ao início</a></aside><article class="panel question">${questionBody(s.questions[s.index],s)}</article></div>`}`;
  const toggle=async()=>{try{writable();if(s.paused)resume(s);else pause(s);await save();render(false);}catch(e){notify(e.message);}};
  $('#pause').onclick=toggle;if($('#resume'))$('#resume').onclick=toggle;
  $('#finish').onclick=async()=>{if(await modal('Finalizar sessão?',`<p>${Object.keys(s.answers).length} de ${s.questions.length} respostas confirmadas. Seleções pendentes não serão contabilizadas.</p><p>Depois de finalizar, você poderá consultar o resultado e todas as explicações.</p>`,'Finalizar sessão')){try{writable();await finalize('manual');}catch(e){notify(e.message);}}};
  if(!s.paused){main.querySelectorAll('[data-index]').forEach(b=>b.onclick=async()=>{try{writable();s.index=Number(b.dataset.index);await save();render();}catch(e){notify(e.message);}});questionActions(s);}
  updateTimer();
}
async function finalize(reason){
  const result=finish(state,reason);if(!result)return;
  await save();viewResult=result.id;reviewIndex=0;navigate('resultado');
}
function updateTimer(){
  const s=state.active;if(!s)return;
  const node=$('#timer');if(node)node.textContent=s.limitMs?duration(Math.max(0,s.limitMs-elapsed(s))):duration(elapsed(s));
  if(canWrite&&!s.paused&&expired(s)&&!busy){busy=true;finalize('expired').catch(e=>notify(e.message)).finally(()=>busy=false);}
}
function result(){
  const s=state.sessions.find(s=>s.id===viewResult)||state.sessions.at(-1);if(!s){navigate('historico');return;}
  const r=score(s);main.innerHTML=heading('Sessão finalizada',s.mode==='study'?'Mais um passo dado.':'Seu resultado.',`${date(s.finishedAt)} · ${s.finishReason==='expired'?'Tempo esgotado':'Finalização manual'} · ${s.pauses} pausa(s) · ${duration(s.accumulated)} de tempo ativo`)+`
  ${s.preset?`<section class="note"><strong>${esc(s.preset.title)} · adaptação</strong><p>${esc(s.preset.note)}</p><p>${esc(s.preset.timeNote)}</p><a href="${esc(s.preset.sourceURL)}" target="_blank" rel="noreferrer">Fonte das regras de origem</a></section>`:''}
  <section class="panel"><div class="result-score">${number(r.net)} <small>/ ${number(r.max)} pontos possíveis</small></div><p class="muted">Acerto soma o peso. Erro desconta ${number(s.rules.penalty)} × peso. Em branco vale zero. Pesos: ${Object.entries(s.rules.weights).map(([k,v])=>`${esc(k)} ${number(v)}`).join('; ')||'1 por questão'}.</p><div class="stats">${metric('Acertos',r.correct)}${metric('Erros',r.wrong)}${metric('Em branco',r.blank)}${metric('Sobre o total',percent(r.totalRate),`${r.correct} / ${r.total}`)}</div><p>Aproveitamento nas respostas: <strong>${percent(r.answeredRate)}</strong> (${r.correct} / ${r.correct+r.wrong}). Este resultado não estima probabilidade de aprovação.</p><div class="table-wrap"><table><thead><tr><th>Matéria</th><th>Acertos</th><th>Erros</th><th>Em branco</th><th>Sobre o total</th></tr></thead><tbody>${Object.entries(r.subjects).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v.correct}</td><td>${v.wrong}</td><td>${v.blank}</td><td>${percent(v.correct/v.total)} (${v.total} questões)</td></tr>`).join('')}</tbody></table></div></section>
  <div class="section-top"><h2>Rever questão ${reviewIndex+1} de ${s.questions.length}</h2><div class="actions"><button id="prev-review" ${reviewIndex===0?'disabled':''}>Anterior</button><button id="next-review" ${reviewIndex===s.questions.length-1?'disabled':''}>Próxima</button></div></div><article class="panel question">${questionBody(s.questions[reviewIndex],{...s,index:reviewIndex},true)}</article><p><a href="#historico">Ver histórico</a> · <a href="#estudar">Estudar de novo</a></p>`;
  $('#prev-review').onclick=()=>{reviewIndex--;render(false);};$('#next-review').onclick=()=>{reviewIndex++;render(false);};questionActions({...s,index:reviewIndex},true);
}
function history(){
  main.innerHTML=heading('Progresso real','Seu caminho até aqui.','Primeiras tentativas e repetições são exibidas separadamente. Simulados em andamento não entram nas estatísticas.')+`<div class="fields"><label class="field">Modo<select id="history-mode"><option value="all">Todos</option><option value="study">Estudo</option><option value="exam">Simulado</option></select></label><label class="field">Tentativas<select id="history-attempt"><option value="all">Todas</option><option value="first">Primeiras</option><option value="repeat">Repetições</option></select></label><label class="field">Pausas<select id="history-pauses"><option value="all">Todas as sessões</option><option value="none">Sem pausas</option><option value="used">Com pausas</option></select></label></div><div id="history-data"></div>`;
  function update(){
    const all=attempts(state),seen=new Set(),first=new Set();for(const r of all){const key=r.sessionId+':'+r.questionId;if(!seen.has(r.questionId))first.add(key);seen.add(r.questionId);}
    const rows=all.filter(r=>($('#history-mode').value==='all'||r.mode===$('#history-mode').value)&&($('#history-attempt').value==='all'||first.has(r.sessionId+':'+r.questionId)===($('#history-attempt').value==='first'))&&($('#history-pauses').value==='all'||(r.pauses>0)===($('#history-pauses').value==='used')));
    const stats=statistics(rows),days=[...new Set(rows.map(r=>r.day))].slice(-14);
    $('#history-data').innerHTML=`<div class="stats">${metric('Questões únicas',stats.unique)}${metric('Tentativas',stats.total)}${metric('Acertos / erros',`${stats.correct} / ${stats.wrong}`)}${metric('Aproveitamento',percent(stats.rate))}</div><section class="panel"><h2>Desempenho por matéria</h2><div class="table-wrap"><table><thead><tr><th>Matéria</th><th>Respostas</th><th>Questões únicas</th><th>Aproveitamento</th></tr></thead><tbody>${subjects().map(s=>{const r=statistics(rows.filter(r=>r.subject===s));return `<tr><td>${esc(s)}</td><td>${r.total}</td><td>${r.unique}${r.unique>0&&r.unique<10?' · Poucos dados':''}</td><td>${percent(r.rate)}</td></tr>`;}).join('')}</tbody></table></div><h2>Evolução diária</h2>${days.length?`<div class="chart" role="img" aria-label="Aproveitamento por dia. Valores detalhados na tabela a seguir.">${days.map(d=>{const s=statistics(rows.filter(r=>r.day===d));return `<div class="chart-item"><span>${percent(s.rate)}</span><div class="chart-bar" style="height:${s.rate*95}px"></div>${esc(d.slice(5).split('-').reverse().join('/'))}</div>`;}).join('')}</div><details><summary>Valores da evolução</summary><table><thead><tr><th>Dia</th><th>Acertos / respostas</th><th>Aproveitamento</th></tr></thead><tbody>${days.map(d=>{const s=statistics(rows.filter(r=>r.day===d));return `<tr><td>${d}</td><td>${s.correct} / ${s.total}</td><td>${percent(s.rate)}</td></tr>`;}).join('')}</tbody></table></details>`:'<p class="empty">Sem dados ainda.</p>'}</section>
    <div class="section-top"><h2>Histórico de sessões</h2></div>${state.sessions.length?`<div class="panel table-wrap"><table><thead><tr><th>Data</th><th>Modo</th><th>Respostas</th><th>Nota</th><th>Pausas</th><th>Resultado</th></tr></thead><tbody>${[...state.sessions].reverse().filter(s=>$('#history-mode').value==='all'||s.mode===$('#history-mode').value).map(s=>{const r=score(s);return `<tr><td>${date(s.finishedAt)}</td><td>${s.mode==='study'?'Estudo':'Simulado'}</td><td>${r.correct} certas · ${r.wrong} erradas · ${r.blank} em branco</td><td>${number(r.net)} / ${number(r.max)}</td><td>${s.pauses}</td><td><button data-result="${esc(s.id)}">Rever</button></td></tr>`;}).join('')}</tbody></table><small>Notas preservam versões e regras de cada sessão. Os filtros de tentativa afetam as métricas acima, não alteram sessões históricas.</small></div>`:'<p class="empty">Nenhuma sessão finalizada.</p>'}`;
    main.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{viewResult=b.dataset.result;reviewIndex=0;navigate('resultado');});
  }
  main.querySelectorAll('select').forEach(n=>n.onchange=update);update();
}
function revision(){
  if(!studyParams().has('cartoes')){setup('review');return;}
  const subject=studyParams().get('materia');
  const back=subjects().includes(subject)?`#revisao?materia=${encodeURIComponent(subject)}`:'#revisao';
  main.innerHTML=`<div class="flash-shell">
    <div class="flash-nav"><a href="${back}">‹ Voltar à revisão</a><a href="#ajustes">Ajustar intervalos</a></div>
    ${heading('Revisão ativa','Cartões de revisão','Pense na resposta. Vire o cartão e marque como foi.')}
    <div id="cards"></div>
  </div>`;
  renderCards();
}
function cardSchedule(previous,intervals,remember,now=Date.now()){
  const step=remember?Math.min(3,(previous?.step??0)+1):0;
  const due=new Date(now);
  if(remember)due.setDate(due.getDate()+intervals[step-1]);
  return {step,due:due.getTime(),revealed:false};
}
function renderCards(focus=false){
  const deck=$('#cards');
  cardVisit??={queue:cards.filter(card=>(state.cards[card.id]?.due??0)<=Date.now()),index:0,remembered:0,revealed:false};
  const visit=cardVisit;
  const total=visit.queue.length;
  const card=visit.queue[visit.index];
  if(!card){
    const retry=visit.index-visit.remembered;
    deck.innerHTML=`<section class="flash-complete">
      <span class="flash-stamp" aria-hidden="true">✓</span>
      <h2 id="flash-done" tabindex="-1">${total?'Rodada concluída':'Baralho em dia'}</h2>
      <p>${total?`Você passou por ${total} ${total===1?'cartão':'cartões'}.`:'Nenhum cartão está previsto para agora.'}</p>
      ${total?`<dl class="flash-results"><div><dt>Lembrei</dt><dd>${visit.remembered}</dd></div><div><dt>Preciso rever</dt><dd>${retry}</dd></div></dl>`:''}
      <div class="actions">${retry?'<button id="flash-retry" class="primary" type="button">Rever pendentes</button>':''}
      <a class="button" href="#estudar">Voltar a Estudar</a></div>
    </section>`;
    if(retry)$('#flash-retry').onclick=()=>{cardVisit=null;renderCards(true);};
    if(focus)$('#flash-done').focus();
    return;
  }

  const previous=state.cards[card.id];
  const nextDays=state.cardIntervals[Math.min(2,previous?.step??0)];
  deck.innerHTML=`<div class="flash-meter">
    <div><span>Cartão <strong>${visit.index+1} de ${total}</strong></span><span>${visit.index} ${visit.index===1?'revisado':'revisados'}</span></div>
    <progress value="${visit.index}" max="${total}" aria-label="Cartões revisados nesta rodada"></progress>
  </div>
  <div class="flash-stack">
    <div class="flash-rotor" id="flash-rotor">
      <button id="reveal" class="flash-face flash-front" type="button" aria-labelledby="flash-prompt flash-turn-label">
        <span class="flash-face-top"><span>Pergunta</span><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="7" width="14" height="14" rx="3"/><path d="M7 4h11a3 3 0 0 1 3 3v11M7 12h6m-6 4h4"/></svg></span>
        <span class="flash-prompt" id="flash-prompt">${esc(card.question)}</span>
        <span class="flash-face-bottom" id="flash-turn-label">Virar cartão <span aria-hidden="true">↻</span></span>
      </button>
      <section class="flash-face flash-back" id="flash-back" aria-labelledby="flash-answer-title" aria-hidden="true" inert>
        <div class="flash-face-top"><h2 id="flash-answer-title">Resposta</h2></div>
        <p class="flash-answer" id="flash-answer" tabindex="-1">${esc(card.answer)}</p>
        <div class="flash-face-bottom"><button type="button" id="flash-unturn">‹ Ver pergunta</button></div>
      </section>
    </div>
  </div>
  <div id="flash-grading" hidden>
    <p class="flash-grade-title">Como foi?</p>
    ${canWrite?'':'<p class="note">Aba em modo de leitura. <a href="#ajustes">Abrir Seus dados</a> para retomar o salvamento.</p>'}
    <div class="flash-ratings">
      <button id="again" type="button" ${canWrite?'':'disabled'}><strong>Preciso rever</strong><small>Volta na próxima rodada</small></button>
      <button id="remember" class="primary" type="button" ${canWrite?'':'disabled'}><strong>Lembrei</strong><small>Revisar em ${nextDays} ${nextDays===1?'dia':'dias'}</small></button>
    </div>
    <details class="flash-reference"><summary>Ver fonte</summary><a href="${esc(card.source.url)}" target="_blank" rel="noreferrer">${esc(card.source.title)}</a> · ${esc(card.source.location)}</details>
  </div>`;
  const front=$('#reveal'),back=$('#flash-back'),unturn=$('#flash-unturn');
  const again=$('#again'),remember=$('#remember');
  function setFace(revealed,moveFocus=true){
    visit.revealed=revealed;
    $('#flash-rotor').classList.toggle('is-flipped',revealed);
    const shown=revealed?back:front;
    const covered=revealed?front:back;
    shown.inert=false;
    shown.removeAttribute('aria-hidden');
    $('#flash-grading').hidden=!revealed;
    if(moveFocus)(revealed?$('#flash-answer'):front).focus({preventScroll:true});
    covered.inert=true;
    covered.setAttribute('aria-hidden','true');
  }
  function disableRating(disabled){
    again.disabled=remember.disabled=disabled||!canWrite;
    unturn.disabled=disabled;
  }
  async function rate(recalled){
    if(cardSaving||!visit.revealed||!canWrite)return;
    cardSaving=true;
    disableRating(true);
    const schedule=cardSchedule(previous,state.cardIntervals,recalled);
    try{
      writable();
      state.cards[card.id]=schedule;
      await save();
    }catch(error){
      if(state.cards[card.id]===schedule){
        if(previous)state.cards[card.id]=previous;
        else delete state.cards[card.id];
      }
      notify(error.message);
      disableRating(false);
      if(cardVisit===visit&&deck.isConnected)(recalled?remember:again).focus();
      return;
    }finally{
      cardSaving=false;
      disableRating(false);
    }
    visit.index++;
    if(recalled)visit.remembered++;
    visit.revealed=false;
    if(cardVisit===visit&&deck.isConnected)renderCards(true);
  }
  front.onclick=()=>setFace(true);
  unturn.onclick=()=>setFace(false);
  again.onclick=()=>rate(false);
  remember.onclick=()=>rate(true);
  setFace(visit.revealed,focus);
}
function download(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function settings(){
  main.innerHTML=heading('Seu progresso, seus dados','Um cuidado com o que você construiu.','Histórico, sessão, favoritas, dúvidas, cartões e sinalizações ficam somente neste navegador. Use o backup para proteger ou transferir seu progresso.')+`
  ${!canWrite?'<p class="note warning">Esta aba está em modo de leitura. Feche a outra aba antes de retomar.</p><button id="takeover">Retomar nesta aba</button>':''}
  <section class="panel"><h2>Backup do progresso</h2><p>Última exportação gerada: <strong>${state.lastExport?date(state.lastExport):'nenhuma'}</strong>. Confira se o arquivo foi salvo em Downloads. Atualizar o site não cria backup; copiar os arquivos do site não transfere dados do navegador.</p><div class="actions"><button id="export" class="primary">Exportar progresso</button><label class="file-label">Restaurar arquivo<input id="import" type="file" accept=".json,application/json"></label></div><p id="backup-status" role="status"></p></section>
  <form id="preferences" class="panel" style="margin-top:24px"><h2>Seu ritmo</h2><div class="fields"><label class="field">Meta diária de respostas<input name="goal" type="number" min="1" max="1000" value="${state.goal}" required></label>${state.cardIntervals.map((d,i)=>`<label class="field">Intervalo ${i+1} dos cartões (dias)<input name="interval${i}" type="number" min="1" max="365" value="${d}" required></label>`).join('')}</div><button ${!canWrite?'disabled':''}>Salvar preferências</button></form>
  <section class="panel" style="margin-top:24px"><div class="row"><h2>Sinalizações locais (${state.reports.length})</h2><button id="export-reports">Exportar sinalizações</button></div><p>Esta lista não é enviada ao desenvolvedor automaticamente.</p>${state.reports.length?state.reports.map(r=>`<div class="review-row"><div><strong>${esc(r.questionId)} · v${r.questionVersion}</strong><small> · ${date(r.createdAt)}</small><p>${esc(r.text)}</p></div></div>`).join(''):'<p class="muted">Nenhum problema sinalizado.</p>'}</section>`;
  if($('#takeover'))$('#takeover').onclick=async()=>{try{await acquire();if(canWrite){notify('Esta aba pode salvar agora.');render();}}catch(e){notify(e.message);}};
  $('#export').onclick=async()=>{try{state.lastExport=Date.now();if(canWrite)await save();download(state,`bruna-estuda-backup-${localDay()}.json`);$('#backup-status').textContent='Arquivo gerado. Confira o download antes de fechar o site.';}catch(e){download(state,`bruna-estuda-emergencia-${localDay()}.json`);$('#backup-status').textContent='Falha ao salvar no navegador. Backup de emergência gerado; confira o download.';}};
  $('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{writable();if(file.size>100*1024*1024)throw new Error('Backup maior que 100 MB.');const imported=parseBackup(await file.text());if(!await modal('Substituir progresso?',`<p>Arquivo válido: ${imported.sessions.length} sessões finalizadas${imported.active?' e uma sessão em andamento':''}.</p><p>O progresso atual será substituído integralmente. Exporte-o antes, se quiser manter uma cópia.</p>`,'Substituir dados'))return;await writeQueue;await writeState(db,imported);state=imported;notify('Backup restaurado.');render();}catch(error){$('#backup-status').textContent=error.message;}finally{e.target.value='';}};
  $('#preferences').onsubmit=async e=>{e.preventDefault();try{writable();state.goal=Number(e.target.elements.goal.value);state.cardIntervals=[0,1,2].map(i=>Number(e.target.elements[`interval${i}`].value));await save();notify('Preferências salvas.');}catch(e){notify(e.message);}};
  $('#export-reports').onclick=()=>download({app:APP,version:1,reports:state.reports},`bruna-estuda-sinalizacoes-${localDay()}.json`);
}
function coverage(){
  const approved=available();const countBy=key=>{const counts=new Map();for(const q of approved)counts.set(q[key],(counts.get(q[key])||0)+1);return [...counts.entries()].map(([k,n])=>`<tr><td>${esc(key==='difficulty'?diff[k]:key==='origin'?(k==='real'?'Aplicada':'Autoral'):k||'Não se aplica')}</td><td>${n}</td></tr>`).join('');};
  main.innerHTML=heading('Transparência do acervo','Questões com origem e contexto.','Conteúdo histórico não confirma o programa de um próximo concurso. Dificuldade é editorial. Somente itens aprovados entram no treino.')+`<section class="panel"><p class="coverage-count">${approved.length} <small>/ meta desta etapa: 300 ativas</small></p><p>${bank.filter(q=>q.status==='pending').length} itens pendentes no arquivo de acervo carregado. Candidatos ainda em pesquisa são contabilizados separadamente no inventário interno.</p><p>Explicações próprias, conferidas por consulta automática às fontes; sem revisão profissional humana. Não constituem orientação clínica para pacientes.</p><div class="note warning">SES-DF: referência inicial é a seleção de 2014. Especialidades e regras de um concurso futuro dependem do respectivo edital. Não há configuração de próximo concurso confirmada nesta versão.</div>${['subject','topic','origin','board','difficulty'].map(k=>`<details open><summary>Contagem por ${{subject:'matéria',topic:'assunto',origin:'origem',board:'banca',difficulty:'dificuldade'}[k]}</summary><table><thead><tr><th>Classificação</th><th>Ativas</th></tr></thead><tbody>${countBy(k)}</tbody></table></details>`).join('')}<h2>Fontes por questão</h2><p>Enunciados autorais são identificados individualmente. As referências de cada explicação aparecem depois da correção. Gabaritos antigos sem verificação definitiva, questões anuladas e material com reutilização pendente não são liberados.</p><a href="./data/inventory.json" target="_blank">Abrir inventário público de fontes</a></section>`;
}
function help(){main.innerHTML=heading('Guia rápido','Estude, confirme, revise.')+`<section class="panel"><ol><li>Abra Estudar e escolha Treinar, Simulado ou Revisar. No treino, escolha a quantidade e as matérias. Selecionar uma alternativa não registra resposta: clique em Confirmar resposta.</li><li>Leia as explicações. Use Próxima quando terminar. Em simulados, a correção fica escondida até finalizar.</li><li>Pausar congela o tempo e oculta o conteúdo. Fechar sem pausar mantém a contagem. Uma mudança no relógio do sistema pode afetar o tempo.</li><li>Em Revisar, volte às erradas, favoritas e dúvidas ou use os cartões. Cada nova sessão guarda uma tentativa independente.</li><li>Em Seus dados, exporte o progresso regularmente. Para mudar de endereço ou computador, exporte no antigo e restaure no novo.</li></ol><h2>Cuidados com seus dados</h2><p>Usamos IndexedDB com formato identificado e versionado. Dados não são enviados a serviços externos. Limpar dados do navegador ou usar modo anônimo pode apagar o progresso. Internet pode ser necessária para abrir o site. Não há promessa de funcionamento offline completo.</p><p>As sessões guardam as versões das questões e as regras usadas. Atualizar o banco não recalcula silenciosamente notas antigas. O histórico oferece as explicações da versão respondida.</p><h2>Acesso e teclado</h2><p>Use Tab para navegar, Espaço para selecionar e Enter para acionar botões. Alternativas também podem ser escolhidas pelas setas do teclado quando o grupo tem foco. Questões extensas podem exigir rolagem. O mapa mostra respostas confirmadas, sem indicar acerto ou erro no simulado.</p><h2>Abrir e atualizar</h2><p>Baixe o atalho no rodapé, extraia o pacote e abra o arquivo ABRA AQUI. Ele abre sempre o mesmo endereço do site. É preciso ter internet. Ao abrir ou recarregar, o site confere a versão publicada e mostra Atualizando quando há novidades. Uma sessão em andamento mantém suas questões e regras originais; o acervo novo vale para as próximas sessões.</p><p>O atalho não contém seu histórico. Use sempre o mesmo navegador e perfil. O progresso permanece no navegador deste endereço; antes de trocar de computador ou endereço, exporte e restaure seu backup.</p><p>O código e o acervo publicados no GitHub Pages são públicos. O PIN da entrada é apenas uma barreira visual contra curiosos; não protege arquivos ou dados sensíveis.</p></section>`;}
function render(focus=true){
  const before=document.activeElement;
  const selector=before?.id?`#${CSS.escape(before.id)}`:before?.name==='answer'?`input[name="answer"][value="${before.value}"]`:before?.dataset.mark?`[data-mark="${before.dataset.mark}"]`:null;
  const path=route();
  const current=studyRoutes.includes(path)?'estudar':path;
  document.querySelectorAll('nav a').forEach(a=>{if(a.hash===`#${current}`)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  try{({inicio:home,estudar:study,treinar:()=>setup('study'),simulados:()=>setup('exam'),sessao:session,resultado:result,historico:history,revisao:revision,ajustes:settings,acervo:coverage,ajuda:help}[path]||home)();if(focus){main.focus({preventScroll:true});window.scrollTo(0,0);}else if(selector){const target=$(selector);if(target&&!target.disabled&&!target.closest('fieldset[disabled]'))target.focus({preventScroll:true});else if($('.explanation h3')){$('.explanation h3').tabIndex=-1;$('.explanation h3').focus({preventScroll:true});}}}
  catch(e){main.innerHTML=heading('Não foi possível abrir esta tela','Seus dados precisam de atenção.')+`<p class="note error">${esc(e.message)}</p><a class="button" href="#ajustes">Abrir Seus dados</a>`;}
}
async function init(){
  try{
    const [questions,cardData]=await Promise.all(['questions','cards'].map(async name=>{const response=await fetch(`./data/${name}.json${releaseQuery}`,{cache:'no-cache'});if(!response.ok)throw new Error(`Falha ao carregar ${name}.`);return response.json();}));
    if(!Array.isArray(questions))throw new Error('Acervo inválido.');questions.forEach(validateQuestion);if(new Set(questions.map(q=>q.id)).size!==questions.length)throw new Error('Identificadores repetidos no acervo.');bank=questions;cards=cardData;
  }catch(e){main.innerHTML=heading('Acervo indisponível','Não foi possível carregar as questões.')+`<p class="note error">${esc(e.message)} Confira a conexão e recarregue.</p>`;return;}
  try{db=await openDatabase();state=await readState(db);await acquire();if(canWrite)await writeState(db,state);}
  catch(e){canWrite=false;storageMessage(`Armazenamento indisponível: ${e.message}. Não inicie uma sessão sem salvamento.`);}
  render();window.addEventListener('hashchange',()=>{cardVisit=null;render();});window.addEventListener('beforeunload',event=>{if(pendingWrites){event.preventDefault();event.returnValue='';}});setInterval(updateTimer,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateTimer();});
  if(!state.lastExport||Date.now()-state.lastExport>7*86400000){if(state.sessions.length)notify('Seu progresso merece uma cópia. Exporte o backup em Seus dados.');}
}
// Barreira visual para curiosos, não autenticação: o site e o PIN são públicos.
const pinForm=$('#pin-form'),pinInput=$('#entry-pin'),pinMessage=$('#pin-message');
function editPin(value){pinInput.value=value.replace(/\D/g,'').slice(0,4);pinInput.removeAttribute('aria-invalid');pinMessage.textContent='';}
pinInput.oninput=()=>editPin(pinInput.value);
pinForm.querySelectorAll('[data-digit]').forEach(button=>button.onclick=()=>editPin(pinInput.value+button.dataset.digit));
$('#pin-clear').onclick=()=>editPin('');
$('#pin-back').onclick=()=>editPin(pinInput.value.slice(0,-1));
pinForm.onsubmit=event=>{
  event.preventDefault();
  if(pinForm.querySelector('[type="submit"]').disabled)return;
  if(pinInput.value!=='1807'){
    pinInput.value='';pinInput.setAttribute('aria-invalid','true');pinMessage.textContent='PIN incorreto. Tente novamente.';pinInput.focus();return;
  }
  pinForm.querySelector('[type="submit"]').disabled=true;
  pinInput.value='';$('#entry').hidden=true;$('#app-shell').hidden=false;
  main.focus({preventScroll:true});init();
};
