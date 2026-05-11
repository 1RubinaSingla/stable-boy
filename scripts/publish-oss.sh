#!/usr/bin/env bash
# Publish the current working-tree state to the public OSS repo as a fresh
# single-commit snapshot.
#
# Usage:
#   npm run publish-oss -- "Release: short message"
#   npm run publish-oss               # uses HEAD commit message
#
# Model: each publish replaces the public repo's history with one new commit.
# This trades commit-history granularity for hard guarantee that no private-
# repo history (which contained an old leaked API token from early dev) ever
# makes it to the public side.

set -euo pipefail

# --- configuration -----------------------------------------------------------
OSS_ACCOUNT="1RubinaSingla"
OSS_ID="34986862"
OSS_EMAIL="${OSS_ID}+${OSS_ACCOUNT}@users.noreply.github.com"
OSS_REMOTE="oss"
PRIVATE_ACCOUNT="dev79-code"
MAIN_BRANCH="main"
ORPHAN_BRANCH="oss-publish-$(date +%s)"

# --- helpers -----------------------------------------------------------------
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }

die() { red "✗ $*"; exit 1; }
ok()  { green "✓ $*"; }

# Restore the user's environment on any exit path.
cleanup() {
  local exit_code=$?
  # Get back to main branch if we strayed.
  if git rev-parse --verify "$ORPHAN_BRANCH" >/dev/null 2>&1; then
    git checkout -q "$MAIN_BRANCH" 2>/dev/null || true
    git branch -D "$ORPHAN_BRANCH" >/dev/null 2>&1 || true
  fi
  # Switch gh CLI back to the private account if the publish was running.
  if [[ "${RESTORE_GH_ACCOUNT:-}" == "1" ]]; then
    gh auth switch -u "$PRIVATE_ACCOUNT" >/dev/null 2>&1 || true
  fi
  if [[ $exit_code -ne 0 ]]; then
    red "publish-oss aborted (exit $exit_code)"
  fi
}
trap cleanup EXIT

# --- preflight ---------------------------------------------------------------
yellow "publish-oss · preflight"

command -v gh >/dev/null || die "gh CLI not installed"
command -v git >/dev/null || die "git not installed"

# Working tree must be clean.
if [[ -n "$(git status --porcelain)" ]]; then
  die "working tree is dirty — commit or stash first"
fi
ok "working tree clean"

# Must be on main.
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "$MAIN_BRANCH" ]]; then
  die "not on $MAIN_BRANCH (currently on $CURRENT_BRANCH)"
fi
ok "on $MAIN_BRANCH"

# `oss` remote must point at the public repo.
if ! git remote get-url "$OSS_REMOTE" >/dev/null 2>&1; then
  die "remote '$OSS_REMOTE' missing — run: git remote add $OSS_REMOTE https://github.com/$OSS_ACCOUNT/stable-boy.git"
fi
OSS_URL="$(git remote get-url "$OSS_REMOTE")"
if [[ "$OSS_URL" != *"$OSS_ACCOUNT"* ]]; then
  die "remote '$OSS_REMOTE' points at $OSS_URL — expected something under $OSS_ACCOUNT"
fi
ok "oss remote → $OSS_URL"

# Both gh accounts must be authenticated.
if ! gh auth status 2>&1 | grep -q "Logged in to github.com account $OSS_ACCOUNT"; then
  die "gh not authenticated as $OSS_ACCOUNT (run: gh auth login)"
fi
if ! gh auth status 2>&1 | grep -q "Logged in to github.com account $PRIVATE_ACCOUNT"; then
  yellow "warning: gh not authenticated as $PRIVATE_ACCOUNT — you'll need to re-auth before pushing to private origin"
fi
ok "gh auth ready"

# --- determine commit message ------------------------------------------------
if [[ $# -gt 0 && -n "$1" ]]; then
  MSG="$1"
else
  MSG="$(git log -1 --pretty=%s)"
  yellow "no message given — using HEAD subject: $MSG"
fi

# --- do the publish ----------------------------------------------------------
yellow "publish-oss · switching gh to $OSS_ACCOUNT"
RESTORE_GH_ACCOUNT=1
gh auth switch -u "$OSS_ACCOUNT" >/dev/null

yellow "publish-oss · creating orphan commit"
git checkout --orphan "$ORPHAN_BRANCH" >/dev/null 2>&1
# `--orphan` keeps the working tree as-is; index already has main's tree.
git -c "user.email=$OSS_EMAIL" -c "user.name=$OSS_ACCOUNT" \
  commit -q -m "$MSG"

NEW_SHA="$(git rev-parse --short HEAD)"
ok "orphan commit $NEW_SHA"

yellow "publish-oss · force-pushing to $OSS_REMOTE main"
git push -q "$OSS_REMOTE" "$ORPHAN_BRANCH:$MAIN_BRANCH" --force
ok "pushed to $OSS_REMOTE/$MAIN_BRANCH"

# trap will restore branch + gh account
green "✓ published $NEW_SHA to https://github.com/$OSS_ACCOUNT/stable-boy"
