// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/navigation/PublicNav';
import { Footer } from '@/components/layout/Footer';
import './blog.css';
export function PublicNotFound() { return <><PublicNav activeLink="blog"/><main className="blog-page blog-wrap"><p className="blog-kicker">404 / Stackweaver</p><h1 className="text-4xl font-semibold mb-6">Page not found</h1><p className="mb-6">This address does not point to a public page.</p><div className="flex gap-6"><Link to="/">Go home</Link><Link to="/docs">Browse documentation</Link><Link to="/blog">Read articles</Link></div></main><Footer/></>; }
