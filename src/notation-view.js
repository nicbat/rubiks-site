import { renderCubePlayer } from "./cube-player.js";
import { applyAlg, solvedCube } from "./cube.js";
import { cubeNet } from "./diagram.js";
import { escape } from "./html.js";

export const moveGroups = [
  {
    title: "Face turns",
    description: "Turn one outer layer.",
    moves: [
      ["U", "Up", "top layer", "U"],
      ["D", "Down", "bottom layer", "D"],
      ["R", "Right", "right layer", "R"],
      ["L", "Left", "left layer", "L"],
      ["F", "Front", "front layer", "F"],
      ["B", "Back", "back layer", "B"],
    ],
  },
  {
    title: "Wide turns",
    description:
      "Turn an outer layer and its neighboring middle layer together. Lowercase r means Rw; the same rule applies to all six faces.",
    moves: [
      ["r", "Right wide · Rw", "right two layers", "R"],
      ["l", "Left wide · Lw", "left two layers", "L"],
      ["u", "Up wide · Uw", "top two layers", "U"],
      ["d", "Down wide · Dw", "bottom two layers", "D"],
      ["f", "Front wide · Fw", "front two layers", "F"],
      ["b", "Back wide · Bw", "back two layers", "B"],
    ],
  },
  {
    title: "Slice moves",
    description:
      "Turn only the middle layer. M follows L, E follows D, and S follows F.",
    moves: [
      ["M", "Middle", "middle layer between L and R", "L"],
      ["E", "Equatorial", "middle layer between U and D", "D"],
      ["S", "Standing", "middle layer between F and B", "F"],
    ],
  },
  {
    title: "Cube rotations",
    description:
      "Reorient the whole cube in your hands. x follows R, y follows U, and z follows F. Read subsequent moves from the new orientation.",
    moves: [
      ["x", "Rotate like R", "whole cube", "R"],
      ["y", "Rotate like U", "whole cube", "U"],
      ["z", "Rotate like F", "whole cube", "F"],
    ],
  },
];

export function renderNotation(
  move = "R",
  suffix = "",
  { showCube = true } = {},
) {
  const entry =
    moveGroups.flatMap((group) => group.moves).find(([id]) => id === move) ||
    moveGroups[0].moves[2];
  const [id, name, layers, face] = entry;
  const ending = ["", "'", "2"].includes(suffix) ? suffix : "";
  const token = id + ending;
  const direction =
    ending === "2"
      ? "180° (either direction)"
      : ending === "'"
        ? "90° counterclockwise"
        : "90° clockwise";
  return `<div class="page-heading"><h1>Move notation</h1></div>
  <div class="notation-page">
    <div class="notation-workspace">
      <div class="notation-picker">${moveGroups.map((group) => `<fieldset><legend>${group.title}</legend><p>${group.description}</p><div class="notation-moves">${group.moves.map(([key, label]) => `<button data-action="notation-move" data-id="${key}" aria-label="${key}: ${label}" aria-pressed="${key === id}"><strong>${key}</strong><span>${label}</span></button>`).join("")}</div></fieldset>`).join("")}</div>
      <section class="notation-demo" aria-label="Move demonstration">
        <label class="notation-mobile-move" for="notation-move">Move to preview<select id="notation-move">${moveGroups.map((group) => `<optgroup label="${group.title}">${group.moves.map(([key, label]) => `<option value="${key}" ${key === id ? "selected" : ""}>${key}: ${label}</option>`).join("")}</optgroup>`).join("")}</select></label>
        <fieldset class="notation-suffix"><legend>Turn amount</legend><div>${[
          ["", "Quarter turn"],
          ["'", "Prime"],
          ["2", "Double"],
        ]
          .map(
            ([value, label]) =>
              `<button data-action="notation-suffix" data-id="${value}" aria-pressed="${ending === value}"><strong>${escape(id + value)}</strong><span>${label}</span></button>`,
          )
          .join("")}</div></fieldset>
        <div aria-live="polite" aria-atomic="true"><h2>${escape(token)} <span>${name}</span></h2><p>Turn the ${layers} ${direction}, looking directly at the ${face} face.</p></div>
        ${showCube ? renderCubePlayer({ id: "notation", mode: "notation", algorithm: token }) : ""}<div class="notation-nets"><figure>${cubeNet(solvedCube(), "Before: solved cube")}<figcaption>Before · solved</figcaption></figure><figure>${cubeNet(applyAlg(solvedCube(), token), `After ${token}`)}<figcaption>After <strong>${escape(token)}</strong></figcaption></figure></div>
        <p class="notation-caption">An unfolded cube: U above F, D below F, L and R beside F, B beyond R. Face labels stay fixed; sticker letters show their original faces. Every example starts solved.</p>
      </section>
    </div>
    <section class="notation-reading"><h2>Reading an algorithm</h2><div>
      <p><strong>R U R' U'</strong><br>Right clockwise, up clockwise, right counterclockwise, up counterclockwise. An apostrophe is pronounced “prime.”</p>
      <p><strong>2 means a half turn</strong><br>R2 and R2' end in the same position. Suffixes work on every move: r', M2, and x' use the same rules.</p>
      <p><strong>Parentheses group moves</strong><br>(R U R' U') is still four moves. AUF means “adjust U face”: use U, U', U2, or no turn to align the top.</p>
    </div></section>
    <p class="notation-sources">3×3 reference. Larger cubes use additional layer notation. Sources: <a href="https://jperm.net/3x3/moves" target="_blank" rel="noreferrer">J Perm’s move guide</a> and <a href="https://www.worldcubeassociation.org/regulations/#article-12-notation" target="_blank" rel="noreferrer">WCA notation</a>.</p>
  </div>`;
}
