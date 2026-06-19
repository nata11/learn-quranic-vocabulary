# Learn Quranic Vocabulary

An open, mobile-friendly study site for the example phrases in
*How to Understand 85% of the Qur'ān* by Drs. Islām Fekry — built so
anyone can read each phrase in Uthmani script, hear it recited by
**Mishary bin Rashid al-Afasy**, and study it on a phone, tablet, or
laptop without installing anything.

Each chapter is a single self-contained HTML page. Tap a phrase and the
audio plays *only* that phrase — trimmed at runtime from the full ayah
using word-level timings — so you spend your time studying, not hunting
for the right spot.

## What you get

- **Per-chapter phrase decks** in your choice of two Uthmani-style
  fonts (Amiri Quran, Scheherazade New), with a size slider that scales
  Arabic and English together.
- **Alafasy recitation per phrase**, streamed and trimmed in the
  browser so each tap plays the matched span only.
- **Sahih International translation** alongside every phrase.
- **iPad / iPhone install:** open the site in Safari, tap **Share →
  Add to Home Screen**, and it launches full-screen like a native app.
- **No accounts, no ads, no tracking.** Just static HTML.

## Inspiration

This project exists because of Drs. Islām Fekry's free YouTube lesson
[**"Understand 85% of the Qur'an"**](https://youtu.be/phO4YyNJ244)
and the book of the same name. His channel and store are the source
material this site is built around:

- Channel: [youtube.com/@Arabic101](https://www.youtube.com/@Arabic101)
- Books & courses: [store.arabic101.org](https://store.arabic101.org)

If this site is useful to you, please support the author by buying his
book and workbook directly from his store.

## Study approach

A short, opinionated [**Learning Plan**](Learning%20Plan.md) is included
in the repo. It covers the five principles (active recall, spaced
repetition, context, production, multimodal encoding), a 20–30 min
daily routine, a per-chapter weekly workflow, and the spacing schedule
for review. It's written as a guide for anyone working through the book
alongside this site.

## Chapters

| # | List | Topic |
|---|---|---|
| 1 | List 1 | Demonstrative Pronouns |
| 2 | List 2 | Negations & Exceptions |

More chapters will be added one at a time.

## Layout

```
.
├── index.html                                  Landing page
├── Learning Plan.md                            Study plan (public)
├── Chapter 1 - Demonstrative Pronouns/
│   └── Coursebook/Phrases.html                 Interactive deck
├── Chapter 2 - Negations & Exceptions/
│   └── Coursebook/Phrases.html                 Interactive deck
└── assets/                                     Shared CSS/JS/icons
```

The original PDF coursebook and workbook are **not** included in this
repository — they are the author's copyrighted work. Get them from
[store.arabic101.org](https://store.arabic101.org).

## Credits

- **Source book:** *How to Understand 85% of the Qur'ān* by Drs. Islām
  Fekry — [arabic101.org](https://arabic101.org) ·
  [store.arabic101.org](https://store.arabic101.org).
- **Recitation:** Mishary bin Rashid al-Afasy.
- **Audio + segment timings:** [Quran.com](https://quran.com) API and
  the EveryAyah CDN.
- **Translation:** Sahih International.

## License

The site code (HTML, CSS, JS) is released under the [MIT License](LICENSE).
The Qur'anic text is in the public domain. The Sahih International
translation is freely redistributable under its own terms. The
recitation is provided by its respective CDNs under their terms. The
book content itself is not redistributed here — please buy the book
from [store.arabic101.org](https://store.arabic101.org).
