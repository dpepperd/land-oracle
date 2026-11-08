
# Land Oracle AI — Support User Guide (Build Specification)
Version: 1.1
Last Updated: 2026-01-25

---

## Purpose of This Document

This document defines the **complete vision and content** for the LandOracle.ai Support User Guide.

It is intended for:
- Antigravity (implementation & CMS build)
- Product & UX alignment
- Future chatbot grounding

This is **not marketing copy**.
This is a **support-grade, instructional guide** designed to:
- onboard new users
- reduce support tickets
- prevent misuse or misinterpretation
- scale across multiple user types

Each top-level section should appear as a **primary navigation item** on the Support page.

Each section is **self-contained**, with sub-sections that expand meaningfully beyond a summary.

---

## Navigation Structure (Left Sidebar)

1. What Land Oracle AI Is (and Is Not)
2. How to Think About Land
3. The Core Workflow
4. Understanding the Dashboard
5. How AI Helps (and Where It Stops)
6. Using Filters & Shapes
7. Reports & Sharing
8. Common Use Cases
9. Common Mistakes & Misunderstandings
10. Reference & Glossary

---

## 1. What Land Oracle AI Is (and Is Not)

### What Land Oracle AI Is

Land Oracle AI is a land intelligence and early-stage due diligence platform.

It consolidates fragmented data sources such as:
- tax and parcel records
- land use classifications
- zoning context
- environmental constraints
- access and infrastructure indicators

into a **single, visual decision surface**.

The goal is not more data.
The goal is **faster, clearer understanding** of land.

---

### What Land Oracle AI Is Not

Land Oracle AI does NOT:
- provide investment advice
- provide legal or zoning approvals
- predict financial returns
- tell users what to buy or sell

All decisions remain with the user.

---

### AI Transparency

AI is used to:
- translate complex rules into plain language
- summarize overlapping constraints
- surface notable patterns

AI is NOT used to:
- recommend decisions
- predict outcomes
- assign certainty

> Antigravity Notes:
> This section should be static, always visible, and linked from AI-related UI elements.

---

## 2. How to Think About Land

### Land Is a Constraint Problem

Most land issues are discovered late.
Land Oracle AI helps surface constraints early.

Examples:
- environmental overlays
- zoning incompatibilities
- access limitations

---

### Think Spatially, Not Sequentially

Land decisions happen on a map.
The map is the primary thinking surface.

Tables and exports are secondary.

---

### Guide Attention, Not Certainty

Visual signals help users decide:
- where to look closer
- what differs from nearby parcels

They are not conclusions.

---

## 3. The Core Workflow

### Why a Workflow Exists

Land Oracle AI follows a repeatable loop that mirrors how experienced land professionals think.

---

### The Workflow

Map → Filter → Click → Evaluate → Decide

> UI Reference:
> Insert simple workflow diagram (not a screenshot)

---

### Step Breakdown

**Start Broad**
Understand the landscape before narrowing.

**Filter Aggressively**
Remove obvious non-starters early.

**Click for Context**
Replace manual research with a unified view.

**Evaluate Constraints**
Look for deal-killers or unusual conditions.

**Decide**
Move forward, save for later, or discard.

---

## 4. Understanding the Dashboard

### The Dashboard as Command Center

The dashboard brings all analysis into one place.

> UI Reference:
> Dashboard overview with labeled callouts

---

### The Map (Opportunity Surface)

The map shows parcels spatially.
Colors guide attention, not decisions.

---

### The Filter Panel

Filters remove parcels from view.
They reduce noise before analysis begins.

---

### The Context Panel

Appears when a parcel is clicked.
Summarizes key information:
- ownership
- land use
- constraints
- AI-assisted summary

> UI Reference:
> Context panel close-up

---

### Layers vs Parcels

Layers add context.
Parcels are selectable objects.

Use layers to ask one question at a time.

---

### Shapes: Hide vs Clear

Shapes act as geographic filters.

- **Hide (Eye icon):**
  - hides the shape visually
  - keeps results visible
  - filtering remains active

- **Clear (Trash icon):**
  - removes shape
  - resets results

> UI Reference:
> Shape with Hide / Clear controls

---

## 5. How AI Helps (and Where It Stops)

### What AI Does

- Summarizes dense rules
- Translates codes into plain language
- Highlights overlapping constraints

---

### What AI Does Not Do

- Decide feasibility
- Recommend purchases
- Replace professionals

---

### How to Interpret AI Summaries

AI summaries are **contextual aids**.
They should trigger questions, not answers.

---

## 6. Using Filters & Shapes Effectively

### Filter Early Philosophy

The biggest mistake is trying to see everything.

---

### High-Impact Filters

- Acreage (min/max)
- Land Use category
- Environmental exclusions

---

### Avoid Over-Filtering

If no results appear:
- relax constraints
- reassess assumptions

---

### Filters vs Layers

Filters remove parcels.
Layers add information.

---

## 7. Reports & Sharing

### When to Use Reports

Reports are useful when:
- sharing with partners
- documenting analysis
- aligning stakeholders

---

### What Reports Include

- parcel overview
- constraint summaries
- AI-assisted highlights

---

### What Reports Are Not

They do not replace surveys, title, or inspections.

> UI Reference:
> Report preview (first page only)

---

## 8. Common Use Cases

### Land Investors
Screen many parcels quickly.

### Developers
Assess feasibility before capital spend.

### Solar & Energy
Evaluate physical suitability early.

### Agricultural Buyers
Understand land quality and exposure.

### Brokers & Advisors
Communicate land context clearly.

---

## 9. Common Mistakes & Misunderstandings

- Treating the platform as advice
- Skipping filters
- Visual overload
- Confusing land use with zoning
- Expecting AI to know strategy

---

## 10. Reference & Glossary

### Land Use Codes Reference

(Include full 00–99 list here — already provided)

---

### Key Definitions

**Constraint** – Any factor limiting land use  
**Layer** – Contextual overlay  
**Filter** – Removes parcels  
**Opportunity Surface** – Map-based decision view  
**Context Panel** – Parcel summary view

---

## Implementation Guidance (Antigravity)

- Each top-level section = one support page section
- Subsections = accordions or anchors
- Screenshots optional but limited
- Text is primary source of truth
- Chatbot should reference section titles verbatim

---

## End of Document
