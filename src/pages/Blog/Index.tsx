// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import articles from 'virtual:public-articles';
import { BlogIndex } from '@/components/blog/BlogIndex';
import { PublicNav } from '@/components/navigation/PublicNav';
import { Footer } from '@/components/layout/Footer';
export default function Blog() { return <><PublicNav activeLink="blog"/><BlogIndex articles={articles} preview={import.meta.env.DEV}/><Footer/></>; }
