/** Deno's WebCrypto typings reject `Uint8Array<ArrayBufferLike>` as `BufferSource`. */
export function webCryptoRawKey(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
