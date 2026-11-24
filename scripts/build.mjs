import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const extras=(await Promise.all(['worker/player-shots.js','worker/picks.js','worker/count-model.js','worker/features.js'].map(p=>readFile(p,'utf8')))).join('\n').replaceAll('export async function','async function').replaceAll('export function','function');
const page=await readFile('worker/page.js','utf8');const model=await readFile('worker/model.js','utf8');const worker=(await readFile('worker/index.js','utf8')).replace(/^import .*;\r?\n/gm,'');
await writeFile('dist/server/index.js',page.replace('export const html','const html')+'\n'+model.replaceAll('export function','function')+'\n'+extras+'\n'+worker);await cp('.openai/hosting.json','dist/.openai/hosting.json');

await cp('drizzle','dist/.openai/drizzle',{recursive:true});
