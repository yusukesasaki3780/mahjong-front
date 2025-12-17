<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { NButton, NInput, NInputNumber } from 'naive-ui';
import type { ShiftBoardMember, ShiftBoardShift, ShiftBoardShiftType } from '../../../api/shiftBoard';

export interface BoardDay {
  date: string;
  label: string;
  weekday: string;
  isPast: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export interface RequirementCell {
  date: string;
  shiftType: ShiftBoardShiftType;
  requiredStart: number;
  requiredEnd: number;
  startActual: number;
  endActual: number;
  editable: boolean;
}

export interface ShiftBoardDayMember {
  userId: string;
  name: string;
  nickname?: string | null;
  zooId?: string | number | null;
  role?: string | null;
  employmentType?: string | null;
  isHelpMember?: boolean;
  helpStoreName?: string | null;
  shift: ShiftBoardShift;
}

const props = defineProps<{
  title: string;
  shiftType: ShiftBoardShiftType;
  days: BoardDay[];
  allMembers: ShiftBoardMember[];
  dayMembers: Record<string, ShiftBoardDayMember[]>;
  requirements: Record<string, RequirementCell>;
  allowShiftEdit: boolean;
  canEditRequirements: boolean;
  isMobile: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit-shift', payload: { userId: string; date: string; shift?: ShiftBoardShift | null }): void;
  (
    e: 'update-requirement',
    payload: { date: string; shiftType: ShiftBoardShiftType; requiredStart: number; requiredEnd: number },
  ): void;
}>();

type RequirementInputState = Record<
  string,
  {
    requiredStart: number | null;
    requiredEnd: number | null;
  }
>;

const requirementInputs = reactive<RequirementInputState>({});

const getDefaultRequirement = (shiftType: ShiftBoardShiftType, date: string) => {
  const day = dayjs(date).day();
  if (shiftType === 'EARLY') {
    if (day >= 1 && day <= 4) return { start: 3, end: 3 };
    if (day === 5) return { start: 3, end: 4 };
    return { start: 4, end: 4 };
  }
  if (shiftType === 'LATE') {
    if (day >= 1 && day <= 4) return { start: 4, end: 3 };
    if (day === 5 || day === 6) return { start: 5, end: 4 };
    return { start: 4, end: 3 };
  }
  return { start: 0, end: 0 };
};

const requirementInputsClear = () => {
  Object.keys(requirementInputs).forEach((key) => {
    delete requirementInputs[key];
  });
};

const syncRequirementInputs = () => {
  requirementInputsClear();
  props.days.forEach((day) => {
    const value = props.requirements[day.date];
    requirementInputs[day.date] = {
      requiredStart:
        value?.requiredStart ?? getDefaultRequirement(props.shiftType, day.date).start,
      requiredEnd:
        value?.requiredEnd ?? getDefaultRequirement(props.shiftType, day.date).end,
    };
  });
};

watch(
  () => props.requirements,
  () => {
    syncRequirementInputs();
  },
  { immediate: true, deep: true },
);

watch(
  () => props.days.map((day) => day.date),
  () => {
    syncRequirementInputs();
  },
  { immediate: true },
);

const differenceByDate = computed<Record<string, { start: number; end: number }>>(() => {
  const map: Record<string, { start: number; end: number }> = {};
  props.days.forEach((day) => {
    const requirement = props.requirements[day.date];
    const requiredStart =
      requirementInputs[day.date]?.requiredStart ??
      requirement?.requiredStart ??
      getDefaultRequirement(props.shiftType, day.date).start;
    const requiredEnd =
      requirementInputs[day.date]?.requiredEnd ??
      requirement?.requiredEnd ??
      getDefaultRequirement(props.shiftType, day.date).end;
    map[day.date] = {
      start: (requirement?.startActual ?? 0) - requiredStart,
      end: (requirement?.endActual ?? 0) - requiredEnd,
    };
  });
  return map;
});

const differenceClass = (value: number): string => {
  if (value > 0) return 'diff-positive';
  if (value < 0) return 'diff-negative';
  return 'diff-neutral';
};

const resolveMemberKey = (member: { userId?: string | number | null; id?: string | number | null }): string => {
  if (member.userId != null) return String(member.userId);
  if (member.id != null) return String(member.id);
  return '';
};

const formatShiftRange = (shift: ShiftBoardShift | null): string => {
  if (!shift) return '--';
  const start = shift.startTime?.slice(0, 5) ?? '';
  const end = shift.endTime?.slice(0, 5) ?? '';
  if (start && end) {
    return `${start}~${end}`;
  }
  return start || end || '--';
};

const handleRequirementInput = (date: string, field: 'requiredStart' | 'requiredEnd', value: number | null) => {
  if (!props.canEditRequirements) return;
  if (!requirementInputs[date]) {
    requirementInputs[date] = { requiredStart: 0, requiredEnd: 0 };
  }
  requirementInputs[date]![field] = value;
  const payload = requirementInputs[date]!;
  emit('update-requirement', {
    date,
    shiftType: props.shiftType,
    requiredStart: payload.requiredStart ?? 0,
    requiredEnd: payload.requiredEnd ?? 0,
  });
};

const canEditRequirementCell = (date: string): boolean =>
  props.canEditRequirements && Boolean(props.requirements[date]?.editable);

const canEditShiftCell = (date: string): boolean => {
  if (!props.allowShiftEdit) return false;
  const requirement = props.requirements[date];
  return requirement?.editable ?? false;
};

const getRequirement = (date: string): RequirementCell | null => props.requirements[date] ?? null;

const formatDiffValue = (value: number): string => (value >= 0 ? `+${value}` : `${value}`);

const formatRequirementValue = (value: number | null | undefined): string =>
  value == null ? '-' : String(value);

const searchInput = ref('');
const searchQuery = ref('');
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  searchInput,
  (value) => {
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    searchTimer = setTimeout(() => {
      searchQuery.value = value.trim();
    }, 300);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
});

