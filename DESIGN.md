# CloudStead: design direction

A study companion: a focus timer, the visitor's own YouTube music, and a small island above the
clouds that its resident, VMK, builds out while the visitor focuses. The island never changes by
itself: every new cell, plant, building and piece of gear is seen being made by VMK.

**Direction (from the owner).** A reference screenshot of a cinematic hero: a floating chunk of
cliff in a sea of golden clouds at a low sun, a person sitting with a laptop on it, a small
wooden hut and power poles, giant words bottom left, a short paragraph and a pill button bottom
right, and a black tab hanging from the top edge with the navigation. The owner asked for it
without the reference's word ("tanpa tulisan prisma"), for a web app to study with music like
their StudyCabin and SongPlay, for a resident who develops a world of tiles ("dunia petak") as
progress, for progress that can be saved and reset, and for a responsive cursor that can play with
the resident. The reference's own code, video and copy are not used; only its look is.

**Design Read.** Reading this as: an ambient study app (software) for students who study at a
screen with music on, in a cinematic golden-hour diorama style taken from the owner's reference,
dial **ENERGY 3 / RHYTHM 1 / MOTION 3**.

- ENERGY 3: a full-bleed live scene and giant numerals, as in the reference.
- RHYTHM 1: one screen; every panel uses the same template, so the island is what changes.
- MOTION 3: the product is a living place (clouds drifting, the resident typing, building,
  sleeping, birds and fireflies). Interface motion stays small.

## The deal (taste-skill 2.5.1)

- Kind: software (page type software, site-kind software). The live island is the hero and the
  page's one effect; it carries `data-enter="off"` because the scene has its own load motion.
- Palette through `start.mjs brand`, taken from the reference: tab black `#0d0e11`, cloud cream
  `#e7e4d1`, low-sun gold `#f0a04b` (accent).
- Type: Funnel Display and Funnel Sans (the first dealt pairing), self-hosted through Fontsource.
- Radius: round (a consumer app, and the reference's pill button).

## Decisions and their reasons (R-31)

| Decision | Reason |
| --- | --- |
| Vite, TypeScript and a live Three.js scene, no React or shadcn | One screen with a canvas: a framework adds nothing, and the owner's other ambient apps use the same stack. The reference's pasted component is a reference only. |
| The island is made of tiles that rise out of the clouds | "Dunia petak": each cell is a block with a grass top, an earth band and a faceted rock under it, so the island literally grows by cells (9 at the start, 37 at the end). |
| 28 milestones over 23 hours 20 minutes of focus | The first ones come in minutes (flowers at 5, two cells at 15) so the first session already changes the island; the last ones (a balloon, a waterfall) reward a semester. |
| VMK does the work for every upgrade, during focus | The owner's correction: the resident should not sit still while the island upgrades on its own. Each milestone is a project; while a focus block runs VMK works on it (planks from the crate and a hammer for buildings, a shovel and a watering can for plants, a rope that hauls new cells up from the clouds, making gear by hand at the seat), and the piece stands exactly as far as the progress line: built up to a cut, with a faint plan of the rest above it. |
| A construction site with stakes, a string and a pile of planks | Shows where the next piece goes and that it is unfinished, even when the timer is off. |
| In a break VMK rests; without a timer he lives on the island (walks, waters the plants, looks at the site, uses the laptop) and the project waits | Keeps the rule plain: the island grows only from focus, and VMK is never just parked at the seat. |
| The resident is called VMK (the owner's initials) and can be renamed | Asked for by the owner. Saves that still carry the first default ("Bayu") move to VMK. |
