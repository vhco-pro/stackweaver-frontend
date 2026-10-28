// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parseAllDocuments } from 'yaml';
import { siteSettings } from './site-settings.mjs';
const chart=new URL('../../deploy/helm/stackweaver',import.meta.url).pathname;
const template=(args=[])=>parseAllDocuments(execFileSync('helm',['template','seo-fixture',chart,'--set','secrets.databasePassword=fixture-only','--set','secrets.redisPassword=fixture-only',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']})).map(d=>d.toJSON());
test('Helm defaults opt out and configured settings match the validated CLI',()=>{
 for(const options of [{}, {url:'https://customer.example',indexing:true},{url:'https://customer.example/stack',indexing:true},{url:'https://customer.example/staging',indexing:false}]) {
  const args=options.url?['--set-string','frontend.publicSite.url='+options.url,'--set','frontend.publicSite.indexing='+options.indexing]:[];
  const docs=template(args);const config=docs.find(d=>d.kind==='ConfigMap'&&d.metadata.name.endsWith('-frontend-config'));
  assert.equal(config.data['public-site-settings.conf'].trim(),siteSettings(options).trim());
  const base=options.url?new URL(options.url).pathname.replace(/\/$/,''):'';
  assert.ok(config.data['env.js'].includes('VITE_BASE_PATH: '+JSON.stringify(base)));
  const deployment=docs.find(d=>d.kind==='Deployment'&&d.metadata.name.endsWith('-frontend'));
  assert.ok(deployment.spec.template.spec.containers[0].volumeMounts.some(m=>m.mountPath==='/etc/nginx/public-site-settings.conf'));
 }
});
test('Helm rejects indexing without a URL and unsafe origins',()=>{
 for(const url of ['', 'http://customer.example','https://customer.example/../x','https://customer.example/path?bad=1','https://user:pass@customer.example']) {
  assert.throws(()=>template(['--set-string','frontend.publicSite.url='+url,'--set','frontend.publicSite.indexing=true']));
 }
});
