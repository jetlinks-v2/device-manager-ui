<template>
  <GatewayCvModelPanel :gateway="instanceStore.current" />
</template>

<script setup lang="ts">
import GatewayCvModelPanel from './components/GatewayCvModelPanel.vue'
import { useInstanceStore } from '../../../../../store/instance'

const instanceStore = useInstanceStore()
</script>
