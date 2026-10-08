# Mind

*Early-stage app idea — not being built yet. Kept here so the thread isn't lost between conversations.*

## What it is

An app for the mind, from ideas Nate has held for a long time. It would bring together exercises from Richard Schwartz (Internal Family Systems), Byron Katie, Nicole Sachs, and others. The rest of the ideas are still to be captured here, in his words.

## How it relates to the rest

Nate doesn't know yet whether there is reason to integrate it with `life/`. The plan is to build it independently first, as `life/` and `finance/` are, using the shared `js/github.js`, and to add functions to `js/api.js` only if the two ever need to share data.

## Some of its data may be ephemeral

Nate's plan (September 2026): cache some mind data in the browser, so that he can express himself freely without concern for whether it is retained. This matters for storage. Git keeps every version of every file in its history, so anything saved to a GitHub repository is never really gone when it is deleted from the file, which is the opposite of what this is for. Browser-only storage is the right home for it, and its usual drawbacks (it stays on one browser and one device, and can be cleared) are part of what makes it suit the purpose. See "How `js/api.js` is developing" in `PROJECT.md`.

## Burning writing

Nate's idea (September 2026), which he thinks came from Nicole Sachs: write a letter you plan to burn immediately after writing. The app would let people "burn" writing they want to move from head to "paper" but never want anyone else to see.

- It is for words someone would never say to another person, or even write down.
- The goal is expression and discovery, not retention or communication.
- Storage would be deliberately fragile: kept in the browser only, with a warning that it could "blow away" on its own.
- Encryption could be considered.
- Nate's own caution: we may be taking this digital design too far. Paper could be used and shredded.

Things to work out:

- What does the app give that paper and a shredder don't? Being honest about this may decide whether it gets built at all.
- Is anything kept before it is burned, so a closed tab doesn't lose it, or is writing gone the moment the page is closed? Nate's "blow away on its own" points at the first.
- Is burning always a real deletion? In the browser it can be, which is a reason it doesn't belong in git.
- What would encryption protect against? Someone else using the same browser is one case. A key kept in that browser doesn't stop that, and a passphrase that is forgotten loses the writing, which may suit the purpose.

## Two layers

Nate's idea (September 2026): design this as two separate layers, and perhaps one app serves both body and mind.

1. **A layer for organizing exercises.** The app: browsing, choosing, doing, organizing potential body and mind work. It is the part other people could use, and they may want to bring in other ideas than Nate's.
2. **The exercises themselves, as data.** Each exercise, with where it came from (Richard Schwartz, Byron Katie, David Grey, Shah Boroumand, and so on), kept as plain files in the user's own data repository, like everything else in this suite.

Body versus mind would then be a property of the data, not a reason for two apps.

Things to work out:

- Some exercises need a capability, not only a description. Burning writing is an exercise that needs its own private space. Does the organizing layer point to such tools, or does each live inside the app?
- Exercises come from people's own work. Which the app could ship, and which each user brings as their own data, is worth deciding on purpose, not by default. The two-layer split makes bringing your own natural.

## Building the Compass here

Nate's idea (September 2026): building a Compass could be done in this app and shipped to `life/`. Making a Compass (from *How to Live a Meaningful Life*, with the personal story, workview and lifeview reflections that lead to it) is an exercise, like the others, and its result is lasting data, unlike burned writing. `life/` would then read the Compass it is checked against (see `life/compass-with-goals.md`).

This follows the pattern already used between finance and life: the app that owns the data writes it, and other apps read it through `js/api.js`. Here `mind/` would own the Compass, and `life/` would read it through something like `api.getCompass`.

Until this app exists, `life/` can be built and tried against a Compass file written by hand, as long as both agree on the file's shape. What has to be decided is where the Compass lives once this app owns it, which depends on the open question below about where this app's lasting data lives.

## The ideas

*The rest are still to fill in.*

## Open questions

- Does the cached data expire on its own, or stay until Nate clears it? Freedom to express without concern for retention may depend on the app being clear and trustworthy about which it is.
- Which of the mind data is cached only in the browser, and which is meant to last?
- Where does the lasting part live: `life-management-data`, or a private repository of its own?
- Is it one app together with `body/`, or two?
