# night

![banner](.img/banner.png)

## Why

AI today is monolithic. Static weighted models wrapped in chat interfaces with context windows and tool access. Powerful — but the vectors that make it work are locked inside black boxes, and the systems around them are architecturally conventional.

This is a quest to understand how those vectors might be assembled differently — in accordance with how such a system most naturally can be built. Explored from the intersection of system design intuition, the nature of software, and what completion models actually are beneath the product surface.

Not a research lab. A personal exploration, augmented by the capability of current AI, uncovering what isn't yet embodied in the ecosystem.

## What

A knowledge system exploring a fundamentally different relationship between AI and memory. Where existing systems bolt memory onto models as a tool, this explores making knowledge constitutive — the thing that makes an agent *this agent*, not an accessory to it.

The ideas range from the immediate to the visionary:
- A commit-based knowledge database built from minimal primitives (chunks, dimensions, weighted relationships)
- Scope-based navigation where structure emerges from the reader's focus, not from imposed hierarchy
- Integration contracts that let agents and browsers depend on the knowledge structure
- At the furthest concrete end: integrating completion models directly into the knowledge system's cycle

All of this grew from earlier, more visionary exploration into the nature of AI and systems [the-strange-of-agi](https://github.com/Cwejman/the-strange-of-agi). The point of this repo is to take a more grounded approach. Later when enough ground is made the strange topics will be brought back in for reflection. But one step at a time. There is already concrete progress to be made here.

## How

Still in ideation. The primitives have been explored and stress-tested across multiple domains. No code yet — more requirements to settle before building. The exploration lives in `knowledge/`, the sub-directory `/legacy` was a premature attempt at working in a lossless, memory based format with claude, the current .md files in knowledge work much better and dont aim to be any kind of embedding system. There are some things left in legacy to bring back out, but not much.
