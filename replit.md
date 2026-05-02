# MAKAMESCO DL

A social media downloader web app built with React + Vite + Tailwind CSS. Allows users to download videos and audio from TikTok, YouTube, Instagram, Facebook, and X/Twitter, as well as search for music on YouTube.

## Architecture

- **Frontend only** — no backend server required
- All API calls go directly to third-party external APIs (apiskeith.top, api-rebix.zone.id, etc.)
- Multi-API rotation logic for reliability (tries multiple endpoints if one fails)

## Artifacts

- `artifacts/makamesco-dl/` — Main web app (`@workspace/makamesco-dl`)
  - Preview path: `/`
  - React + Vite + Tailwind CSS v4

## Key Files

- `artifacts/makamesco-dl/src/App.tsx` — Main app component with all logic and UI
- `artifacts/makamesco-dl/src/index.css` — Tailwind CSS base styles
- `artifacts/makamesco-dl/index.html` — HTML entry with page title and Inter font

## Features

- Platform selection grid (TikTok, YouTube, Instagram, Facebook, X/Twitter)
- Music Search via YouTube Search API
- Multi-API rotation for reliable downloads
- Download HD Video + MP3 Audio links for found media
- Dark theme with cyan/blue gradient accents

## Visual Identity

- Background: `#05070a` (near black)
- Accent: cyan-400 to blue-500 gradient
- Typography: Inter, bold uppercase tracking
- Rounded cards with gradient backgrounds per platform
