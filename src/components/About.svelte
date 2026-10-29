<script>
  import { caseDiagram } from "../case-diagram.js";

  // The feature graphics are decorative: each item's copy says what it shows.
  const tPerm = caseDiagram(
    "R U R' U' R' F R2 U' R' U' R U R' F'",
    "PLL",
    "T perm viewed from above",
    { arrows: true },
  );
  // A made-up run of daily averages in seconds, falling from 31 to 16.
  const times = [
    31, 29.5, 30.2, 27, 25.6, 26.4, 23, 21.8, 22.3, 19.5, 18, 16.4,
  ];
  const points = times.map((t, i) => [
    8 + (i * 144) / (times.length - 1),
    92 - ((t - 14) / 18) * 76,
  ]);
  const line = points.map(([x, y]) => `${x},${y.toFixed(1)}`).join(" ");
  const area = `M8,92 L${line} L152,92 Z`;
  const [lastX, lastY] = points.at(-1);
</script>

<div class="page-toolbar"><h1 class="sr-only">About</h1></div>
<div class="about">
  <section class="about-panel about-hero" aria-labelledby="about-title">
    <blockquote class="about-epigraph">
      <p>“While you were partying, I studied the cube.”</p>
    </blockquote>
    <h2 id="about-title">Last Layer</h2>
    <p>
      Last Layer is a free training tool for speedcubers of every level. Whether
      you’re solving your first cube or grinding PLLs for a sub-10, Last Layer
      helps you learn faster, track your progress, and have more fun doing it.
    </p>
  </section>

  <section class="about-panel" aria-labelledby="about-why">
    <h2 id="about-why">Why Last Layer?</h2>
    <p>
      Last Layer was built by two lifelong friends who got a little too into
      cubing. We wanted something approachable enough for total beginners and
      serious enough for competitors. Plenty of cubing sites get the job done.
      We wanted one that’s actually exciting to use. Here’s what that looks
      like:
    </p>
    <ol class="about-features">
      <li class="about-feature" data-feature="cubes">
        <div class="about-screen" aria-hidden="true">
          <div class="about-diagram">{@html tPerm}</div>
          <div class="about-scrubber"><span></span></div>
        </div>
        <div class="about-feature-copy">
          <h3>Fully interactive cubes</h3>
          <p>
            No more pausing and rewinding shaky YouTube videos or squinting at
            cryptic diagrams. Step through any algorithm at your own pace and
            scrub through every move in real time.
          </p>
        </div>
      </li>
      <li class="about-feature" data-feature="progress">
        <div class="about-screen" aria-hidden="true">
          <svg class="about-chart" viewBox="0 0 160 100">
            <defs>
              <linearGradient id="about-chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0"
                  style="stop-color: var(--c); stop-opacity: 0.5"
                />
                <stop
                  offset="1"
                  style="stop-color: var(--c); stop-opacity: 0"
                />
              </linearGradient>
            </defs>
            {#each [16, 41, 67, 92] as y}
              <line class="about-chart-grid" x1="8" x2="152" y1={y} y2={y} />
            {/each}
            <path d={area} fill="url(#about-chart-fill)" />
            <polyline class="about-chart-line" points={line} />
            <circle class="about-chart-point" cx={lastX} cy={lastY} r="4" />
          </svg>
        </div>
        <div class="about-feature-copy">
          <h3>Progress tracking that actually tracks progress</h3>
          <p>
            Watch your times drop with beautifully rendered charts. Flag cases
            for extra review and keep tabs on your cube collection.
          </p>
        </div>
      </li>
      <li class="about-feature" data-feature="timer">
        <div class="about-screen about-timer" aria-hidden="true">
          <div class="about-lamps"><i></i><i></i><i data-lit></i></div>
          <div class="about-lcd" data-ghost="88.88">9.87</div>
        </div>
        <div class="about-feature-copy">
          <h3>The coolest timer you’ve ever seen</h3>
          <p>
            You’ll wonder why you ever wanted a hardware timer. Serious cubers
            deserve high-octane gear, and ours turns every solve into a race for
            the finish line.
          </p>
        </div>
      </li>
    </ol>
  </section>

  <section class="about-panel" aria-labelledby="about-ideas">
    <h2 id="about-ideas">Got ideas?</h2>
    <p>
      We’re always looking for ways to make Last Layer better. If there’s a
      feature you’d love to see, <a href="#/about">get in touch</a>. We’d love
      to hear from you.
    </p>
  </section>

  <p class="about-credits">
    Built with <svg
      class="about-heart"
      viewBox="0 0 7 6"
      shape-rendering="crispEdges"
      role="img"
      aria-label="love"
      ><defs
        ><linearGradient id="about-heart-fill" x1="0" y1="0" x2="0" y2="1"
          ><stop offset="0" style="stop-color: var(--brand-top)" /><stop
            offset="1"
            style="stop-color: var(--brand-bottom)"
          /></linearGradient
        ></defs
      ><path
        fill="url(#about-heart-fill)"
        d="M1 0h2v1H1zM4 0h2v1H4zM0 1h7v2H0zM1 3h5v1H1zM2 4h3v1H2zM3 5h1v1H3z"
      /></svg
    >
    by
    <a href="https://nicb.at">Nicholas</a> and
    <a href="https://kgoh.net">Keven</a>
  </p>
</div>
