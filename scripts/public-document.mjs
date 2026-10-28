// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
/** Treat authored content as literal replacement data, including shell dollar/backtick examples. */
export function publicDocument(template,{content,head,styles='',fallback=''}) {
 const prepared=content.replace(/(href|src)="\/(?!\/)/g,'$1="__SW_BASE_PATH__/');
 return template.replace(/<title>[\s\S]*?<\/title>/,()=>head)
  .replace('<head>','<head>\n<base href="__SW_BASE_PATH__/"><meta name="sw-public-site-url" content="__SW_SITE_URL__">')
  .replace('</head>',()=>styles+'\n'+fallback+'\n</head>')
  .replace('<div id="root"></div>',()=>`<div id="root">${prepared}</div>`);
}
