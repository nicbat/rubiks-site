# Ideas for later

Ideas discussed for Last Layer that are not part of the current update. These are options, not commitments.

## Courses and shared learning

See [the course-system plan](courses-plan.md) for shared CFOP/F2L modules, algorithm and recognition progress transfer, a planned blindfolded framework, and prepared 2×2 content. The local CFOP course is implemented; blindfolded and 2×2 are marked coming soon.

## Shared progress for Nicholas and Keven

- Keep separate learning sets and let each person move at their own pace.
- See each other’s progress while following a shared plan.
- Consider sign-in and sync if they can stay simple and free for two people.
- Keep one source of truth for progress; Google Sheets was an initial possibility, not a requirement.
- Preserve local progress and export/import when introducing sync.

## Learning guidance

- Suggest an order for learning OLL and PLL, while keeping manual selection available.
- Offer an algorithm of the day for short practice sessions throughout the day.
- Use progress to prioritize hidden practice: unfamiliar cases, missed recognition, and cases due for review.
- Support a consistent habit without making speed the main measure of progress.

## Move-trigger practice

- Add dedicated drills for common move sequences such as `R U R' U'`.
- Connect triggers to the algorithms that use them.
- Expand the existing chunk labels where reliable grouping is available.

## Related and mirrored algorithms

Consider teaching related algorithms together, with paired recognition diagrams
and the shared or mirrored moves highlighted. OLL 5 and OLL 6 are mirrored square
cases: the sequences `r' U2 R U R' U r` and `r U2 R' U' R U' r'` provide a concrete
pair. Record relationships for specific algorithm variants and grips; other
variants need their own verification. Keep case IDs and variant histories
independent when introducing paired lessons.

References: [Cubefreak OLL](https://www.cubefreak.net/speed/cfop/oll.php) and
[CubeSkills OLL sheet](https://www.cubeskills.com/uploads/pdf/tutorials/big-cube-oll-algorithms.pdf)
(Squares, OLL 5/6; `Rw` and `r` both denote a wide R turn).

## Recognizable sub-algorithms

Consider showing longer algorithms as familiar sub-algorithms, with their
intermediate cube states. One common Y-perm sequence splits as:

```text
F R U' R' U' R U R' F' | R U R' U' R' F R F'
```

The first segment is an OLL 37 algorithm; the second is the T-shaped OLL 33
algorithm. This is a relationship between these exact sequences, not every
Y-perm variant. From a Y-perm state, the intermediate top need not be oriented:
the segments combine to restore orientation and solve the permutation. Verify
the chosen sequences, grip, and intermediate states before adding a lesson.

References: [Cubefreak Y-perm](https://cubefreak.net/speed/cfop/pll.php),
[Cubefreak OLL 37/33](https://www.cubefreak.net/speed/cfop/oll.php), and
[CubeSkills OLL sheet](https://www.cubeskills.com/uploads/pdf/tutorials/big-cube-oll-algorithms.pdf)
(Fish Shapes, OLL 37; T-Shapes, OLL 33).

Both learning ideas are deferred; this update adds no paired lessons or
sub-algorithm teaching UI.

## Cross and F2L

Cross/F2L reference guides now cover basics, improvement tips, and on-demand worked examples. Possible future practice directions:

- **Cross:** short scrambles, inspection practice, solution reveals, and comparison of move counts.
- **F2L:** a library of pair cases with diagrams and insertion algorithms.
- **F2L practice:** isolate one corner/edge pair, recognize its case, then practice an insertion while preserving solved slots.

Keep future exercises separate from the informational guides until their teaching and progress rules are defined.

## Current scope

The current update covers larger PLL arrows, collapsible library groups, global settings, marking already-known algorithms, styled dropdowns, 2-look OLL/PLL, and a scramble timer. Local progress, hidden-case practice, algorithm variants, named move chunks, themes, and JSON backups already exist.
