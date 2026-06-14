export interface VadFrame {
  timestamp: number;
  speaking: boolean;
}

export function createVadStream(): VadFrame[] {
  // mock frames until real microphone analysis is wired
  return [
    { timestamp: 0, speaking: false },
    { timestamp: 350, speaking: true },
    { timestamp: 1200, speaking: false },
  ];
}
