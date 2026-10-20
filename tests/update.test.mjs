import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../docs/boot.mjs',import.meta.url),'utf8');
const release='0123456789abcdef';
const bootstrap=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8').match(/<script type="module" id="bootstrap">([\s\S]*?)<\/script>/)[1];
for(const search of ['',`?v=${release}`]){
  const status={},retry={hidden:true};let script,reloads=0;
  runInNewContext(bootstrap,{document:{createElement:()=>({}),head:{append:node=>{script=node;}},querySelector:key=>key==='#update-status'?status:retry},location:{search,reload:()=>reloads++}});
  assert.equal(script.src,`./boot.mjs${search}`);
  script.onerror();assert.equal(retry.hidden,false);assert.match(status.textContent,/Não foi possível/);
  retry.onclick();assert.equal(reloads,1);
}
async function check(previous,{fail=false,invalid=false,storageFails=false,entryRelease=release,assetFails}={}){
  const messages=[],loaded=[],requests=[],redirects=[];
  const status={set textContent(value){messages.push(value);}};
  const retry={hidden:true},submit={disabled:true};
  const style={set href(value){loaded.push(value);queueMicrotask(()=>assetFails==='style'?this.onerror():this.onload());}};
  const nodes={'#update-status':status,'#retry-update':retry,'#app-styles':style,'#pin-form [type="submit"]':submit};
  const storage=new Map(previous?[['bruna-estuda-release',previous]]:[]);
  await runInNewContext(source,{
    document:{querySelector:key=>nodes[key],createElement:()=>({}),head:{append(script){loaded.push(script.src);queueMicrotask(()=>assetFails==='script'?script.onerror():script.onload());}}},
    location:{href:`https://example.test/bruna-estuda/?origem=atalho${entryRelease?`&v=${entryRelease}`:''}#simulados`,replace:url=>redirects.push(url),reload(){}},URL,
    AbortSignal:{timeout:()=>({})},
    localStorage:{getItem:key=>{if(storageFails)throw Error();return storage.get(key);},setItem:(key,value)=>{if(storageFails)throw Error();storage.set(key,value);}},
    fetch:async(url,options)=>{requests.push({url,options});if(fail)throw Error('offline');return {ok:true,json:async()=>({format:1,release:invalid?'../untrusted':release})};}
  });
  return {messages,loaded,requests,retry,submit,storage,redirects};
}
for(const previous of [undefined,release,'fedcba9876543210']){
  const result=await check(previous);
  assert.equal(result.requests[0].options.cache,'no-store');
  assert.deepEqual(result.loaded,[`./styles.css?v=${release}`,`./app.mjs?v=${release}`]);
  assert.equal(result.submit.disabled,false);
  assert.equal(result.storage.get('bruna-estuda-release'),release);
  assert.equal(result.messages.includes('Atualizando seu espaço…'),Boolean(previous&&previous!==release));
  assert.equal(result.redirects.length,0);
}
for(const entryRelease of [null,'fedcba9876543210']){
  const result=await check('fedcba9876543210',{entryRelease});
  assert.deepEqual(result.redirects,[`https://example.test/bruna-estuda/?origem=atalho&v=${release}#simulados`]);
  assert.equal(result.loaded.length,0); // Aguarda o documento da versão correta antes de iniciar.
  assert.equal(result.submit.disabled,true);
  assert.equal(result.storage.get('bruna-estuda-release'),'fedcba9876543210');
}
for(const options of [{fail:true},{invalid:true}]){
  const result=await check(release,options);
  assert.equal(result.submit.disabled,true);
  assert.equal(result.retry.hidden,false);
  assert.equal(result.loaded.length,0);
  assert.equal(result.redirects.length,0);
}
assert.equal((await check(undefined,{storageFails:true})).submit.disabled,false);
for(const assetFails of ['style','script']){
  const result=await check('fedcba9876543210',{assetFails});
  assert.equal(result.submit.disabled,true);assert.equal(result.retry.hidden,false);
  assert.equal(result.storage.get('bruna-estuda-release'),'fedcba9876543210');
}
// A revisão explica mudanças editoriais sem usar o gabarito novo para reescrever a tentativa.
const app=readFileSync(new URL('../docs/app.mjs',import.meta.url),'utf8');
const explanationSource=app.slice(app.indexOf('function explanation('),app.indexOf('function questionBody('));
const historical={id:'question-test',version:1,answer:0,explanations:['Comentário original A.','Comentário original B.'],references:[],checkedAt:'2026-10-15'};
const original=structuredClone(historical);
function review(current){
  return runInNewContext(explanationSource+';explanation(question,0)',{bank:current?[current]:[],question:historical,esc:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;')});
}
assert.doesNotMatch(review({...historical,status:'approved'}),/note warning/);
for(const status of ['approved','pending','historical','excluded']){
  const html=review({...historical,version:2,status,answer:1,editorialNote:'Motivo <conferido>.'});
  assert.match(html,/versão 1/);assert.match(html,/versão 2/);
  assert.match(html,/Gabarito: A/);assert.doesNotMatch(html,/Gabarito: B/);
  assert.match(html,/Motivo &lt;conferido&gt;/);
  assert.equal(html.includes('fora do treino atual'),status!=='approved');
}
assert.match(review(),/não está no acervo atual/);
assert.deepEqual(historical,original);
console.log('Atualização: entrada, recursos, falhas e endereço conferidos; revisão informa mudança/retirada sem reescrever o gabarito da tentativa.');
