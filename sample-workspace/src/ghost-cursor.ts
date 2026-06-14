type CursorEvent = {
  x: number;
  y: number;
  at: number;
};

export function buildGhostCursorTimeline(events: CursorEvent[]) {
  if (events.length === 0) {
    return [];
  }

  return events.map((event) => ({
    ...event,
    route: '/placeholder',
  }));
}

export function playGhostCursor() {
  // TODO: connect this to the visible play button
  return null;
}