const isSearching = computed(() => Boolean(searchQuery.value.trim().length));

const allMemberItems = computed(() =>
  props.allMembers
    .map((member) => {
      const key = resolveMemberKey(member);
      if (!key) return null;
      return { key, member };
    })
    .filter((item): item is { key: string; member: ShiftBoardMember } => Boolean(item)),
);

const memberMatchesQuery = (
  member: { name?: string; nickname?: string | null; zooId?: string | number | null; helpStoreName?: string | null },
  query: string,
): boolean => {
  if (!query) {
    return true;
  }
  const normalized = query.toLowerCase();
  const candidates = [
    member.name ?? '',
    member.nickname ?? '',
    member.zooId != null ? String(member.zooId) : '',
    member.helpStoreName ?? '',
  ];
  return candidates.some((raw) => raw.toLowerCase().includes(normalized));
};

const searchedMemberKeys = computed(() => {
  const query = searchQuery.value.trim();
  if (!query) {
    return allMemberItems.value.map((item) => item.key);
  }
  return allMemberItems.value
    .filter(({ member }) =>
      memberMatchesQuery(
        {
          name: member.name,
          nickname: member.nickname,
          zooId: member.zooId,
          helpStoreName: (member as { helpStoreName?: string | null }).helpStoreName,
        },
        query,
      ),
    )
    .map((item) => item.key);
});

const expandedDays = reactive<Record<string, boolean>>({});
const memberTabs = reactive<Record<string, 'shifted' | 'listing'>>({});

const syncExpandedDays = () => {
  const dates = props.days.map((day) => day.date);
  const dateSet = new Set(dates);
  dates.forEach((date) => {
    if (expandedDays[date] === undefined) {
      expandedDays[date] = true;
    }
    if (memberTabs[date] === undefined) {
      memberTabs[date] = 'shifted';
    }
  });
  Object.keys(expandedDays).forEach((key) => {
    if (!dateSet.has(key)) {
      delete expandedDays[key];
    }
  });
  Object.keys(memberTabs).forEach((key) => {
    if (!dateSet.has(key)) {
      delete memberTabs[key];
    }
  });
};

watch(
  () => props.days.map((day) => day.date),
  () => {
    syncExpandedDays();
  },
  { immediate: true },
);

interface DayEntry {
  meta: BoardDay;
  requirement: RequirementCell | null;
  diff: { start: number; end: number };
  membersWithShift: ShiftBoardDayMember[];
  membersWithoutShift: ShiftBoardMember[];
}

