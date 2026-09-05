# Meadow Mail

A small third-person Three.js prototype about delivering mail, making paths, and helping animal neighbours feel closer together.

## Play

### GitHub Pages

The complete game is on `main`. To enable its public GitHub site:

1. Open [Settings → Pages](https://github.com/Adam-Vozzo/game9/settings/pages).
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open [Deploy Meadow Mail to GitHub Pages](https://github.com/Adam-Vozzo/game9/actions/workflows/pages.yml), choose **Run workflow**, and run it on **main**. If a run failed before Pages was enabled, rerun it after step 2.
4. Once deployment succeeds, play at **https://adam-vozzo.github.io/game9/**.

Future pushes to `main` rebuild and publish the game automatically. No API keys or backend are needed. Use the Actions source above; publishing the raw source branch would show the README instead of the compiled game.

The Pages build shares the exact game component and engine with the Sites build. It bundles a client-only entry, uses relative asset URLs for `/game9/` or a custom domain, and validates the output before uploading `dist/pages`. To build and preview that artifact locally:

```sh
npm run build:pages
npm run preview:pages
```

### Local development

Requires Node.js 22.18+ (24 recommended) and a browser with WebGL2.

```sh
npm ci
npm run dev
```

Open the local address printed by the server. The game opens directly on the island. Visit the gold envelope at Willow Post Office and press **E** to collect your first parcel. A complete round takes roughly 10–15 minutes at a relaxed pace.

| Input                | Action                                           |
| -------------------- | ------------------------------------------------ |
| WASD / arrow keys    | Move relative to the camera; steer while sailing |
| E / on-screen prompt | Pick up, deliver, board, or dock                 |
| Shift                | Jog using energy                                 |
| Space                | Steady a heavy parcel                            |
| Drag / scroll        | Orbit camera / zoom                              |
| M / J / B            | Map / journal / route improvements               |
| Escape               | Close a panel                                    |

Touch devices have directional buttons and a tappable interaction prompt. Sound is opt-in. Panels pause the simulation. Progress saves locally in this browser, with a reset in Help. Reloading during sailing resumes safely on Willow Isle while retaining deliveries and upgrades.

## Prototype features

- Procedural fox courier with walking animation, satchel and visible cargo.
- Five letters/parcels, four animal neighbours, journal entries and thank-you stamps.
- Light traversal friction: parcel weight, sway, stamina and better boots.
- Purchasable creek bridge, restorative flower path and woodland shortcut.
- Tangible story effects: sunflowers bloom, friends meet for a picnic, a harbour workshop appears, and a lighthouse lights up.
- A steerable sailboat unlocked by the third delivery, two docks and a second explorable island.
- Eight-minute day/night loop, rotating windmill, drifting clouds, birds, wandering rabbits and swimming ducks.
- Live destination marker, minimap, expanded map, responsive HUD and reduced-motion support.
- Original procedural geometry and synthesized audio; no external asset downloads or API keys.

This is a compact vertical slice, not the proposed large open world. Route improvements use authored locations. There is no gondola, train, oil rig, houseboat interior, advanced sailing physics, NPC dialogue tree, multiplayer or full cargo-balancing simulation. The small world and five-delivery story are intended to test whether the core loop is enjoyable before scaling it up.

## Development

The app preserves the Sites React/Vinext scaffold. Three.js runs client-side and is loaded lazily. The build is a static export, with no server or database required.

- `app/page.tsx`: HUD, map, journal, improvements and controls.
- `lib/game/engine.ts`: game loop, movement, camera, interaction, audio and lifecycle cleanup.
- `lib/game/world.ts`: terrain, cottages, characters, flora, wildlife and story props.
- `lib/game/state.ts`: pure progression, save validation and traversal rules.
- `lib/game/webmcp.ts`: optional browser tool registration for reading progress and purchasing improvements through the same game actions.

```sh
npm test
npm run typecheck
npm run build
```

Tests cover the five-delivery round, upgrade economy, corrupt-save recovery, bridge and shortcut access, island route reachability and dock locations. The TypeScript check and static builds validate the complete application. The GitHub Pages artifact was also played in Chrome under `/game9/`: startup, asset loading, keyboard movement, parcel pickup and delivery, bridge purchase, journal, save/reload and mobile layout passed with no browser errors or failed requests. Desktop and mobile screenshots were inspected. A native WebMCP runtime contract check remains unverified; WebMCP is optional and does not affect normal play.

Deployment uses the static output directory recorded in `.openai/hosting.json`. The repository includes a CI workflow for tests, type checking and build. Starter dependencies are retained; audit the dependency tree before adapting this into a production service.
