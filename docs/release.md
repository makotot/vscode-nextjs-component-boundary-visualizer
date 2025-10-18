# Release Flow

0. `npx changeset`
1. `npx changeset version`
2. `git add -A && git commit -m "chore(release): v$(node -p \"require('./package.json').version\")" && git push`
3. `vsce publish`
