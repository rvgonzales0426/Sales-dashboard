<script setup lang="ts">
import { computed } from 'vue'
import ClusterBezel from '@/components/instruments/ClusterBezel.vue'
import AttainmentDial from '@/components/instruments/AttainmentDial.vue'
import Tachometer from '@/components/instruments/Tachometer.vue'
import FuelGauge from '@/components/instruments/FuelGauge.vue'
import Odometer from '@/components/instruments/Odometer.vue'
import RangeReadout from '@/components/instruments/RangeReadout.vue'
import TellTale from '@/components/instruments/TellTale.vue'
import { formatPeso, type MetricSettings } from '@/lib/metrics'
import type { ClusterReading } from '@/lib/cockpit/reading'

/**
 * The instrument cluster for one reading — the filtered team or one person.
 *   left   in-house and ethical attainment
 *   centre combi attainment, the hero
 *   right  calls against target, quota as fuel
 *   strip  collected (odometer), range to target, tell-tales
 */
const props = defineProps<{
  reading: ClusterReading
  settings: MetricSettings
  /** "Q4 to date", "October". */
  periodLabel: string
  /** "end of October". */
  byWhen: string
  quarterLabel: string
  /** "Team: 8 people" or "Ana Reyes". */
  subject: string
}>()

const combiDetail = computed(() =>
  props.reading.quota.actual === null
    ? ''
    : `${formatPeso(props.reading.quota.actual)} collected toward ${formatPeso(props.reading.quota.target)}`,
)
</script>

<template>
  <ClusterBezel :label="`Instrument cluster: ${subject}, ${periodLabel}`">
    <template #left>
      <AttainmentDial
        label="In-house"
        :ratio="reading.attainment.inhouse"
        :status="reading.status.inhouse"
        :expected-share="reading.expectedShare"
        :on-pace="settings.onPace"
        :at-risk="settings.atRisk"
        caption="in-house"
      />
      <AttainmentDial
        label="Ethical"
        :ratio="reading.attainment.ethical"
        :status="reading.status.ethical"
        :expected-share="reading.expectedShare"
        :on-pace="settings.onPace"
        :at-risk="settings.atRisk"
        caption="ethical"
      />
    </template>

    <template #hero>
      <AttainmentDial
        label="Combi attainment"
        size="hero"
        :ratio="reading.attainment.combi"
        :status="reading.status.combi"
        :expected-share="reading.expectedShare"
        :on-pace="settings.onPace"
        :at-risk="settings.atRisk"
        :caption="`combi · ${periodLabel}`"
        :detail="combiDetail"
        data-testid="speedometer"
      />
    </template>

    <template #right>
      <Tachometer :calls="reading.calls.actual" :target="reading.calls.target" :status="reading.status.calls" />
      <FuelGauge
        :progress="reading.quota.progress"
        :status="reading.status.combi"
        :actual="reading.quota.actual"
        :target="reading.quota.target"
        :period-label="quarterLabel"
      />
    </template>

    <template #odometer>
      <Odometer :centavos="reading.collected" :label="`Collected · ${periodLabel}`" caption="Combi: in-house + ethical, everyone in view" />
    </template>

    <template #range>
      <RangeReadout :catch-up="reading.catchUp" :by-when="byWhen" :projection="reading.projection" />
    </template>

    <template #telltales>
      <TellTale
        v-for="lamp in reading.telltales"
        :key="lamp.key"
        :kind="lamp.key"
        :label="lamp.label"
        :lit="lamp.lit"
        :tone="lamp.tone"
        :detail="lamp.detail"
      />
    </template>
  </ClusterBezel>
</template>
