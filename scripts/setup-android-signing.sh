#!/usr/bin/env bash
#
# A wizard - walks a human through Android release signing setup.
# Generated from the /wizard skill template.

set -euo pipefail

# Wizard library. Keep this section identical across generated wizards.
if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

TOTAL_STAGES=0
TOTAL_MINUTES=0

_STAGE_INDEX=0
_MINUTES_ELAPSED=0
ENV_FILE="${ENV_FILE:-.env}"
WRITTEN_ENV=()
WRITTEN_SECRET=()
SKIPPED=()

_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[3J\033[H'; fi
}

banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages - about %s minutes%s\n\n' \
    "$DIM" "$TOTAL_STAGES" "$TOTAL_MINUTES" "$RESET"
  printf '%s  This wizard captures secrets only in your local terminal. Stop with\n' "$DIM"
  printf '  Ctrl-C and run it again later if needed.%s\n' "$RESET"
  pause "Ready to start?"
}

stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  local remaining=$((TOTAL_MINUTES - _MINUTES_ELAPSED))
  (( remaining < 0 )) && remaining=0
  _MINUTES_ELAPSED=$((_MINUTES_ELAPSED + ${2:-0}))
  printf '\n%s%s> Stage %s/%s - %s%s  %s(~%s min left)%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET" "$DIM" "$remaining" "$RESET"
}

say()  { printf '  %s\n' "$1"; }
step() { printf '  %s*%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s! %s%s\n' "$YELLOW" "$1" "$RESET"; }

open_url() {
  local url="$1"
  printf '  %sopening%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview      >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open     >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open         >/dev/null 2>&1; then open "$url"
    else warn "couldn't open a browser - visit it manually: $url"; fi
  } >/dev/null 2>&1 || warn "couldn't open a browser - visit it manually: $url"
}

pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

ask_secret() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || true
  printf '\n'
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

write_env() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %screated%s %s in %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

set_secret() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
      WRITTEN_SECRET+=("$name")
      printf '  %sset%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub secret $name (set it manually: gh secret set $name)")
  warn "skipped GitHub secret $name - gh not ready; set it later"
}

set_var() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh variable set "$name" --body "$value" >/dev/null 2>&1; then
      printf '  %sset%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub variable $name")
  warn "skipped GitHub variable $name - gh not ready; set it later"
}

finish() {
  _clear
  printf '\n%s%s  Setup complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} ))    && note "wrote ${#WRITTEN_ENV[@]} value(s) to $ENV_FILE: ${WRITTEN_ENV[*]}"
  (( ${#WRITTEN_SECRET[@]} )) && note "set ${#WRITTEN_SECRET[@]} GitHub secret(s): ${WRITTEN_SECRET[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "still to do by hand:"
    for skipped_item in "${SKIPPED[@]}"; do note "  - $skipped_item"; done
  fi
  printf '\n'
}

# STAGES
TOTAL_STAGES=3
TOTAL_MINUTES=5

if ! command -v gh >/dev/null 2>&1; then
  for gh_directory in "/c/Program Files/GitHub CLI" "/c/Users/$USERNAME/AppData/Local/Programs/GitHub CLI"; do
    if [[ -x "$gh_directory/gh.exe" ]]; then
      export PATH="$gh_directory:$PATH"
      break
    fi
  done
fi

KEYSTORE_PATH="kapperplekcheck-release.jks"
KEY_ALIAS="kapperplekcheck"

banner "Android release signing"

stage "Create signing key" 2
say "The keystore stays local and is ignored by Git. Its password is not saved."
if ! command -v openssl >/dev/null 2>&1; then
  warn "OpenSSL is required. Run this wizard from Git Bash for Windows."
  exit 1
fi
while true; do
  ask_secret KEYSTORE_PASSWORD "Choose a strong keystore password (12+ characters):"
  ask_secret KEYSTORE_PASSWORD_CONFIRM "Repeat the password:"
  if [[ ${#KEYSTORE_PASSWORD} -lt 12 ]]; then
    warn "Use at least 12 characters; please try again."
    continue
  fi
  if [[ "$KEYSTORE_PASSWORD" != "$KEYSTORE_PASSWORD_CONFIRM" ]]; then
    warn "The passwords do not match; please try again."
    continue
  fi
  break
done
if [[ -f "$KEYSTORE_PATH" ]]; then
  say "$KEYSTORE_PATH already exists; it will be reused."
  if ! openssl pkcs12 -info -in "$KEYSTORE_PATH" -passin "pass:$KEYSTORE_PASSWORD" -noout >/dev/null 2>&1; then
    warn "The password does not unlock the existing keystore."
    exit 1
  fi
else
  rm -f "${KEYSTORE_PATH}.key" "${KEYSTORE_PATH}.crt"
  if ! MSYS2_ARG_CONV_EXCL="*" openssl req \
    -x509 -newkey rsa:4096 -sha256 -days 10000 -nodes \
    -subj "/CN=Kapperplekcheck/O=Kapperplekcheck/C=NL" \
    -keyout "${KEYSTORE_PATH}.key" -out "${KEYSTORE_PATH}.crt"; then
    rm -f "${KEYSTORE_PATH}.key" "${KEYSTORE_PATH}.crt"
    warn "OpenSSL could not generate the signing certificate."
    exit 1
  fi
  openssl pkcs12 -export -name "$KEY_ALIAS" \
    -inkey "${KEYSTORE_PATH}.key" -in "${KEYSTORE_PATH}.crt" \
    -out "$KEYSTORE_PATH" -passout "pass:$KEYSTORE_PASSWORD"
  rm -f "${KEYSTORE_PATH}.key" "${KEYSTORE_PATH}.crt"
  step "Created $KEYSTORE_PATH. Never commit or lose this file."
fi

stage "Configure GitHub Actions" 2
say "The encoded key and matching values will be sent directly to repository secrets."
if ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1; then
  warn "GitHub CLI is not authenticated. Run 'gh auth login' and rerun this wizard."
  exit 1
fi
KEYSTORE_BASE64=$(base64 -w 0 "$KEYSTORE_PATH")
set_secret ANDROID_KEYSTORE_BASE64 "$KEYSTORE_BASE64"
set_secret ANDROID_KEYSTORE_PASSWORD "$KEYSTORE_PASSWORD"
set_secret ANDROID_KEY_ALIAS "$KEY_ALIAS"
set_secret ANDROID_KEY_PASSWORD "$KEYSTORE_PASSWORD"
unset KEYSTORE_BASE64 KEYSTORE_PASSWORD KEYSTORE_PASSWORD_CONFIRM

stage "Back up signing key" 1
say "Store $KEYSTORE_PATH in an encrypted backup outside this repository."
warn "Without this key and password, future APK versions cannot update existing installs."
pause "Press Enter after making or scheduling that backup."
open_url "https://github.com/timraasveld/kapperplekcheck/settings/secrets/actions"

finish