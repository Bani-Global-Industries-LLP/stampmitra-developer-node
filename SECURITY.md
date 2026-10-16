# Security Policy

## Reporting a vulnerability

Email **security@stampmitra.in** with a description, reproduction steps and the affected
version. Please do not open a public issue for security problems. See also
<https://developer.stampmitra.in/security.txt>.

We acknowledge reports promptly and will keep you informed while we investigate and fix.

## Supported versions

This SDK is pre-1.0; only the latest 0.x release receives security fixes.

## Handling API keys

`sk_test_` / `sk_live_` keys are secrets. Use this SDK server-side only and never ship keys in
browser or mobile apps. If a key leaks, rotate it in the StampMitra developer dashboard.
