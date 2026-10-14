import { courses, courseById, moduleById } from "./courses.js";
import { escape } from "./html.js";

const reviewButton = (id, reviewed) =>
  `<button class="${reviewed ? "secondary" : "primary"}" data-action="review-lesson" data-id="${id}" aria-pressed="${!!reviewed}">${reviewed ? "Reviewed" : "Mark reviewed"}</button>`;
export function renderCourseContext(courseId, moduleId, method = "full") {
  const module = moduleById(moduleId);
  if (
    courseId !== "cfop" ||
    !module ||
    !courseById("cfop").modules.includes(moduleId)
  )
    return "";
  const current = module.guide || module.section.toLowerCase();
  return `<div class="page-heading"><h1>CFOP</h1><button class="text-button" data-action="courses-back">All courses</button></div><nav class="guide-sections cfop-sections" aria-label="CFOP sections">${[
    ["cross", "Cross"],
    ["f2l", "F2L"],
    ["oll", "OLL"],
    ["pll", "PLL"],
  ]
    .map(
      ([id, label]) =>
        `<button data-action="open-module" data-course="cfop" data-id="${id === "cross" || id === "f2l" ? id : `${method}-${id}`}" aria-pressed="${current === id}">${label}</button>`,
    )
    .join("")}</nav>`;
}
export function renderCourseContinue(progress) {
  const course = courseById(progress.activeCourse);
  if (!course || course.status)
    return `<div class="course-continue"><div><strong>Choose a learning path</strong><p>Explore CFOP, with more paths to come.</p></div><button class="primary" data-action="nav" data-view="courses">Explore courses</button></div>`;
  const module = moduleById(progress.resume?.[course.id] || course.modules[0]);
  return `<div class="course-continue"><div><strong>${escape(course.title)}</strong><p>Continue with ${escape(module.title)}.</p></div><button class="primary" data-action="open-module" data-id="${module.id}" data-course="${course.id}">Continue course</button></div>`;
}
export function renderCourses({ progress }) {
  return `<div class="page-heading"><div><h1>Courses</h1><p class="muted">Choose a puzzle and a path.</p></div></div><section class="course-grid" aria-label="Courses">${courses.map((c) => `<article class="course-card"><span class="muted">${c.puzzle.replace("x", "×")}${c.status ? " · Coming soon" : ""}</span><h2>${escape(c.title)}</h2><p>${escape(c.description)}</p>${c.status ? '<span class="badge">Work in progress</span>' : `<button class="${progress.activeCourse === c.id ? "primary" : "secondary"}" data-action="open-course" data-id="${c.id}">Open ${escape(c.title)}</button>`}</article>`).join("")}</section>`;
}
export function renderGuideReview(id, progress) {
  return `<div class="guide-review"><p>Reviewed this guide? You can return to it any time.</p>${reviewButton(id, progress.reviewed?.includes(id))}</div>`;
}
