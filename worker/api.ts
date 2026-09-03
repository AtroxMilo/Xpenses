import {
  clearCookie,
  kvIdFor,
  sessionCookie,
  sessionKvId,
  signSession,
} from './session'

export interface Env {
  ASSETS: Fetcher
  XP_BACKUP: KVNamespace
  SESSION_SECRET: string
}

/** Shape stored in KV at `backup:<kvId>`. `blob` is client-side AES-GCM ciphertext. */
interface StoredBackup {
  updatedAt: number
  deviceId: string
  blob: unknown
}

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

export async function handleApi(req: Request, env: Env): Promise<Response> {
  try {
    return await route(req, env)
  } catch (err) {
    return json(
      { error: 'server_error', detail: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}

async function route(req: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(req.url)
  const { method } = req

  // Unauthenticated health check — confirms bindings without leaking anything.
  if (pathname === '/api/health') {
    return json({
      ok: Boolean(env.SESSION_SECRET) && Boolean(env.XP_BACKUP),
      hasSecret: Boolean(env.SESSION_SECRET),
      hasKv: Boolean(env.XP_BACKUP),
    })
  }

  if (!env.SESSION_SECRET) {
    return json({ error: 'server_misconfigured', detail: 'SESSION_SECRET is not set' }, 503)
  }

  if (pathname === '/api/session') {
    if (method === 'POST') return sessionCreate(req, env)
    if (method === 'GET') return sessionState(req, env)
    if (method === 'DELETE') {
      return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() })
    }
    return json({ error: 'method_not_allowed' }, 405)
  }

  if (pathname === '/api/backup') {
    const kvId = await sessionKvId(req, env.SESSION_SECRET)
    if (!kvId) return json({ error: 'unauthorized' }, 401)
    if (method === 'GET') return backupGet(env, kvId)
    if (method === 'PUT') return backupPut(req, env, kvId)
    return json({ error: 'method_not_allowed' }, 405)
  }

  return json({ error: 'not_found' }, 404)
}

async function sessionCreate(req: Request, env: Env): Promise<Response> {
  let accountId: unknown
  try {
    ;({ accountId } = (await req.json()) as { accountId?: unknown })
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (typeof accountId !== 'string' || !/^[0-9a-f]{64}$/.test(accountId)) {
    return json({ error: 'bad_account_id' }, 400)
  }
  const kvId = await kvIdFor(env.SESSION_SECRET, accountId)
  const token = await signSession(kvId, env.SESSION_SECRET)
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token) })
}

async function sessionState(req: Request, env: Env): Promise<Response> {
  const kvId = await sessionKvId(req, env.SESSION_SECRET)
  return json({ connected: Boolean(kvId) })
}

async function backupGet(env: Env, kvId: string): Promise<Response> {
  const stored = await env.XP_BACKUP.get<StoredBackup>(`backup:${kvId}`, 'json')
  if (!stored) return new Response(null, { status: 204 })
  return json(stored)
}

async function backupPut(req: Request, env: Env, kvId: string): Promise<Response> {
  let body: { baseUpdatedAt?: unknown; deviceId?: unknown; blob?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const { baseUpdatedAt, deviceId, blob } = body
  if (typeof deviceId !== 'string' || blob == null) {
    return json({ error: 'bad_request' }, 400)
  }

  const key = `backup:${kvId}`
  const current = await env.XP_BACKUP.get<StoredBackup>(key, 'json')
  const currentUpdatedAt = current?.updatedAt ?? null
  const base = typeof baseUpdatedAt === 'number' ? baseUpdatedAt : null
  if (currentUpdatedAt !== base) {
    return json({ error: 'conflict', updatedAt: currentUpdatedAt }, 409)
  }

  const next: StoredBackup = { updatedAt: Date.now(), deviceId, blob }
  await env.XP_BACKUP.put(key, JSON.stringify(next))
  return json({ updatedAt: next.updatedAt })
}
