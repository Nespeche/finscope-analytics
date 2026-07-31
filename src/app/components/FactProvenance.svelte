<script lang="ts">
  export let concept: string;
  export let accession: string;
  export let sourceUnit: string;
  export let normalizedUnit: string;
  export let scale: string;
  export let sign: string;
  export let mapping: string;
  export let confidence: string;
  export let quality: string;
</script>

<dl aria-label={`Provenance for ${concept}`}>
  <div><dt>Concept</dt><dd>{concept}</dd></div>
  <div><dt>Accession</dt><dd><code>{accession}</code></dd></div>
  <div><dt>Unit</dt><dd>{sourceUnit} → {normalizedUnit}</dd></div>
  <div><dt>Scale</dt><dd>{scale}</dd></div>
  <div><dt>Sign</dt><dd>{sign}</dd></div>
  <div><dt>Mapping</dt><dd>{mapping}</dd></div>
  <div><dt>Confidence</dt><dd>{confidence}</dd></div>
  <div><dt>Quality</dt><dd>{quality}</dd></div>
</dl>

<style>
  dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .75rem; margin: 0; }
  div { border-inline-start: .2rem solid currentColor; padding-inline-start: .6rem; }
  dt { font-weight: 700; }
  dd { margin: .2rem 0 0; overflow-wrap: anywhere; }
</style>
