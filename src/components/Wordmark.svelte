<script>
  import { wordmark } from "../wordmark.js";
</script>

<!-- Decorative: the brand link carries the "Last Layer" name as text. -->
<svg class="wordmark" viewBox={wordmark.viewBox} aria-hidden="true">
  <defs>
    <linearGradient
      id="wordmark-fill"
      gradientUnits="userSpaceOnUse"
      x1="0"
      y1="-3"
      x2="0"
      y2="44"
    >
      <stop offset="0" style="stop-color: var(--brand-top)" />
      <stop offset="1" style="stop-color: var(--brand-bottom)" />
    </linearGradient>
    <mask id="wordmark-cuts" maskUnits="userSpaceOnUse" {...wordmark.mask}>
      <rect {...wordmark.mask} fill="#fff" />
      {#each wordmark.cuts as cut}<rect {...cut} fill="#000" />{/each}
    </mask>
    <path id="wordmark-glyphs" d={wordmark.d} fill-rule="evenodd" />
  </defs>
  <g transform="skewX(-12)" mask="url(#wordmark-cuts)">
    <use
      href="#wordmark-glyphs"
      x="2.5"
      y="2.5"
      style="fill: var(--brand-shadow)"
    />
    <use href="#wordmark-glyphs" fill="url(#wordmark-fill)" />
  </g>
</svg>
