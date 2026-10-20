<script setup lang="ts">
import AttainmentDial from '@/components/instruments/AttainmentDial.vue'
import Tachometer from '@/components/instruments/Tachometer.vue'
import FuelGauge from '@/components/instruments/FuelGauge.vue'
import Odometer from '@/components/instruments/Odometer.vue'
import RangeReadout from '@/components/instruments/RangeReadout.vue'
import TellTale from '@/components/instruments/TellTale.vue'
import StatusPill from '@/components/instruments/StatusPill.vue'
import InstrumentSkeleton from '@/components/instruments/InstrumentSkeleton.vue'
import { DEFAULT_SETTINGS, paceStatus, TELLTALE_LABEL, type PaceStatus, type TellTaleKey } from '@/lib/metrics'

/**
 * /dev/instruments — every instrument in every state the brief asks for
 * (0, 35, 70, 100, 130%, no data), Day and Night side by side, so the look can
 * be reviewed without any data.
 */
const RATIOS: (number | null)[] = [0, 0.35, 0.7, 1, 1.3, null]
const label = (r: number | null) => (r === null ? 'No data' : `${Math.round(r * 100)}%`)
const status = (r: number | null): PaceStatus => paceStatus(r, r !== null, DEFAULT_SETTINGS)

const THEMES = [
  { name: 'dark', title: 'Night' },
  { name: 'light', title: 'Day' },
] as const

const LAMPS: TellTaleKey[] = ['behind_pace', 'no_inhouse', 'no_ethical', 'calls_low']
const STATUSES: PaceStatus[] = ['ahead', 'on_pace', 'at_risk', 'behind', 'no_target', 'no_data']
</script>

