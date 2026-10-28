<script>
  import { wordmark } from "../wordmark.js";
</script>

<!-- Decorative: the brand link carries the "Last Layer" name as text. -->
<svg
  class="wordmark"
  viewBox={wordmark.viewBox}
  shape-rendering="crispEdges"
  aria-hidden="true"
>
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
    <path id="wordmark-pixels" d={wordmark.d} />
  </defs>
  <use
    href="#wordmark-pixels"
    x={wordmark.offset}
    y={wordmark.offset}
    style="fill: var(--brand-shadow)"
  />
  <use href="#wordmark-pixels" fill="url(#wordmark-fill)" />
</svg>
