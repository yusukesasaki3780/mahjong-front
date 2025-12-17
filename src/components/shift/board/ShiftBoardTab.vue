<script setup lang="ts">
import { computed, defineExpose, onMounted, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import {
  NAlert,
  NButton,
  NCard,
  NDatePicker,
  NSelect,
  NSpin,
  NTabs,
  NTabPane,
  useMessage,
} from 'naive-ui';
import { getStoreMasters, type StoreMaster } from '../../../api/stores';
import {
  fetchShiftBoard,
  updateShiftRequirements,
  type ShiftBoardHalf,
  type ShiftBoardMember,
  type ShiftBoardResponse,
  type ShiftBoardShift,
  type ShiftBoardShiftType,
} from '../../../api/shiftBoard';
import { useResponsive } from '../../../composables/useResponsive';
import { getHalfMonthRange } from '../../../utils/dateRanges';
import HalfMonthSelector from './HalfMonthSelector.vue';
import ShiftBoardTable, {
  type BoardDay,
  type RequirementCell,
  type ShiftBoardDayMember,
} from './ShiftBoardTable.vue';

const props = defineProps<{
  isAdmin: boolean;
}>();

const emit = defineEmits<{
  (
    e: 'edit-shift-request',
    payload: {
      date: string;
      userId: string;
      storeId: number | null;
      shift?: ShiftBoardShift | null;
    },
  ): void;
}>();

const message = useMessage();
const storeOptions = ref<StoreMaster[]>([]);
const selectedStoreId = ref<number | null>(null);
const selectedMonth = ref(dayjs().startOf('month').valueOf());
const selectedHalf = ref<ShiftBoardHalf>('first');
const loadingStores = ref(false);
const loadingBoard = ref(false);
const requirementSaving = ref(false);
const boardData = ref<ShiftBoardResponse | null>(null);
const activeShiftType = ref<ShiftBoardShiftType>('EARLY');
const activeBoardStoreId = computed<number | null>(() => {
  const boardStoreId = boardData.value?.storeId;
  if (typeof boardStoreId === 'number' && !Number.isNaN(boardStoreId)) {
    return boardStoreId;
  }
  if (typeof selectedStoreId.value === 'number' && !Number.isNaN(selectedStoreId.value)) {
    return selectedStoreId.value;
  }
  return null;
});
const shiftTabOptions: Array<{ label: string; value: ShiftBoardShiftType }> = [
  { label: '早番', value: 'EARLY' },
  { label: '遅番', value: 'LATE' },
];

type HelpMember = ShiftBoardMember & {
  isHelpMember?: boolean;
  helpStoreId?: number;
  helpStoreName?: string;
};

const helpStoreId = ref<number | null>(null);
const helpMemberId = ref<string | null>(null);
const helpMembersCache = reactive<Record<number, HelpMember[]>>({});
const selectedHelpMembers = ref<HelpMember[]>([]);
const loadingHelpMembers = ref(false);

const today = dayjs().startOf('day');
const responsive = useResponsive();
const isMobileView = computed(() => responsive.current.value === 'mobile');
const storeNameMap = computed<Record<number, string>>(() => {
  const map: Record<number, string> = {};
  storeOptions.value.forEach((store) => {
    map[store.id] = store.storeName;
  });
  return map;
});

const loadStores = async (): Promise<void> => {
  loadingStores.value = true;
  try {
    storeOptions.value = await getStoreMasters();
    if (!selectedStoreId.value && storeOptions.value.length > 0) {
      selectedStoreId.value = storeOptions.value[0]!.id;
    }
  } catch (error) {
    console.error(error);
    message.error('店舗リストの取得に失敗しました');
  } finally {
    loadingStores.value = false;
  }
};

const buildDateRange = () => {
  const month = dayjs(selectedMonth.value).format('YYYY-MM');
  return getHalfMonthRange(month, selectedHalf.value);
};

const loadBoard = async (): Promise<void> => {
  if (!selectedStoreId.value) {
    boardData.value = null;
    return;
  }
  loadingBoard.value = true;
  try {
    const month = dayjs(selectedMonth.value).format('YYYY-MM');
    const range = getHalfMonthRange(month, selectedHalf.value);
    boardData.value = await fetchShiftBoard(selectedStoreId.value, {
      startDate: range.startDate,
      endDate: range.endDate,
    });
  } catch (error) {
    console.error(error);
    message.error('シフトボードの取得に失敗しました');
  } finally {
    loadingBoard.value = false;
  }
};

watch(
  [selectedStoreId, selectedMonth, selectedHalf],
  () => {
    void loadBoard();
  },
  { immediate: true },
);

onMounted(() => {
  loadStores().catch(() => undefined);
});

watch(selectedStoreId, () => {
  selectedHelpMembers.value = [];
  helpStoreId.value = null;
  helpMemberId.value = null;
});

const ensureHelpMembers = async (storeId: number): Promise<void> => {
  if (helpMembersCache[storeId]) {
    return;
  }
  loadingHelpMembers.value = true;
  try {
    const month = dayjs(selectedMonth.value).format('YYYY-MM');
    const range = getHalfMonthRange(month, selectedHalf.value);
    const response = await fetchShiftBoard(storeId, {
      startDate: range.startDate,
      endDate: range.endDate,
    });
    const members = (response.users ?? [])
      .filter((member) => member && member.isDeleted !== true)
      .map<HelpMember>((member) => ({
        ...member,
        userId: member.userId ?? member.id ?? '',
        isHelpMember: true,
        helpStoreId: storeId,
        helpStoreName: storeNameMap.value[storeId] ?? '',
      }));
    helpMembersCache[storeId] = members;
  } catch (error) {
    console.error(error);
    message.error('ヘルプメンバーの取得に失敗しました');
  } finally {
    loadingHelpMembers.value = false;
  }
};

watch(helpStoreId, (storeId) => {
  helpMemberId.value = null;
  if (storeId) {
    void ensureHelpMembers(storeId);
  }
});

const createBoardDays = (startDate: string, endDate: string): BoardDay[] => {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const result: BoardDay[] = [];
  for (let cursor = start; cursor.diff(end, 'day') <= 0; cursor = cursor.add(1, 'day')) {
    result.push({
      date: cursor.format('YYYY-MM-DD'),
      label: cursor.format('D日'),
      weekday: cursor.format('dd'),
      isWeekend: cursor.day() === 0 || cursor.day() === 6,
      isPast: cursor.isBefore(today),
      isToday: cursor.isSame(today),
    });
  }
  return result;
};

const boardDays = computed<BoardDay[]>(() => {
  const requirements = Array.isArray(boardData.value?.requirements)
    ? boardData.value!.requirements
    : [];
  const uniqueDates = Array.from(
    new Set(
      requirements
        .map((req) =>
          normalizeDate((req as { date?: string }).date ?? (req as { targetDate?: string }).targetDate),
        )
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  if (uniqueDates.length > 0) {
    return uniqueDates.map((date) => {
      const cursor = dayjs(date);
      return {
        date,
        label: cursor.format('D日'),
        weekday: cursor.format('dd'),
        isWeekend: cursor.day() === 0 || cursor.day() === 6,
        isPast: cursor.isBefore(today),
        isToday: cursor.isSame(today),
      };
    });
  }

  const fallback = buildDateRange();
  return createBoardDays(fallback.startDate, fallback.endDate);
});

const normalizeUserKey = (value: {
  userId?: string | number | null;
  user_id?: string | number | null;
  memberId?: string | number | null;
  member_id?: string | number | null;
  id?: string | number | null;
}): string => {
  const candidates = [
    value.userId,
    (value as { user_id?: string | number | null }).user_id,
    (value as { memberId?: string | number | null }).memberId,
    (value as { member_id?: string | number | null }).member_id,
    value.id,
  ];
  const key = candidates.find((candidate) => candidate !== null && candidate !== undefined);
  return key != null ? String(key) : '';
};

const sortMembers = (members: ShiftBoardMember[]): ShiftBoardMember[] => {
  return [...members].sort((a, b) => {
    const aZoo = a.zooId ? String(a.zooId) : '';
    const bZoo = b.zooId ? String(b.zooId) : '';
    if (aZoo && bZoo && aZoo !== bZoo) {
      return aZoo.localeCompare(bZoo, 'ja');
    }
    return a.name.localeCompare(b.name, 'ja');
  });
};

const baseMembers = computed((): ShiftBoardMember[] => {
  const users = Array.isArray(boardData.value?.users)
    ? boardData.value!.users
    : Array.isArray(boardData.value?.members)
    ? boardData.value!.members!
    : [];
  const activeMembers = users
    .filter((member) => member && member.isDeleted !== true)
    .map((member) => {
      const normalizedId = normalizeUserKey(member);
      const resolvedUserId =
        normalizedId || String(member.userId ?? member.id ?? '');
      return {
        ...member,
        userId: resolvedUserId,
      };
    });
  return sortMembers(activeMembers);
});

const findHelpMemberDetail = (userKey: string): HelpMember | null => {
  const fromSelected = selectedHelpMembers.value.find(
    (member) => resolveMemberKey(member) === userKey,
  );
  if (fromSelected) {
    return fromSelected;
  }
  const storeIds = Object.keys(helpMembersCache);
  for (const rawId of storeIds) {
    const list = helpMembersCache[Number(rawId)] ?? [];
    const found = list.find((member) => resolveMemberKey(member) === userKey);
    if (found) {
      return {
        ...found,
        helpStoreName: found.helpStoreName ?? storeNameMap.value[Number(rawId)] ?? found.helpStoreName,
        isHelpMember: true,
      };
    }
  }
  return null;
};

const memberList = computed(() => {
  const combined: ShiftBoardMember[] = [...baseMembers.value];
  const existingKeys = new Set(combined.map((member) => resolveMemberKey(member)).filter(Boolean));

  selectedHelpMembers.value.forEach((member) => {
    const key = resolveMemberKey(member);
    if (!key || existingKeys.has(key)) {
      return;
    }
    existingKeys.add(key);
    combined.push(member);
  });

  const currentStoreId = boardData.value?.storeId ?? selectedStoreId.value ?? null;
  (boardData.value?.shifts ?? []).forEach((shift) => {
    const shiftStoreId = (shift as { storeId?: number }).storeId ?? currentStoreId;
    if (currentStoreId && shiftStoreId && shiftStoreId !== currentStoreId) {
      return;
    }
    const key = resolveShiftUserKey(shift);
    if (!key || existingKeys.has(key)) {
      return;
    }
    const helpDetail = findHelpMemberDetail(key);
    if (helpDetail) {
      existingKeys.add(key);
      combined.push(helpDetail);
      return;
    }
    existingKeys.add(key);
    combined.push({
      id: key,
      userId: key,
      name: `ヘルプメンバー (${key})`,
      isDeleted: false,
      isHelpMember: true,
    } as HelpMember);
  });

  return sortMembers(combined);
});

const memberDirectory = computed<Record<string, HelpMember>>(() => {
  const map: Record<string, HelpMember> = {};
  memberList.value.forEach((member) => {
    const key = resolveMemberKey(member);
    if (!key) return;
    map[key] = member as HelpMember;
  });
  return map;
});

const resolveMemberKey = (member: ShiftBoardMember): string => {
  return normalizeUserKey(member);
};

const resolveShiftUserKey = (shift: ShiftBoardShift): string => {
  return normalizeUserKey(shift as unknown as {
    userId?: string | number | null;
    user_id?: string | number | null;
    memberId?: string | number | null;
    member_id?: string | number | null;
    id?: string | number | null;
  });
};

const normalizeDate = (value?: string | Date | null): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    if (!value.trim()) return null;
    if (value.includes('T')) {
      return dayjs(value).format('YYYY-MM-DD');
    }
    return value.slice(0, 10);
  }
  if (value instanceof Date) {
    return dayjs(value).format('YYYY-MM-DD');
  }
  return null;
};

const buildDayMembers = (filterType: ShiftBoardShiftType): Record<string, ShiftBoardDayMember[]> => {
  const dayMap: Record<string, ShiftBoardDayMember[]> = {};
  boardDays.value.forEach((day) => {
    dayMap[day.date] = [];
  });

  const shifts = Array.isArray(boardData.value?.shifts) ? boardData.value!.shifts : [];
  shifts.forEach((shift) => {
    if (shift.shiftType !== filterType) {
      return;
    }
    const dateKey = normalizeDate(shift.workDate ?? shift.date);
    if (!dateKey || !dayMap[dateKey]) {
      return;
    }
    const userKey = resolveShiftUserKey(shift);
    if (!userKey) {
      return;
    }
    const meta = memberDirectory.value[userKey];
    dayMap[dateKey]!.push({
      userId: userKey,
      name: meta?.name ?? `メンバー (${userKey})`,
      nickname: meta?.nickname ?? null,
      zooId: meta?.zooId ?? null,
      role: (meta as { role?: string | null })?.role ?? null,
      employmentType: (meta as { employmentType?: string | null })?.employmentType ?? null,
      isHelpMember: (meta as { isHelpMember?: boolean })?.isHelpMember ?? false,
      helpStoreName: (meta as { helpStoreName?: string | null })?.helpStoreName ?? null,
      shift,
    });
  });

  Object.keys(dayMap).forEach((date) => {
    dayMap[date]!.sort((a, b) => {
      const aZoo = a.zooId ? String(a.zooId) : '';
      const bZoo = b.zooId ? String(b.zooId) : '';
      if (aZoo && bZoo && aZoo !== bZoo) {
        return aZoo.localeCompare(bZoo, 'ja');
      }
      return a.name.localeCompare(b.name, 'ja');
    });
  });

  return dayMap;
};

const earlyDayMembers = computed(() => buildDayMembers('EARLY'));
const lateDayMembers = computed(() => buildDayMembers('LATE'));

const requirementMap = computed(() => {
  const result: Record<ShiftBoardShiftType, Record<string, RequirementCell>> = {
    EARLY: {},
    LATE: {},
  };

  const requirements = Array.isArray(boardData.value?.requirements) ? boardData.value!.requirements : [];
  requirements.forEach((req) => {
    const dateKey =
      normalizeDate((req as { date?: string }).date ?? (req as { targetDate?: string }).targetDate) ??
      (req as { date?: string }).date ??
      (req as { targetDate?: string }).targetDate;
    if (!dateKey) return;
    result[req.shiftType][dateKey] = {
      date: dateKey,
      shiftType: req.shiftType,
      requiredStart: req.startRequired,
      requiredEnd: req.endRequired,
      startActual: req.startActual,
      endActual: req.endActual,
      editable: props.isAdmin ? req.editable : false,
    };
  });

  return result;
});

const activeShiftTitle = computed(() =>
  activeShiftType.value === 'EARLY' ? '早番シフト' : '遅番シフト',
);
const activeDayMembers = computed(() =>
  activeShiftType.value === 'EARLY' ? earlyDayMembers.value : lateDayMembers.value,
);
const activeShiftRequirements = computed(() => requirementMap.value[activeShiftType.value]);

const boardEditable = computed(() => boardData.value?.editable ?? true);
const canEditAll = computed(() => props.isAdmin && boardEditable.value);
const allowShiftEdit = computed(() => canEditAll.value);
const isReadOnlyBoard = computed(() => Boolean(boardData.value) && !boardEditable.value);
const helpPanelDisabled = computed(() => !canEditAll.value);

const updateRequirementState = (payload: {
  date: string;
  shiftType: ShiftBoardShiftType;
  requiredStart: number;
  requiredEnd: number;
}) => {
  if (!boardData.value) return;
  const normalizedDate = dayjs(payload.date).format('YYYY-MM-DD');
  const requirements = Array.isArray(boardData.value.requirements) ? [...boardData.value.requirements] : [];
  const index = requirements.findIndex(
    (req) => req.date === normalizedDate && req.shiftType === payload.shiftType,
  );
  if (index >= 0) {
    const prev = requirements[index]!;
    requirements[index] = {
      ...prev,
      date: normalizedDate,
      startRequired: payload.requiredStart,
      endRequired: payload.requiredEnd,
    };
  } else {
    requirements.push({
      date: normalizedDate,
      shiftType: payload.shiftType,
      startRequired: payload.requiredStart,
      endRequired: payload.requiredEnd,
      startActual: 0,
      endActual: 0,
      editable: true,
    });
  }
  boardData.value = {
    ...boardData.value,
    requirements,
  };
};

const handleRequirementUpdate = async (payload: {
  date: string;
  shiftType: ShiftBoardShiftType;
  requiredStart: number;
  requiredEnd: number;
}) => {
  if (!selectedStoreId.value) return;
  if (!canEditAll.value) return;
  requirementSaving.value = true;
  try {
    await updateShiftRequirements(selectedStoreId.value, {
      targetDate: payload.date,
      shiftType: payload.shiftType,
      startRequired: payload.requiredStart,
      endRequired: payload.requiredEnd,
    });
    updateRequirementState(payload);
  } catch (error) {
    console.error(error);
    message.error('必要人数の更新に失敗しました');
  } finally {
    requirementSaving.value = false;
  }
};

const handleCellEdit = (payload: { date: string; userId: string; shift?: ShiftBoardShift | null }) => {
  if (activeBoardStoreId.value == null) {
    message.error('対象店舗を選択できないため編集できません');
    return;
  }
  emit('edit-shift-request', {
    ...payload,
    storeId: activeBoardStoreId.value,
  });
};

const selectableStores = computed(() => storeOptions.value);

const storeSelectOptions = computed(() =>
  selectableStores.value.map((store) => ({
    label: store.storeName,
    value: store.id,
  })),
);
const storeSelectDisabled = computed(
  () => storeSelectOptions.value.length <= 1 || loadingStores.value,
);

watch(
  selectableStores,
  (stores) => {
    if (!stores.length) {
      selectedStoreId.value = null;
      return;
    }
    const hasSelected = stores.some((store) => store.id === selectedStoreId.value);
    if (!hasSelected) {
      selectedStoreId.value = stores[0]!.id;
    }
  },
  { immediate: true },
);

const helpMemberOptions = computed(() => {
  const storeId = helpStoreId.value;
  if (!storeId) return [];
  const members = helpMembersCache[storeId] ?? [];
  return members.map((member: HelpMember) => ({
    label: member.nickname ? `${member.name}（${member.nickname}）` : member.name,
    value: resolveMemberKey(member),
  }));
});

const addHelpMember = (): void => {
  if (!helpStoreId.value || !helpMemberId.value) {
    message.warning('ヘルプ対象を選択してください');
    return;
  }
  const candidates = helpMembersCache[helpStoreId.value] ?? [];
  const candidate = candidates.find(
    (member: HelpMember) => resolveMemberKey(member) === helpMemberId.value,
  );
  if (!candidate) {
    message.error('ヘルプメンバーの情報が見つかりませんでした');
    return;
  }
  const candidateKey = resolveMemberKey(candidate);
  if (!candidateKey) {
    message.error('ヘルプメンバーを追加できませんでした');
    return;
  }
  const alreadyExists =
    selectedHelpMembers.value.some(
      (member: HelpMember) => resolveMemberKey(member) === candidateKey,
    ) ||
    memberList.value.some((member) => resolveMemberKey(member) === candidateKey);
  if (alreadyExists) {
    message.info('選択したメンバーは既に追加されています');
    return;
  }
  selectedHelpMembers.value = [
    ...selectedHelpMembers.value,
    {
      ...candidate,
      isHelpMember: true,
      helpStoreId: helpStoreId.value,
      helpStoreName: storeNameMap.value[helpStoreId.value] ?? candidate.helpStoreName ?? '',
    },
  ];
  helpMemberId.value = null;
};

const removeHelpMember = (userKey: string): void => {
  selectedHelpMembers.value = selectedHelpMembers.value.filter(
    (member: HelpMember) => resolveMemberKey(member) !== userKey,
  );
};

const hasAnyShiftsOnBoard = computed(() => {
  const hasEntries = (collection: Record<string, ShiftBoardDayMember[]>) =>
    Object.values(collection).some((members) => members.length > 0);
  return hasEntries(earlyDayMembers.value) || hasEntries(lateDayMembers.value);
});

const isBoardEmpty = computed(() => !loadingBoard.value && !hasAnyShiftsOnBoard.value);

const refresh = async (): Promise<void> => {
  await loadBoard();
};

defineExpose({ refresh });
</script>

<template>
  <n-card class="shift-board-tab">
    <div class="board-controls">
      <div class="control-group">
        <label>対象店舗</label>
        <n-select
          v-model:value="selectedStoreId"
          :options="storeSelectOptions"
          placeholder="店舗を選択"
          :loading="loadingStores"
          :disabled="storeSelectDisabled"
        />
      </div>
      <div class="control-group">
        <label>対象月</label>
        <n-date-picker
          v-model:value="selectedMonth"
          type="month"
          :actions="null"
          :clearable="false"
        />
      </div>
      <div class="control-group half-selector-wrapper">
        <label>期間</label>
        <HalfMonthSelector v-model="selectedHalf" />
      </div>
      <div class="control-group refresh-group">
        <label>　</label>
        <n-button size="small" @click="refresh" :loading="loadingBoard">再読み込み</n-button>
      </div>
    </div>

    <div v-if="props.isAdmin" class="help-panel">
      <div class="help-panel__title">ヘルプメンバー</div>
      <div class="help-panel__form">
        <n-select
          v-model:value="helpStoreId"
          :options="storeSelectOptions"
          placeholder="ヘルプ元店舗"
          :loading="loadingHelpMembers"
          :disabled="helpPanelDisabled || loadingHelpMembers"
        />
        <n-select
          v-model:value="helpMemberId"
          :options="helpMemberOptions"
          placeholder="ヘルプメンバー"
          :loading="loadingHelpMembers"
          :disabled="helpPanelDisabled || !helpStoreId || loadingHelpMembers || !helpMemberOptions.length"
        />
        <n-button
          size="small"
          type="primary"
          :disabled="helpPanelDisabled || !helpMemberId"
          @click="addHelpMember"
        >
          追加
        </n-button>
      </div>
      <div v-if="selectedHelpMembers.length" class="help-panel__selected">
        <span>追加済み</span>
        <ul>
          <li v-for="member in selectedHelpMembers" :key="resolveMemberKey(member)">
            <span>{{ member.name }}（{{ member.helpStoreName || 'ヘルプ' }}）</span>
            <n-button size="tiny" tertiary @click="removeHelpMember(resolveMemberKey(member))">削除</n-button>
          </li>
        </ul>
      </div>
    </div>

    <n-alert v-if="!props.isAdmin" type="info" class="view-only-alert" :show-icon="false">
      メンバー配置を閲覧できます。編集は管理者のみ可能です。
    </n-alert>
    <n-alert v-else-if="isReadOnlyBoard" type="warning" class="view-only-alert" :show-icon="false">
      この店舗のシフトは閲覧のみです。編集操作は無効化されています。
    </n-alert>

    <n-spin :show="loadingBoard || requirementSaving">
      <div v-if="boardData">
        <div class="shift-toggle">
          <label>表示シフト</label>
          <n-tabs v-model:value="activeShiftType" type="segment" size="small">
            <n-tab-pane
              v-for="option in shiftTabOptions"
              :key="option.value"
              :name="option.value"
              :tab="option.label"
            />
          </n-tabs>
        </div>
        <ShiftBoardTable
          :title="activeShiftTitle"
          :shift-type="activeShiftType"
          :days="boardDays"
          :all-members="memberList"
          :day-members="activeDayMembers"
          :requirements="activeShiftRequirements"
          :allow-shift-edit="allowShiftEdit"
          :can-edit-requirements="canEditAll"
          :is-mobile="isMobileView"
          @edit-shift="handleCellEdit"
          @update-requirement="handleRequirementUpdate"
        />
      </div>
      <div v-else-if="isBoardEmpty" class="empty-board">
        表示できるシフトがありませんでした。
      </div>
    </n-spin>
  </n-card>
</template>

<style scoped>
.shift-board-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.board-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 4px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control-group label {
  font-size: 12px;
  color: #475569;
}

.half-selector-wrapper {
  align-items: flex-start;
}

.refresh-group {
  justify-content: flex-end;
}

.view-only-alert {
  margin-bottom: 12px;
}

.empty-board {
  text-align: center;
  padding: 24px;
  color: #94a3b8;
}

.help-panel {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-panel__title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.help-panel__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  align-items: center;
}

.help-panel__selected ul {
  list-style: none;
  padding: 0;
  margin: 4px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.help-panel__selected li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #e2e8f0;
  font-size: 12px;
}

.shift-toggle {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.shift-toggle label {
  font-size: 12px;
  color: #475569;
}

@media (max-width: 640px) {
  .board-controls {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
}
</style>
