---
id: 36
title: Reverse Prompting as Purification Capability
tags: [purification, reverse-prompting, verification, lossless, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Reverse prompting: generate prompts from stored knowledge entries and verify they reconstruct the original intent. If a knowledge entry is complete, it should be possible to derive the original instruction from it. This is the inverse of the archival check — not "is the prompt stored?" but "does the stored knowledge reproduce the prompt's meaning?" A form of knowledge validation through generation.

## Layer 2 — Full Detail

### The concept

Forward: human prompt → knowledge entry (current flow)
Reverse: knowledge entry → reconstructed prompt → compare to original

If the reconstructed prompt is semantically equivalent to the original, the entry is complete. If it diverges, the entry is lossy — it captured something, but not the full intent.

### As a purification tool

Run after a session: for each knowledge entry written during the session, generate a "what instruction would produce this entry?" prompt. Compare to the original human message. Gaps surface as semantic divergence.

This is stronger than archival checking (did we store the prompt?) and complementary to semantic gap analysis (is the knowledge system complete?). It closes the loop: entry → prompt reconstruction → validation.

### Practical form

An agent is given a knowledge entry and asked: "What human instruction would have produced this entry? Reconstruct the original intent in one sentence." The result is compared (semantically, not literally) to the stored prompt. This can be automated as a scored check: high similarity = entry is faithful, low similarity = entry may have drifted from original intent.

### Relationship to embedding optimization

In the vector DB phase, reverse prompting can also serve as an embedding quality check: embed the reconstructed prompt, compare its vector to the original prompt's vector. Distance = fidelity score. This gives a quantitative lossless metric.
