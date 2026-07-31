<script lang="ts">
  export type RuleOutcome = 'positive' | 'neutral' | 'negative' | 'not_evaluable';
  export let ruleId: string;
  export let title: string;
  export let outcome: RuleOutcome;
  export let explanation: string;
  export let fingerprint: string;
</script>

<article data-rule-id={ruleId} data-rule-outcome={outcome}>
  <h3>{title}</h3>
  <p><strong>Outcome:</strong> {outcome.replaceAll('_', ' ')}</p>
  <p>{explanation}</p>
  <p class="fingerprint"><strong>Analysis fingerprint:</strong> <code>{fingerprint}</code></p>
</article>

<style>
  article { border-block-start: 1px solid currentColor; padding-block: .8rem; }
  h3 { margin-block: 0 .4rem; }
  .fingerprint { overflow-wrap: anywhere; }
</style>
