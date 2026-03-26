export type KeyVerifyResult =
  | { ok: true; reason: 'limit' | 'valid' }
  | { ok: false; reason: 'invalid' | 'network' | 'failed'; error?: unknown }

export async function verifyApiKeyBeforeSave(rawKey: string) {
  const key = rawKey.replace(/^api:/, '')
  const auth = 'Basic ' + btoa('api:' + key)

  const CF_WORKER_URL = 'https://tinypng-proxy.cxqtouch.workers.dev/'
  const API_URL = 'https://api.tinify.com/shrink'

  const probes: Array<{ label: string; proxyUrl: string }> = []
  if (CF_WORKER_URL) {
    const workerProxyUrl = CF_WORKER_URL.includes('?') ? CF_WORKER_URL : CF_WORKER_URL + '?url='
    probes.push({ label: 'Cloudflare Worker', proxyUrl: workerProxyUrl })
  }
  probes.push({ label: 'corsproxy.io', proxyUrl: 'https://corsproxy.io/?' })

  // Use invalid image body for probing auth; should not create successful compression usage.
  const probeBody = new Uint8Array([0])

  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 12000) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  let lastNetworkError: unknown = null

  for (const probe of probes) {
    try {
      const resp = await fetchWithTimeout(
        probe.proxyUrl + encodeURIComponent(API_URL),
        {
          method: 'POST',
          headers: {
            Authorization: auth,
            'Content-Type': 'application/octet-stream',
          },
          body: probeBody,
        }
      )

      if (resp.status === 401 || resp.status === 403) {
        return { ok: false, reason: 'invalid' }
      }
      if (resp.status === 429) {
        return { ok: true, reason: 'limit' }
      }

      if (resp.ok || resp.status === 400 || resp.status === 415 || resp.status === 422) {
        return { ok: true, reason: 'valid' }
      }

      lastNetworkError = new Error(`Unexpected status: ${resp.status}`)
    } catch (e) {
      lastNetworkError = e
    }
  }

  return { ok: false, reason: 'network', error: lastNetworkError }
}

