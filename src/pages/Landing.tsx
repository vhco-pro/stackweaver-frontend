// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMountEffect } from '@/hooks/useMountEffect';
import { ArrowRight, Zap, Server, Cloud, Layers3, GitBranch, Cpu, KeyRound, ShieldCheck, Wrench, Database, Globe, PlugZap, Container, Copy, Check, ExternalLink } from 'lucide-react';
import { getVcsProviderIcon } from '@/lib/vcs';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { CookieConsent } from '@/components/gdpr/CookieConsent';
import { Stage } from '@/components/landing/Stage';
import { Compatibility } from '@/components/landing/Compatibility';
import { LicenseSecurity } from '@/components/landing/LicenseSecurity';
import { Footer } from '@/components/layout/Footer';


export default function Landing() {
  const { session } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();

  // A link such as /#overview arrives before this page has rendered, so the browser finds
  // nothing to scroll to. Honour the fragment once the sections exist.
  useMountEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  });

  const handleGetStarted = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (session) {
      void Promise.resolve(navigate('/dashboard'));
    } else {
      document.getElementById('install')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-950 dark:text-white transition-colors duration-500">
      {/* Tapered Blur Gradient above Nav */}
      {/* Tapered Blur Gradient above Nav */}
      <div 
        className="fixed top-0 left-0 w-full h-32 z-40 pointer-events-none dark:hidden"
        style={{
          maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)'
        }} 
      />
      <div 
        className="fixed top-0 left-0 w-full h-32 z-40 pointer-events-none dark:block hidden"
        style={{
          maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          background: 'linear-gradient(to bottom, rgba(2, 6, 23, 1) 0%, rgba(2, 6, 23, 0) 100%)'
        }} 
      />

      {/* The hero and the product tour, one pinned scroll sequence. It renders the navigation too. */}
      <Stage
        background={
          <>
            {/* Animated "aurora" background (stacked layers + canvas) - DARK MODE ONLY */}
            <div className="aurora-bg z-0 hidden dark:block dark:opacity-100" />
            <div className="aurora-bg alt z-0 hidden dark:block dark:opacity-100" />
            <AuroraCanvas className="absolute inset-0 z-0 pointer-events-none hidden dark:block" theme={resolvedTheme} />
          </>
        }
      />

      <Compatibility />

      {/* Install Section */}
      <InstallSection />

      {/* Features Section */}
      <section id="features" className="py-12 md:py-24 px-4 md:px-6 relative">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-8 md:mb-16 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-500 dark:from-white dark:to-blue-200 bg-clip-text text-transparent">
            Powerful Features
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Layers3, title: 'TFE-Compatible Core', description: 'Organizations, Projects, Workspaces, Runs, Variables, State Versions, Tokens, JSON:API v2 and TFE token auth' },
              { icon: PlugZap, title: 'Provider Compatibility', description: 'terraform-provider-tfe parity, so existing automation against the TFE API keeps working' },
              { icon: Database, title: 'State & Secrets', description: 'Encrypted state storage (S3-compatible), variable sets, sensitive vars, workspace-scoped secrets' },
              { icon: Wrench, title: 'Ansible (AWX Parity)', description: 'Projects, inventories, credentials, job templates and schedules' },
              { icon: GitBranch, title: 'VCS-Driven Workflows', description: 'GitHub App and Azure DevOps integration, repo/branch selection, webhooks for push/PR events, auto-queue and speculative plans' },
              { icon: Cpu, title: 'Remote Execution Engine', description: 'Self-hosted runners with agent pools, Redis-queued plans/applies, streamed logs and artifact storage, org-scoped runner assignment' },
              { icon: KeyRound, title: 'Identity & SSO', description: 'OIDC workload identity for AWS, GCP and Azure; no static credentials in runners. SSO via Azure AD, Okta, Cognito or any OIDC provider with optional team sync' },
              { icon: ShieldCheck, title: 'Run Tasks & Governance', description: 'Hook security scanners, cost checks and custom gates into runs at stage boundaries, advisory or mandatory. Manual apply confirmation, audit trails, team and org permissions' },
              { icon: Globe, title: 'Multi-Cloud & Hybrid', description: 'AWS/GCP/Azure support, on-prem friendly with outbound agent pools' },

            ].map((feature, index) => (
              <div
                key={index}
                className="h-full rounded-xl bg-white/50 dark:bg-transparent backdrop-blur-md border border-gray-300/80 dark:border-white/10 p-6 hover:bg-white/60 hover:border-gray-300 dark:hover:border-white/20 transition-colors shadow-xs dark:shadow-none"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/20 dark:to-indigo-500/20 flex items-center justify-center shrink-0">
                    <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1 text-slate-950 dark:text-white">{feature.title}</h3>
                    <p className="text-slate-800 dark:text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LicenseSecurity />

      {/* CTA Section */}
      <section className="pt-12 pb-24 px-4 md:px-6 relative">
        <div className="max-w-5xl mx-auto text-center">
          <div className="p-8 sm:p-16 md:p-20 rounded-3xl bg-gradient-to-br from-white/60 via-blue-50/50 to-white/60 dark:from-slate-950/80 dark:via-blue-950/70 dark:to-slate-950/80 backdrop-blur-xl border border-white/20 dark:border-blue-900/30 shadow-2xl shadow-blue-900/10 dark:shadow-blue-950/50">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/40 dark:bg-white/10 backdrop-blur-md border border-white/20 mb-6">
              <Zap className="w-4 h-4 text-blue-600 dark:text-yellow-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Self-hosted in minutes</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 pb-2 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-500 dark:from-white dark:via-blue-100 dark:to-blue-300 bg-clip-text text-transparent">
              Ready to Get Started?
            </h2>
            <p className="text-xl md:text-2xl text-slate-800 dark:text-gray-300 mb-4 max-w-2xl mx-auto">
              Install it, point a workspace at it, and run your first plan.
            </p>
            <p className="text-lg text-slate-800 dark:text-gray-400 mb-10 max-w-xl mx-auto">
              OpenTofu and Ansible, one login, your own runners.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <GradientButton
                size="lg"
                onClick={handleGetStarted}
                className="w-auto text-lg px-8 py-6 h-auto"
              >
                <span className="flex items-center gap-2">
                  <span>{session ? 'Go to Dashboard' : 'Get Started'}</span>
                  <ArrowRight className="h-5 w-5 shrink-0" />
                </span>
              </GradientButton>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="bg-white/50 dark:bg-white/10 backdrop-blur-md border-slate-200 dark:border-white/20 hover:bg-white/80 dark:hover:bg-white/20 text-slate-900 dark:text-white text-lg px-8 py-6 h-auto whitespace-nowrap"
              >
                <a href="https://github.com/vhco-pro" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  {getVcsProviderIcon('github', 'h-5 w-5 shrink-0')}
                  <span>Star on GitHub</span>
                </a>
              </Button>
            </div>
            
            {/* Trust indicators */}
            <div className="mt-12 pt-8 border-t border-slate-200 dark:border-white/10 flex flex-wrap justify-center items-center gap-6 text-sm text-slate-800 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span>Runs on your infrastructure</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Signed releases</span>
              </div>
              <div className="flex items-center gap-2">
                <PlugZap className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                <span>TFE API compatible</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <CookieConsent />
    </div>
  );
}

