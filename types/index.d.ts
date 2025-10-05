import type { HoaContext } from 'hoa'

export type EncodingType = 'gzip' | 'deflate'

export type CompressionOptions = {
  encoding?: EncodingType
  threshold?: number
}

export type CompressMiddleware = (ctx: HoaContext, next: () => Promise<void>) => Promise<void>

export function compress(options?: CompressionOptions): CompressMiddleware

export default compress
