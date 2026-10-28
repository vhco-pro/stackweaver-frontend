// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
// Disposable production-image fixtures. Only loopback ports and synthetic runtime data.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { siteSettings } from '../scripts/site-settings.mjs';
const record=process.env.SW_SEO_RUNTIME_RECORD??'/tmp/stackweaver-public-site-runtime.json';
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:120_000,stdio:['ignore','pipe','pipe']}).trim();
const marker='stackweaver-public-seo-fixture';
if(process.argv[2]==='stop') {
 const state=JSON.parse(readFileSync(record,'utf8'));
 for(const fixture of state.fixtures) if(docker('inspect','--format','{{index .Config.Labels "purpose"}}',fixture.id)===marker) docker('rm','--force',fixture.id);
 state.cleanedUp=true;writeFileSync(record,JSON.stringify(state,null,2)+'\n');console.log('Removed only the recorded SEO fixtures.');
} else {
 const image=process.env.SW_SEO_TEST_IMAGE??'stackweaver-frontend:public-seo-20261028-final';
 const imageID=docker('image','inspect','--format','{{.Id}}',image);
 const stage=mkdtempSync(join(tmpdir(),'sw-public-runtime-'));
 const state={image,imageID,fixtures:[]};
 try {
  for(const options of [{name:'root',url:'https://stackweaver.sh',indexing:true},{name:'prefix',url:'https://customer.example/stack',indexing:true},{name:'private',url:'https://private.customer.example',indexing:false}]) {
   const basePath=new URL(options.url).pathname.replace(/\/$/,'');
   const settings=join(stage,options.name+'.conf'),env=join(stage,options.name+'.js');
   writeFileSync(settings,siteSettings(options));writeFileSync(env,'window.__STACKWEAVER__ = '+JSON.stringify({VITE_API_URL:'/api/v2',VITE_BASE_PATH:basePath})+';\n');
   const id=docker('create','--label','purpose='+marker,'--publish','127.0.0.1::8080','--cap-drop=ALL','--security-opt=no-new-privileges',imageID);
   const fixture={...options,basePath,id};state.fixtures.push(fixture);
   docker('cp',settings,`${id}:/etc/nginx/public-site-settings.conf`);docker('cp',env,`${id}:/usr/share/nginx/html/env.js`);
   docker('start',id);fixture.origin='http://'+docker('port',id,'8080/tcp');
  }
  writeFileSync(record,JSON.stringify(state,null,2)+'\n');console.log(JSON.stringify(state,null,2));
 } catch(error) {for(const fixture of state.fixtures)docker('rm','--force',fixture.id);throw error;}
 finally {rmSync(stage,{recursive:true,force:true});}
}
