export type TinyPngCompressionResult = {
  compressedBytes: Uint8Array
  compressionCount?: number
}

export type TinyPngKeyLimitError = Error & { isKeyLimit?: boolean }

export async function tinifyCompress(bytes: Uint8Array, apiKey: string) {
  // Remove 'api:' prefix if user accidentally included it
  const key = apiKey.replace(/^api:/, '')
  const auth = 'Basic ' + btoa('api:' + key)

  // Cloudflare Worker URL（优先代理）
  const CF_WORKER_URL = 'https://tinypng-proxy.cxqtouch.workers.dev/'
  const API_URL = 'https://api.tinify.com/shrink'

  const proxies: Array<{ label: string; proxyUrl: string }> = []
  if (CF_WORKER_URL) {
    const workerProxyUrl = CF_WORKER_URL.includes('?')
      ? CF_WORKER_URL
      : CF_WORKER_URL + '?url='
    proxies.push({ label: 'Cloudflare Worker', proxyUrl: workerProxyUrl })
  }

  // Fallback proxy
  proxies.push({ label: 'corsproxy.io', proxyUrl: 'https://corsproxy.io/?' })

  const MAX_ATTEMPTS_PER_PROXY = 2
  const BASE_BACKOFF_MS = 400
  const jitter = () => Math.floor(Math.random() * 200)
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const SHRINK_TIMEOUT_MS = 20000
  const DOWNLOAD_TIMEOUT_MS = 20000

  async function fetchWithTimeout(
    url: string,
    fetchOptions: RequestInit,
    timeoutMs: number
  ) {
    const controller = new AbortController()
    const timerId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...fetchOptions, signal: controller.signal })
    } finally {
      clearTimeout(timerId)
    }
  }

  let lastError: unknown = null

  for (const proxy of proxies) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PROXY; attempt++) {
      try {
        const resp = await fetchWithTimeout(
          proxy.proxyUrl + encodeURIComponent(API_URL),
          {
            method: 'POST',
            headers: {
              Authorization: auth,
              'Content-Type': 'application/octet-stream',
            },
            body: bytes as any,
          },
          SHRINK_TIMEOUT_MS
        )

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '')
          // eslint-disable-next-line no-console
          console.error(
            `[TinyPNG] Proxy(${proxy.label}) TinyPNG Error:`,
            resp.status,
            errText
          )
          if (resp.status === 429) {
            const e: TinyPngKeyLimitError = new Error('KEY_LIMIT_REACHED')
            e.isKeyLimit = true
            throw e
          }

          try {
            const errJson = JSON.parse(errText)
            if (errJson.message) throw new Error(errJson.message)
            if (errJson.error) throw new Error(errJson.error)
          } catch (_) {}

          throw new Error(`TinyPNG API Error: ${resp.status} ${resp.statusText}`)
        }

        const compCount =
          resp.headers.get('Compression-Count') ||
          resp.headers.get('compression-count')
        let compressionCount: number | undefined = undefined
        if (compCount != null) {
          const n = parseInt(compCount, 10)
          if (!isNaN(n) && n >= 0) compressionCount = n
        }

        const meta = (await resp.json()) as any
        if (!(meta && meta.output && meta.output.url)) {
          throw new Error('Invalid TinyPNG response')
        }

        // Download compressed result
        const outResp = await fetchWithTimeout(
          proxy.proxyUrl + encodeURIComponent(meta.output.url),
          {},
          DOWNLOAD_TIMEOUT_MS
        )
        if (!outResp.ok) {
          throw new Error(`Download failed: ${outResp.status}`)
        }

        const arr = await outResp.arrayBuffer()
        const compressedBytes = new Uint8Array(arr)

        return { compressedBytes, compressionCount }
      } catch (e) {
        lastError = e
        // key limit should short-circuit
        if (e && typeof e === 'object' && (e as TinyPngKeyLimitError).isKeyLimit) {
          throw e
        }
        // eslint-disable-next-line no-console
        console.warn(
          `[TinyPNG] Proxy failed: ${proxy.label} (attempt ${attempt}/${MAX_ATTEMPTS_PER_PROXY})`,
          e
        )
        if (attempt < MAX_ATTEMPTS_PER_PROXY) {
          await sleep(BASE_BACKOFF_MS * attempt + jitter())
        }
      }
    }
  }

  // eslint-disable-next-line no-console
  console.error('TinyPNG Exception (all proxies failed):', lastError)
  throw lastError || new Error('TinyPNG compression failed')
}

