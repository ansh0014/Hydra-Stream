import React, { useState, useEffect } from 'react';
import {
  Globe,
  RefreshCw,
  Shield,
  Zap,
  Box,
  Layers,
  Menu,
  X,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  clusterHealth: string;
  throughput: number;
  onRestore: () => void;
  onSync: () => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  clusterHealth,
  throughput,
  onRestore,
  onSync,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  // Dynamic scroll listener: when scrolling down (moving the website up),
  // collapse the left brand and right status/actions, leaving ONLY the center navigation tabs floating!
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 35);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'landing', label: 'Overview & Story', icon: Globe },
    { id: 'topology', label: 'Topology & Network', icon: Layers },
    { id: 'kafka', label: 'Kafka Explorer', icon: Box },
    { id: 'chaos', label: 'Chaos Studio', icon: Zap },
    { id: 'compliance', label: 'GDPR Vault', icon: Shield },
  ];

  // Harmonized status pill
  const renderStatusBadge = () => {
    switch (clusterHealth) {
      case 'DEGRADED':
        return (
          <div className="h-[30px] px-2.5 rounded-full bg-amber-500/[0.08] border border-amber-500/30 text-amber-300 flex items-center gap-2 select-none shadow-[0_0_12px_rgba(245,158,11,0.12)] shrink-0">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400"></span>
            </span>
            <span className="text-[10.5px] xl:text-[11px] font-mono font-medium tracking-wide uppercase whitespace-nowrap">
              <span className="hidden xl:inline">LINK DEGRADED (BYPASS ACTIVE)</span>
              <span className="xl:hidden">BYPASS ACTIVE</span>
            </span>
          </div>
        );
      case 'LOCAL_QUORUM':
        return (
          <div className="h-[30px] px-2.5 rounded-full bg-rose-500/[0.08] border border-rose-500/30 text-rose-300 flex items-center gap-2 select-none shadow-[0_0_12px_rgba(244,63,94,0.12)] shrink-0">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-400"></span>
            </span>
            <span className="text-[10.5px] xl:text-[11px] font-mono font-medium tracking-wide uppercase whitespace-nowrap">
              <span className="hidden xl:inline">AUTONOMOUS LOCAL QUORUM</span>
              <span className="xl:hidden">LOCAL QUORUM</span>
            </span>
          </div>
        );
      case 'SYNCING':
        return (
          <div className="h-[30px] px-2.5 rounded-full bg-sky-500/[0.08] border border-sky-500/30 text-sky-300 flex items-center gap-2 select-none shadow-[0_0_12px_rgba(56,189,248,0.12)] shrink-0">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-400"></span>
            </span>
            <span className="text-[10.5px] xl:text-[11px] font-mono font-medium tracking-wide uppercase whitespace-nowrap">
              SYNCING ETCD...
            </span>
          </div>
        );
      case 'HEALTHY':
      default:
        return (
          <div className="h-[30px] px-2.5 rounded-full bg-cyan-500/[0.08] border border-cyan-500/30 text-cyan-400 flex items-center gap-2 select-none shadow-[0_0_12px_rgba(6,182,212,0.15)] shrink-0">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400"></span>
            </span>
            <span className="text-[10.5px] xl:text-[11px] font-mono font-medium tracking-wide uppercase whitespace-nowrap">
              CLUSTER HEALTHY
            </span>
          </div>
        );
    }
  };

  return (
    <div className="fixed top-2.5 sm:top-3.5 inset-x-0 z-50 flex justify-center px-2 sm:px-4 pointer-events-none font-sans">
      <motion.nav
        layout
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 32,
          mass: 0.8
        }}
        className={`pointer-events-auto rounded-full transition-all duration-300 relative flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 overflow-hidden ${
          scrolled
            ? 'max-w-fit mx-auto bg-black/80 backdrop-blur-3xl border border-white/[0.18] shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.3)]'
            : 'w-full max-w-[1360px] bg-black/60 backdrop-blur-2xl border border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.2)]'
        } before:absolute before:inset-x-8 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-white/[0.3] before:to-transparent before:pointer-events-none`}
      >
        {/* Left: Brand Identity (Smoothly collapses when website is scrolled up) */}
        <AnimatePresence>
          {!scrolled && (
            <motion.div
              key="brand-section"
              initial={{ opacity: 0, width: 0, scale: 0.95 }}
              animate={{ opacity: 1, width: 'auto', scale: 1 }}
              exit={{ opacity: 0, width: 0, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-2 cursor-pointer shrink-0 select-none group overflow-hidden pr-1"
              onClick={() => setActiveTab('landing')}
            >
              {/* Logo Glyph */}
              <div className="h-[28px] w-[28px] rounded-lg bg-gradient-to-b from-white/[0.2] to-white/[0.04] border border-white/[0.24] flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.4)] group-hover:border-white/50 group-hover:scale-105 transition-all shrink-0">
                H
              </div>

              {/* Name & Version */}
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[13px] sm:text-[13.5px] font-semibold text-white tracking-tight leading-none group-hover:text-neutral-100 transition-colors">
                  Hydra Stream
                </span>
                <span className="hidden sm:inline text-[9.5px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-neutral-400 leading-none">
                  v1.2
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center: Fluid Liquid Glass Navigation (ALWAYS REMAINS FLOATING) */}
        <div
          onMouseLeave={() => setHoveredTab(null)}
          className="hidden lg:flex items-center gap-0.5 xl:gap-1 p-1 rounded-full bg-white/[0.03] border border-white/[0.07] backdrop-blur-md relative shrink-0 mx-auto"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const isHovered = hoveredTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                onMouseEnter={() => setHoveredTab(item.id)}
                className={`relative h-[30px] px-2.5 xl:px-3 rounded-full text-[12px] xl:text-[12.5px] font-medium transition-colors flex items-center gap-1.5 select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${
                  isActive
                    ? 'text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {/* Active Fluid Glass Pill */}
                {isActive && (
                  <motion.div
                    layoutId="liquidGlassIndicator"
                    className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.16] to-white/[0.04] border border-white/[0.2] shadow-[inset_0_1px_1px_rgba(255,255,255,0.26),0_2px_8px_rgba(0,0,0,0.35)]"
                    transition={{
                      type: 'spring',
                      stiffness: 450,
                      damping: 32,
                      mass: 0.8
                    }}
                  />
                )}

                {/* Soft Glass Hover Follower */}
                {!isActive && isHovered && (
                  <motion.div
                    layoutId="hoverGlassSpotlight"
                    className="absolute inset-0 rounded-full bg-white/[0.05] border border-white/[0.06]"
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 35
                    }}
                  />
                )}

                <Icon
                  size={13.5}
                  strokeWidth={1.8}
                  className={`relative z-10 transition-colors ${
                    isActive ? 'text-white' : 'text-neutral-400'
                  }`}
                />
                <span className="relative z-10 tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Cluster Status & Actions (Smoothly collapses when website is scrolled up) */}
        <AnimatePresence>
          {!scrolled && (
            <motion.div
              key="actions-section"
              initial={{ opacity: 0, width: 0, scale: 0.95 }}
              animate={{ opacity: 1, width: 'auto', scale: 1 }}
              exit={{ opacity: 0, width: 0, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="hidden md:flex items-center gap-2 shrink-0 overflow-hidden pl-1"
            >
              {/* Status Indicator */}
              {renderStatusBadge()}

              {/* Sync Button */}
              <button
                onClick={onSync}
                className="h-[30px] px-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.09] active:scale-95 border border-white/[0.1] hover:border-white/[0.2] text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 text-[11px] font-mono select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] shrink-0"
                title="Sync dynamic topology from etcd & Prometheus"
              >
                <RefreshCw size={12} className="text-neutral-400" />
                <span>Sync</span>
              </button>

              {/* Primary Action Button (Launch Console) */}
              <button
                onClick={() => setActiveTab('topology')}
                className="h-[30px] px-3.5 rounded-full bg-white hover:bg-neutral-100 font-semibold text-xs flex items-center gap-1.5 shadow-[0_2px_10px_rgba(255,255,255,0.25),inset_0_1px_0_rgba(255,255,255,1)] active:scale-95 transition-all shrink-0 focus:outline-none select-none whitespace-nowrap cursor-pointer"
                style={{ color: '#000000', backgroundColor: '#ffffff' }}
              >
                <span style={{ color: '#000000' }} className="font-semibold text-black tracking-tight">
                  Launch Console
                </span>
                <ArrowUpRight size={13} strokeWidth={2.5} style={{ color: '#000000' }} className="text-black" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile / Tablet Menu Button */}
        <button
          type="button"
          className="lg:hidden h-[30px] w-[30px] rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/[0.1] text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors focus:outline-none shrink-0"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </motion.nav>

      {/* Mobile Glass Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto absolute top-16 inset-x-3 sm:inset-x-4 max-w-[1360px] mx-auto rounded-2xl bg-[#05070a]/95 backdrop-blur-3xl border border-white/[0.14] p-4 flex flex-col gap-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`text-left text-xs py-2.5 px-3.5 rounded-xl transition-all flex items-center gap-2.5 font-medium ${
                    isActive
                      ? 'bg-white/[0.1] text-white border border-white/[0.15]'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-white' : 'text-neutral-500'} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div className="pt-3 mt-1 border-t border-white/[0.08] flex items-center justify-between gap-3">
              {renderStatusBadge()}
              <button
                onClick={() => {
                  setActiveTab('topology');
                  setMobileMenuOpen(false);
                }}
                className="h-[30px] px-3.5 rounded-full bg-white hover:bg-neutral-100 font-semibold text-xs flex items-center gap-1.5 shrink-0 shadow-[0_2px_10px_rgba(255,255,255,0.2)]"
                style={{ color: '#000000', backgroundColor: '#ffffff' }}
              >
                <span style={{ color: '#000000' }} className="font-semibold text-black tracking-tight">Console</span>
                <ArrowUpRight size={13} strokeWidth={2.5} style={{ color: '#000000' }} className="text-black" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
