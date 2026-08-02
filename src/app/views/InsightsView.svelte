<script module lang="ts">
  import type { RouteDefinition } from '../composition';

  export const routeDefinition = {
    id: 'insights',
    label: 'Insights',
    order: 60,
    requiredCapabilities: ['insights', 'synthesis', 'evidence'],
  } as const satisfies RouteDefinition;
</script>

<script lang="ts">
  import InsightRuleResult from '../components/InsightRuleResult.svelte';

  type RuleOutcome = 'positive' | 'neutral' | 'negative' | 'not_evaluable';
  const fingerprint = 'analysis-3ef1294ac4e87df48d4eb90561f1d047';
  const rules: readonly { id: string; title: string; outcome: RuleOutcome; explanation: string }[] = [
    { id: 'R01', title: 'Revenue trend', outcome: 'positive', explanation: 'Reported revenue increased across comparable periods.' },
    { id: 'R02', title: 'Gross margin', outcome: 'neutral', explanation: 'Margin remains within the historical range.' },
    { id: 'R03', title: 'Operating margin', outcome: 'positive', explanation: 'Operating efficiency improved.' },
    { id: 'R04', title: 'Net margin', outcome: 'neutral', explanation: 'Net margin is stable.' },
    { id: 'R05', title: 'Free cash flow', outcome: 'positive', explanation: 'Free cash flow remains positive.' },
    { id: 'R06', title: 'Leverage', outcome: 'not_evaluable', explanation: 'Debt classification is incomplete.' },
    { id: 'R07', title: 'Liquidity', outcome: 'neutral', explanation: 'Short-term coverage is adequate.' },
    { id: 'R08', title: 'Return on assets', outcome: 'positive', explanation: 'Asset returns improved.' },
    { id: 'R09', title: 'Return on equity', outcome: 'not_evaluable', explanation: 'Non-positive equity prevents meaningful evaluation.' },
  ];
</script>

<section aria-labelledby="insights-heading" aria-describedby="insights-disclosure">
  <p class="eyebrow">Descriptive analysis only</p>
  <h1 id="insights-heading">Rule outcomes and synthesis</h1>
  <p id="insights-disclosure" class="disclosure"><strong>Not investment advice.</strong> These deterministic observations are descriptive and are not personalized. They do not provide a recommendation, target price or confidence score, and they are not a forecast or suitability assessment.</p>
  <p><strong>Active context:</strong> Apple Inc.; CIK 0000320193; FY 2025; profile us-gaap-industrial-v1; snapshot fundamental-snapshot-0000320193-fy2025.</p>
  <p>Shared analysis fingerprint: <code>{fingerprint}</code></p>

  <section aria-labelledby="rule-outcomes-heading">
    <h2 id="rule-outcomes-heading">Nine rule outcomes</h2>
    <p>Each outcome is written explicitly as positive, neutral, negative or not evaluable; visual styling is supplementary.</p>
    {#each rules as rule (rule.id)}
      <InsightRuleResult ruleId={rule.id} title={rule.title} outcome={rule.outcome} explanation={rule.explanation} {fingerprint} />
    {/each}
  </section>

  <aside aria-labelledby="synthesis-heading">
    <h2 id="synthesis-heading">Synthesis: mixed with limitations</h2>
    <p>Several operating and cash-flow signals are positive, while leverage and return-on-equity remain not evaluable.</p>
    <h3>Limitations</h3>
    <ul>
      <li>Debt classification is incomplete.</li>
      <li>Non-positive equity prevents one ratio from being evaluated.</li>
      <li>Price data is intentionally excluded.</li>
    </ul>
  </aside>
</section>

<style>
  section { max-inline-size: 70rem; }
  .eyebrow { font-weight: 700; text-transform: uppercase; }
  .disclosure, aside { border-inline-start: 0.3rem solid currentColor; padding-inline-start: 1rem; }
  code { overflow-wrap: anywhere; }
</style>
