import { mount } from 'svelte';
import App from '$app/App.svelte';

const applicationRoot = document.querySelector<HTMLElement>('#app');

if (applicationRoot === null) {
  throw new Error('FinScope bootstrap failed: #app root was not found.');
}

export const application = mount(App, {
  target: applicationRoot,
});
