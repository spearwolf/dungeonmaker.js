// SPDX-License-Identifier: GPL-3.0-or-later
// tsc does not check single-file components (there is no vue-tsc); it only needs to know that
// importing one yields a component.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent;
  export default component;
}
