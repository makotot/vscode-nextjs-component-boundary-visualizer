# Release Flow

0. `npx changeset`
1. `npx changeset version`
2. `git commit -m "chore(release): v$(npm pkg get version | tr -d '\"')"`
3. `vsce publish patch|minor|major`
4. `git push --follow-tags`
