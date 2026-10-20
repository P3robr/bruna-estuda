import {readFileSync,writeFileSync} from 'node:fs';
import {validateQuestion} from '../docs/core.mjs';
const questions=JSON.parse(readFileSync('docs/data/questions.json','utf8'));
const ids=new Set(),texts=new Map();
for(const q of questions){
 validateQuestion(q);
 if(ids.has(q.id))throw new Error(`Identificador duplicado: ${q.id}`);ids.add(q.id);
 const fingerprint=(q.prompt+' '+q.options.join(' ')).normalize('NFD').replace(/\p{Diacritic}|[^a-zA-Z0-9]/gu,'').toLowerCase();
 if(texts.has(fingerprint))throw new Error(`Duplicata literal: ${q.id} e ${texts.get(fingerprint)}`);texts.set(fingerprint,q.id);
 if(q.status==='approved'&&(!q.editorialReview||!q.difficultyBasis||!q.reuse))throw new Error(`Faltam evidências editoriais: ${q.id}`);
}
const active=questions.filter(q=>q.status==='approved');
const inventory=JSON.parse(readFileSync('docs/data/inventory.json','utf8'));
if(active.filter(q=>q.origin==='real').length!==inventory.activeReal||active.filter(q=>q.origin==='authorial').length!==inventory.activeAuthorial)throw new Error('Contagem por origem divergente no inventário.');
if(inventory.sources.reduce((sum,source)=>sum+(source.activeCount||0),0)!==inventory.activeReal)throw new Error('Contagem de itens ativos por fonte divergente no inventário.');
if(inventory.sources.reduce((sum,source)=>sum+(source.candidateCount||0),0)!==inventory.realCandidateQuestionsLocated)throw new Error('Contagem bruta de candidatos divergente no inventário.');
const countBy=key=>Object.fromEntries([...new Set(active.map(q=>q[key]??'Não se aplica'))].map(k=>[k,active.filter(q=>(q[key]??'Não se aplica')===k).length]));
const minimum=300; // Meta desta etapa, reduzida pelo usuário em 18/10/2026.
const report={generatedAt:new Date().toISOString(),active:active.length,minimum,minimumReached:active.length>=minimum,totalInApp:questions.length,pending:questions.filter(q=>q.status==='pending').length,historical:questions.filter(q=>q.status==='historical').length,excluded:questions.filter(q=>q.status==='excluded').length,bySubject:countBy('subject'),byTopic:countBy('topic'),byOrigin:countBy('origin'),byBoard:countBy('board'),byDifficulty:countBy('difficulty'),limits:['Validação estrutural e detecção literal não substituem conferência semântica de duplicatas, gabaritos e explicações.','Coleta real e cobertura final ainda em andamento; o piloto não é entrega final.']};
writeFileSync('docs/data/coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(`Ativas: ${report.active}; meta de ${minimum} ${report.minimumReached?'atingido numericamente':'ainda NÃO atingido'}.`);
