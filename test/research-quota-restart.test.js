import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
test('interrumpir investigación y perder historial visible no reinicia cupo diario',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quota-restart-'));
  const env={...process.env,GUICON_DATA_DIR:dir,PAID_API_ENABLED:'true',OPENAI_API_KEY:'TEST',MAX_RESEARCH_RUNS_PER_DAY:'1'};
  try {
    execFileSync(process.execPath,['--input-type=module','-e',"import {startResearch} from './src/research.js'; startResearch({},()=>new Promise(()=>{}));"],{env});
    fs.writeFileSync(path.join(dir,'research.json'),'[]');
    const output=execFileSync(process.execPath,['--input-type=module','-e',"import {startResearch} from './src/research.js'; try {startResearch({},async()=>({}));process.exitCode=1;} catch(e){console.log(e.status);}"],{env,encoding:'utf8'});
    assert.equal(output.trim(),'429');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
