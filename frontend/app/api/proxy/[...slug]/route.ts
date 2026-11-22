import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return proxyRequest(request, 'GET', params.slug.join('/'))
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return proxyRequest(request, 'POST', params.slug.join('/'))
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return proxyRequest(request, 'PUT', params.slug.join('/'))
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return proxyRequest(request, 'DELETE', params.slug.join('/'))
}

async function proxyRequest(
  request: NextRequest,
  method: string,
  path: string
): Promise<NextResponse> {
  if (!API_URL) {
    return NextResponse.json(
      { error: 'API_URL not configured on server' },
      { status: 500 }
    )
  }

  const targetUrl = `${API_URL}/${path}`

  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    if (key !== 'host' && key !== 'connection') {
      headers[key] = value
    }
  })

  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text()

  const res = await fetch(targetUrl, {
    method,
    headers,
    body,
    cache: 'no-store',
  })

  // Forward only safe response headers
  const responseHeaders: Record<string, string> = {}
  const allowed = ['content-type', 'cache-control', 'access-control-allow-origin']
  res.headers.forEach((value, key) => {
    if (allowed.includes(key.toLowerCase())) {
      responseHeaders[key] = value
    }
  })

  const data = await res.arrayBuffer()

  return new NextResponse(data, {
    status: res.status,
    headers: responseHeaders,
  })
}
