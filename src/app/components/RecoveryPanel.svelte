<script module lang="ts">
  import type { AppPlacement } from '../composition';

  export const componentId = 'recovery-panel';
  export const appPlacement: AppPlacement = 'recovery';
  export const order = 30;
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    getRecoveryIssue,
    getRecoveryOperation,
    issueCodeFromText,
    parseRecoveryIssueDetail,
    repositoryCorruptionIssue,
    type RecoveryIssueDescriptor,
  } from '../recovery/recovery-actions';

  let issue: RecoveryIssueDescriptor | undefined;
  let statusMessage = '';
  let panel: HTMLElement | undefined;

  $: issueDescriptionId = issue === undefined ? undefined : `recovery-${issue.code.toLocaleLowerCase('en-US').replaceAll('_', '-')}-description`;

  function inspectVisibleIssues(): void {
    if (document.querySelector('[data-testid="corruption-recovery"]') !== null) {
      issue = repositoryCorruptionIssue;
      return;
    }
    const alerts = [...document.querySelectorAll('[role="alert"]')]
      .filter((element) => !panel?.contains(element));
    for (const alert of alerts.reverse()) {
      const code = issueCodeFromText(alert.textContent ?? '');
      const next = code === undefined ? undefined : getRecoveryIssue(code);
      if (next !== undefined) {
        issue = Object.freeze({ ...next, message: alert.textContent?.trim() || next.message });
        return;
      }
    }
    if (issue?.source !== 'repository') issue = undefined;
  }

  function handleIssueEvent(event: Event): void {
    if (!(event instanceof CustomEvent)) return;
    const next = parseRecoveryIssueDetail(event.detail);
    if (next !== undefined) issue = next;
  }

  async function activate(actionId: string): Promise<void> {
    const operation = getRecoveryOperation(actionId);
    const navButton = [...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Primary navigation"] button')]
      .find((button) => button.textContent?.trim() === operation.routeLabel);
    navButton?.click();
    if (operation.eventName !== undefined) {
      window.dispatchEvent(new CustomEvent(operation.eventName, { detail: { actionId } }));
    }
    await tick();
    const target = operation.targetSelector === undefined
      ? document.querySelector<HTMLElement>('main h1, main h2, main')
      : document.querySelector<HTMLElement>(operation.targetSelector);
    if (target !== null && target !== undefined) {
      if (!target.matches('a, button, input, select, textarea, summary, [tabindex]')) target.tabIndex = -1;
      target.focus();
      target.scrollIntoView({ block: 'nearest' });
    }
    statusMessage = `${operation.label} is available in ${operation.routeLabel}.`;
  }

  onMount(() => {
    inspectVisibleIssues();
    const observer = new MutationObserver(inspectVisibleIssues);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('finscope:recovery-issue', handleIssueEvent);
    return () => {
      observer.disconnect();
      window.removeEventListener('finscope:recovery-issue', handleIssueEvent);
    };
  });
</script>

{#if issue}
  <section bind:this={panel} class="recovery-panel" aria-labelledby="recovery-panel-heading" aria-describedby={issueDescriptionId} data-testid="recovery-panel">
    <h2 id="recovery-panel-heading">Recovery options</h2>
    <p id={issueDescriptionId}><strong>{issue.title}.</strong> {issue.message}</p>
    <p><strong>State:</strong> {issue.pipelineState}</p>
    <p><strong>Blocked:</strong> {issue.blockedOperations.join(', ')}</p>
    <p><strong>Preserved:</strong> {issue.preservedCapabilities.join(', ')}</p>
    <div class="actions" aria-label={`Available recovery actions for ${issue.title}`} aria-describedby={issueDescriptionId}>
      {#each issue.recoveryActions as actionId}
        {@const operation = getRecoveryOperation(actionId)}
        <button type="button" aria-label={`${actionId === 'use_last_snapshot' ? 'Recover with last snapshot' : operation.label} for ${issue.title}`} aria-describedby={issueDescriptionId} onclick={() => { void activate(actionId); }}>
          {actionId === 'use_last_snapshot' ? 'Recover with last snapshot' : operation.label}
        </button>
      {/each}
    </div>
    <p class="status" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</p>
  </section>
{/if}

<style>
  .recovery-panel { border: 2px solid currentColor; display: grid; gap: 0.5rem; margin: 1rem; padding: 1rem; }
  h2, p { margin: 0; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  button { min-block-size: 2.75rem; }
  .status:empty { display: none; }
</style>
