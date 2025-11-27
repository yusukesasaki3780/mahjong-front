<script setup lang="ts">
import { computed } from 'vue';
import AppBackButton from './AppBackButton.vue';

interface PageHeaderProps {
  title: string;
  backTo?: string;
  backLabel?: string;
}

const props = defineProps<PageHeaderProps>();

// 戻るボタンを表示する必要があるか判定する
const hasBack = computed(() => Boolean(props.backTo));
</script>

<template>
  <header class="app-page-header">
    <div class="left">
      <AppBackButton v-if="hasBack" :to="props.backTo!" :label="props.backLabel" />
      <h1>{{ props.title }}</h1>
    </div>
    <div class="right">
      <slot name="right" />
    </div>
  </header>
</template>

<style scoped>
.app-page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 56px;
  padding: 12px 0;
  background: var(--color-background);
}

.left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  min-width: 0;
}

h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
