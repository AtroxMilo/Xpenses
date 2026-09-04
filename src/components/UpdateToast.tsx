import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * Shows a tap-to-refresh banner when a new deploy is ready. On its own, the
 * service worker only checks for updates on page navigation — an installed
 * PWA that's just reopened from the home screen (iOS especially) doesn't
 * navigate, so it can sit on a stale build indefinitely. This forces an
 * explicit check whenever the app comes back to the foreground, and gives
 * the user a visible way to grab the new version instead of guessing how
 * many times to relaunch.
 */
export function UpdateToast() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
    })

    const checkNow = () => {
      if (document.visibilityState === 'visible') void updateRef.current?.(false)
    }
    document.addEventListener('visibilitychange', checkNow)
    window.addEventListener('pageshow', checkNow)
    window.addEventListener('focus', checkNow)
    return () => {
      document.removeEventListener('visibilitychange', checkNow)
      window.removeEventListener('pageshow', checkNow)
      window.removeEventListener('focus', checkNow)
    }
  }, [])

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl bg-blue-600 px-4 py-3 text-sm text-white shadow-lg">
      <span>A new version of Xpenses is ready.</span>
      <button
        type="button"
        onClick={() => void updateRef.current?.(true)}
        className="shrink-0 rounded-full bg-white px-3 py-1.5 font-semibold text-blue-600"
      >
        Update
      </button>
    </div>
  )
}
