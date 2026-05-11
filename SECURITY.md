# Security Policy

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.** Open issues are visible to everyone — for anything that affects the safety of users, contact us privately first.

### Preferred: GitHub Private Vulnerability Reporting

Go to the [Security tab](https://github.com/1RubinaSingla/stable-boy/security/advisories/new) and click **Report a vulnerability**. This creates a private channel between you and the maintainers; nothing is visible publicly until we agree on a disclosure.

### Backup: DM on X

If the GitHub flow doesn't work for you, DM [@StableBoyPF](https://x.com/StableBoyPF) with the words "security report" and we'll move the conversation to a private channel.

## What's in scope

- **API key leaks** in git history, build artifacts, or environment variables exposed to the client
- **Scoring manipulation** vectors that let an attacker artificially inflate or deflate a wallet's score
- **Cross-site issues** in the receipt page (XSS, CSRF, etc.) — particularly because we accept arbitrary wallet addresses in the URL
- **Server-side vulnerabilities** in `/api/score`, `/api/accumulate-tags`, or the `/w/<addr>` server component
- **Supabase RLS bypasses** or service-key exposure in the bundled client code
- **Open-redirect or SSRF** in the OG image or badge SVG renderers

## What's out of scope

- **Score values you disagree with.** The score is a heuristic; use the [Score Disagreement issue template](https://github.com/1RubinaSingla/stable-boy/issues/new?template=score-disagreement.yml) instead.
- **Rate-limit complaints.** GMGN's 1 req/s ceiling is a fact of the dependency, not a vulnerability.
- **Outdated dependencies** without an exploitable path — Dependabot handles those automatically. Open a security report only if you have a working PoC.
- **Self-XSS** or other attacks that require an attacker to first compromise the victim's browser.

## Response expectations

This is a small project. We'll acknowledge a report within ~3 business days and aim to ship a fix or mitigation within 14 days for high-severity issues. Low-severity reports may be tracked in a public issue once disclosure is coordinated.

## Coordinated disclosure

If you give us a chance to ship a fix before going public, we'll credit you (with your permission) in the release notes. We won't pursue legal action against good-faith researchers.

## Past issues

None disclosed yet.
