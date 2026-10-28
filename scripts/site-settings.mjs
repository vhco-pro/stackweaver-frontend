// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { cleanBasePath } from '../src/lib/publicRoutes.ts';

/** nginx receives only operator-owned values. Never trust Host/Forwarded headers for canonicals. */
export function siteSettings({ url='', indexing=false }={}) {
 let site='',base='';
 if(url) {
  if(/[\\\s"'<>$;#%]/.test(url)||url.includes('/../')||url.includes('/./')) throw new Error('Invalid public site URL');
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash) throw new Error('Public site URL must be an HTTPS origin with an optional clean base path');
  base=cleanBasePath(parsed.pathname); site=parsed.origin+base;
 }
 if(indexing&&!site) throw new Error('Public indexing requires an explicit public site URL');
 return `# Generated deployment settings. Mount at /etc/nginx/public-site-settings.conf.\nset $sw_site_url "${site}";\nset $sw_base_path "${base}";\nset $sw_noindex "${indexing?'':'noindex, nofollow'}";\nset $sw_sitemap_line "${indexing?'Sitemap: '+site+'/sitemap.xml':''}";\n${base?`if ($uri = "${base}") { return 308 ${base}/; }\nrewrite ^${base}(/.*)$ $1 last;\n`:''}`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const args=process.argv.slice(2); const option=name=>{const at=args.indexOf(name);return at<0?undefined:args[at+1];};
 const output=option('--output'); const content=siteSettings({url:option('--url')??'',indexing:args.includes('--indexing')});
 if(output) writeFileSync(output,content); else process.stdout.write(content);
}
