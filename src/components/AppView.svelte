<script>
  import PreferenceCheckbox from "./PreferenceCheckbox.svelte";
  import Badge from "../lib/components/ui/badge/badge.svelte";
  import { methodGroups, recommendedVariant } from "../learning-methods.js";
  import { caseDiagram as renderCaseDiagram } from "../case-diagram.js";
  import { createProgressIndex } from "../progress-index.js";
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import CourseContext from "./CourseContext.svelte";
  import CourseLesson from "./CourseLesson.svelte";
  import CourseContent from "./CourseContent.svelte";
  import { courses, courseSummary, moduleById } from "../courses.js";
  import PllQuiz from "./PllQuiz.svelte";
  import Courses from "./Courses.svelte";
  import Timer from "./Timer.svelte";
  import Cubes from "./Cubes.svelte";
  import Guides from "./Guides.svelte";
  import GuideReview from "./GuideReview.svelte";
  import PracticePicker from "./PracticePicker.svelte";
  import Navigation from "./Navigation.svelte";
  import Home from "./Home.svelte";
  import Dashboard from "./Dashboard.svelte";
  import About from "./About.svelte";
  import Profile from "./Profile.svelte";
  import Library from "./Library.svelte";
  import Account from "./Account.svelte";
  import Practice from "./Practice.svelte";
  import SyncDialog from "./SyncDialog.svelte";
  import { syncStatus } from "../sync-status.js";
  import Progress from "./Progress.svelte";
  import SettingsDialog from "./SettingsDialog.svelte";
  import CaseDialog from "./CaseDialog.svelte";
  import ScrambleDialog from "./ScrambleDialog.svelte";
  import SolveDialog from "./SolveDialog.svelte";
  import BackupDialog from "./BackupDialog.svelte";
  import OriginRecovery from "./OriginRecovery.svelte";
  let props = $props();
</script>

