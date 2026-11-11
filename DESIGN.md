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
| Progress counts only while a focus block runs | One plain rule the panel states; breaks are not counted. A block left running while the tab is closed is counted up to its end. |
| Autosave plus a save button, a file to download and load, and a reset behind a dialog | The owner asked for save and reset. Autosave means nothing is lost; the button confirms; the file is a backup; reset is destructive, so it asks first and offers the download. |
| Preview mode (`?pratinjau=<minutes>`) that never writes | Lets the visitor see the finished island, and lets the checks render it, without touching a real save. |
| A custom cursor over the island only: a dot on the mouse and a trailing ring that stretches with speed and changes over the resident, cells and pieces | The owner asked for a responsive cursor that plays with the resident. Over the interface the system pointer stays, so every control keeps its own pointer (R-39). Mouse only. |
| Hover makes the resident look at you; a click greets (a poke during focus); holding pets them | The interaction the owner asked for, with lines that fit the moment (focus, break, idle). The grass parts round the pointer too. |
| VMK's name tag is a real button | Keyboard and touch users can greet him; it steps aside while he speaks or the pointer is on him. |
| The black tab hanging from the top, centred | The reference's composition, kept on purpose; the wordmark sits inside it so its contrast never depends on the sky. |
| Giant numerals bottom left are the timer | The reference's giant word, made into live state. Its ink switches between cream and black from the pixels under it, so it keeps 3:1 or better on gold clouds and on night. |
| Small text on dark plates (92% black) | 4.5:1 over the brightest midday cloud. Blur on the story plate and the open panel only (R-10). |
| Gold accent only on the meter, the active tab mark, focus rings and state | One warm note, the low sun. The primary button is cream with a black round end, as in the reference. |
| Clouds drawn as lit billows (a union of spheres stored as normals and a distance field) | The reference's crisp cumulus, lit from wherever the sun stands, smooth at any size. |
| Senja (golden hour) by default, with morning, midday, night and "follow the clock" | The reference's light is the first impression; the other times give long sessions a change. Night lights the lamp, the hut and the laptop screen. |
| Sound made in the browser: wind, birds by day and crickets at night, the resident's keys, building knocks | The island's own sound under the visitor's music; it ducks when music plays and every layer has its own switch. |
| Music by pasted YouTube or YouTube Music links, plus two public Lofi Girl live streams as suggestions | Same approach as StudyCabin; the suggestions were live and embeddable on 12 November 2026 (live stream addresses change when a stream restarts). |
| Green hoodie, dark hair, headphones (on the ears with music, round the neck without) | The same person as the owner's profile art, so the resident reads as theirs. |
| Film grain inside the sky and cloud shaders | The reference's grain, kept off the island and the interface. |

## Motion and why

- Scene entrance: the still poster fades as the live island comes in.
- A hauled cell follows the rope up from the clouds, swaying, and lands with a puff of dust.
- A finished piece gives a small bounce and a puff of dust while VMK cheers (the page's dealt
  moment: the work is done).
- During focus VMK works in rounds of about five seconds (hammer blows, shovel strokes, pulls on
  the rope), with walks to the crate for more material; the piece rises with the progress line.
- In a break he stretches and sips tea; without a timer he walks about, waters plants and checks
  the site, dozes after 2.5 minutes of nothing happening, and wakes when you come back.
- Panels fade with a 6 px rise, 200 ms open, 120 ms close. Buttons step on hover, press on click.
- The scene pause (the tab's pause button, the Suasana panel, the P key) freezes everything.
  Under reduced motion the scene starts paused and builds appear at once.

## Checks

The taste-skill gate is written for multi-section company sites. This page is one screen of app,
