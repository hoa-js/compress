import Hoa from 'hoa'
import { compress } from '../src/compress.js'

describe('Compress Middleware for Hoa', () => {
  const app = new Hoa()

  // Apply compress middleware globally
  app.use(compress())

  // Routes implemented via middleware based on pathname
  app.use(async (ctx, next) => {
    const { pathname } = ctx.req

    if (pathname === '/small') {
      ctx.res.set('Content-Type', 'text/plain')
      ctx.res.set('Content-Length', '5')
      ctx.res.body = 'small'
      return
    }

    if (pathname === '/large') {
      ctx.res.set('Content-Type', 'text/plain')
      ctx.res.set('Content-Length', '1024')
      ctx.res.body = 'a'.repeat(1024)
      return
    }

    if (pathname === '/small-json') {
      ctx.res.set('Content-Type', 'application/json')
      ctx.res.set('Content-Length', '26')
      ctx.res.body = { message: 'Hello, World!' }
      return
    }

    if (pathname === '/large-json') {
      ctx.res.set('Content-Type', 'application/json')
      ctx.res.set('Content-Length', '1024')
      ctx.res.body = { data: 'a'.repeat(1024), message: 'Large JSON' }
      return
    }

    if (pathname === '/no-transform') {
      ctx.res.set('Content-Type', 'text/plain')
      ctx.res.set('Content-Length', '1024')
      ctx.res.set('Cache-Control', 'no-transform')
      ctx.res.body = 'a'.repeat(1024)
      return
    }

    if (pathname === '/jpeg-image') {
      ctx.res.set('Content-Type', 'image/jpeg')
      ctx.res.set('Content-Length', '1024')
      ctx.res.body = new Uint8Array(1024)
      return
    }

    if (pathname === '/already-compressed') {
      ctx.res.set('Content-Type', 'application/octet-stream')
      ctx.res.set('Content-Encoding', 'br')
      ctx.res.set('Content-Length', '1024')
      ctx.res.body = new Uint8Array(1024)
      return
    }

    if (pathname === '/transfer-encoding-deflate') {
      ctx.res.set('Content-Type', 'application/octet-stream')
      ctx.res.set('Transfer-Encoding', 'deflate')
      ctx.res.set('Content-Length', '1024')
      ctx.res.body = new Uint8Array(1024)
      return
    }

    if (pathname === '/chunked') {
      ctx.res.set('Content-Type', 'application/octet-stream')
      ctx.res.set('Transfer-Encoding', 'chunked')
      ctx.res.set('Content-Length', '1024')
      ctx.res.body = new Uint8Array(1024)
      return
    }

    if (pathname === '/stream') {
      ctx.res.set('Content-Type', 'text/plain')
      // 60000 bytes: 'chunk ' * 10000
      ctx.res.body = new ReadableStream({
        async start (controller) {
          for (let i = 0; i < 10000; i++) {
            controller.enqueue(new TextEncoder().encode('chunk '))
          }
          controller.close()
        },
      })
      return
    }

    if (pathname === '/already-compressed-stream') {
      ctx.res.set('Content-Type', 'text/plain')
      ctx.res.set('Content-Encoding', 'br')
      // 60000 bytes
      ctx.res.body = new ReadableStream({
        async start (controller) {
          const chunk = new Uint8Array([0, 1, 2, 3, 4, 5])
          for (let i = 0; i < 10000; i++) {
            controller.enqueue(chunk)
          }
          controller.close()
        },
      })
      return
    }

    if (pathname === '/sse') {
      // Server-Sent Events should not be compressed
      ctx.res.set('Content-Type', 'text/event-stream')
      ctx.res.body = new ReadableStream({
        async start (controller) {
          const enc = new TextEncoder()
          for (let i = 0; i < 1000; i++) {
            controller.enqueue(enc.encode('data: chunk\n\n'))
          }
          controller.close()
        },
      })
      return
    }

    if (pathname === '/not-found') {
      ctx.res.status = 404
      ctx.res.set('Content-Type', 'text/plain')
      ctx.res.set('Content-Length', '1024')
      ctx.res.body = 'Custom NotFound'
      return
    }

    if (pathname === '/response-body') {
      // Body is a Response instance
      ctx.res.body = new Response('x'.repeat(1024), { headers: { 'Content-Type': 'text/plain' } })
      return
    }

    if (pathname === '/typed-array-text') {
      // TypedArray with compressible content-type
      ctx.res.set('Content-Type', 'text/plain')
      const size = 5000
      const arr = new Uint8Array(size)
      arr.fill(97) // fill with 'a'
      ctx.res.body = arr
      return
    }

    if (pathname === '/vary-append') {
      ctx.res.set('Vary', 'Origin')
      ctx.res.set('Content-Type', 'text/plain')
      ctx.res.set('Content-Length', '1024')
      ctx.res.body = 'a'.repeat(1024)
      return
    }

    if (pathname === '/blob-text') {
      const blob = new Blob([new TextEncoder().encode('a'.repeat(3000))], { type: 'text/plain' })
      ctx.res.body = blob
      return
    }

    if (pathname === '/formdata') {
      const fd = new FormData()
      fd.append('a', 'x'.repeat(1024))
      ctx.res.body = fd
      return
    }

    if (pathname === '/no-body') {
      ctx.res.status = 204
      ctx.res.body = null
      return
    }

    await next()
  })

  const testCompression = async (path, acceptEncoding, expectedEncoding) => {
    const req = new Request(`http://localhost${path}`, {
      method: 'GET',
      headers: new Headers({ 'Accept-Encoding': acceptEncoding }),
    })
    const res = await app.fetch(req)
    expect(res.headers.get('Content-Encoding')).toBe(expectedEncoding)
    return res
  }

  describe('Compression Behavior', () => {
    it('should compress large responses with gzip', async () => {
      const res = await testCompression('/large', 'gzip', 'gzip')
      expect(res.headers.get('Content-Length')).toBeNull()
      expect((await res.arrayBuffer()).byteLength).toBeLessThan(1024)
    })

    it('should compress large responses with deflate', async () => {
      const res = await testCompression('/large', 'deflate', 'deflate')
      expect((await res.arrayBuffer()).byteLength).toBeLessThan(1024)
    })

    it('should prioritize gzip over deflate when both are accepted', async () => {
      await testCompression('/large', 'gzip, deflate', 'gzip')
    })

    it('should not compress small responses', async () => {
      const res = await testCompression('/small', 'gzip, deflate', null)
      expect(res.headers.get('Content-Length')).toBe('5')
    })

    it('should not compress when no Accept-Encoding is provided', async () => {
      await testCompression('/large', '', null)
    })

    it('should not compress when Accept-Encoding header is missing', async () => {
      const req = new Request('http://localhost/large', { method: 'GET' })
      const res = await app.fetch(req)
      expect(res.headers.get('Content-Encoding')).toBeNull()
    })

    it('should not compress when only br is accepted', async () => {
      await testCompression('/large', 'br', null)
    })

    it('should not compress images', async () => {
      const res = await testCompression('/jpeg-image', 'gzip', null)
      expect(res.headers.get('Content-Type')).toBe('image/jpeg')
      expect(res.headers.get('Content-Length')).toBe('1024')
    })

    it('should not compress already compressed responses', async () => {
      const res = await testCompression('/already-compressed', 'gzip', 'br')
      expect(res.headers.get('Content-Length')).toBe('1024')
    })

    it('should remove Content-Length when compressing', async () => {
      const res = await testCompression('/large', 'gzip', 'gzip')
      expect(res.headers.get('Content-Length')).toBeNull()
    })

    it('should not remove Content-Length when not compressing', async () => {
      const res = await testCompression('/jpeg-image', 'gzip', null)
      expect(res.headers.get('Content-Length')).toBeDefined()
    })

    it('should not compress transfer-encoding: deflate', async () => {
      const res = await testCompression('/transfer-encoding-deflate', 'gzip', null)
      expect(res.headers.get('Content-Length')).toBe('1024')
      expect(res.headers.get('Transfer-Encoding')).toBe('deflate')
    })

    it('should not compress transfer-encoding: chunked', async () => {
      const res = await testCompression('/chunked', 'gzip', null)
      expect(res.headers.get('Content-Length')).toBe('1024')
      expect(res.headers.get('Transfer-Encoding')).toBe('chunked')
    })
  })

  describe('JSON Handling', () => {
    it('should not compress small JSON responses', async () => {
      const res = await testCompression('/small-json', 'gzip', null)
      expect(res.headers.get('Content-Length')).toBe('26')
    })

    it('should compress large JSON responses', async () => {
      const res = await testCompression('/large-json', 'gzip', 'gzip')
      expect(res.headers.get('Content-Length')).toBeNull()
      const decompressed = await decompressResponse(res)
      const json = JSON.parse(decompressed)
      expect(json.data.length).toBe(1024)
      expect(json.message).toBe('Large JSON')
    })
  })

  describe('Streaming Responses', () => {
    it('should compress streaming responses written in multiple chunks', async () => {
      const res = await testCompression('/stream', 'gzip', 'gzip')
      const decompressed = await decompressResponse(res)
      expect(decompressed.length).toBe(60000)
    })

    it('should not compress already compressed streaming responses', async () => {
      const res = await testCompression('/already-compressed-stream', 'gzip', 'br')
      expect((await res.arrayBuffer()).byteLength).toBe(60000)
    })

    it('should not compress server-sent events', async () => {
      const res = await testCompression('/sse', 'gzip', null)
      expect((await res.arrayBuffer()).byteLength).toBe(13000)
    })
  })

  describe('Edge Cases', () => {
    it('should not compress responses with Cache-Control: no-transform', async () => {
      await testCompression('/no-transform', 'gzip', null)
    })

    it('should handle HEAD requests without compression', async () => {
      const req = new Request('http://localhost/large', {
        method: 'HEAD',
        headers: new Headers({ 'Accept-Encoding': 'gzip' }),
      })
      const res = await app.fetch(req)
      expect(res.headers.get('Content-Encoding')).toBeNull()
    })

    it('should compress custom 404 Not Found responses', async () => {
      const res = await testCompression('/not-found', 'gzip', 'gzip')
      expect(res.status).toBe(404)
      const decompressed = await decompressResponse(res)
      expect(decompressed).toBe('Custom NotFound')
    })

    it('should compress Response body instances', async () => {
      const res = await testCompression('/response-body', 'gzip', 'gzip')
      const decompressed = await decompressResponse(res)
      expect(decompressed.length).toBe(1024)
    })

    it('should append Accept-Encoding to existing Vary header', async () => {
      const res = await testCompression('/vary-append', 'gzip', 'gzip')
      const vary = res.headers.get('Vary')
      expect(vary).toContain('Origin')
      expect(vary).toContain('Accept-Encoding')
    })

    it('should compress typed arrays when content-type is text/plain', async () => {
      const res = await testCompression('/typed-array-text', 'gzip', 'gzip')
      const bufLen = (await res.arrayBuffer()).byteLength
      expect(bufLen).toBeLessThan(5000)
    })

    it('should compress Blob bodies with text/plain type', async () => {
      const res = await testCompression('/blob-text', 'gzip', 'gzip')
      const bufLen = (await res.arrayBuffer()).byteLength
      expect(bufLen).toBeLessThan(3000)
    })

    it('should not compress when body is null', async () => {
      const req = new Request('http://localhost/no-body', {
        method: 'GET',
        headers: new Headers({ 'Accept-Encoding': 'gzip' }),
      })
      const res = await app.fetch(req)
      expect(res.headers.get('Content-Encoding')).toBeNull()
    })

    it('should not compress FormData responses (no Content-Type)', async () => {
      const res = await testCompression('/formdata', 'gzip', null)
      expect(res.headers.get('Content-Encoding')).toBeNull()
      expect(res.headers.get('Content-Type') || '').toContain('multipart/form-data')
    })
  })

  describe('Options Behavior', () => {
    it('should compress when encoding is forced via options even if Accept-Encoding is empty', async () => {
      const app = new Hoa()
      app.use(compress({ encoding: 'gzip' }))
      app.use(async (ctx, next) => {
        if (ctx.req.pathname === '/opt-large') {
          ctx.res.set('Content-Type', 'text/plain')
          ctx.res.set('Content-Length', '1024')
          ctx.res.body = 'a'.repeat(1024)
          return
        }
        await next()
      })
      const req = new Request('http://localhost/opt-large', {
        method: 'GET',
        headers: new Headers({ 'Accept-Encoding': '' }),
      })
      const res = await app.fetch(req)
      expect(res.headers.get('Content-Encoding')).toBe('gzip')
    })
  })
})

async function decompressResponse (res) {
  const decompressedStream = res.body.pipeThrough(new DecompressionStream('gzip'))
  const decompressedResponse = new Response(decompressedStream)
  return await decompressedResponse.text()
}