{#snippet content({ state, catalog, byId, variant, selected })}
  {@const {
    notice,
    progress,
    preferences,
    view,
    section,
    detail,
    session,
    backup,
    toast,
  } = state}
  {@const sync =
    state.syncStatus ||
    syncStatus({ account: state.account, demo: preferences.testData, notice })}
  {@const workspace =
    ["library", "guides", "lesson"].includes(view) && !!state.activeModule}
  {@const progressIndex = createProgressIndex(progress, state.method || "full")}
  {@const courseSummaries = Object.fromEntries(
    courses
      .filter((course) => !course.status)
      .map((course) => [
        course.id,
        courseSummary(
          course,
          progress,
          progressIndex,
          catalog,
          (c, method) =>
            progress.variants[c.id] ?? recommendedVariant(c, method),
        ),
      ]),
  )}
  {@const status = (c) => progressIndex.statusFor(c.id, variant(c))}
  {@const stages = new Map(
    ["OLL", "PLL"].flatMap((section) =>
      methodGroups(catalog, section, state.method || "full").flatMap((stage) =>
        stage.cases.map((c) => [c.id, stage]),
      ),
    ),
  )}
  {@const caseAlias = (c) => stages.get(c.id)?.labels[c.id]}
  {#snippet aliasMarkup(c)}
    {#if caseAlias(c)}<small class="case-alias">{caseAlias(c)}</small>{/if}
  {/snippet}
  {#snippet caseDiagram(c)}
    {@html renderCaseDiagram(
      c.algorithms[variant(c)].moves,
      c.section,
      `${c.name} viewed from above; front at bottom`,
      {
        arrows: preferences.pllArrows,
        top: detail || session ? state.displayTop : preferences.displayTop,
      },
    )}
  {/snippet}
  {#snippet badge(c)}
    {@const s = status(c)}
    <Badge class={s.label === "Confident" ? "confident" : ""}>{s.label}</Badge>
  {/snippet}

  {#snippet sideToggle()}
    <div class="side-option">
      <Label class="setting-toggle"
        ><PreferenceCheckbox
          aria-describedby="random-side-help"
          id="random-side"
          {...preferences.randomLastLayer ? { checked: true } : {}}
        />Randomize last-layer color</Label
      ><small id="random-side-help" class="muted"
        >The last layer can be any of the six colors; repeats are possible.</small
      >
    </div>
  {/snippet}

  {@const model = {
    state,
    catalog,
    byId,
    variant,
    selected,
    progressIndex,
    status,
    stages,
    caseAlias,
    caseDiagram,
    badge,
    aliasMarkup,
    sideToggle,
    workspace,
    courseSummaries,
  }}
  <div class="shell">
    <Navigation {model} />{#if notice}<div class="warning" role="alert">
        {notice}
      </div>{/if}
    <main id="main" tabindex="-1">
      {#if state.originRecovery}<OriginRecovery
          recovery={state.originRecovery}
          earlier={state.earlierLearning}
          testData={preferences.testData}
        />{/if}
      {#if sync.attention && !notice}<p class="warning" role="status">
          {sync.label}<Button variant="link" data-action="sync-details"
            >Review sync</Button
          >
        </p>{/if}
      {#if state.account?.email && !state.account.profile}
        <p class="warning" role="status">
          {state.account.profileLoading
            ? "Loading account…"
            : state.account.profileError
              ? "Account could not be loaded. Try again in Account."
              : "Choose a username in Account to finish account setup and enable sync."}
          <Button variant="link" data-action="nav" data-view="account"
            >Account setup</Button
          >
        </p>
      {/if}
      {#if state.account?.profile && state.account.guestImportPending && !state.settings && view !== "account" && !session && state.timer?.status !== "running"}
        <p class="warning" role="status">
          Guest progress is available on this device.
          <Button variant="link" data-action="account-import-preview"
            >Review guest progress</Button
          >
          <Button variant="link" data-action="account-import-cancel"
            >Keep separate</Button
          >
        </p>
      {/if}
      {#if workspace}
        <CourseContext
          courseId={progress.activeCourse}
          moduleId={state.activeModule}
          method={state.method}
        />
      {/if}
      {#if view === "profile"}
        <Profile page={state.profilePage} account={state.account} />
      {:else if view === "people"}
        <Profile
          page={{ ...state.profilePage, status: "search", profile: null }}
          account={state.account}
        />
      {:else if view === "pll-quiz"}
        <PllQuiz
          quiz={state.pllQuiz}
          {catalog}
          top={state.displayTop}
          method={state.method}
        />
      {:else if view === "courses"}
        <Courses {progress} summaries={courseSummaries} />
      {:else if view === "lesson"}
        <CourseLesson
          courseId={progress.activeCourse}
          moduleId={state.activeModule}
          {progress}
          example={state.guideExample}
          summary={courseSummaries[progress.activeCourse]}
        />
      {:else if view === "dashboard"}
        <Dashboard {model} />
      {:else if view === "about"}
        <About />
      {:else if view === "home"}
        <Home {model} />
      {:else if view === "library"}
        {#if workspace && moduleById(state.activeModule)?.nodes}<CourseContent
            nodes={moduleById(state.activeModule).nodes}
            {model}
          />{:else}<Library {model} />{/if}
      {:else if view === "account"}
        <Account {model} />
      {:else if view === "progress"}
        <Progress {model} />
      {:else if view === "timer"}
        <Timer
          {...state.timer}
          minutes={preferences.timerMinutes}
          hideTimer={preferences.hideTimer}
          solves={state.solves}
          historyLimit={state.timerHistoryLimit}
          bulk={state.timerBulkEdit}
          currentSolveId={state.currentSolveId}
          cubes={state.cubeCollection?.cubes}
          cubeId={state.timerCubeId}
        />
      {:else if view === "cubes"}
        <Button class="text-button" data-action="nav" data-view="settings"
          >Back to Settings</Button
        >
        <Cubes
          formRevision={state.cubeFormRevision}
          {...state.cubeCollection}
          editingId={state.editingCubeId}
          deletingId={state.deletingCubeId}
        />
      {:else if view === "guides"}
        <Guides
          embedded={workspace}
          section={state.guideSection}
          example={state.guideExample}
          notationMove={state.notationMove}
          notationSuffix={state.notationSuffix}
        />
        {#if ["cross", "f2l"].includes(state.guideSection || "cross")}
          <GuideReview id={state.guideSection || "cross"} {progress} />
        {/if}
      {:else}
        <Practice {model} />
      {/if}
    </main>
    <footer>
      <nav class="utility-nav" aria-label="Reference and tools">
        {#each [["library", "Algorithm library"], ["guides", "Guides"]] as [v, label]}<Button
            class="secondary footer-key"
            data-action="nav"
            data-view={v}
            {...view === v && !workspace ? { "aria-current": "page" } : {}}
            >{label}</Button
          >{/each}
      </nav>
      <Button
        class="secondary footer-key footer-backup"
        data-action="backup"
        aria-label="Backup and transfer training data"
        >Backup and transfer {@html icon("download")}</Button
      >
    </footer>
  </div>
  <div id="toast" role="status" aria-live="polite">{toast}</div>
  {#if state.syncDetails}<SyncDialog
      state={{ ...state, syncStatus: sync }}
    />{/if}
  {#if state.settings}<SettingsDialog
      {model}
    />{/if}{#if state.practicePicker}<PracticePicker
      picker={state.practicePicker}
      {caseDiagram}
    />{/if}{#if detail}<CaseDialog {model} />{/if}{#if backup}<BackupDialog
      {model}
    />{/if}{#if state.scramblePreview}<ScrambleDialog {model} />{/if}
  {#if state.solveDetailId && !state.solveInline}<SolveDialog {state} />{/if}
{/snippet}

{@render content(props)}
