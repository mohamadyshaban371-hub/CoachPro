import React, { useState } from 'react';
import { Sun, Moon, Languages, MoreHorizontal, X } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import BrandLogo from './BrandLogo';
import { AnimatePresence, motion } from 'motion/react';
import { playClick } from '../lib/sounds';

export interface ShellTab {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

interface ShellProps {
  tabs: ShellTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Number of tabs to show directly in the mobile bottom bar.
 * Any tabs beyond this become accessible via the "More" drawer.
 */
const MOBILE_PRIMARY_TABS = 5;

export default function DashboardShell({
  tabs,
  activeTab,
  onTabChange,
  headerActions,
  children,
}: ShellProps) {
  const { theme, toggle: toggleTheme } = useTheme();
  const { t, toggle: toggleLocale, locale } = useI18n();
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  // ── Mobile tab split ──────────────────────────────────────────────────────
  // Always include the currently active tab in the primary bar so the user
  // never loses sight of where they are.
  let primaryTabs: ShellTab[];
  let overflowTabs: ShellTab[];

  if (tabs.length <= MOBILE_PRIMARY_TABS) {
    primaryTabs = tabs;
    overflowTabs = [];
  } else {
    const first = tabs.slice(0, MOBILE_PRIMARY_TABS);
    const rest = tabs.slice(MOBILE_PRIMARY_TABS);
    const activeInRest = rest.find((t) => t.key === activeTab);
    if (activeInRest) {
      // Swap the last primary tab out to overflow and put the active tab in.
      const swapped = first[MOBILE_PRIMARY_TABS - 1];
      primaryTabs = [...first.slice(0, MOBILE_PRIMARY_TABS - 1), activeInRest];
      overflowTabs = [swapped, ...rest.filter((t) => t.key !== activeTab)];
    } else {
      primaryTabs = first;
      overflowTabs = rest;
    }
  }

  const handleTabChange = (key: string) => {
    playClick();
    onTabChange(key);
    setMoreDrawerOpen(false);
  };

  return (
    <div className="min-h-screen app-bg app-text font-sans flex flex-col md:flex-row">
      {/* ─── Desktop Sidebar (md+) ─── */}
      <aside className="hidden md:flex md:flex-col md:w-64 lg:w-72 shrink-0 border-e app-border bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
        <div className="px-6 py-5 flex items-center gap-3 border-b app-border">
          <BrandLogo size={42} />
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight truncate">{t('brand.name')}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] app-text-muted font-bold uppercase tracking-widest leading-none truncate">
                {t('brand.engine')}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'app-text-muted hover:bg-slate-200/60 dark:hover:bg-white/5 hover:app-text'
                }`}
              >
                <Icon size={20} />
                <span className="text-start flex-1">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t app-border space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold app-text-muted hover:app-text hover:bg-slate-200/60 dark:hover:bg-white/5 transition-all"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? t('action.theme.light') : t('action.theme.dark')}</span>
          </button>
          <button
            onClick={toggleLocale}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold app-text-muted hover:app-text hover:bg-slate-200/60 dark:hover:bg-white/5 transition-all"
          >
            <Languages size={18} />
            <span>{t('action.lang.toggle')}</span>
            <span className="ms-auto text-[10px] uppercase font-black opacity-60">{locale}</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-slate-900/80 border-b app-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:hidden min-w-0">
            <BrandLogo size={36} />
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold tracking-tight truncate">{t('brand.name')}</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[9px] app-text-muted font-bold uppercase tracking-widest leading-none truncate">
                  {t('brand.engine')}
                </span>
              </div>
            </div>
          </div>
          <div className="hidden md:block app-text-muted text-sm font-medium">
            {tabs.find((tab) => tab.key === activeTab)?.label}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 ms-auto">
            <button
              onClick={toggleTheme}
              className="md:hidden p-2.5 rounded-xl app-text-muted hover:app-text hover:bg-slate-200/60 dark:hover:bg-white/5 transition-all"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={toggleLocale}
              className="md:hidden p-2.5 rounded-xl app-text-muted hover:app-text hover:bg-slate-200/60 dark:hover:bg-white/5 transition-all flex items-center gap-1"
            >
              <Languages size={18} />
              <span className="text-[10px] uppercase font-black">{locale}</span>
            </button>
            {headerActions}
          </div>
        </header>

        {/* Children content — extra bottom padding so content clears the fixed nav */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-6">{children}</main>

        {/* ─── Mobile bottom nav (md hidden) ─── */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-white/90 dark:bg-slate-900/95 border-t app-border safe-bottom">
          <div className="flex items-stretch px-1 py-1">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl min-w-0 transition-all active:scale-95 ${
                    active ? 'text-blue-600 dark:text-blue-400' : 'app-text-muted'
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      active ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : ''
                    }`}
                  >
                    <Icon size={19} />
                  </span>
                  <span className={`text-[9px] font-bold leading-tight text-center max-w-full truncate px-0.5 ${active ? 'opacity-100' : 'opacity-60'}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}

            {overflowTabs.length > 0 && (
              <button
                onClick={() => setMoreDrawerOpen((v) => !v)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl transition-all active:scale-95 ${
                  moreDrawerOpen ? 'text-blue-600 dark:text-blue-400' : 'app-text-muted'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    moreDrawerOpen ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : ''
                  }`}
                >
                  {moreDrawerOpen ? <X size={19} /> : <MoreHorizontal size={19} />}
                </span>
                <span className={`text-[9px] font-bold leading-tight ${moreDrawerOpen ? 'opacity-100' : 'opacity-60'}`}>
                  {locale === 'en' ? 'More' : 'المزيد'}
                </span>
              </button>
            )}
          </div>
        </nav>

        {/* ─── More tabs drawer ─── */}
        <AnimatePresence>
          {moreDrawerOpen && overflowTabs.length > 0 && (
            <>
              {/* Backdrop */}
              <motion.div
                key="drawer-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
                onClick={() => setMoreDrawerOpen(false)}
              />
              {/* Drawer */}
              <motion.div
                key="drawer-panel"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                className="md:hidden fixed bottom-[64px] inset-x-0 z-40 bg-white/95 dark:bg-slate-900/98 backdrop-blur-xl border-t app-border rounded-t-3xl shadow-2xl pb-4 px-4 pt-4"
              >
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-5" />
                <div className="grid grid-cols-4 gap-2">
                  {overflowTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all active:scale-95 ${
                          active
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                            : 'app-text-muted hover:bg-slate-100 dark:hover:bg-white/5 hover:app-text'
                        }`}
                      >
                        <Icon size={22} />
                        <span className="text-[11px] font-bold text-center leading-tight">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Settings shortcuts in drawer */}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t app-border">
                  <button
                    onClick={toggleTheme}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold app-text-muted hover:app-text hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                  >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    <span className="text-xs">{theme === 'dark' ? t('action.theme.light') : t('action.theme.dark')}</span>
                  </button>
                  <button
                    onClick={() => { toggleLocale(); setMoreDrawerOpen(false); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold app-text-muted hover:app-text hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                  >
                    <Languages size={16} />
                    <span className="text-xs">{t('action.lang.toggle')}</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