const dayMemberMap = computed((): Record<string, Record<string, ShiftBoardDayMember>> => {
  const map: Record<string, Record<string, ShiftBoardDayMember>> = {};
  Object.keys(props.dayMembers).forEach((date) => {
    map[date] = {};
    props.dayMembers[date]!.forEach((member) => {
      map[date]![member.userId] = member;
    });
  });
  return map;
});

const allMembersMap = computed<Record<string, ShiftBoardMember>>(() => {
  const map: Record<string, ShiftBoardMember> = {};
  allMemberItems.value.forEach(({ key, member }) => {
    map[key] = member;
  });
  return map;
});

const dayEntries = computed<DayEntry[]>(() =>
  props.days.map((day) => {
    const shiftMap = dayMemberMap.value[day.date] ?? {};
    const baseShiftList = props.dayMembers[day.date] ?? [];
    const withShift = !isSearching.value
      ? baseShiftList
      : baseShiftList.filter((member) =>
          memberMatchesQuery(
            {
              name: member.name,
              nickname: member.nickname,
              zooId: member.zooId,
              helpStoreName: member.helpStoreName,
            },
            searchQuery.value,
          ),
        );

    const shiftKeys = new Set(Object.keys(shiftMap));
    const unassignedKeys = isSearching.value
      ? searchedMemberKeys.value
      : allMemberItems.value.map((item) => item.key);

    const membersWithoutShift = unassignedKeys
      .filter((key) => !shiftKeys.has(key))
      .map((key) => allMembersMap.value[key])
      .filter((member): member is ShiftBoardMember => Boolean(member));

    return {
      meta: day,
      requirement: getRequirement(day.date),
      diff: differenceByDate.value[day.date] ?? { start: 0, end: 0 },
      membersWithShift: withShift,
      membersWithoutShift,
    };
  }),
);

const filteredDayEntries = computed<DayEntry[]>(() => {
  if (!isSearching.value) {
    return dayEntries.value;
  }
  return dayEntries.value.filter(
    (entry) => entry.membersWithShift.length > 0 || entry.membersWithoutShift.length > 0,
  );
});

const hasVisibleEntries = computed(() =>
  filteredDayEntries.value.some(
    (entry) => entry.membersWithShift.length > 0 || entry.membersWithoutShift.length > 0,
  ),
);

const toggleDay = (date: string): void => {
  expandedDays[date] = !expandedDays[date];
};

const setMemberTab = (date: string, tab: 'shifted' | 'listing'): void => {
  memberTabs[date] = tab;
};

const getMemberTab = (date: string): 'shifted' | 'listing' => memberTabs[date] ?? 'shifted';

const handleMemberClick = (date: string, member: ShiftBoardDayMember): void => {
  if (!canEditShiftCell(date)) {
    return;
  }
  emit('edit-shift', {
    userId: member.userId,
    date,
    shift: member.shift,
  });
};

const handleMemberCreate = (date: string, member: ShiftBoardMember): void => {
  if (!canEditShiftCell(date)) {
    return;
  }
  const userId = resolveMemberKey(member);
  if (!userId) return;
  emit('edit-shift', {
    userId,
    date,
    shift: null,
  });
};
</script>

