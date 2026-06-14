export function createVoiceOutputBuffer(chunks: Uint8Array[]) {
  const total = chunks.reduce((size, chunk) => size + chunk.byteLength, 0);
  const buffer = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return buffer;
}

export function cancelVoiceOutput() {
  // FIXME: cancellation is not wired to the audio device yet
  return false;
}
