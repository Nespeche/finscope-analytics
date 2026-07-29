<script lang="ts">
  import type { IssuerIdentity } from '../../domain/identity/issuer-resolver';

  export let candidates: readonly IssuerIdentity[] = [];
  export let onSelect: (issuer: IssuerIdentity) => void = () => {};
</script>

<ul aria-label="Issuer candidates" class="candidate-list">
  {#each candidates as candidate (candidate.cik)}
    <li>
      <button
        type="button"
        aria-label={`Select ${candidate.legalName}, CIK ${candidate.cik}`}
        onclick={() => { onSelect(candidate); }}
      >
        <strong>{candidate.legalName}</strong>
        <span>CIK {candidate.cik}</span>
        <span>Profile {candidate.analysisProfile}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .candidate-list {
    display: grid;
    gap: 0.75rem;
    list-style: none;
    margin: 1rem 0 0;
    padding: 0;
  }

  button {
    display: grid;
    gap: 0.25rem;
    inline-size: 100%;
    padding: 0.75rem;
    text-align: start;
  }

  span {
    font-size: 0.9rem;
  }
</style>
