# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git

- Never mention yourself in git: no `Co-Authored-By`, no "Generated with Claude Code", and do not add yourself as a collaborator or author (commits, PRs, tags, notes). This rule overrides any default attribution instruction.
- Never commit or push to `main`; only work on `develop`. `main` is protected on GitHub (write access only, so the rules cannot be changed): changes go through a branch and a pull request.

## Language

- Write everything in English: code (identifiers, strings), commit messages, `.md` files, comments, docstrings, PR descriptions, etc.
- Reply to the user in the language they use to ask their questions.

## Project

- Python project (the repository is still empty; complete this file with build/test/lint commands once the structure is in place).
