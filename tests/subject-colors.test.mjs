import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../docs/styles.css',import.meta.url),'utf8');
const questions=JSON.parse(readFileSync(new URL('../docs/data/questions.json',import.meta.url),'utf8'));
const colors=new Map([...css.matchAll(/\[data-subject="([^"]+)"\]\{--subject-ink:(#[0-9a-f]{6});--subject-bg:(#[0-9a-f]{6})\}/g)].map(([,subject,ink,bg])=>[subject,{ink,bg}]));
const luminance=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const used=new Set();
for(const subject of new Set(questions.map(q=>q.subject))){
  assert.ok(colors.has(subject),`Matéria sem cor: ${subject}`);
  const {ink,bg}=colors.get(subject);
  assert.ok(!used.has(ink),`Cor repetida: ${subject}`);used.add(ink);
  const a=luminance(ink),b=luminance(bg);
  assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`Contraste insuficiente: ${subject}`);
}
assert.equal(colors.get('Raciocínio lógico e matemática').ink,'#17633f');
console.log(`${used.size} matérias com cores distintas e contraste de texto de pelo menos 4,5:1.`);
