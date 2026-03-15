import DefaultTheme from 'vitepress/theme'
import './custom.css'

export default {
  ...DefaultTheme,
  enhanceApp() {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('dark')
    }
  },
}
