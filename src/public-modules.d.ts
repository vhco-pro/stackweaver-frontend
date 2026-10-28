// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
declare module 'virtual:public-articles' {
  const articles: import('./lib/blog').BlogArticle[];
  export default articles;
}

declare module 'virtual:public-pages' {
 const pages: import('./lib/publicRoutes').PublicPage[];
 export default pages;
}
