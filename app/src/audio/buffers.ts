export function createNoiseBuffer(context: AudioContext, duration: number) {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function createDustBuffer(context: AudioContext, duration: number) {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const dust = Math.random() > 0.992 ? Math.random() * 2 - 1 : 0;
    data[i] = dust + (Math.random() * 2 - 1) * 0.08;
  }
  return buffer;
}
