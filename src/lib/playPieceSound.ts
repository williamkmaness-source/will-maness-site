// Synthesizes a short wood-thud sound using the Web Audio API.
// No audio file required — runs entirely in-browser.
// Silently no-ops if the AudioContext API is unavailable.
export function playPieceSound(): void {
  try {
    const ctx = new AudioContext();

    // Frequency sweep (180→60 Hz) with quick exponential decay mimics a wooden thud.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext blocked or unavailable — play silently.
  }
}
