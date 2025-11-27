<script setup lang="ts">
import { reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  useMessage,
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  type FormInst,
  type FormRules,
} from 'naive-ui';
import { login, type LoginRequest } from '../api/auth';
import { isApiClientError } from '../api/axios';

const router = useRouter();
const route = useRoute();
const message = useMessage();
const formRef = ref<FormInst | null>(null);
const loading = ref(false);

const TEXT = {
  emailLabel: '\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9',
  emailRequired: '\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044',
  emailFormat: '\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u306e\u5f62\u5f0f\u304c\u6b63\u3057\u304f\u3042\u308a\u307e\u305b\u3093',
  passwordLabel: '\u30d1\u30b9\u30ef\u30fc\u30c9',
  passwordRequired: '\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044',
  cardTitle: 'ZOO\u30e1\u30f3\u30d0\u30fc\u7528\u30ed\u30b0\u30a4\u30f3',
  loginSuccess: '\u30ed\u30b0\u30a4\u30f3\u3057\u307e\u3057\u305f',
  loginFailure: '\u30ed\u30b0\u30a4\u30f3\u306b\u5931\u6557\u3057\u307e\u3057\u305f',
  login: '\u30ed\u30b0\u30a4\u30f3',
  signupLink: '\u30a2\u30ab\u30a6\u30f3\u30c8\u3092\u304a\u6301\u3061\u3067\u306a\u3044\u65b9\u306f\u3053\u3061\u3089\uff08\u65b0\u898f\u767b\u9332\uff09',
} as const;

const formValue = reactive<LoginRequest>({
  email: '',
  password: '',
});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rules: FormRules = {
  email: [
    { required: true, message: TEXT.emailRequired, trigger: ['blur', 'input'] },
    {
      validator: (_rule, value: string) =>
        emailRegex.test(value)
          ? Promise.resolve()
          : Promise.reject(TEXT.emailFormat),
      trigger: ['blur', 'input'],
    },
  ],
  password: [{ required: true, message: TEXT.passwordRequired, trigger: 'blur' }],
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  loading.value = true;
  try {
    const response = await login({ ...formValue });
    const savedUserId = response.user?.id ?? response.userId;
    console.log('[Login] savedUserId', savedUserId);
    message.success(TEXT.loginSuccess);

    const redirectPath = (route.query.redirect as string | undefined) ?? '/dashboard';
    router.push(redirectPath || '/dashboard');
  } catch (error) {
    if (isApiClientError(error)) {
      message.error(error.message);
    } else {
      message.error(TEXT.loginFailure);
    }
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="auth-page">
    <n-card class="auth-card" :title="TEXT.cardTitle">
      <n-form ref="formRef" :model="formValue" :rules="rules" label-placement="top" size="large">
        <n-form-item :label="TEXT.emailLabel" path="email">
          <n-input v-model:value="formValue.email" placeholder="example@mahjong-zoo.jp" />
        </n-form-item>

        <n-form-item :label="TEXT.passwordLabel" path="password">
          <n-input
            v-model:value="formValue.password"
            type="password"
            placeholder="********"
            show-password-on="mousedown"
          />
        </n-form-item>

        <div class="actions">
          <n-button
            type="primary"
            block
            size="large"
            :loading="loading"
            data-testid="button-login"
            @click="handleSubmit"
          >
            {{ TEXT.login }}
          </n-button>

          <div class="auth-switch">
            <RouterLink class="auth-link" to="/register" data-testid="link-register">
              {{ TEXT.signupLink }}
            </RouterLink>
          </div>
        </div>
      </n-form>
    </n-card>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, #f5f6fa, #edf2ff);
}

.auth-card {
  width: 420px;
  max-width: 100%;
  border-radius: 16px;
  box-shadow: 0 15px 30px rgba(15, 23, 42, 0.15);
}

.actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-switch {
  text-align: center;
}

.auth-link {
  font-size: 0.9rem;
  color: #10b981;
  text-decoration: none;
  transition: opacity 0.2s ease, text-decoration 0.2s ease;
}

.auth-link:hover {
  opacity: 0.85;
  text-decoration: underline;
}

@media (max-width: 480px) {
  .auth-page {
    padding: 16px;
  }
  .auth-card {
    width: 100%;
    padding: 8px;
  }
}
</style>
