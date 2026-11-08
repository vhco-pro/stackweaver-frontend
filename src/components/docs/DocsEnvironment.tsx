// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { createContext, useContext, useCallback } from 'react';
/**
 * How code frames look. `framed` with the `default` tone applies when a host sets nothing;
 * `classic` keeps the original transparent frame, and the `deep` tone darkens the fills in dark mode.
 */
export interface DocsCodeBlockPresentation { style?:'framed'|'classic'; tone?:'default'|'deep' }
export interface DocsEnvironment { basePath:string; staticRender:boolean; files?:Record<string,string>; codeBlocks?:DocsCodeBlockPresentation }
/** A generic host adapter. The viewer does not import application config or services. */
export const DocsEnvironmentContext=createContext<DocsEnvironment>({basePath:'',staticRender:false});
export function useDocsEnvironment() {
 const environment=useContext(DocsEnvironmentContext);
 const assetUrl=useCallback((url:string)=>url.startsWith('/')&&!url.startsWith('//')&&environment.basePath&&!url.startsWith(environment.basePath+'/')?environment.basePath+url:url,[environment.basePath]);
 return {...environment,assetUrl};
}
