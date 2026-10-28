<script>
  import { flame } from "../brand-flame.js";
</script>

<!-- Decorative: the brand link carries the "Last Layer" name as text. -->
<span class="brand-logo" aria-hidden="true">
  <svg
    class="brand-flame"
    viewBox="0 0 {flame.width} {flame.height}"
    shape-rendering="crispEdges"
  >
    <defs>
      <linearGradient id="brand-flame-outer" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color: var(--brand-top)" />
        <stop offset="1" style="stop-color: var(--brand-bottom)" />
      </linearGradient>
      <linearGradient id="brand-flame-core" x1="0" y1="0" x2="0" y2="1">
        <stop
          offset="0"
          style="stop-color: color-mix(in srgb, var(--brand-top), #fff 45%)"
        />
        <stop
          offset="1"
          style="stop-color: color-mix(in srgb, var(--brand-bottom), #fff 35%)"
        />
      </linearGradient>
    </defs>
    <path d={flame.outer} fill="url(#brand-flame-outer)" />
    <path d={flame.core} fill="url(#brand-flame-core)" />
    <path
      d={flame.embers}
      style="fill: color-mix(in srgb, var(--brand-top), #fff 30%)"
    />
  </svg>
  <span class="brand-mark"><i></i><i></i><i></i><i></i></span>
</span>
