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
  <section bind:this={panel} class="recovery-panel" aria-labelledby="recovery-panel-heading" data-testid="recovery-panel">
    <h2 id="recovery-panel-heading">Recovery options</h2>
    <p><strong>{issue.title}.</strong> {issue.message}</p>
    <p><strong>State:</strong> {issue.pipelineState}</p>
    <p><strong>Blocked:</strong> {issue.blockedOperations.join(', ')}</p>
    <p><strong>Preserved:</strong> {issue.preservedCapabilities.join(', ')}</p>
    <div class="actions" aria-label="Available recovery actions">
      {#each issue.recoveryActions as actionId}
        {@const operation = getRecoveryOperation(actionId)}
        {@const actionLabel = actionId === 'use_last_snapshot' ? 'Recover with last snapshot' : operation.label}
        <bu]Ûˆ\OH˜]ÛˆˆÛ˜ÛXÚÏ^Ê
HOˆÈ›ÚYXÝ]˜]JXÝ[Û’Y
NÈ_O‚ˆØXÝ[Û“X™[BˆØ]Û‚ˆËÙXXÚBˆÙ]‚ˆÛ\ÜÏHœÝ]\Èˆ›ÛOHœÝ]\Èˆ\šXK[]™OHœÛ]Hˆ\šXKX]ÛZXÏHYHžÜÝ]\ÓY\ÜØYÙ_OÜ‚ˆÜÙXÝ[Û‚žËÚYŸB‚Ý[O‚ˆœ™XÛÝ™\žK\[™[È›Ü™\ŽˆœÛÛYÝ\œ™[ÛÛÜŽÈ\Ü^NˆÜšYÈØ\ˆ\™[NÈX\™Ú[Žˆ\™[NÈY[™Îˆ\™[NÈBˆ‹ÈX\™Ú[ŽˆÈBˆ˜XÝ[ÛœÈÈ\Ü^Nˆ›^È›^]Ü˜\ˆÜ˜\ÈØ\ˆÍ\™[NÈBˆ]ÛˆÈZ[‹X›ØÚË\Ú^™Nˆ‹Í\™[NÈBˆœÝ]\Î™[\HÈ\Ü^Nˆ›Û™NÈBÜÝ[O‚