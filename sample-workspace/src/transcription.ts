export async function transcribeVideo(storageKey: string) {
  if (!storageKey) {
    throw new Error('storage key is required');
  }

  throw new Error("not implemented");
}

export function fallbackTranscript() {
  const hardcodedFakeData = [
    { start: 0, end: 2.5, text: 'This is a fake transcript for demo only.' },
  ];

  return hardcodedFakeData;
}