<template>
  <div class="shift-board-table" :class="{ 'mobile-view': props.isMobile }">
    <div class="table-header">
      <h4>{{ title }}</h4>
      <n-input
        v-model:value="searchInput"
        class="member-search"
        size="small"
        clearable
        placeholder="メンバー名で検索"
      />
    </div>

    <div v-if="hasVisibleEntries" class="day-accordion">
      <section
        v-for="entry in filteredDayEntries"
        :key="entry.meta.date"
        class="day-section"
        :class="{ past: entry.meta.isPast }"
      >
        <button type="button" class="day-header" @click="toggleDay(entry.meta.date)">
          <div class="day-header__info">
            <span class="day-label">
              {{ entry.meta.label }}
              <small :class="{ weekend: entry.meta.isWeekend }">{{ entry.meta.weekday }}</small>
            </span>
            <span v-if="entry.meta.isToday" class="today-badge">今日</span>
          </div>
          <div class="day-header__diffs">
            <span class="diff-chip" :class="differenceClass(entry.diff.start)">
              開: {{ formatDiffValue(entry.diff.start) }}
            </span>
            <span class="diff-chip" :class="differenceClass(entry.diff.end)">
              終: {{ formatDiffValue(entry.diff.end) }}
            </span>
          </div>
          <span class="toggle-icon">{{ expandedDays[entry.meta.date] ? '▲' : '▼' }}</span>
        </button>
        <div v-show="expandedDays[entry.meta.date]" class="day-body">
          <div class="requirements-panel">
            <div class="requirement-block">
              <p>開始 必要人数</p>
              <div class="requirement-input">
                <template v-if="canEditRequirementCell(entry.meta.date)">
                  <span class="current-value">
                    現在: {{ requirementInputs[entry.meta.date]?.requiredStart ?? 0 }}
                  </span>
                  <n-input-number
                    size="small"
                    :min="0"
                    :max="99"
                    :value="requirementInputs[entry.meta.date]?.requiredStart ?? 0"
                    @update:value="(val) => handleRequirementInput(entry.meta.date, 'requiredStart', val)"
                  />
                </template>
                <span v-else class="metric-value">
                  {{ formatRequirementValue(requirementInputs[entry.meta.date]?.requiredStart) }}
                </span>
              </div>
            </div>
            <div class="requirement-block">
              <p>終了 必要人数</p>
              <div class="requirement-input">
                <template v-if="canEditRequirementCell(entry.meta.date)">
                  <span class="current-value">
                    現在: {{ requirementInputs[entry.meta.date]?.requiredEnd ?? 0 }}
                  </span>
                  <n-input-number
                    size="small"
                    :min="0"
                    :max="99"
                    :value="requirementInputs[entry.meta.date]?.requiredEnd ?? 0"
                    @update:value="(val) => handleRequirementInput(entry.meta.date, 'requiredEnd', val)"
                  />
                </template>
                <span v-else class="metric-value">
                  {{ formatRequirementValue(requirementInputs[entry.meta.date]?.requiredEnd) }}
                </span>
              </div>
            </div>
            <div class="requirement-block actuals">
              <p>実人数</p>
              <div class="difference-stack">
                <div class="difference-entry">
                  <small>開店</small>
                  <span class="metric-chip metric-chip--muted">
                    {{ formatRequirementValue(getRequirement(entry.meta.date)?.startActual) }}
                  </span>
                </div>
                <div class="difference-entry">
                  <small>閉店</small>
                  <span class="metric-chip metric-chip--muted">
                    {{ formatRequirementValue(getRequirement(entry.meta.date)?.endActual) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="members-panel">
            <div class="member-tabs">
              <button
                type="button"
                :class="['member-tab', { active: getMemberTab(entry.meta.date) === 'shifted' }]"
                @click="setMemberTab(entry.meta.date, 'shifted')"
              >
                シフト中
              </button>
              <button
                type="button"
                :class="['member-tab', { active: getMemberTab(entry.meta.date) === 'listing' }]"
                @click="setMemberTab(entry.meta.date, 'listing')"
              >
                メンバー一覧
              </button>
            </div>

            <div v-if="getMemberTab(entry.meta.date) === 'shifted'" class="member-tab-content">
              <template v-if="entry.membersWithShift.length">
                <div
                  v-for="member in entry.membersWithShift"
                  :key="`${entry.meta.date}-${member.userId}-${member.shift.id}`"
                  class="member-pill"
                  :class="{ clickable: canEditShiftCell(entry.meta.date) }"
                  @click="handleMemberClick(entry.meta.date, member)"
                >
                  <div class="member-pill__info">
                    <div class="member-name-line">
                      <strong>{{ member.name }}</strong>
                      <small v-if="member.nickname" class="nickname">({{ member.nickname }})</small>
                      <span v-if="member.isHelpMember" class="help-tag">ヘルプ</span>
                    </div>
                    <small class="zoo">Zoo ID: {{ member.zooId ?? '--' }}</small>
                    <small v-if="member.helpStoreName" class="help-store">{{ member.helpStoreName }}</small>
                  </div>
                  <div class="member-pill__time">
                    {{ formatShiftRange(member.shift) }}
                  </div>
                </div>
              </template>
              <p v-else class="members-empty">この日に登録されたシフトはありません</p>
            </div>

            <div v-else class="member-tab-content">
              <template v-if="entry.membersWithoutShift.length">
                <div
                  v-for="member in entry.membersWithoutShift"
                  :key="`${entry.meta.date}-${resolveMemberKey(member)}`"
                  class="member-pill member-pill--empty"
                >
                  <div class="member-pill__info">
                    <div class="member-name-line">
                      <strong>{{ member.name }}</strong>
                      <small v-if="member.nickname" class="nickname">({{ member.nickname }})</small>
                    </div>
                    <small class="zoo">Zoo ID: {{ member.zooId ?? '--' }}</small>
                    <span class="missing-label">未登録</span>
                  </div>
                  <div class="member-pill__actions">
                    <n-button
                      size="tiny"
                      secondary
                      :disabled="!canEditShiftCell(entry.meta.date)"
                      @click="handleMemberCreate(entry.meta.date, member)"
                    >
                      ＋追加
                    </n-button>
                  </div>
                </div>
              </template>
              <p v-else class="members-empty">この日に未登録のメンバーはいません</p>
            </div>
          </div>
        </div>
      </section>
    </div>
    <p v-else class="empty-board">
      {{ isSearching ? '検索条件に一致するメンバーが見つかりません。' : '表示できるシフトがありません。' }}
    </p>
  </div>
</template>

<style scoped>
.shift-board-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.table-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.member-search :deep(.n-input) {
  width: 100%;
}

.day-accordion {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.day-section {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.day-section.past {
  opacity: 0.92;
}

.day-header {
  width: 100%;
  border: none;
  background: #f8fafc;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.day-header__info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.day-label {
  font-weight: 600;
  color: #0f172a;
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.day-label small {
  color: #94a3b8;
}

.day-label small.weekend {
  color: #ea580c;
}

.today-badge {
  font-size: 11px;
  color: #155e75;
  background: #cffafe;
  padding: 2px 6px;
  border-radius: 999px;
  font-weight: 600;
}

.day-header__diffs {
  display: flex;
  gap: 6px;
}

.diff-chip {
  min-width: 64px;
  text-align: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 13px;
}

.toggle-icon {
  font-size: 12px;
  color: #475569;
}

.day-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.requirements-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.requirement-block {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #475569;
}

.requirement-block.actuals {
  align-items: center;
}

.requirement-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.requirement-input :deep(.n-input-number) {
  width: 100%;
}

.metric-value {
  font-weight: 600;
  font-size: 16px;
  color: #0f172a;
}

.current-value {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}

.metric-chip {
  display: inline-flex;
  min-width: 48px;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}

.metric-chip--muted {
  background: #e2e8f0;
  color: #334155;
}

.diff-positive {
  background: #dcfce7;
  color: #15803d;
}

.diff-negative {
  background: #fee2e2;
  color: #b91c1c;
}

.diff-neutral {
  background: #e2e8f0;
  color: #475569;
}

.difference-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.difference-entry {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.difference-entry small {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
}

.members-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-tabs {
  display: inline-flex;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
  align-self: flex-start;
}

.member-tab {
  border: none;
  padding: 6px 14px;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
}

.member-tab.active {
  background: #1d4ed8;
  color: #fff;
}

.member-tab-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-pill {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 12px;
  background: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.member-pill.clickable {
  cursor: pointer;
}

.member-pill--empty {
  background: #f8fafc;
  border-style: dashed;
}

.member-pill__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.member-name-line {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.nickname {
  color: #94a3b8;
}

.help-tag {
  padding: 2px 6px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 11px;
  font-weight: 600;
}

.zoo,
.help-store {
  font-size: 12px;
  color: #94a3b8;
}

.member-pill__time {
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
}

.member-pill__actions {
  display: flex;
  align-items: center;
}

.missing-label {
  display: inline-flex;
  align-self: flex-start;
  margin-top: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #475569;
  font-size: 11px;
  font-weight: 600;
}

.empty-board {
  text-align: center;
  padding: 24px 0;
  color: #94a3b8;
}

@media (min-width: 768px) {
  .table-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .member-search {
    max-width: 240px;
  }
}
</style>
