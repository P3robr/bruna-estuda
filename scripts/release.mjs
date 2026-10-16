import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';

const root=fileURLToPath(new URL('../docs/',import.meta.url));
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(item=>item.isDirectory()?files(join(dir,item.name)):[join(dir,item.name)]))).flat();}
const paths=(await files(root)).filter(path=>relative(root,path)!=='version.json').sort();
const hash=createHash('sha256');
for(const path of paths){hash.update(relative(root,path).replaceAll('\\','/'));hash.update('\0');hash.update(await readFile(path));hash.update('\0');}
const release=hash.digest('hex').slice(0,16);
await writeFile(join(root,'version.json'),JSON.stringify({format:1,release,generatedAt:new Date().toISOString()},null,2)+'\n');
console.log(`Versão ${release} preparada; ${paths.length} arquivos. O progresso do navegador não foi alterado.`);
