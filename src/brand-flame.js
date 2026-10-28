// A pixel fireball that engulfs the brand mark: a round body with tongues
// rising off the top. "#" is flame, "o" is its hotter core, "*" is a loose
// ember and "." is empty; the mark sits in the middle of the ball. Each row is one pixel tall, so the art renders as crisp squares at
// whole-pixel sizes.
const art = [
  "....*....*............",
  "...........#...*......",
  "..........##.......*..",
  "......*...#.....#.....",
  ".........##.....##....",
  "..*.#....##......#....",
  "....##..###.....##....",
  ".....#..####...###....",
  ".....############.....",
  "...#.############..#..",
  "...#######oo#####.##..",
  "..######oooooo######..",
  "...####oooooooo####...",
  "...###oooooooooo###...",
  "...###oooooooooo###...",
  "...###oooooooooo###...",
  "...###oooooooooo###...",
  "...###oooooooooo###...",
  "...####oooooooo####...",
  "....###oooooooo###....",
  "....#####oooo#####....",
  ".....############.....",
  ".......########.......",
  ".........####.........",
];

// One subpath per horizontal run of the given characters.
const runs = (chars) =>
  art
    .flatMap((row, y) =>
      [...row.matchAll(new RegExp(`[${chars}]+`, "g"))].map(
        (run) => `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`,
      ),
    )
    .join("");

export const flame = {
  width: art[0].length,
  height: art.length,
  // The whole flame, the core drawn over it, and the loose embers.
  outer: runs("#o"),
  core: runs("o"),
  embers: runs("*"),
};
