const ENCODING_TYPES = ['gzip', 'deflate']
const cacheControlNoTransformRegExp = /(?:^|,)\s*?no-transform\s*?(?:,|$)/i
const COMPRESSIBLE_CONTENT_TYPE_REGEX = /^\s*(?:text\/(?!event-stream(?:[;\s]|$))[^;\s]+|application\/(?:javascript|json|xml|xml-dtd|ecmascript|dart|postscript|rtf|tar|toml|vnd\.dart|vnd\.ms-fontobject|vnd\.ms-opentype|wasm|x-httpd-php|x-javascript|x-ns-proxy-autoconfig|x-sh|x-tar|x-virtualbox-hdd|x-virtualbox-ova|x-virtualbox-ovf|x-virtualbox-vbox|x-virtualbox-vdi|x-virtualbox-vhd|x-virtualbox-vmdk|x-www-form-urlencoded)|font\/(?:otf|ttf)|image\/(?:bmp|vnd\.adobe\.photoshop|vnd\.microsoft\.icon|vnd\.ms-dds|x-icon|x-ms-bmp)|message\/rfc822|model\/gltf-binary|x-shader\/x-fragment|x-shader\/x-vertex|[^;\s]+?\+(?:json|text|xml|yaml))(?:[;\s]|$)/i

function negotiateEncoding (accepted) {
  const qualities = new Map()
  for (const part of accepted.split(',')) {
    const [name, ...parameters] = part.trim().toLowerCase().split(';')
    const parameter = parameters.find(value => /^\s*q\s*=/.test(value))
    const quality = parameter === undefined ? 1 : Number(parameter.split('=')[1])
    qualities.set(name, Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0)
  }
  let bestQuality = 0
  let encoding
  for (const candidate of ENCODING_TYPES) {
    const quality = qualities.get(candidate) ?? qualities.get('*') ?? 0
    if (quality > bestQuality) {
      encoding = candidate
      bestQuality = quality
    }
  }
  return encoding
}

/**
 * Compress middleware for Hoa.
 *
 * @param {CompressionOptions} [options] - The options for the compress middleware.
 * @param {'gzip' | 'deflate'} [options.encoding] - The compression scheme to allow for response compression. Either 'gzip' or 'deflate'. If not defined, both are allowed and will be used based on the Accept-Encoding header. 'gzip' is prioritized if this option is not provided and the client provides both in the Accept-Encoding header.
 * @param {number} [options.threshold=1024] - The minimum size in bytes to compress. Defaults to 1024 bytes.
 * @returns {(ctx: any, next: () => Promise<void>) => Promise<void>} The middleware handler function.
 */
export const compress = (options = {}) => {
  const threshold = options.threshold ?? 1024
  return async function compress (ctx, next) {
    await next()

    const accepted = ctx.req.get('Accept-Encoding') || ''
    if (!ctx.res.body) {
      return
    }

    const contentLength = ctx.res.length
    if (
      ctx.res.has('Content-Encoding') || // already encoded
      ctx.res.has('Transfer-Encoding') || // already encoded or chunked
      ctx.req.method === 'HEAD' || // HEAD request
      (typeof contentLength === 'number' && contentLength < threshold) || // content-length below threshold
      !shouldCompress(ctx.res) || // not compressible type
      !shouldTransform(ctx.res) // cache-control: no-transform
    ) {
      return
    }

    const vary = ctx.res.get('Vary')?.toLowerCase().split(',').map(value => value.trim()) ?? []
    if (!vary.includes('*') && !vary.includes('accept-encoding')) ctx.res.append('Vary', 'Accept-Encoding')
    const encoding = options.encoding ?? negotiateEncoding(accepted)
    if (!encoding) return

    const body = ctx.res.body
    let readable
    if (body instanceof ReadableStream) {
      readable = body
    } else if (body instanceof Response) {
      readable = body.body
    } else if (
      (typeof body === 'string') ||
      (body instanceof Blob) ||
      (body instanceof ArrayBuffer) ||
      ArrayBuffer.isView(body) ||
      (body instanceof FormData) ||
      (body instanceof URLSearchParams)
    ) {
      readable = new Response(body).body
    } else {
      // json
      readable = new Response(JSON.stringify(body)).body
    }

    const stream = new CompressionStream(encoding)
    ctx.res.body = readable.pipeThrough(stream)
    ctx.res.delete('Content-Length')
    ctx.res.set('Content-Encoding', encoding)
  }
}

const shouldCompress = (res) => {
  const type = res.get('Content-Type')
  return type && COMPRESSIBLE_CONTENT_TYPE_REGEX.test(type)
}

const shouldTransform = (res) => {
  const cacheControl = res.get('Cache-Control')
  // Don't compress for Cache-Control: no-transform
  // https://tools.ietf.org/html/rfc7234#section-5.2.2.4
  return !cacheControl || !cacheControlNoTransformRegExp.test(cacheControl)
}

export default compress
