import { roomManager, type ConnectionData } from './room-manager'
import { join } from 'path'

const PORT = Number(process.env.PORT) || 1999
const STATIC_DIR = join(import.meta.dir, '../../client/dist')

const server = Bun.serve<ConnectionData>({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url)

    // Health check
    if (url.pathname === '/health') {
      return new Response('ok')
    }

    // Matchmaking API — list public games
    if (url.pathname === '/api/public-games') {
      return new Response(JSON.stringify({ games: roomManager.getPublicGames() }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Deploy webhook — triggers rollout restart via K8s API
    if (url.pathname === '/webhook/deploy' && req.method === 'POST') {
      const token = req.headers.get('authorization')?.replace('Bearer ', '')
      const expectedToken = process.env.DEPLOY_TOKEN
      if (!expectedToken || token !== expectedToken) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
      }

      try {
        // Use K8s API via mounted service account
        const k8sToken = await Bun.file('/var/run/secrets/kubernetes.io/serviceaccount/token').text()
        const namespace = 'uno'
        const deployment = 'uno-server'
        const k8sHost = process.env.KUBERNETES_SERVICE_HOST || 'kubernetes.default.svc'
        const k8sPort = process.env.KUBERNETES_SERVICE_PORT || '443'

        const patchBody = JSON.stringify({
          spec: {
            template: {
              metadata: {
                annotations: {
                  'uno/restartedAt': new Date().toISOString(),
                },
              },
            },
          },
        })

        const res = await fetch(
          `https://${k8sHost}:${k8sPort}/apis/apps/v1/namespaces/${namespace}/deployments/${deployment}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${k8sToken}`,
              'Content-Type': 'application/strategic-merge-patch+json',
            },
            body: patchBody,
            // @ts-ignore Bun supports this for self-signed certs
            tls: { rejectUnauthorized: false },
          },
        )

        if (res.ok) {
          console.log('Deploy webhook: rollout restart triggered')
          return new Response(JSON.stringify({ status: 'ok', message: 'rollout restarted' }))
        } else {
          const err = await res.text()
          console.error('Deploy webhook: K8s API error', err)
          return new Response(JSON.stringify({ status: 'error', message: err }), { status: 500 })
        }
      } catch (err) {
        console.error('Deploy webhook error:', err)
        return new Response(JSON.stringify({ status: 'error', message: String(err) }), { status: 500 })
      }
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    // WebSocket upgrade — extract room code from path: /ws/:roomCode
    const match = url.pathname.match(/^\/ws\/([A-Z0-9]+)$/i)
    if (match) {
      const roomCode = match[1].toUpperCase()
      const upgraded = server.upgrade(req, {
        data: {
          playerId: '',
          nickname: '',
          isHost: false,
          roomCode,
        },
      })
      if (upgraded) return undefined
      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    // Serve static files from the Vite build
    const filePath = join(STATIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname)
    const file = Bun.file(filePath)
    if (await file.exists()) {
      return new Response(file)
    }

    // SPA fallback — serve index.html for client-side routes
    const indexFile = Bun.file(join(STATIC_DIR, 'index.html'))
    if (await indexFile.exists()) {
      return new Response(indexFile)
    }

    return new Response('UNO Game Server', { status: 200 })
  },

  websocket: {
    open(ws) {
      roomManager.handleConnect(ws)
    },
    message(ws, message) {
      roomManager.handleMessage(ws, String(message))
    },
    close(ws) {
      roomManager.handleClose(ws)
    },
  },
})

console.log(`UNO game server listening on port ${PORT}`)
