import {readFileSync,readdirSync,lstatSync,writeFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {buildDossier,sourceImports,htmlFacts} from '../vendor/makefun-game.ts';
const checks=[];function check(name,pass){checks.push({name,pass});if(!pass)throw Error(name);console.log('PASS '+name);}
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const path=join(dir,e.name);check('plain entry '+path,!lstatSync(path).isSymbolicLink());return e.isDirectory()?walk(path):[path];});
const files=walk('game'),images=readdirSync('screenshots');let bytes=0;for(const f of files){bytes+=lstatSync(f).size;if(f.endsWith('.js'))check('syntax '+f,spawnSync('node',['--check',f]).status===0);}
check('game size cap',bytes<50331648);check('game file cap',files.length+2<993);check('index size cap',lstatSync('game/index.html').size<1048576);check('four screenshots',images.length===4);for(const name of images)check('JPEG cap '+name,lstatSync(join('screenshots',name)).size<262144);
for(const f of files.filter(f=>f.endsWith('.js'))){for(const spec of sourceImports(readFileSync(f,'utf8'))){check('local import '+f+' -> '+spec,spec.startsWith('.')&&files.map(x=>resolve(x)).includes(resolve(dirname(f),spec)));}}
check('no import map',htmlFacts(readFileSync('game/index.html','utf8')).importMaps.length===0);
check('no authored remote URL',files.filter(f=>!f.includes('/vendor/')).every(f=>!(/https?:\/\//).test(readFileSync(f,'utf8'))));
for(const folder of ['game','screenshots']){const original=walk(folder),copied=walk('out/'+folder);check('output tree '+folder,original.length===copied.length&&original.every(f=>readFileSync(f).equals(readFileSync('out/'+f))));}
const caps={text_max_bytes:163840,screenshots:{max:4,max_bytes:262144},game_max_files:993,game_max_bytes:50331648,game_path_max_bytes:1000};const dossier=readFileSync('out/dossier.json');check('canonical dossier matches',dossier.equals(Buffer.from(buildDossier('out',caps))));check('dossier cap',dossier.length<1572864);
const hash=createHash('sha256').update(dossier).digest('hex');spawnSync('node',['main.ts'],{env:{...process.env,MAKEFUN_OUTPUT_DIR:'out'}});check('repeat packaging deterministic',createHash('sha256').update(readFileSync('out/dossier.json')).digest('hex')===hash);
writeFileSync('test-artifacts/package-report.json',JSON.stringify({checks,gameFiles:files.length,gameBytes:bytes,indexBytes:lstatSync('game/index.html').size,dossierBytes:dossier.length,dossierSha256:hash,screenshots:images.map(name=>({name,bytes:lstatSync(join('screenshots',name)).size}))},null,2));
