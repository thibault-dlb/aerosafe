# Known issues

Register of issues not fixed by the defence date, with their severity and any workaround. It is annexed to the documentation (§IX.3). The register, the severity levels and the warranty come from the specifications and are not in the project sheet.

## Register

| ID | Description | Severity | Workaround |
| --- | --- | --- | --- |
| K-01 | Login throttling counts failures per e-mail and client address, but behind nginx the API sees the proxy address, so anyone can lock an account for 15 minutes with wrong passwords | Minor | Wait 15 minutes. Fix: start uvicorn with `--proxy-headers --forwarded-allow-ips=<nginx address>` |
| K-02 | Login throttling counters live in memory: they reset when the API restarts and are not shared between API processes | Minor | None needed while the API runs as one process |
| K-03 | A refresh token used twice is refused, but the newer token issued from it stays valid (no token family revocation) | Minor | The refresh cookie is `HttpOnly` and `SameSite=Strict`, which limits theft |

## Severity levels

| Severity | Definition | Fix deadline |
| --- | --- | --- |
| Blocking | Prevents use of an essential feature or launching the application | Priority fix, before the defence |
| Major | Strongly degrades a feature without preventing its use; a workaround is possible | As availability allows, before the defence |
| Minor | Usability, display or wording defect with no functional impact | Recorded in the [change requests](change-requests.md) |

## Warranty

The warranty period runs from submission of the deliverable until the final defence, inclusive. During this period, the project group fixes issues according to the levels above.

The warranty does not cover:

- failures caused by the external data source being unavailable;
- failures caused by a change to its interface;
- use outside the scope defined in §II.

Any change requested after the deliverable is submitted belongs in the [change requests](change-requests.md), not the warranty.
