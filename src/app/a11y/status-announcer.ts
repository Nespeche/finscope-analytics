import { refreshRuntime, type RefreshPipelineState } from '../lifecycle/resume-refresh';
import type { AppPluginCleanup, AppPluginContext } from '../composition';

export const pluginId = 'status-announcer';
export const order = 40;

const installedDocuments = new WeakSet<Document>();
const busyStates = new Set<RefreshPipelineState>(['checking', 'acquiring', 'normalizing', 'analyzing']);
const disabledStates = new Set<RefreshPipelineState>(['failed', 'cancelled']);

function createAnnouncer(document: Document, role: 'status' | 'alert', testId: string): HTMLElement {
  const existing = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (existing !== null) return existing;
  const element = document.createElement('div');
  element.dataset['testid'] = testId;
  element.dataset['a11yAnnouncer'] = 'true';
  element.setAttribute('role', role);
  element.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
  element.setAttribute('aria-atomic', 'true');
  element.className = 'visually-hidden';
  document.body.append(element);
  return element;
}

function applyPipelineSemantics(control: HTMLElement, state: RefreshPipelineState): void {
  if (busyStates.has(state)) control.setAttribute('aria-busy', 'true');
  else control.removeAttribute('aria-busy');
  if (disabledStates.has(state)) control.setAttribute('aria-disabled', 'true');
  else control.removeAttribute('aria-disabled');
}

export function installAppPlugin({ document, window }: AppPluginContext): AppPluginCleanup {
  if (installedDocuments.has(document)) return () => {};
  installedDocuments.add(document);

  const polite = createAnnouncer(document, 'status', 'a11y-polite-announcer');
  const assertive = createAnnouncer(document, 'alert', 'a11y-assertive-announcer');
  let lastPolite = '';
  let lastAssertive = '';

  const announce = (message: string, urgent = false): void => {
    const normalized = message.replace(/\s+/gu, ' ').trim();
    if (normalized.length === 0) return;
    if (urgent) {
      if (normalized === lastAssertive) return;
      lastAssertive = normalized;
      assertive.textContent = normalized;
    } else {
      if (normalized === lastPolite) return;
      lastPolite = normalized;
      polite.textContent = normalized;
    }
  };

  const unsubscribe = refreshRuntime.subscribe((snapshot) => {
    const control = document.querySelector<HTMLElement>('[data-testid="refresh-fundamentals-button"]');
    if (control !== null) applyPipelineSemantics(control, snapshot.state);
    announce(snapshot.statusMessage, snapshot.state === 'failed' || snapshot.state === 'cancelled');
  });

  const pipelineHandler = (event: Event): void => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== 'object' || event.detail === null) return;
    const detail = event.detail as Readonly<Record<string, unknown>>;
    const state = detail.state;
    const message = detail.message;
    const controlSelector = detail.controlSelector;
    if (typeof state !== 'string' || ![
      'idle', 'checking', 'acquiring', 'normalizing', 'analyzing', 'ready', 'partial', 'failed', 'cancelled',
    ].includes(state)) return;
    if (typeof controlSelector === 'string') {
      const control = document.querySelector<HTMLElement>(controlSelector);
      if (control !== null) applyPipelineSemantics(control, state as RefreshPipelineState);
    }
    if (typeof message === 'string') announce(message, state === 'failed' || state === 'cancelled');
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      const region = target?.closest<HTMLElement>('[role="status"], [role="alert"]');
      if (region === null || region === undefined || region.dataset['a11yAnnouncer'] === 'true') continue;
      announce(region.textContent ?? '', region.getAttribute('role') === 'alert');
    }
  });

  window.addEventListener('finscope:pipeline-state', pipelineHandler);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  return () => {
    unsubscribe();
    window.removeEventListener('finscope:pipeline-state', pipelineHandler);
    observer.disconnect();
    polite.remove();
    assertive.remove();
    installedDocuments.delete(document);
  };
}
