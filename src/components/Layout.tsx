import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

type Tab = { to: string; label: string; icon: string; end: boolean }

const leftTabs: Tab[] = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/expenses', label: 'Expenses', icon: '🧾', end: false },
]
const rightTabs: Tab[] = [
  { to: '/goals', label: 'Goals', icon: '⭐', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
]

function TabLink({ tab }: { tab: Tab }) {
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
          isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
        }`
      }
    >
      <span className="text-lg">{tab.icon}</span>
      {tab.label}
    </NavLink>
  )
}

export function Layout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(pathname)

  // Close the add menu whenever the route changes.
  if (menuPath !== pathname) {
    setMenuPath(pathname)
    setMenuOpen(false)
  }

  function go(to: string) {
    setMenuOpen(false)
    navigate(to)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col bg-slate-100 dark:bg-slate-950">
      <main className="safe-top flex-1 px-4 pb-28 pt-5">
        <Outlet />
      </main>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-20 cursor-default bg-slate-950/40"
          />
          <div className="safe-bottom fixed inset-x-0 bottom-20 z-30 mx-auto flex max-w-lg justify-center px-4">
            <div className="flex w-full max-w-xs flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl dark:bg-slate-800">
              <button
                type="button"
                onClick={() => go('/scan')}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left font-medium text-slate-800 active:bg-slate-100 dark:text-slate-100 dark:active:bg-slate-700"
              >
                <span className="text-xl">📸</span> Scan receipt
              </button>
              <button
                type="button"
                onClick={() => go('/add')}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left font-medium text-slate-800 active:bg-slate-100 dark:text-slate-100 dark:active:bg-slate-700"
              >
                <span className="text-xl">✏️</span> Enter manually
              </button>
            </div>
          </div>
        </>
      )}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        {leftTabs.map((t) => (
          <TabLink key={t.to} tab={t} />
        ))}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close add menu' : 'Add expense'}
            aria-expanded={menuOpen}
            className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-3xl font-light text-white shadow-lg shadow-blue-600/30 transition active:scale-95 ${
              menuOpen ? 'rotate-45' : ''
            }`}
          >
            +
          </button>
        </div>
        {rightTabs.map((t) => (
          <TabLink key={t.to} tab={t} />
        ))}
      </nav>
    </div>
  )
}
