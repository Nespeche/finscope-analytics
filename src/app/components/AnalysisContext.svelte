<script module lang="ts">
  import type { AppPlacement } from '../composition';

  export const componentId = 'analysis-context';
  export const appPlacement: AppPlacement = 'header';
  export const order = 20;
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  interface AnalysisContextState {
    readonly legalName: string;
    readonly cik: string;
    readonly profile: string;
    readonly period: string;
    readonly snapshot: string;
  }

  const storageKey = 'finscope.analysis-context.v1';
  const emptyContext: AnalysisContextState = Object.freeze({
    legalName: 'Not selected',
    cik: 'Not selected',
    profile: 'Not selected',
    period: 'Not selected',
    snapshot: 'No local snapshot',
  });

  let context = emptyContext;

  function isContext(value: unknown): value is AnalysisContextState {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const record = value as Readonly<Record<string, unknown>>;
    return ['legalName', 'cik', 'profile', 'period', 'snapshot']
      .every((key) => typeof record[key] === 'string' && (record[key] as string).trim().length > 0);
  }

  function readDefinitionList(container: Element): AnalysisContextState | undefined {
    const values = new Map<string, string>();
    for (const row of container.querySelectorAll('dl > div')) {
      const term = row.querySelector('dt')?.textContent?.trim();
      const definition = row.querySelector('dd')?.textContent?.trim();
      if (term !== undefined && definition !== undefined) values.set(term, definition);
    }
    const legalName = values.get('Legal name');
    const cik = values.get('CIK');
    const profile = values.get('Profile');
    if (legalName === undefined || cik === undefined || profile === undefined) return undefined;
    return Object.freeze({
      legalName,
      cik,
      profile,
      period: values.get('Period') ?? context.period,
      snapshot: values.get('Snapshot') ?? context.snapshot,
    });
  }

  function persist(next: AnalysisContextState): void {
    context = next;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // The visible context remains available when session storage is unavailable.
    }
  }

  function updateFromExplicitIssuerSelection(): void {
    const heading = document.querySelector('#issuer-context-heading');
    const container = heading?.closest('aside');
    if (container === null || container === undefined) return;
    const next = readDefinitionList(container);
    if (next !== undefined && (next.cik !== context.cik || next.legalName !== context.legalName)) {
      persist(next);
    }
  }

  function handleContextEvent(event: Event): void {
    if (!(event instanceof CustomEvent) || !isContext(event.detail)) return;
    persist(Object.freeze({ ...event.detail }));
  }

  onMount(() => {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored !== null) {
        const parsed: unknown = JSON.parse(stored);
        if (isContext(parsed)) context = Object.freeze({ ...parsed });
      }
    } catch {
      context = emptyContext;
    }

    updateFromExplicitIssuerSelection();
    const observer = new MutationObserver(() => {
      updateFromExplicitIssuerSelection();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('finscope:analysis-context-changed', handleContextEvent);
    return () => {
      observer.disconnect();
      window.removeEventListener('finscope:analysis-context-changed', handleContextEvent);
    };
  });
</script>

<section class="analysis-context" aria-labelledby="analysis-context-heading" data-testid="analysis-context">
  <h2 id="analysis-context-heading">Active analysis context</h2>
  <dl>
    <div><dt>Issuer</dt><dd data-testid="context-issuer">{context.legalName}</dd></div>
    <div><dt>CIK</dt><dd data-testid="context-cik">{context.cik}</dd></div>
    <div><dt>Period</dt><dd data-testid="context-period">{context.period}</dd></div>
    <div><dt>Profile</dt><dd data-testid="context-profile">{context.profile}</dd></div>
    <div><dt>Snapshot</dt><dd data-testid="context-snapshot">{context.snapshot}</dd></div>
  </dl>
</section>

<style>
  .analysis-context {
    border-block-start: 1px solid currentColor;
    margin-block-start: 0.75rem;
    padding-block-start: 0.75rem;
  }
  h2 { font-size: 1rem; margin: 0; }
  dl { display: flex; flex-wrap: wrap; gap: 0.35rem 1rem; margin-block: 0.5rem 0; }
  dl div { display: flex; flex: 1 1 12rem; gap: 0.35rem; min-inline-size: 0; }
  dt { font-weight: 700; }
  dd { margin: 0; overflow-wrap: anywhere; }
</style>