<template>
  <div class="gallery">
    <header class="gallery__head">
      <h1>Instruments</h1>
      <p>Every gauge state in both display modes. Flat, printed, no glow — review the look here, in isolation.</p>
    </header>

    <div class="gallery__themes">
      <v-theme-provider v-for="theme in THEMES" :key="theme.name" :theme="theme.name" with-background class="gallery__theme">
        <section :data-theme-name="theme.title">
          <h2 class="gallery__mode">{{ theme.title }}</h2>

          <h3 class="micro-label gallery__label">Speedometer — combi attainment</h3>
          <div class="gallery__grid gallery__grid--hero">
            <div v-for="r in RATIOS" :key="`hero-${r}`" class="gallery__cell">
              <AttainmentDial label="Combi" :ratio="r" :status="status(r)" size="hero" caption="combi · October" />
              <span class="gallery__state">{{ label(r) }}</span>
            </div>
            <div class="gallery__cell">
              <AttainmentDial label="Combi" :ratio="0.11" :status="status(0.33)" size="hero" caption="combi · Q4 to date" :expected-share="1 / 3" />
              <span class="gallery__state">11% one month in (bands at a third)</span>
            </div>
            <div class="gallery__cell">
              <AttainmentDial label="Combi" :ratio="null" status="no_target" size="hero" />
              <span class="gallery__state">No target set</span>
            </div>
          </div>

          <h3 class="micro-label gallery__label">Small dials — in-house, ethical</h3>
          <div class="gallery__grid">
            <div v-for="r in RATIOS" :key="`small-${r}`" class="gallery__cell">
              <AttainmentDial label="In-house" :ratio="r" :status="status(r)" />
              <span class="gallery__state">{{ label(r) }}</span>
            </div>
          </div>

          <h3 class="micro-label gallery__label">Tachometer — calls against target 160</h3>
          <div class="gallery__grid">
            <div v-for="r in RATIOS" :key="`tach-${r}`" class="gallery__cell">
              <Tachometer :calls="r === null ? null : Math.round(r * 160)" :target="160" :status="status(r)" />
              <span class="gallery__state">{{ label(r) }}</span>
            </div>
          </div>

          <h3 class="micro-label gallery__label">Fuel — quarter quota</h3>
          <div class="gallery__grid gallery__grid--wide">
            <div v-for="r in RATIOS" :key="`fuel-${r}`" class="gallery__cell gallery__cell--left">
              <FuelGauge
                :progress="r"
                :status="status(r)"
                :actual="r === null ? null : Math.round(r * 400_000_000)"
                :target="r === null ? null : 400_000_000"
                period-label="Q4"
              />
            </div>
          </div>

          <h3 class="micro-label gallery__label">Odometer and range</h3>
          <div class="gallery__grid gallery__grid--wide">
            <div class="gallery__cell gallery__cell--left"><Odometer :centavos="0" label="Collected · Q4 to date" /></div>
            <div class="gallery__cell gallery__cell--left"><Odometer :centavos="24_564_986" label="Collected · Q4 to date" /></div>
            <div class="gallery__cell gallery__cell--left"><Odometer :centavos="1_240_000_000" label="Collected · large" caption="₱12.4M in tight spaces" /></div>
            <div class="gallery__cell gallery__cell--left"><Odometer :centavos="null" label="Collected" /></div>
            <div class="gallery__cell gallery__cell--left"><RangeReadout :catch-up="109_266_447" by-when="end of October" :projection="0.0226" /></div>
            <div class="gallery__cell gallery__cell--left"><RangeReadout :catch-up="0" by-when="end of October" :projection="1.34" /></div>
            <div class="gallery__cell gallery__cell--left"><RangeReadout :catch-up="null" by-when="end of October" :projection="null" /></div>
          </div>

          <h3 class="micro-label gallery__label">Tell-tales — off, caution, critical</h3>
          <div class="gallery__lamps">
            <TellTale v-for="key in LAMPS" :key="`off-${key}`" :kind="key" :label="TELLTALE_LABEL[key]" :lit="false" tone="caution" detail="Off" />
            <TellTale v-for="key in LAMPS" :key="`c-${key}`" :kind="key" :label="TELLTALE_LABEL[key]" :lit="true" tone="caution" detail="Caution" />
            <TellTale v-for="key in LAMPS" :key="`r-${key}`" :kind="key" :label="TELLTALE_LABEL[key]" :lit="true" tone="critical" detail="Critical" />
          </div>

          <h3 class="micro-label gallery__label">Pace pills</h3>
          <div class="gallery__pills">
            <StatusPill v-for="s in STATUSES" :key="s" :status="s" />
          </div>

          <h3 class="micro-label gallery__label">Loading</h3>
          <InstrumentSkeleton />
        </section>
      </v-theme-provider>
    </div>
  </div>
</template>

<style scoped>
.gallery {
  min-height: 100vh;
  background-color: rgb(var(--v-theme-background));
}

.gallery__head {
  padding: 32px 32px 0;
}

.gallery__head h1 {
  font-size: 1.625rem;
}

.gallery__head p {
  margin-top: 4px;
  color: rgb(var(--v-theme-ink-2));
}

.gallery__themes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.gallery__theme {
  padding: 32px;
  background-color: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-ink));
  min-width: 0;
}

.gallery__mode {
  font-size: 1.25rem;
  margin-bottom: 8px;
}

.gallery__label {
  display: block;
  margin: 32px 0 12px;
}

.gallery__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.gallery__grid--hero {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.gallery__grid--wide {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.gallery__cell {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 16px;
  border: 1px solid rgb(var(--v-theme-line));
  border-radius: 6px;
  background-color: rgb(var(--v-theme-surface));
  min-width: 0;
}

.gallery__cell--left {
  justify-items: stretch;
}

.gallery__state {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-ink-2));
}

.gallery__lamps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.gallery__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 1280px) {
  .gallery__themes {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .gallery__theme,
  .gallery__head {
    padding: 16px;
  }

  .gallery__grid,
  .gallery__grid--hero,
  .gallery__grid--wide,
  .gallery__lamps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
