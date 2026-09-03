import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import { Layout } from './components/Layout'
import { AddExpense } from './pages/AddExpense'
import { Budgets } from './pages/Budgets'
import { Dashboard } from './pages/Dashboard'
import { Expenses } from './pages/Expenses'
import { Goals } from './pages/Goals'
import { ScanReceipt } from './pages/ScanReceipt'
import { Settings } from './pages/Settings'
import { initAutoSync } from './lib/sync/sync'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'expenses', element: <Expenses /> },
      { path: 'add', element: <AddExpense /> },
      { path: 'edit/:id', element: <AddExpense /> },
      { path: 'scan', element: <ScanReceipt /> },
      { path: 'budgets', element: <Budgets /> },
      { path: 'goals', element: <Goals /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

void initAutoSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
