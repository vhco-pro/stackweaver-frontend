// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeroTourVisual } from '@/components/landing/HeroTour';
import { TOUR_PANES, useHeroTour } from '@/components/landing/heroTour';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { RotatingTextContainer, RotatingText } from '@/components/animate-ui/primitives/texts/rotating';
import { getVcsProviderIcon } from '@/lib/vcs';

export function ProductOverview() {
  const tour = useHeroTour();
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
              <span>Orchestrate</span>
              <RotatingTextContainer
                text={['OpenTofu', 'Ansible']}
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

          {/* Feature pills double as the hero tour's tabs: each one swaps the visual on the right. */}
          <div className="flex flex-wrap gap-3" role="tablist" aria-label="Product tour">
            {TOUR_PANES.map((feature) => {
              const active = feature.id === tour.pane;
              return (
                <button
                  key={feature.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="hero-tour-visual"
                  onClick={() => { tour.select(feature.id); }}
                  onMouseEnter={() => { tour.setHovering(true); }}
                  onMouseLeave={() => { tour.setHovering(false); }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-300 cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
                    active
                      ? 'bg-white dark:bg-white/10 border-blue-500/60 dark:border-blue-400/50 text-slate-900 dark:text-white shadow-md shadow-blue-500/10'
                      : 'bg-white border-slate-200 shadow-xs dark:bg-white/5 dark:border-white/10 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/10'
                  )}
                >
                  <feature.icon className={cn('w-4 h-4 transition-colors', active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400')} />
                  <span>{feature.label}</span>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <GradientButton
              size="lg"
              asChild
              className="sm:w-auto justify-center h-12 px-6 text-base font-semibold"
            >
              <a href="https://github.com/michielvha/stackweaver" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                {getVcsProviderIcon('github', 'w-5 h-5')}
                <span>View on GitHub</span>
              </a>
            </GradientButton>
            
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

        {/* Right Column: 3D visual - a miniature of the screen the active pill describes */}
        <div id="hero-tour-visual" role="tabpanel" className="relative perspective-[2000px] lg:h-[600px] flex items-center justify-center">
          <HeroTourVisual pane={tour.pane} />
        </div>
      </div>
    </section>
  );
}
