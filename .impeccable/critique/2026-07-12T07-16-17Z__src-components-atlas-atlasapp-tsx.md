---
target: Akashic Computer Explore and Compare interface
total_score: 21
p0_count: 0
p1_count: 4
timestamp: 2026-07-12T07-16-17Z
slug: src-components-atlas-atlasapp-tsx
---
# Akashic Computer Interface Critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | Selected states are clear; Compare has no coverage/progress detail. |
| 2 | Match System / Real World | 2 | The model hierarchy is natural, but core technical terms are unexplained. |
| 3 | User Control and Freedom | 2 | Filters toggle off, but hierarchy changes silently clear artifact selections. |
| 4 | Consistency and Standards | 2 | Visual language is cohesive; search behavior differs between modes. |
| 5 | Error Prevention | 2 | Constraints help, but selection loss and unwieldy comparisons remain possible. |
| 6 | Recognition Rather Than Recall | 2 | Mobile horizontal comparison requires remembering hidden columns. |
| 7 | Flexibility and Efficiency | 2 | Expert-oriented controls exist, but Compare is unavailable and 150 rows lack accelerators. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm and restrained; the default artifact wall overwhelms the hierarchy. |
| 9 | Error Recovery | 2 | Empty states guide recovery, except for unavailable Compare data. |
| 10 | Help and Documentation | 1 | No glossary or contextual explanation of formats, fit, and benchmark evidence. |
| **Total** |  | **21/40** | **Acceptable; significant workflow improvements remain.** |

## Anti-Patterns Verdict

**Pass, with a second-order category reflex.** The interface feels intentionally designed rather than generically generated. The paper-and-ink palette, serif identity, compact utility typography, flat borders, and evidence colors match the product. Warm paper, uppercase labels, and pill controls are recognizable as the current scholarly AI-catalog lane, but consistency and restraint keep the surface credible.

The source detector returned zero findings. The live detector reported `cream-palette`, `nested-cards`, and mobile `cramped-padding`; all three are false positives against the committed paper identity, a standard Benchmarks disclosure control, and a table wrapper whose padding is supplied by its panel and cells. No reliable human-visible overlay was available because in-app Browser visibility is unsupported from sub-agent threads; console output and measured DOM geometry were used instead.

## Overall Impression

The product opens with unusual calm and trustworthiness, and the model hierarchy is its strongest idea. The biggest opportunity is to make the results obey that hierarchy: the controls disclose progressively, but the default result surface immediately exposes 150 artifact rows.

## What Is Working

- The paper/ink, STIX/Plex, and semantic-color system is disciplined and appropriate.
- Family, release, size, and variant controls build the correct mental model with clear selected states.
- Copy stays neutral and evidence-oriented through terms such as verified, estimated, needs review, and no measured benchmarks.
- The repaired implementation has no page-level overflow at desktop or 390px mobile, no unnamed interactive nodes, no console errors, and a clean deterministic detector run.

## Cognitive Load

Five checklist failures indicate high cognitive load:

- **Chunking:** Qwen opens as one 150-row artifact table.
- **One thing at a time:** Results compete with the hierarchy before a release is chosen.
- **Minimal choices:** Families, releases, VRAM presets, benchmarks, and artifact checkboxes exceed four options.
- **Working memory:** Mobile Explore shows 316px of an 820px table; the comparison drawer shows 350px of 720px.
- **Progressive disclosure:** Controls disclose progressively while results expose the complete inventory.

Decision points above four options include eight families, six Qwen releases, seven capacity choices, eight benchmarks, five comparison categories, and 150 artifact checkboxes.

## Emotional Journey

The opening feels quiet, credible, and trustworthy. Selecting a release is the peak because metadata appears immediately and the hierarchy begins to make sense. The artifact wall is the first valley, where learning becomes scanning. Mobile makes that valley deeper by hiding key columns. Compare is the sharpest disappointment because a primary mode leads only to an unavailable-data state.

## Priority Issues

### [P1] Explore search breaks its stated contract

Search says models, families, and vendors, but Explore filters only the family rail while the selected family and artifact table remain unchanged.

**Fix:** Present grouped family/model/artifact results and update the hierarchy when a result is selected. Make search semantics consistent between modes.

**Suggested command:** `$impeccable shape`

### [P1] Compare is a dead primary destination

Desktop and mobile show only Benchmark data is being sourced, so the benchmark-led expert workflow cannot be completed.

**Fix:** Ship a sourced minimum comparison set before exposing the primary tab, or mark the mode unavailable with explicit coverage status.

**Suggested command:** `$impeccable harden`

### [P1] Default Explore is an undifferentiated artifact wall

Showing every artifact technically preserves completeness but defeats the teaching sequence and makes the catalog exhaustive rather than legible.

**Fix:** Start with a release-grouped family index and truthful counts. Reveal artifact rows after release selection, or use collapsible release groups with an explicit show-all action.

**Suggested command:** `$impeccable distill`

### [P1] Mobile comparison hides critical evidence

Fit, VRAM, runtime, and the second selected artifact require horizontal panning and working-memory comparison.

**Fix:** Use stacked mobile artifact rows with Model, Format, VRAM, and Fit always visible. Convert the drawer into vertically aligned attribute comparisons.

**Suggested command:** `$impeccable adapt`

### [P2] Technical meaning and selection state are under-explained

BF16, NVFP4, context, deltas, benchmarks, and fit methodology lack nearby explanation. Hierarchy changes also clear artifact selections without notice.

**Fix:** Add concise definitions, textual mobile fit labels, a visible selection count after the first checkbox, individual removal, and notice before discarding selections.

**Suggested command:** `$impeccable clarify`

## Persona Red Flags

### Alex, power user

- Compare is unavailable and the 150-row default lacks accelerators.
- Search semantics change between modes.
- No quick column controls or keyboard accelerators are exposed.

### Jordan, first-timer

- Artifacts appear before release, size, and variant are taught.
- Core terms and fit symbols lack nearby explanation.
- Search can appear broken because the main content does not follow the query.

### Casey, mobile user

- Key evidence requires horizontal panning.
- The comparison drawer occupies nearly half the viewport.
- Visible controls meet the 24px AA target but remain below the more comfortable 44px touch target.

## Minor Observations

- The partially visible next family in the mobile rail is an effective scroll cue.
- Repository and evidence text at 11-11.5px is demanding on mobile.
- Seven VRAM choices are presented without grouping.
- The comparison drawer has global Clear but no per-artifact removal or visible selection count.
- Explore had 150 named repository links and 150 named checkboxes; Compare had no unnamed controls.

## Provocative Questions

- Does showing the full family require every artifact, or would a release map with truthful counts better preserve discovery?
- Is Search a navigation mechanism or a filter? It needs one consistent contract.
- Which four facts must remain visible without horizontal movement at 390px?
- Should Compare appear as a primary mode before the atlas has a credible comparison corpus?
