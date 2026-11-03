"""PreToolUse hook: enforce the branch rules before `git commit` and `git push`.

Blocks the command when it would commit on, or push to, `main` or `develop`.
Otherwise it reminds the model of the rules and points to the
`git-branch-rules` skill. See CONTRIBUTING.md for the rules.
"""

import json
import re
import subprocess
import sys

PROTECTED = ("main", "develop")
GIT_WRITE = re.compile(r"\bgit\b[^;&|\n]*?\b(commit|push)\b")
SKILL_HINT = "Invoke the `git-branch-rules` skill and follow CONTRIBUTING.md."


def current_branch() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def pushes_to_protected(command: str) -> bool:
    """Detect `git push origin main`, `git push origin HEAD:develop`, etc."""
    for part in re.split(r"[;&|\n]", command):
        if not re.search(r"\bgit\b.*\bpush\b", part):
            continue
        for token in part.split():
            target = token.split(":")[-1].removeprefix("refs/heads/")
            if target in PROTECTED:
                return True
    return False


def respond(decision: str, message: str) -> None:
    output = {"hookEventName": "PreToolUse"}
    if decision == "deny":
        output["permissionDecision"] = "deny"
        output["permissionDecisionReason"] = message
    else:
        output["additionalContext"] = message
    print(json.dumps({"hookSpecificOutput": output}))


def main() -> None:
    payload = json.load(sys.stdin)
    command = payload.get("tool_input", {}).get("command", "")
    match = GIT_WRITE.search(command)
    if not match:
        return

    branch = current_branch()
    action = match.group(1)

    if action == "commit" and branch in PROTECTED:
        respond(
            "deny",
            f"Blocked: you are on `{branch}`, which accepts no direct commits. "
            f"Create a branch from an up-to-date `develop` "
            f"(feat/, fix/, docs/ or chore/ prefix), then commit there. {SKILL_HINT}",
        )
    elif action == "push" and (branch in PROTECTED or pushes_to_protected(command)):
        respond(
            "deny",
            f"Blocked: never push to `main` or `develop` (current branch: `{branch}`). "
            f"Push a feat/, fix/, docs/ or chore/ branch and open a pull request "
            f"to `develop`. {SKILL_HINT}",
        )
    else:
        respond(
            "allow",
            f"Branch rules reminder (branch: `{branch}`): the branch must use a "
            f"feat/, fix/, docs/ or chore/ prefix, commits follow Conventional "
            f"Commits in English with no mention of Claude, and changes reach "
            f"`develop` through a pull request approved by Thibault. {SKILL_HINT}",
        )


if __name__ == "__main__":
    main()
