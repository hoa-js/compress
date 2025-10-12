import type { HoaMiddleware } from 'hoa'

export type EncodingType = 'gzip' | 'deflate'

export type CompressionOptions = {
  encoding?: EncodingType
  threshold?: number
}

export function compress(options?: CompressionOptions): HoaMiddleware

export default compress
