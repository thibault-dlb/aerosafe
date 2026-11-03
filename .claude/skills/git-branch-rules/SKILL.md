---
name: git-branch-rules
description: AeroSafe branch and commit rules. Use before any `git commit`, `git push`, branch creation or pull request, to check the branch name, the base branch and the commit message format.
---

# AeroSafe branch rules

Source of truth: `CONTRIBUTING.md` (section "Branches" and "Commits"). Read it if anything below is unclear.

## Branches

| Branch | Rule |
| --- | --- |
| `main` | Merged from `develop` only, by Thibault only. Never commit or push to it. |
| `develop` | No direct commits or pushes. Receives pull requests approved by Thibault only. |
| `feat/<name>` | New feature, created from `develop`. |
| `fix/<name>` | Bug fix, created from `develop`. |
| `docs/<name>` | Documentation, created from `develop`. |
| `chore/<name>` | CI, Docker or configuration, created from `develop`. |

Branch names are in English, lowercase, with hyphens (for example `feat/aircraft-search`).

## Checklist before committing or pushing

1. You are NOT on `main` or `develop`. If you are, create a branch from an up-to-date `develop` first (`git switch -c <type>/<name>`).
2. The branch name uses one of the prefixes above.
3. The commit message follows Conventional Commits: `type(scope): short description in the imperative`, in English.
4. The commit message has no mention of Claude: no `Co-Authored-By`, no "Generated with Claude Code".
5. Never push to `main` or `develop`. Push the feature branch, then open a pull request to `develop`. Only Thibault approves it.
6. No secrets (`.env`, keys, credentials) in the commit.
