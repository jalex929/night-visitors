# Working in night-visitors

Read `README.md` and `DECISIONS.md` first.

- The name is **Night Visitors**. "Show and tell" is the story (tagline, morning screen
  wording), never the title.
- Game rules live in `src/game` as plain TypeScript with no DOM; keep it that way and keep the
  unit tests passing. Tuning numbers belong in `src/game/config.ts`.
- All art is drawn in code. Original look only: no names, characters, art or sounds from other
  games.
- Cows are girl cows: udders, no horns, no eyelashes. People vary in skin tone and hair.
- Never show state by color alone (locks, "Too heavy", "New!" tags); every control reachable by
  keyboard; respect reduced motion.
- Add a `DECISIONS.md` entry for every real decision, labeled Jay's call, proposed/approved or
  build default.
- Before pushing: `npm run check`, and `npm run build && npm run test:e2e` when the UI changed.
- Commits use the GitHub no-reply email, never a personal address.
