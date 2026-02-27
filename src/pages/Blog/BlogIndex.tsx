// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - gray-matter types may not be available
import matter from 'gray-matter';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface BlogPostMetadata {
  slug: string;
  title: string;
  description: string;
  author: string;
  date: string;
  image?: string;
  tags?: string[];
}

export default function BlogIndex() {
  const [posts, setPosts] = useState<BlogPostMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPosts() {
      try {
        const modules = import.meta.glob('/src/content/blog/*.md', { as: 'raw' });
        const loadedPosts: BlogPostMetadata[] = [];

        for (const path in modules) {
          const rawContent = await modules[path]();
           
          const parsed = matter(rawContent);
           
          const data = parsed.data as Omit<BlogPostMetadata, 'slug'>;
          const slug = path.split('/').pop()?.replace('.md', '') || '';
          
          loadedPosts.push({
            slug,
            ...(data as Record<string, unknown>),
          } as BlogPostMetadata);
        }

        // Sort by date descending
        loadedPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPosts(loadedPosts);
      } catch (error) {
        console.error('Failed to load blog posts', error);
      } finally {
        setLoading(false);
      }
    }

    void loadPosts();
  }, []);

  return (
    <MarketingLayout>
      <div className="pt-32 pb-20 px-6 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-300 dark:to-cyan-300 bg-clip-text text-transparent">
              Latest Updates
            </h1>
            <p className="text-xl text-slate-600 dark:text-gray-400 max-w-2xl mx-auto">
              News, tutorials, and engineering deep dives from the Stackweaver team.
            </p>
          </div>

          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {[1, 2, 3].map((i) => (
                 <Skeleton key={i} className="h-96 rounded-2xl" />
               ))}
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link key={post.slug} to={`/blog/${post.slug}`} className="group">
                  <article className="h-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300 overflow-hidden hover:shadow-xl hover:shadow-blue-500/10 flex flex-col">
                    {post.image && (
                      <div className="relative h-48 overflow-hidden">
                        <img 
                          src={post.image} 
                          alt={post.title} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary" className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      
                      <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {post.title}
                      </h2>
                      
                      <p className="text-slate-600 dark:text-gray-400 mb-6 line-clamp-3">
                        {post.description}
                      </p>
                      
                      <div className="mt-auto flex items-center justify-between text-sm text-slate-500 dark:text-gray-500">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {post.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {post.author}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-500" />
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </MarketingLayout>
  );
}
