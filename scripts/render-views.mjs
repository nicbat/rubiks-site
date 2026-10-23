import { render } from "svelte/server";
import AppView from "../src/components/AppView.svelte";
import Notation from "../src/components/Notation.svelte";
import Guides from "../src/components/Guides.svelte";
import Timer from "../src/components/Timer.svelte";
import TwoByTwo from "../src/components/TwoByTwo.svelte";
import CubePlayer from "../src/components/CubePlayer.svelte";
import CourseContent from "../src/components/CourseContent.svelte";
import CourseLesson from "../src/components/CourseLesson.svelte";
import Courses from "../src/components/Courses.svelte";
// Normalize framework markers/formatting for existing markup contract assertions.
// Observable browser behavior is covered separately by the production browser suite.
const html = (component, props) =>
  render(component, { props })
    .body.replace(/<!--[^]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/ (?:data-slot="[^"]*"|type="button"|class="")/g, "");
export const renderApp = (ctx) => html(AppView, ctx);
export const renderNotation = (move, suffix, options = {}) =>
  html(Notation, { move, suffix, ...options });
export const renderGuides = (options = {}) => html(Guides, options);
export const renderTimer = (options) => html(Timer, options);
export const renderTwoByTwo = (progress) => html(TwoByTwo, { progress });
export const renderCubePlayer = (options) => html(CubePlayer, options);
export const renderCourseLesson = (options) => html(CourseLesson, options);
export const renderCourses = (options) => html(Courses, options);
export const renderCourseContent = (options) => html(CourseContent, options);
