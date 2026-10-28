// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
// Run after serve-public-fixtures.mjs. Verifies every generated public document in the image.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const runtime=JSON.parse(readFileSync(process.env.SW_SEO_RUNTIME_RECORD??'/tmp/stackweaver-public-site-runtime.json','utf8'));
const results=[];
for(const fixture of runtime.fixtures.filter(f=>f.indexing)) {
 const response=await fetch(fixture.origin+fixture.basePath+'/public-pages.json');assert.equal(response.status,200);
 const pages=await response.json();const rows=[];
 for(let offset=0;offset<pages.length;offset+=6) {
  rows.push(...await Promise.all(pages.slice(offset,offset+6).map(async page=>{
   const response=await fetch(fixture.origin+fixture.basePath+page.path,{redirect:'manual'});
   assert.equal(response.status,200,`${fixture.name}: ${page.path}`);
   assert.match(response.headers.get('content-type')??'',/text\/html/);
   const html=await response.text();
   assert.ok(html.includes('<h1'),`${page.path}: substantive heading`);
   assert.equal((html.match(/<title>/g)??[]).length,1,`${page.path}: one document title`);
   assert.ok(html.includes(`rel="canonical" href="${fixture.url}${page.path}"`),`${page.path}: trusted canonical`);
   assert.doesNotMatch(html,/__SW_(?:SITE_URL|BASE_PATH|SITEMAP_LINE)__/);
   assert.doesNotMatch(html,/<div id="root"><\/div>/);
   return {path:page.path,status:response.status,sha256:createHash('sha256').update(html).digest('hex')};
  })));
 }
 results.push({fixture:fixture.name,site:fixture.url,documents:rows.length,rows});
}
writeFileSync('/tmp/sw-seo-all-public-pages.json',JSON.stringify({imageID:runtime.imageID,results},null,2)+'\n');
console.log(results.map(({fixture,documents})=>({fixture,documents,passed:true})));
