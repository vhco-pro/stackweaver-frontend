// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { Link } from 'react-router-dom';
import { ArrowRight, Folder } from 'lucide-react';
import { docLabel, docUrl, homepageEntries, type DocsIndex } from './docsCollection';
import { glassSurface } from '@/lib/surfaces';
import './overview.css';

/** Collection presentation only. Hosts supply metadata; no product catalogue lives here. */
export function DocsOverview({ index, folderPath, docsBase, hideCompleted }: {
  index: DocsIndex; folderPath: string; docsBase: string; hideCompleted: boolean;
}) {
  const { folders, files } = homepageEntries(index, folderPath, hideCompleted);
  const root = !folderPath;
  const articles = files.length > 0 && <section data-overview-articles aria-label={root ? 'More to read' : 'In this section'}>
    <div className="overview-section-title"><h2>{root ? 'More to read' : 'In this section'}</h2><span>{files.length} {files.length === 1 ? 'article' : 'articles'}</span></div>
    <div className="overview-reading-list">{files.map((file, i) => <Link key={file.path} to={docUrl(docsBase, file.path)} className="overview-reading-row">
      <span className="overview-row-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
      <span className="min-w-0"><h3>{docLabel(file)}</h3>{file.description && <p>{file.description}</p>}</span>
      <ArrowRight className="overview-row-arrow" aria-hidden="true" />
    </Link>)}</div>
  </section>;
  const sections = folders.length > 0 && <section aria-label={root ? 'Explore documentation' : 'Explore sub-sections'}>
    <div className="overview-section-title"><h2>{root ? 'Explore documentation' : 'Explore sub-sections'}</h2><span>{folders.length} {folders.length === 1 ? 'section' : 'sections'}</span></div>
    <div className="overview-section-grid">{folders.map((folder, i) => {
      const lead = root && i === 0 && folder.nav_order !== undefined;
      return <article key={folder.path} data-overview-lead={lead} className={`${glassSurface} overview-section-card ${lead ? 'overview-lead' : ''}`}>
        <div className="overview-card-heading"><span className="overview-folder-icon"><Folder aria-hidden="true" /></span><h3><Link to={docUrl(docsBase, folder.path)}>{folder.title}</Link></h3></div>
        <p className="overview-card-description">{folder.description}</p>
        {folder.links.length > 0 && <div className="overview-card-links">{folder.links.map(link => <Link key={link.path} to={docUrl(docsBase, link.path)}>{docLabel(link)}{lead && <ArrowRight aria-hidden="true" />}</Link>)}</div>}
        <div className="overview-card-footer"><span>{folder.count} {folder.count === 1 ? 'page' : 'pages'}</span><Link aria-label={`Browse ${folder.title}`} to={docUrl(docsBase, folder.path)}>Browse section<ArrowRight aria-hidden="true" /></Link></div>
      </article>;
    })}</div>
  </section>;
  return <div className={`overview-navigation ${!root && files.length && folders.length ? 'overview-split' : ''}`}>
    {root ? <>{sections}{articles}</> : <>{articles}{sections}</>}
    {!files.length && !folders.length && <p className="rounded-xl border border-dashed border-border p-8 text-muted-foreground">No documentation yet</p>}
  </div>;
}
