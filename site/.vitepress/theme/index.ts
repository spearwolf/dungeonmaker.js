// SPDX-License-Identifier: GPL-3.0-or-later
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import Playground from '../../components/Playground.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  // Global components are registered here by the tasks that add them.
  enhanceApp({ app }) {
    app.component('Playground', Playground);
  },
} satisfies Theme;
