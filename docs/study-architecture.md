# Study and investigation

The docs index is a study hub with three sections: learning paths, a primary
resource library, and the existing Akashic guides. Learning paths have stable
URLs at `/docs/paths/[slug]`; existing guide and lexicon URLs are unchanged.

## Content boundaries

`src/lib/atlas/study.ts` defines resource identities, topic/type/level metadata,
original reading notes, ordered paths, prerequisites and investigations.
Resources link to original papers, official documentation or creator
implementations. Wafer's resource collection is credited as inspiration;
Akashic's path outcomes and investigation prompts are written for model
selection and inference questions. Content does not fetch external pages on
every request or imply that a linked method is compatible with every model.

`StudyHub` presents and filters the library. `StudyPathView` renders an ordered
curriculum with companion guides and a practical exercise. Server route
handling resolves path identities, supplies metadata and rejects unknown paths
with a 404. The quantization investigation resolves the GLM/Flash comparison
from current catalog identities, with the generic planner as a fallback.
The floating comparison drawer is hidden on study and guide pages; selections
remain available when returning to models.

`useStudyProgress` stores explicit resource completion in the browser under a
versioned key. The library and all paths share those resource IDs. Opening an
external source never marks it as read. Storage events synchronize other tabs;
blocked writes retain progress for the current session. Parsing ignores corrupt
data and resource IDs that no longer exist. Progress does not require an
account or change catalog evidence.

## Adding material

Add a stable resource ID with a checked primary URL, attribution, metadata and
a short original description. Add it to a path with a specific reading
question. Check that prerequisites remain acyclic, companion guides exist and
each investigation asks for evidence rather than asserting an unmeasured
result. Update the displayed source-review date when reviewing the collection.

Keep estimates, reference-model results and actual checkpoint evaluations
distinct. Performance claims need a reproducible workload, hardware, software,
precision, baseline and correctness method. Account-synced progress or notes
can later replace the browser persistence adapter without changing curriculum
identities or path URLs.

Curriculum tests check graph integrity, resource coverage, filter intersections
and corrupted progress. Browser checks cover mobile navigation, source links,
progress across paths/library/reload, blocked storage, guide navigation and
the GLM comparison handoff.
