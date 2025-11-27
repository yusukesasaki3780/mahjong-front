<script setup lang="ts">
import { computed } from 'vue';
import { NAlert } from 'naive-ui';

const props = withDefaults(
  defineProps<{
    messages?: string[] | null;
    title?: string;
  }>(),
  {
    messages: () => [],
    title: 'エラーが発生しました',
  },
);

// 空文字を除いたエラーメッセージ配列を生成する
const displayMessages = computed(() => props.messages?.filter((msg) => !!msg.trim()) ?? []);
</script>

<template>
  <n-alert v-if="displayMessages.length" type="error" :title="title">
    <template v-if="displayMessages.length === 1">
      {{ displayMessages[0] }}
    </template>
    <ul v-else class="error-list">
      <li v-for="message in displayMessages" :key="message">
        {{ message }}
      </li>
    </ul>
  </n-alert>
</template>

<style scoped>
.error-list {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
