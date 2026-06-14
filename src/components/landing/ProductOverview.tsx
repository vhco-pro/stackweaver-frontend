// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { FileText, Search, Shield, LayoutDashboard, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RotatingTextContainer, RotatingText } from '@/components/animate-ui/primitives/texts/rotating';
import { getVcsProviderIcon } from '@/lib/vcs';

export function ProductOverview() {
  return (
    <section id="overview" className="py-12 md:py-24 px-4 md:px-6 relative overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-500">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200/40 dark:bg-blue-900/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-200/40 dark:bg-indigo-900/20 blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10">
        {/* Left Column: Content */}
        <div className="flex flex-col gap-8">
          {/* Badge */}
          <div>
            <span className="inline-flex items-center px-4 py-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-medium tracking-wide text-slate-600 dark:text-gray-300 uppercase shadow-xs">
              Open Source Orchestration
            </span>
          </div>

          {/* Heading */}
          <div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-2 text-slate-900 dark:text-white">
            STACKWEAVER
          </h1>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-700 dark:text-gray-200 mb-6 flex flex-wrap items-center gap-x-3">
              <span>Dashboard for</span>
              <RotatingTextContainer
                text={['Terraform', 'Ansible']}
                className="inline-flex text-blue-600 dark:text-blue-400 min-w-[100px] sm:min-w-[140px] justify-start"
                y={40}
                duration={2000}
              >
                <RotatingText transition={{ type: 'spring', damping: 25, stiffness: 300 }} />
              </RotatingTextContainer>
              <span>.</span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-gray-400 leading-relaxed max-w-xl">
              Stackweaver is an orchestration platform for various platform tools. It provides a unified interface for managing your infrastructure and automating your workflows. 
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-3">
            {[
              { icon: LayoutDashboard, label: 'Visualize Resources' },
              { icon: Search, label: 'Search & Filter' },
              { icon: Shield, label: 'Secure' },
              { icon: Zap, label: 'Real-time' },
            ].map((feature, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 shadow-xs dark:bg-white/5 dark:border-white/10 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors cursor-default"
              >
                <feature.icon className="w-4 h-4 text-slate-500 dark:text-gray-400" />
                <span>{feature.label}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative inline-flex w-full sm:w-auto rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 p-[3px] dark:p-[2.5px]">
              <Button
                variant="ghost"
                size="lg"
                asChild
                className="w-full sm:w-auto justify-center bg-white dark:bg-slate-900/80 dark:backdrop-blur-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-3px)] dark:rounded-[calc(0.75rem-2.5px)] h-12 px-6 text-base font-semibold transition-colors duration-200"
              >
                <a href="https://github.com/michielvha/stackweaver" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  {getVcsProviderIcon('github', 'w-5 h-5')}
                  <span>View on GitHub</span>
                </a>
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              size="lg" 
              asChild
              className="border-slate-200 bg-white text-slate-900 hover:bg-slate-50 dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10 h-12 px-6 text-base"
            >
              <Link to="/docs" className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Documentation
              </Link>
            </Button>
          </div>
        </div>

        {/* Right Column: 3D Visual */}
        <div className="relative perspective-[2000px] lg:h-[600px] flex items-center justify-center">
          <motion.div 
            initial={{ rotateY: 15, rotateX: 5, scale: 0.9, opacity: 0 }}
            whileInView={{ rotateY: -10, rotateX: 5, scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            viewport={{ once: true }}
            className="relative w-full aspect-[4/3] rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl group"
            style={{
              transformStyle: 'preserve-3d',
              boxShadow: 'var(--shadow-color)',
            }}
          >
            {/* Fake Dashboard Header */}
            <div className="h-12 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex items-center px-4 justify-between">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="h-6 w-1/3 bg-slate-200 dark:bg-white/5 rounded-md" />
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10" />
            </div>

            {/* Fake Dashboard Content */}
            <div className="p-6 grid grid-cols-12 gap-6 h-[calc(100%-3rem)]">
              {/* Sidebar */}
              <div className="col-span-3 space-y-4 border-r border-slate-200 dark:border-white/10 pr-6">
                <div className="h-8 w-full bg-blue-500/10 dark:bg-blue-500/20 rounded-md" />
                <div className="h-4 w-3/4 bg-slate-100 dark:bg-white/5 rounded-md" />
                <div className="h-4 w-1/2 bg-slate-100 dark:bg-white/5 rounded-md" />
                <div className="h-4 w-5/6 bg-slate-100 dark:bg-white/5 rounded-md" />
                <div className="mt-8 h-px w-full bg-slate-200 dark:bg-white/10" />
                <div className="h-4 w-full bg-slate-100 dark:bg-white/5 rounded-md" />
                <div className="h-4 w-2/3 bg-slate-100 dark:bg-white/5 rounded-md" />
              </div>

              {/* Main Area */}
              <div className="col-span-9 space-y-6">
                 {/* Top Stats */}
                 <div className="grid grid-cols-3 gap-4">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="h-24 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-4">
                       <div className="h-4 w-8 bg-blue-400/20 rounded-sm mb-2" />
                       <div className="h-8 w-16 bg-slate-200 dark:bg-white/10 rounded-sm" />
                     </div>
                   ))}
                 </div>

                 {/* Graph/Table Area */}
                 <div className="h-32 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-4 flex items-end gap-2 px-8 pb-4">
                    {[40, 65, 45, 80, 55, 70, 40, 60, 50, 75].map((h, i) => (
                      <div key={i} className="flex-1 bg-blue-500/30 rounded-t-sm hover:bg-blue-500/50 transition-colors" style={{ height: `${h}%` }} />
                    ))}
                 </div>

                 <div className="space-y-3">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="h-10 rounded-md bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5" />
                   ))}
                 </div>
              </div>
            </div>

            {/* Floating Elements for Depth */}
            <motion.div 
               animate={{ y: [0, -10, 0] }}
               transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
               className="absolute top-1/4 right-[-20px] bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-white/10 shadow-xl w-48 z-20 hidden md:block"
               style={{ transform: 'translateZ(40px)' }}
            >
               <div className="flex items-center gap-3 mb-2">
                 <div className="p-1.5 bg-green-500/10 dark:bg-green-500/20 rounded-md">
                   <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
                 </div>
                 <div className="text-xs font-semibold text-slate-900 dark:text-white">Policy Check Passed</div>
               </div>
               <div className="h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full w-full bg-green-500" />
               </div>
            </motion.div>

            <motion.div 
               animate={{ y: [0, 15, 0] }}
               transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
               className="absolute bottom-1/4 left-[-10px] bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-white/10 shadow-xl w-40 z-20 hidden md:block"
               style={{ transform: 'translateZ(60px)' }}
            >
               <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">Active Resources</div>
               <div className="text-2xl font-bold text-slate-900 dark:text-white">1,248</div>
               <div className="text-xs text-green-600 dark:text-green-400 mt-1">+12% this week</div>
            </motion.div>

          </motion.div>
        </div>
      </div>
    </section>
  );
}
