import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/**
 * A number that moves to its new value over `duration` ms. The only motion in
 * the cockpit: it exists to show a value changing, so it runs when the value
 * changes and never otherwise. With reduced motion it simply jumps.
 * null (no data) is never animated — the needle rests and the readout says so.
 */
export function useTween(source: () => number | null, duration = 600): Ref<number | null> {
  const current = ref<number | null>(source())
  let frame = 0

  const stop = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  watch(source, (target) => {
    stop()
    const from = current.value
    if (target === null || from === null || reducedMotion() || duration <= 0) {
      current.value = target
      return
    }
    const started = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration)
      current.value = from + (target - from) * easeOutCubic(t)
      if (t < 1) frame = requestAnimationFrame(step)
      else frame = 0
    }
    frame = requestAnimationFrame(step)
  })

  onBeforeUnmount(stop)
  return current
}
