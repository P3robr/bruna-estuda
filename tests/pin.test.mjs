import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Executa os mesmos eventos da entrada sem dependências ou acesso ao progresso.
const elements=Object.fromEntries(['entry-pin','pin-message','pin-clear','pin-back','entry','app-shell'].map(id=>[id,{value:'',textContent:'',hidden:id==='app-shell',attributes:{},focus(){this.focused=true;},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];}}]));
const digits=Array.from({length:10},(_,digit)=>({dataset:{digit:String(digit)}}));
const submit={disabled:false};
elements['pin-form']={querySelectorAll:()=>digits,querySelector:()=>submit};
let starts=0;
const source=readFileSync(new URL('../docs/app.mjs',import.meta.url),'utf8');
runInNewContext(source.slice(source.indexOf("const pinForm=")),{$:selector=>elements[selector.slice(1)],main:{focus(){}},init(){starts++;}});
const input=elements['entry-pin'],form=elements['pin-form'];
const send=()=>form.onsubmit({preventDefault(){}});

assert.equal(starts,0);
assert.equal(elements['app-shell'].hidden,true);
input.value='12a345';input.oninput();assert.equal(input.value,'1234');
elements['pin-back'].onclick();assert.equal(input.value,'123');
elements['pin-clear'].onclick();assert.equal(input.value,'');
for(const digit of [1,1,1,1])digits[digit].onclick();
send();
assert.equal(starts,0);
assert.equal(elements['app-shell'].hidden,true);
assert.equal(input.attributes['aria-invalid'],'true');
assert.match(elements['pin-message'].textContent,/incorreto/);
assert.equal(input.value,'');
for(const digit of [1,8,0,7])digits[digit].onclick();
assert.equal(input.attributes['aria-invalid'],undefined);
send();
assert.equal(starts,1);
assert.equal(elements.entry.hidden,true);
assert.equal(elements['app-shell'].hidden,false);
assert.equal(input.value,'');
send();assert.equal(starts,1);
console.log('Entrada: bloqueio inicial, edição, PIN errado, PIN 1807 e inicialização única conferidos.');
