---
name: awesome-design
description: A library of 74 brand-inspired design systems, each a DESIGN.md carrying concrete tokens — colours, typography, spacing, corner radii and component rules. Use when the user wants a UI built in the visual language of a known product ("make it look like Stripe", "a Linear-style dashboard", "something with Apple's restraint"), when they ask for a DESIGN.md or design-token set for their own project, or when a design needs a coherent reference system instead of invented values. Also useful for comparing how established products solve type scale, colour ramps, elevation and density.
license: MIT
metadata:
  source: https://github.com/VoltAgent/awesome-design-md
  upstream_author: VoltAgent
---

# Awesome Design

A vendored copy of the `awesome-design-md` collection: 74 design systems
distilled from well-known products, one directory per brand under `design-md/`.

## How to use it

Read only the file you need. Each brand is a single self-contained
`design-md/<brand>/DESIGN.md`, so never load the whole collection — pick the
one that matches the brief and read it in full.

Every `DESIGN.md` opens with YAML frontmatter holding the machine-usable part
of the system:

| Key | Contents |
|---|---|
| `colors` | Named ramp — primary and its press/hover/subdued steps, ink levels, canvas, hairlines, accents |
| `typography` | Families, weights, sizes, letter-spacing, and where each is used |
| `rounded` | Corner-radius scale |
| `spacing` | Spacing scale |
| `components` | Per-component rules: buttons, cards, inputs, navigation |

Prose after the frontmatter explains the reasoning — why the type is set that
way, what the brand does with density and restraint. Read it when the goal is
to match the *feel*, not only the values.

Workflow: pick a brand, take its tokens as the starting scale, then adapt them
to the project's own palette and content. Do not paste a whole system in
unchanged — these are references, not drop-in themes.

## Two cautions

**These are third-party interpretations, not official brand guidelines.** They
were reverse-engineered from public sites by the collection's authors. Some
files name the brand directly, others mark themselves "Inspired". Treat the
values as a well-observed approximation, never as a brand's authoritative spec.

**Do not ship another company's identity as your own.** Borrowing a type scale,
a spacing rhythm or an approach to colour is ordinary design practice.
Reproducing a recognisable brand's full visual identity — its palette, logo
treatment and typography together — on a real product invites a trademark or
passing-off problem. Use these to learn structure, not to clone a brand.

## Available brands

`airbnb` `airtable` `apple` `binance` `bmw` `bmw-m` `bugatti` `cal` `claude`
`clay` `clickhouse` `cohere` `coinbase` `composio` `cursor` `dell-1996`
`elevenlabs` `expo` `ferrari` `figma` `framer` `hashicorp` `hp` `ibm`
`intercom` `kraken` `lamborghini` `linear.app` `lovable` `mastercard` `meta`
`minimax` `mintlify` `miro` `mistral.ai` `mongodb` `nike` `nintendo-2001`
`notion` `nvidia` `ollama` `opencode.ai` `pinterest` `playstation` `posthog`
`raycast` `renault` `replicate` `resend` `revolut` `runwayml` `sanity`
`sentry` `shopify` `slack` `spacex` `spotify` `starbucks` `stripe` `supabase`
`superhuman` `tesla` `theverge` `together.ai` `uber` `vercel` `vodafone`
`voltagent` `warp` `webflow` `wired` `wise` `x.ai` `zapier`

## Provenance

Collection: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md), MIT — see `LICENSE`.

Upstream ships the collection without a `SKILL.md`; this file is a local
wrapper written to expose it to Claude Code. The `design-md/` files themselves
are byte-identical to upstream. The per-brand `README.md` stubs were left
behind — each only pointed at the project's website and carried no design
content.
