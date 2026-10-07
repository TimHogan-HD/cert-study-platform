---
name: handoff-plans
description: Use before implementing any item from a content remediation or handoff plan (a phase list, gap list, or "add X to objective Y" document). Plans in this repo have repeatedly called for content that already exists.
---

# Working From Handoff Plans

Content remediation is driven by handoff documents. **They have been wrong repeatedly, in a consistent direction:** they infer gaps by comparing an objectives list against older notes instead of reading the live files, so they call for content that already exists.

- **Audit the live file before implementing any plan item — including items the plan states are missing.** Three consecutive revisions of the Domain 1 plan specified adding content that was already present: cellular, satellite, RJ11, NAT64, and in v3 the IPv4 address-class table, which the plan described as lacking Class E when all five classes were already there.
- **If an item turns out to be already covered, stop and report rather than duplicating it.** Extend what exists. Building a parallel component next to an equivalent one is the systemic failure mode on this platform — it is what produced the aggregate/per-objective drift that had to be cleaned up.
- **A grep hit is not coverage.** A topic name can appear in a comment, a cross-reference, or a note without the content itself being there. Read the surrounding context before concluding a topic is present or absent.
- **Cross-reference, do not copy.** The official objectives deliberately list the same topic under several objectives. Choose one authoritative location and point at it from the others.
