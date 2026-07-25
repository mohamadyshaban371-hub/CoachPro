import React from 'react';
import { auth } from '../firebase';

interface State {
  error: Error | null;
}

/**
 * Catches render errors in the authenticated views so a single bad code path
 * (e.g. a missing icon import or unguarded data access) never blanks the
 * client's screen. Shows the user a friendly Arabic recovery card with two
 * actions: reload the page, or sign out and try again.
 *
 * The error is logged to the console for the developer.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info);
  }

  private handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  private handleSignOut = async () => {
    try { await auth.signOut(); } catch {}
    this.setState({ error: null });
    window.location.hash = '';
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-3xl p-8 text-center space-y-5">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-bold">حدث خطأ غير متوقع</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            واجهنا مشكلة أثناء تحميل لوحة التحكم. حسابك بأمان — جرّب إعادة تحميل الصفحة، أو سجّل خروج
            ثم ادخل مرة أخرى.
          </p>
          <pre className="text-[10px] text-red-400/70 bg-slate-950 rounded-lg p-3 overflow-auto max-h-32 text-left" dir="ltr">
            {this.state.error.message}
          </pre>
          <div className="flex gap-3">
            <button
              onClick={this.handleReload}
              className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-all"
            >
              إعادة تحميل
            </button>
            <button
              onClick={this.handleSignOut}
              className="flex-1 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-bold text-slate-300 transition-all"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }
}