/* ------------------------------------------------------------
 * Install Section Component
 * ----------------------------------------------------------*/
function InstallSection() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const installMethods = [
    {
      id: 'kubernetes',
      title: 'Kubernetes (Helm)',
      subtitle: 'Recommended for production - deploy with the official Helm chart',
      icon: Cloud,
      recommended: true,
      commands: `helm install stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \\
  --namespace stackweaver --create-namespace \\
  --set ingress.hosts.app=stackweaver.example.com \\
  --set ingress.hosts.auth=auth.stackweaver.example.com`,
      links: [
        { label: 'Setup Guide', href: '/docs/get-started/self-hosting/kubernetes', external: false },
        { label: 'View on GHCR', href: 'https://github.com/vhco-pro/stackweaver-helm/pkgs/container/charts%2Fstackweaver', external: true },
      ],
    },
    {
      id: 'docker-compose',
      title: 'Docker Compose',
      subtitle: 'Single-machine deployment for evaluation or small-scale use',
      icon: Container,
      commands: `# Download the bundle from the guide, extract it, then:
cp .env.example .env
docker compose up -d`,
      links: [
        { label: 'Download Bundle & Guide', href: '/docs/get-started/self-hosting/docker-compose', external: false },
      ],
    },
    {
      id: 'kustomize',
      title: 'Kustomize (GitOps)',
      subtitle: 'Declarative deployment with Argo CD or Flux CD',
      icon: GitBranch,
      commands: `# Download the overlay bundle, commit to Git, then:
kubectl apply -k overlays/production`,
      links: [
        { label: 'Download Bundle & Guide', href: '/docs/get-started/self-hosting/kubernetes/kustomize', external: false },
      ],
    },
  ];

  return (
    <section id="install" className="py-12 md:py-24 px-4 md:px-6 relative">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-500 dark:from-white dark:to-blue-200 bg-clip-text text-transparent">
          Install Stackweaver
        </h2>
        <p className="text-center text-slate-800 dark:text-gray-400 mb-8 md:mb-16 max-w-2xl mx-auto">
          Choose your preferred installation method. Deploy to production on Kubernetes with the official Helm chart, run a single-machine stack with Docker Compose, or manage a GitOps workflow with Kustomize. Each guide includes a downloadable deployment bundle.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {installMethods.map((method, index) => (
            <div
              key={method.id}
              className={`relative rounded-2xl backdrop-blur-md border transition-all duration-300 overflow-hidden ${
                method.recommended ? 'md:col-span-2' : ''
              } ${
                method.recommended
                  ? 'bg-blue-50/80 dark:bg-transparent border-blue-400/40 shadow-lg shadow-blue-500/10'
                  : 'bg-white border-slate-200 dark:bg-transparent dark:border-white/10 hover:border-blue-300 hover:shadow-md dark:hover:border-white/20'
              }`}
            >
              <div className="p-6 md:p-8">
                {/* Layout: header always atop code */}
                <div className="flex flex-col gap-6">
                  {/* Header Row: Title and Links */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Title Block */}
                    <div>
                      <div className="flex items-start gap-4 mb-2">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/50 dark:to-indigo-500/50 flex items-center justify-center shrink-0">
                          <method.icon className="h-6 w-6 text-blue-600 dark:text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{method.title}</h3>
                          <p className="text-sm text-slate-800 dark:text-gray-400">{method.subtitle}</p>
                        </div>
                      </div>
                      {method.recommended && (
                        <div className="ml-[64px]">
                          <span className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-400/30 text-xs font-medium text-blue-700 dark:text-blue-300">
                            Recommended
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Links - Aligned right on large screens */}
                    <div className="flex flex-wrap gap-2 lg:ml-auto">
                      {method.links.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          target={link.external ? '_blank' : undefined}
                          rel={link.external ? 'noopener noreferrer' : undefined}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-400/30 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30 hover:border-blue-300 dark:hover:border-blue-400/50 transition-all"
                        >
                          {link.external ? <ExternalLink className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Code Block - Full Width */}
                  <div className="w-full min-w-0">
                    <div className="relative rounded-lg bg-slate-900/80 border border-white/10 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        <button
                          onClick={() => copyToClipboard(method.commands, index)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-green-400" />
                              <span className="text-green-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-4 text-sm text-gray-300 overflow-x-auto whitespace-pre">
                        <code>{method.commands}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
 * Animated Aurora Canvas (visible fancy background)
 * ----------------------------------------------------------*/
function AuroraCanvas({ className = '', theme = 'dark' }: { className?: string; theme?: 'light' | 'dark' }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = useMemo(() => (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let frame = 0;

    const resize = () => {
      const { clientWidth, clientHeight } = canvas.parentElement || document.body;
      canvas.width = Math.floor(clientWidth * dpr);
      canvas.height = Math.floor((clientHeight || window.innerHeight) * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const onResize = () => {
      resize();
    };
    window.addEventListener('resize', onResize);

    // create moving blobs
    type Blob = { x: number; y: number; r: number; hue: number; ax: number; ay: number; speed: number };
    const blobs: Blob[] = Array.from({ length: 6 }).map((_, i) => ({
      x: Math.random() * (canvas.width / dpr),
      y: Math.random() * (canvas.height / dpr),
      r: 120 + Math.random() * 160,
      hue: theme === 'dark' 
        ? [210, 225, 240, 250, 230, 260][i % 6] // Dark: Blue, Indigo, Violet range
        : [200, 190, 210, 220, 230, 180][i % 6], // Light: similar but maybe shifted? Adjusted below in draw
      ax: 0.5 + Math.random() * 1.5,
      ay: 0.5 + Math.random() * 1.5,
      speed: 0.04 + Math.random() * 0.06,
    }));

    // star field with color and brightness variations
    // Stars rotate around a point far off screen (parallax effect)
    type Star = { 
      x: number; 
      y: number; 
      r: number; 
      twinkle: number; 
      phase: number; 
      hue: number; 
      bright: boolean; 
      twinkleStart: number; 
      twinkleDuration: number;
      // Orbital motion properties
      centerX: number;  // Center point far off screen
      centerY: number;  // Center point far off screen
      orbitRadius: number;  // Distance from center
      orbitAngle: number;  // Current angle in orbit
      orbitSpeed: number;  // Rotation speed (radians per frame)
    };
    const starCount = 180;
    const huePalette = [
      210, // blue
      220, // blue-indigo
      230, // indigo
      240, // indigo-purple
      200, // light blue
      250, // purple
      260, // deeper purple
      215, // another blue
    ];
    const makeStar = (): Star => {
      const bright = Math.random() < 0.18; // some brighter stars
      const hueBase = huePalette[(Math.random() * huePalette.length) | 0];
      const hueJitter = (Math.random() - 0.5) * 12; // slight variation per star
      
      // Create orbital motion around a point far off screen
      // Center point is way off screen (3-5x canvas size away)
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const centerDistance = Math.max(w, h) * (3 + Math.random() * 2); // 3-5x canvas size
      const centerAngle = Math.random() * Math.PI * 2;
      const centerX = w / 2 + Math.cos(centerAngle) * centerDistance;
      const centerY = h / 2 + Math.sin(centerAngle) * centerDistance;
      
      // Initial position on screen
      const initialX = Math.random() * w;
      const initialY = Math.random() * h;
      
      // Calculate orbit radius and angle from center
      const dx = initialX - centerX;
      const dy = initialY - centerY;
      const orbitRadius = Math.sqrt(dx * dx + dy * dy);
      const orbitAngle = Math.atan2(dy, dx);
      
      return {
        x: initialX,
        y: initialY,
        r: (bright ? 1.2 : 0.6) + Math.random() * (bright ? 1.2 : 0.8),
        twinkle: bright ? (0.7 + Math.random() * 0.7) : (0.3 + Math.random() * 0.5),
        phase: Math.random() * Math.PI * 2,
        hue: hueBase + hueJitter,
        bright,
        twinkleStart: -1, // frame when twinkle starts (-1 means not twinkling)
        twinkleDuration: 0, // duration of twinkle in frames
        centerX,
        centerY,
        orbitRadius,
        orbitAngle,
        orbitSpeed: (0.0001 + Math.random() * 0.0002) * 0.15 * (Math.random() < 0.5 ? 1 : -1), // Slow rotation (70% slower), some clockwise, some counter-clockwise
      };
    };
    const stars: Star[] = Array.from({ length: starCount }).map(makeStar);
    
    // Track when to trigger next star twinkle (every 3-5 seconds for more frequent twinkling)
    let nextTwinkleFrame = 180 + Math.random() * 120; // 3-5 seconds at 60fps (180-300 frames)
    const twinkleIntervalMin = 180; // 3 seconds at 60fps
    const twinkleIntervalMax = 300; // 5 seconds at 60fps

    // shooting lines (meteors)
    type Streak = { x: number; y: number; len: number; angle: number; speed: number; life: number; hue: number };
    const streaks: Streak[] = [];
    const spawnStreak = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const fromTop = Math.random() < 0.5;
      const x = fromTop ? Math.random() * w : -40;
      const y = fromTop ? -40 : Math.random() * h * 0.4;
      const angle = (20 + Math.random() * 25) * (Math.PI / 180); // tilt down-right
      streaks.push({
        x,
        y,
        len: 100 + Math.random() * 160,
        angle,
        speed: (6 + Math.random() * 9) * 0.6, // Slower for calmer effect
        life: 1,
        hue: 210 + Math.random() * 35, // Blue to violet
      });
    };
 
    const draw = () => {
      frame += 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      // faint base gradient for depth
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      if (theme === 'dark') {
        bg.addColorStop(0, 'rgba(0,10,30,0.20)');
        bg.addColorStop(1, 'rgba(0,0,0,0.0)');
      } else {
        bg.addColorStop(0, 'rgba(255,255,255,0.0)');
        bg.addColorStop(1, 'rgba(255,255,255,0.0)');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // additive blending for glow layers
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        // Lissajous-like drift
        const t = frame * 0.0015 * b.speed + i * 0.3;
        const nx = Math.sin(t * b.ax) * 0.45 + 0.5;
        const ny = Math.cos(t * b.ay) * 0.45 + 0.5;
        b.x = nx * w;
        b.y = ny * h;

        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        let c1, c2;
        if (theme === 'dark') {
           c1 = `hsla(${b.hue}, 95%, 60%, 0.10)`;
           c2 = `hsla(${b.hue + 20}, 90%, 55%, 0.06)`;
        } else {
           // Light mode: softer, more pastel/visible on white
           c1 = `hsla(${b.hue}, 80%, 60%, 0.12)`;
           c2 = `hsla(${b.hue + 20}, 75%, 55%, 0.08)`;
        }
        // const c3 = `hsla(${b.hue + 40}, 85%, 50%, 0.04)`; // Unused
        grad.addColorStop(0.0, c1);
        grad.addColorStop(0.45, c2);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Trigger star twinkle more frequently (every 3-5 seconds)
      if (frame >= nextTwinkleFrame) {
        // Pick a random star to twinkle
        const twinklingStarIndex = Math.floor(Math.random() * stars.length);
        stars[twinklingStarIndex].twinkleStart = frame;
        stars[twinklingStarIndex].twinkleDuration = 120; // 2 seconds at 60fps
        // Next twinkle in 3-5 seconds (randomized for more natural feel)
        nextTwinkleFrame = frame + twinkleIntervalMin + Math.random() * (twinkleIntervalMax - twinkleIntervalMin);
      }

      // twinkling stars pass (normal blend for crispness + subtle glow for bright ones)
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        
        // Orbital motion: rotate around a point far off screen
        s.orbitAngle += s.orbitSpeed;
        s.x = s.centerX + Math.cos(s.orbitAngle) * s.orbitRadius;
        s.y = s.centerY + Math.sin(s.orbitAngle) * s.orbitRadius;
        
        // Stars naturally move in and out of view as they orbit
        // Only draw stars that are visible on screen (with small margin for smooth entry/exit)
        const margin = 50;
        if (s.x < -margin || s.x > w + margin || s.y < -margin || s.y > h + margin) {
          continue; // Skip drawing stars that are off-screen
        }
        
        // Calculate twinkle effect - only if this star is currently twinkling
        // (both branches below assign tw)
        let tw: number;
        if (s.twinkleStart >= 0 && frame >= s.twinkleStart && frame < s.twinkleStart + s.twinkleDuration) {
          const twinkleProgress = (frame - s.twinkleStart) / s.twinkleDuration;
          // Smooth in-out twinkle using sine wave
          tw = (Math.sin(twinkleProgress * Math.PI) * 0.5 + 0.5) * s.twinkle * 2.5; // amplified for visible effect
        } else {
          // Normal subtle twinkle for non-twinkling stars
          tw = (Math.sin(frame * 0.008 + s.phase) * 0.5 + 0.5) * s.twinkle * 0.3; // reduced base twinkle
        }
        
        let alpha = 0.25 + tw * (s.bright ? 0.9 : 0.55);
        if (alpha > 1) alpha = 1;

        // occasional flare when at peak twinkle
        const flare = tw > 0.95 && s.bright ? (tw - 0.95) * 6.0 : 0;
        const radius = s.r + flare * 1.5;

        // subtle glow using shadow
        ctx.save();
        if (s.bright) {
          ctx.shadowColor = `hsla(${s.hue}, 80%, 70%, ${Math.min(0.6, 0.15 + alpha * 0.6)})`;
          ctx.shadowBlur = 6 + tw * 10;
        } else {
          ctx.shadowColor = `hsla(${s.hue}, 70%, 65%, ${Math.min(0.35, 0.08 + tw * 0.3)})`;
          ctx.shadowBlur = 2 + tw * 4;
        }

        ctx.fillStyle = `hsla(${s.hue}, ${s.bright ? 85 : 75}%, ${s.bright ? 85 : 80}%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // occasional shooting streaks across hero
      if (Math.random() < 0.005 && streaks.length < 2) spawnStreak();
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        const vx = Math.cos(s.angle) * s.speed;
        const vy = Math.sin(s.angle) * s.speed;
        s.x += vx;
        s.y += vy;
        s.life -= 0.006;
        const x2 = s.x - Math.cos(s.angle) * s.len;
        const y2 = s.y - Math.sin(s.angle) * s.len;

        const grad = ctx.createLinearGradient(s.x, s.y, x2, y2);
        grad.addColorStop(0, `hsla(${s.hue}, 95%, 70%, ${Math.max(s.life, 0)})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        if (s.life <= 0 || s.x > w + 200 || s.y > h + 200) {
          streaks.splice(i, 1);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [dpr, theme]);

  return <canvas ref={canvasRef} className={className} />;
}
