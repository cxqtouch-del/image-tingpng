// Cloudflare Worker Script
// 部署步骤：
// 1. 登录 Cloudflare -> Workers & Pages -> Create Application -> Create Worker
// 2. 命名 Worker (例如: tinypng-proxy) -> Deploy
// 3. 点击 "Edit code"
// 4. 将以下代码完整粘贴覆盖原有代码
// 5. 点击 "Save and deploy"
// 6. 复制生成的 Worker URL (例如: https://tinypng-proxy.username.workers.dev)
// 7. 将该 URL 填入插件 ui.html 的 CLOUDFLARE_WORKER_URL 变量中

export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing "url" query parameter', { status: 400, headers: corsHeaders });
    }

    try {
      // Recreate the request to the target URL
      const newRequest = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow'
      });
      
      const response = await fetch(newRequest);
      
      // Recreate response with CORS headers
      const newResponse = new Response(response.body, response);
      Object.keys(corsHeaders).forEach(key => {
        newResponse.headers.set(key, corsHeaders[key]);
      });
      
      return newResponse;
    } catch (e) {
      return new Response(e.message, { status: 500, headers: corsHeaders });
    }
  }
};
