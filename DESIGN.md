---
name: Akashic Computer
description: A scholarly technical catalog for discovering open-weight models.
colors:
  paper: "#f7f5ee"
  ink: "#1c1a14"
  panel: "#fffdf8"
  panel-subtle: "#f2efe5"
  muted: "#6b6557"
  faint: "#948d7c"
  line: "#ddd6c4"
  line-soft: "#eae4d4"
  verified: "#0f8560"
  verified-soft: "#e7f2ec"
  caution: "#966c15"
  caution-soft: "#f5edd5"
  metadata: "#35639f"
  metadata-soft: "#e9eef6"
  alert: "#a04a35"
  alert-soft: "#f5e4de"
typography:
  display:
    fontFamily: "STIX Two Text, Georgia, serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
  title:
    fontFamily: "STIX Two Text, Georgia, serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "IBM Plex Sans, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Sans, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.12em"
  data:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  xs: "4px"
  chip: "5px"
  control: "7px"
  panel: "10px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  button-outline:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  filter-pill-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "14px 16px"
---

# Design System: Akashic Computer

## Overview

**Creative North Star: "The Living Technical Catalog"**

Akashic Computer should feel like a carefully maintained reference work that happens to be interactive. The interface is scholarly, calm, and exact. Dense technical information is welcome when its hierarchy remains obvious and every color or badge carries meaning.

The system uses a restrained paper-and-ink composition with editorial serif moments, utilitarian sans-serif controls, and monospaced data. Discovery owns the hierarchy. VRAM capacity, benchmark evidence, provenance, and runtime support annotate the catalog without turning into recommendations.

The design explicitly rejects marketing-site composition, affiliate buying-guide language, generic SaaS dashboards, promotional AI leaderboards, ornamental card grids, decorative gradients, and hardware-first framing.

**Key Characteristics:**

- Warm paper surfaces with dark ink and thin structural rules.
- Editorial model names paired with compact technical metadata.
- Dense tables that remain factual, sortable, and expandable.
- Semantic color reserved for verification, caution, metadata, and constraints.
- Flat surfaces at rest with no decorative elevation.

## Colors

The palette resembles archival paper and technical ink, with restrained semantic accents for evidence and state.

### Primary

- **Catalog Ink**: The dominant selected state, primary text, and strongest structural contrast.
- **Archive Paper**: The persistent page background and inverse text color on selected controls.

### Secondary

- **Provenance Blue**: Publisher and source metadata only.
- **Verified Green**: Confirmed provenance and capacity-fit states only.
- **Evidence Amber**: Estimates, uncertainty, and tight capacity states only.
- **Constraint Rust**: Does-not-fit and needs-review states only.

### Neutral

- **Reading Panel**: Primary framed work surfaces and controls.
- **Index Wash**: Secondary chips, expanded rows, and quiet grouping.
- **Muted Annotation**: Supporting labels and metadata.
- **Faint Annotation**: Tertiary source text and disabled values.
- **Catalog Rule**: Panel boundaries and table headers.
- **Soft Rule**: Row separation and internal grouping.

### Named Rules

**The Evidence Color Rule.** Semantic colors only communicate provenance, confidence, metadata, or constraints. They never decorate empty space.

**The Paper Dominance Rule.** Ink and paper must carry the composition before any accent color appears.

## Typography

**Display Font:** STIX Two Text with Georgia fallback  
**Body Font:** IBM Plex Sans with Arial fallback  
**Label/Mono Font:** IBM Plex Mono with monospace fallback

**Character:** STIX gives model families and product identity the authority of a reference volume. IBM Plex keeps controls, metadata, and numerical comparison precise and contemporary.

### Hierarchy

- **Display** (600, 19px, 1): Product identity only.
- **Title** (600, 15px, 1.25): Model names, family names, and important row identities.
- **Body** (400, 13px, 1.5): Explanatory content and supporting interface copy. Prose should not exceed 72 characters per line.
- **Label** (700, 11px, 0.12em, uppercase): Section labels and table headings.
- **Data** (500, 13px, 1.4): Scores, parameter counts, repositories, runtimes, and memory ranges.

