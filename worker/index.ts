import { type Env, handleApi } from './api'

export default {
  fetch(req: Request, env: Env): Response | Promise<Response> {
    const { pathname } = new URL(req.url)
    if (pathname.startsWith('/api/')) return handleApi(req, env)
    return env.ASSETS.fetch(req)
  },
}
