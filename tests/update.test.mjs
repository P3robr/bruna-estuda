import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../docs/boot.mjs',import.meta.url),'utf8');
const release='0123456789abcdef';
async function check(previous,{fail=false,invalid=false,storageFails=false}={}){
  const messages=[],loaded=[],requests=[];
  const status={set textContent(value){messages.push(value);}};
  const retry={hidden:true},submit={disabled:true};
  const style={set href(value){loaded.push(value);queueMicrotask(()=>this.onload());}};
  const nodes={'#update-status':status,'#retry-update':retry,'#app-styles':style,'#pin-form [type="submit"]':submit};
  const storage=new Map(previous?[['bruna-estuda-release',previous]]:[]);
  await runInNewContext(source,{
    document:{querySelector:key=>nodes[key],createElement:()=>({}),head:{append(script){loaded.push(script.src);queueMicrotask(()=>script.onload());}}},
    location:{reload(){}},
    AbortSignal:{timeout:()=>({})},
    localStorage:{getItem:key=>{if(storageFails)throw Error();return storage.get(key);},setItem:(key,value)=>{if(storageFails)throw Error();storage.set(key,value);}},
    fetch:async(url,options)=>{requests.push({url,options});if(fail)throw Error('offline');return {ok:true,json:async()=>({format:1,release:invalid?'../untrusted':release})};}
  });
  return {messages,loaded,requests,retry,submit,storage};
}
for(const previous of [undefined,release,'fedcba9876543210']){
  const result=await check(previous);
  assert.equal(result.requests[0].options.cache,'no-store');
  assert.deepEqual(result.loaded,[`./styles.css?v=${release}`,`./app.mjs?v=${release}`]);
  assert.equal(result.submit.disabled,false);
  assert.equal(result.storage.get('bruna-estuda-release'),release);
  assert.equal(result.messages.includes('Atualizando seu espaço…'),Boolean(previous&&previous!==release));
}
for(const options of [{fail:true},{invalid:true}]){
  const result=await check(release,options);
  assert.equal(result.submit.disabled,true);
  assert.equal(result.retry.hidden,false);
  assert.equal(result.loaded.length,0);
}
assert.equal((await check(undefined,{storageFails:true})).submit.disabled,false);
console.log('Atualização: versão nova/igual, primeiro acesso, falha de rede, versão inválida e armazenamento restrito conferidos.');
