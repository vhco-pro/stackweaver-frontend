// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteSettings } from './site-settings.mjs';
test('trusted deployment identity is explicit and portable',()=>{
 const settings=siteSettings({url:'https://customer.example/stack',indexing:true});
 assert.match(settings,/https:\/\/customer.example\/stack/);
 assert.match(settings,/set \$sw_base_path "\/stack"/);
 assert.match(settings,/rewrite \^\/stack/);
 assert.doesNotMatch(settings,/stackweaver\.sh/);
});
test('unconfigured and private deployments opt out of indexing',()=>{
 assert.match(siteSettings({}),/noindex/);
 assert.match(siteSettings({url:'https://customer.example',indexing:false}),/noindex/);
 assert.throws(()=>siteSettings({indexing:true}),/URL/);
});
test('unsafe origins, query strings and configuration injection fail closed',()=>{
 for(const url of ['http://example.com','https://example.com/?x=y','https://user:pass@example.com','https://example.com/#hash','https://example.com/../x','https://example.com/";return 200;#','https://example.com/x\\y']) assert.throws(()=>siteSettings({url,indexing:true}),url);
});

// Authored shell/configuration examples must not expand JavaScript replacement tokens.
import { publicDocument } from './public-document.mjs';
test('public HTML preserves shell dollar tokens without duplicating its document head',()=>{
 const template='<html><head><title>Shell</title></head><body><div id="root"></div></body></html>';
 const literal='<h1>Procedure</h1><pre><code>'+['$'+'`','$&',"$'"].join(' ')+'</code></pre>';
 const html=publicDocument(template,{content:literal,head:'<title>Procedure</title>'});
 assert.ok(html.includes(literal));
 assert.equal((html.match(/<title>/g)??[]).length,1);
 assert.equal((html.match(/<head>/g)??[]).length,1);
});
