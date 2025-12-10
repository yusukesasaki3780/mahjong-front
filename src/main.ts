import { createApp } from 'vue'
import App from './App.vue'
import naive from 'naive-ui'
import router from './router'
import { pinia } from './stores/pinia'

const app = createApp(App)

app.use(pinia)
app.use(naive)
app.use(router)

app.mount('#app')
