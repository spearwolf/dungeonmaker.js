// SPDX-License-Identifier: GPL-3.0-or-later
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import DesignEditor from '../../components/DesignEditor.vue';
import Playground from '../../components/Playground.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  // Global components are registered here by the tasks that add them.
  enhanceApp({ app }) {
    app.component('Playground', Playground);
    app.component('DesignEditor', DesignEditor);
  },
} satisfies Theme;
