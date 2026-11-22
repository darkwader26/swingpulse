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

  const contentType = res.headers.get('content-type') ?? 'application/json'

  // Read body as text — more reliable than ArrayBuffer passthrough on Vercel
  const text = await res.text()

  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  })
}
