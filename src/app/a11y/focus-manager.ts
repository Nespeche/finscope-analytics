import type { AppPluginCleanup, AppPluginContext } from '../composition';

export const pluginId = 'focus-manager';
export const order = 30;

const installedDocuments = new WeakSet<Document>();

function asFocusable(element: Element | null): HTMLElement | undefined {
  return element instanceof HTMLElement ? element : undefined;
}

function focusTarget(target: HTMLElement | undefined): void {
  if (target === undefined || !target.isConnected) return;
  if (!target.matches('a, button, input, select, textarea, summary, [tabindex]')) {
    target.tabIndex = -1;
  }
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export function installAppPlugin({ document, window }: AppPluginContext): AppPluginCleanup {
  if (installedDocuments.has(document)) return () => {};
  installedDocuments.add(document);

  let dialogInvoker: HTMLElement | undefined;
  const clickHandler = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    const navButton = target?.closest('nav[aria-label="Primary navigation"] button');
    if (navButton !== null && navButton !== undefined) {
      window.requestAnimationFrame(() => focusTarget(asFocusable(document.querySelector('main'))));
    }
    const dialogTrigger = target?.closest<HTMLElement>('button, input, label');
    if (
      dialogTrigger !== null
      && dialogTrigger !== undefined
      && dialogTrigger.closest('dialog') === null
    ) dialogInvoker = dialogTrigger;
  };

  const closeHandler = (event: Event): void => {
    if (!(event.target instanceof HTMLDialogElement)) return;
    const invoker = dialogInvoker;
    dialogInvoker = undefined;
    window.queueMicrotask(() => {
      if (document.activeElement === document.body || document.activeElement === null) focusTarget(invoker);
    });
  };

  const focusRequestHandler = (event: Event): void => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== 'object' || event.detail === null) return;
    const selector = (event.detail as Readonly<Record<string, unknown>>).selector;
    if (typeof selector === 'string') focusTarget(asFocusable(document.querySelector(selector)));
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const candidates: Element[] = [];
      if (record.target instanceof Element) candidates.push(record.target);
      else if (record.target.parentElement !== null) candidates.push(record.target.parentElement);
      for (const node of record.addedNodes) {
        if (node instanceof Element) candidates.push(node);
      }
      for (const candidate of candidates) {
        const alert = candidate.matches('[role="alert"]')
          ? candidate
          : candidate.querySelector('[role="alert"]');
        if (alert === null || alert.closest('[data-testid="a11y-assertive-announcer"]') !== null) continue;
        const text = alert.textContent?.toLowerCase() ?? '';
        if (text.includes('cancel')) {
          window.requestAnimationFrame(() => focusTarget(asFocusable(document.querySelector('[aria-label="Refresh recovery actions"] button'))));
        } else {
          window.requestAnimationFrame(() => focusTarget(asFocusable(alert)));
        }
        return;
      }
    }
  });

  document.addEventListener('click', clickHandler, true);
  document.addEventListener('close', closeHandler, true);
  window.addEventListener('finscope:focus-request', focusRequestHandler);
  observer.observe(document.body, { attributes: true, childList: true, subtree: true, characterData: true, attributeFilter: ['role'] });

  return () => {
    document.removeEventListener('click', clickHandler, true);
    document.removeEventListener('close', closeHandler, true);
    window.removeEventListener('finscope:focus-request', focusRequestHandler);
    observer.disconnect();
    installedDocuments.delete(document);
  };
}
