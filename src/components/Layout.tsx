import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/expenses', label: 'Expenses', icon: '🧾', end: false },
  { to: '/budgets', label: 'Budgets', icon: '🎯', end: false },
  { to: '/goals', label: 'Goals', icon: '⭐', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
]

export function Layout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // The quick-add buttons only make sense where you're looking at spending.
  const showQuickAdd = pathname === '/' || pathname === '/expenses'

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col bg-slate-100 dark:bg-slate-950">
      <main className="safe-top flex-1 px-4 pb-28 pt-5">
        <Outlet />
      </main>

      {showQuickAdd && (
        <div className="fixed bottom-24 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          <button
            type="button"
            onClick={() => navigate('/scan')}
            aria-label="Scan receipt"
            className="rounded-full bg-white px-4 py-3 text-lg shadow-lg shadow-slate-900/20 ring-1 ring-slate-200 active:scale-95 dark:bg-slate-800 dark:ring-slate-700"
          >
            📸
          </button>
          <button
            type="button"
            onClick={() => navigate('/add')}
            aria-label="Add expense"
            className="rounded-full bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-slate-900/30 active:scale-95 dark:bg-white dark:text-slate-900"
          >
            + Add expense
          </button>
        </div>
      )}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-lg justify-around border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                isActive
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-400 dark:text-slate-500'
              }`
            }
          >
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
