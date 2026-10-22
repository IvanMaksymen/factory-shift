# Factory Shift

An original HTML5 factory puzzle and idle game. Build production lines, combine metals, complete orders, and expand your factory.

## Play locally

Open `dist/index.html` in a browser. No installation or server is required.

## Build and test

Requires Node.js; no external dependencies.

```sh
npm test
npm run build
```

## Vercel

Import this repository into Vercel. The included `vercel.json` builds the standalone game and publishes only `dist/`.

Progress is saved in the current browser on the current website. To transfer from a downloaded HTML copy or another device, use Settings → Export save, then Settings → Import save on the website.

## CrazyGames

`npm run build:crazygames` creates the separate SDK build in `crazygames/`. See `CRAZYGAMES.md`. This repository does not automatically publish to CrazyGames.

See `README_UA.md` for Ukrainian instructions and `QA.md` for verification details and limitations.

Version 0.4.6. All rights reserved; no open-source license is granted.
