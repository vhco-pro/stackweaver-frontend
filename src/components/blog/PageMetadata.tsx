// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { useMountEffect } from '@/hooks/useMountEffect';
import { pageStructuredData } from '@/lib/publicRoutes';
import pages from 'virtual:public-pages';
import { config } from '@/config';
/** Mounted with a pathname key so navigation cannot retain another page's head state. */
export function PageMetadata({path}:{path:string}) {
 useMountEffect(()=>{
  const page=pages.find(page=>page.path===(path==='/landing'?'/':path));
  const trusted=document.head.querySelector<HTMLMetaElement>('meta[name="sw-public-site-url"]')?.content;
  const siteUrl=trusted&&!trusted.includes('__SW_')?trusted:location.origin+config.basePath;
  for(const element of document.head.querySelectorAll('[data-sw-meta]')) element.remove();
  document.title=page?`${page.title} | Stackweaver`:'Stackweaver';
  const meta=(name:string,content:string,property=false)=>{const el=document.createElement('meta');el.setAttribute(property?'property':'name',name);el.content=content;el.dataset.swMeta='';document.head.append(el);};
  if(!page) { meta('robots','noindex, nofollow'); return; }
  meta('description',page.description); meta('og:title',document.title,true); meta('og:description',page.description,true); meta('og:type',page.kind==='article'?'article':'website',true);meta('twitter:card','summary');
  const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=`${siteUrl}${page.path}`;canonical.dataset.swMeta='';document.head.append(canonical);meta('og:url',canonical.href,true);
  const entity=pageStructuredData(page,siteUrl);if(entity){const script=document.createElement('script');script.type='application/ld+json';script.dataset.swMeta='';script.textContent=JSON.stringify(entity);document.head.append(script);}
 });
 return null;
}
