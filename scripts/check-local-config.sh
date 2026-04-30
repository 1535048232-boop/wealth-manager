#!/usr/bin/env bash

set -u

SCENARIO="${1:-dev}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

FAILURES=0

print_header() {
  echo "Checking local config for scenario: $1"
}

pass() {
  echo "[OK] $1"
}

fail() {
  echo "[MISSING] $1"
  FAILURES=$((FAILURES + 1))
}

check_file_exists() {
  local file_path="$1"
  local label="$2"

  if [[ -f "$ROOT_DIR/$file_path" ]]; then
    pass "$label ($file_path)"
  else
    fail "$label ($file_path)"
  fi
}

check_env_var() {
  local env_file="$1"
  local var_name="$2"
  local label="$3"
  local full_path="$ROOT_DIR/$env_file"
  local line
  local value

  if [[ ! -f "$full_path" ]]; then
    fail "$label requires $env_file"
    return
  fi

  line="$(grep -E "^${var_name}=" "$full_path" 2>/dev/null | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    fail "$label missing variable $var_name in $env_file"
    return
  fi

  value="${line#*=}"
  value="${value%$'\r'}"

  if [[ -z "$value" ]]; then
    fail "$label has empty value for $var_name in $env_file"
    return
  fi

  case "$value" in
    https://your-project.supabase.co|your-anon-key|https://your-web-domain.com|your-resend-api-key|your-apple-id@example.com|1234567890|AB12XYZ34S|xxxx-xxxx-xxxx-xxxx|replace-with-local-password)
      fail "$label still uses placeholder value for $var_name in $env_file"
      ;;
    *)
      pass "$label: $var_name present in $env_file"
      ;;
  esac
}

check_dev() {
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    fail "Local development env file (.env)"
    return
  fi

  pass "Local development env file (.env)"
  check_env_var ".env" "EXPO_PUBLIC_SUPABASE_URL" "Dev"
  check_env_var ".env" "EXPO_PUBLIC_SUPABASE_ANON_KEY" "Dev"
  check_env_var ".env" "EXPO_PUBLIC_WEB_BASE_URL" "Dev"
}

check_invite() {
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    fail "Invite flow env file (.env)"
    return
  fi

  pass "Invite flow env file (.env)"
  check_env_var ".env" "APP_WEB_BASE_URL" "Invite"
  check_env_var ".env" "APP_SCHEME" "Invite"
  check_env_var ".env" "RESEND_API_KEY" "Invite"
  check_env_var ".env" "INVITE_EMAIL_FROM" "Invite"
}

check_ios_build() {
  check_file_exists "credentials.json" "Local iOS credentials config"
  check_file_exists "credentials/ios/dist-cert.p12" "iOS distribution certificate"
  check_file_exists "credentials/ios/profile.mobileprovision" "iOS provisioning profile"
}

check_ios_submit() {
  if [[ ! -f "$ROOT_DIR/.env.release.local" ]]; then
    fail "Local iOS submit env file (.env.release.local)"
    return
  fi

  pass "Local iOS submit env file (.env.release.local)"
  check_env_var ".env.release.local" "EXPO_APPLE_ID" "iOS submit"
  check_env_var ".env.release.local" "ASC_APP_ID" "iOS submit"
  check_env_var ".env.release.local" "APPLE_TEAM_ID" "iOS submit"
}

check_android_submit() {
  check_file_exists "credentials/android/service-account.json" "Android Play service account"
}

print_header "$SCENARIO"

case "$SCENARIO" in
  dev)
    check_dev
    ;;
  invite)
    check_invite
    ;;
  ios-build)
    check_ios_build
    ;;
  ios-submit)
    check_ios_submit
    ;;
  android-submit)
    check_android_submit
    ;;
  all)
    check_dev
    check_invite
    check_ios_build
    check_ios_submit
    check_android_submit
    ;;
  *)
    echo "Unsupported scenario: $SCENARIO"
    echo "Supported scenarios: dev, invite, ios-build, ios-submit, android-submit, all"
    exit 2
    ;;
esac

if [[ "$FAILURES" -gt 0 ]]; then
  echo
  echo "Result: $FAILURES check(s) missing or still using placeholder values."
  exit 1
fi

echo
echo "Result: all checks passed."