### Named Rules

**The Editorial Identity Rule.** Serif type names the product and models. It never appears inside buttons, filters, badges, or utility labels.

**The Data Alignment Rule.** Comparable numbers use IBM Plex Mono and tabular numerals.

## Elevation

The system is flat by default. Depth comes from tonal layering, one-pixel rules, and the relationship between paper and reading panels. The artifact comparison drawer is the only elevated surface because it temporarily sits above the catalog.

### Shadow Vocabulary

- **Comparison Drawer** (`0 -8px 28px rgba(0,0,0,0.14)`): Used only for the fixed artifact comparison surface.

### Named Rules

**The Flat Catalog Rule.** Static panels never use shadows. If a panel needs emphasis, strengthen its hierarchy or border instead.

## Components

Components are refined and restrained. Familiar controls should disappear into the research task.

### Buttons

- **Shape:** Gently squared controls with a 7px radius; filter pills use a full radius.
- **Primary:** Catalog Ink on Archive Paper with 6px vertical and 12px horizontal padding.
- **Hover / Focus:** Outline buttons darken their border on hover. Every control receives a 2px Provenance Blue focus ring with a 1px offset.
- **Secondary / Ghost:** Reading Panel backgrounds, Catalog Rule borders, and Muted Annotation text.

### Chips

- **Style:** Compact 5px-radius labels using Index Wash or a semantic soft color.
- **State:** Chips describe immutable properties. Filter pills are buttons and must expose pressed state separately.

### Cards / Containers

- **Corner Style:** Restrained 10px radius.
- **Background:** Reading Panel on Archive Paper.
- **Shadow Strategy:** Flat by default.
- **Border:** One-pixel Catalog Rule boundary with Soft Rule internal dividers.
- **Internal Padding:** 14px vertical and 16px horizontal for primary panels.

### Inputs / Fields

- **Style:** Reading Panel background, Catalog Rule border, 7px radius, and compact utility typography.
- **Focus:** Provenance Blue focus ring. Labels remain visible outside the field.
- **Error / Disabled:** Constraint Rust communicates errors; Faint Annotation is reserved for truly unavailable values.

### Navigation

- The product identity stays top-left. Explore and Compare models use a standard segmented tab treatment with explicit selected state.
- Search filters the active view. The selected family becomes the page title with company and license metadata.
- Release, size, and variant reveal progressively as filters. Hovering or focusing a release previews its metadata without applying it.
- On narrow screens, controls may wrap without changing typography scale or hiding required context.

### Model Tables

- Model comparison is benchmark-led and sortable. Expandable model names use real disclosure buttons with `aria-expanded`.
- Artifact tables begin with the complete selected family, then narrow as release, size, and variant filters are applied.
- Artifact rows keep model identity, format, provenance, runtimes, VRAM, capacity fit, and selected benchmark delta visible together.
- Capacity fit reports counts or constraints. It never chooses an artifact for the user.

## Do's and Don'ts

### Do:

- **Do** preserve the family, release, size, variant, and artifact hierarchy.
- **Do** show the complete catalog before applying optional VRAM filtering.
- **Do** use provenance and confidence labels wherever data origins differ.
- **Do** keep model comparison benchmark-led and artifact comparison explicitly separate.
- **Do** use semantic color only when the same state is also expressed in text or symbols.
- **Do** keep the current warm paper, serif identity, sans utility, and mono data pairing.

### Don't:

- **Don't** make Akashic Computer feel like a marketing site or affiliate buying guide.
- **Don't** introduce a generic SaaS dashboard or ornamental card grid.
- **Don't** use decorative gradients, glassmorphism, colored side stripes, or gradient text.
- **Don't** label one model or artifact as universally best or recommended.
- **Don't** turn a benchmark leaderboard into promotional ranking language.
- **Don't** let hardware-first framing hide the broader model ecosystem.
- **Don't** use display typography in buttons, filters, badges, or data cells.
