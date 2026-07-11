#!/usr/bin/env bash
# Sourceable same-filesystem transaction for the generated listening catalog.
# The caller must install cleanup traps before initializing the build root.

listen_catalog_rollback_publish() {
  local failed=0

  # Move installed replacement paths back under the build root before restoring
  # their predecessors. State flags are set before each critical rename, so an
  # interrupt between the rename and the next shell statement is recoverable.
  if [ "${INSTALLED_CATALOG:-0}" -eq 1 ] && [ -e "${FINAL_CATALOG:-}" ]; then
    mv -- "$FINAL_CATALOG" "$PENDING_CATALOG" || failed=1
  fi
  if [ "${INSTALLED_BOOKS:-0}" -eq 1 ] && [ -e "${FINAL_BOOKS:-}" ]; then
    mv -- "$FINAL_BOOKS" "$PENDING_BOOKS" || failed=1
  fi

  if [ "${HAD_FINAL_BOOKS:-0}" -eq 1 ]; then
    if [ -e "${BACKUP_BOOKS:-}" ]; then
      mv -- "$BACKUP_BOOKS" "$FINAL_BOOKS" || failed=1
    elif [ ! -e "${FINAL_BOOKS:-}" ]; then
      echo "error: rollback backup is missing: ${BACKUP_BOOKS:-unset}" >&2
      failed=1
    fi
  fi
  if [ "${HAD_FINAL_CATALOG:-0}" -eq 1 ]; then
    if [ -e "${BACKUP_CATALOG:-}" ]; then
      mv -- "$BACKUP_CATALOG" "$FINAL_CATALOG" || failed=1
    elif [ ! -e "${FINAL_CATALOG:-}" ]; then
      echo "error: rollback backup is missing: ${BACKUP_CATALOG:-unset}" >&2
      failed=1
    fi
  fi

  return "$failed"
}

listen_catalog_cleanup() {
  local exit_status=$?
  local rollback_status=0

  trap - EXIT INT TERM
  set +e

  if [ "${PUBLISHING:-0}" -eq 1 ] && [ "${PUBLISHED:-0}" -eq 0 ]; then
    echo "warning: catalog publish failed; restoring the previous bundle" >&2
    listen_catalog_rollback_publish
    rollback_status=$?
    if [ "$rollback_status" -ne 0 ]; then
      exit_status=1
      echo "error: automatic rollback failed; recovery bundle preserved at ${BUILD_ROOT:-unset}" >&2
    fi
  fi

  if [ "$rollback_status" -eq 0 ] && [ -n "${BUILD_ROOT:-}" ] && [ -e "$BUILD_ROOT" ]; then
    if ! rm -rf -- "$BUILD_ROOT"; then
      echo "error: could not clean catalog transaction root: $BUILD_ROOT" >&2
      exit_status=1
    fi
  fi

  exit "$exit_status"
}

listen_catalog_install_cleanup_traps() {
  # Never inherit transaction state from the caller's environment. Cleanup
  # must only remove a root created by the matching init call below.
  BUILD_ROOT=""
  PUBLISHING=0
  PUBLISHED=0
  HAD_FINAL_BOOKS=0
  HAD_FINAL_CATALOG=0
  INSTALLED_BOOKS=0
  INSTALLED_CATALOG=0
  LISTEN_CATALOG_TRAPS_INSTALLED=1
  trap listen_catalog_cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

listen_catalog_transaction_init() {
  local out_dir="$1"
  local attempts=0

  [ "${LISTEN_CATALOG_TRAPS_INSTALLED:-0}" -eq 1 ] || {
    echo "error: install catalog cleanup traps before transaction initialization" >&2
    return 1
  }
  [ -d "$out_dir" ] || { echo "error: catalog output directory is missing: $out_dir" >&2; return 1; }

  FINAL_BOOKS="$out_dir/books"
  FINAL_CATALOG="$out_dir/books.json"
  PUBLISHING=0
  PUBLISHED=0
  HAD_FINAL_BOOKS=0
  HAD_FINAL_CATALOG=0
  INSTALLED_BOOKS=0
  INSTALLED_CATALOG=0

  # Set BUILD_ROOT before creating it, so the already-installed EXIT/signal
  # cleanup can remove even a partially initialized transaction.
  while :; do
    attempts=$((attempts + 1))
    BUILD_ROOT="$out_dir/.listen-catalog-build.$$.$RANDOM"
    if mkdir -m 700 -- "$BUILD_ROOT"; then
      break
    fi
    [ "$attempts" -lt 20 ] || {
      echo "error: could not create a unique catalog transaction root" >&2
      return 1
    }
  done

  WORK_ROOT="$BUILD_ROOT/work"
  STAGE_ROOT="$BUILD_ROOT/stage"
  STAGED_BOOKS="$STAGE_ROOT/books"
  STAGED_CATALOG="$STAGE_ROOT/books.json"
  BACKUP_ROOT="$BUILD_ROOT/backup"
  BACKUP_BOOKS="$BACKUP_ROOT/books"
  BACKUP_CATALOG="$BACKUP_ROOT/books.json"
  PENDING_ROOT="$BUILD_ROOT/pending"
  PENDING_BOOKS="$PENDING_ROOT/books"
  PENDING_CATALOG="$PENDING_ROOT/books.json"

  mkdir -p -- "$WORK_ROOT" "$STAGED_BOOKS" "$BACKUP_ROOT" "$PENDING_ROOT"
}

listen_catalog_publish_staged_bundle() {
  if [ -e "$FINAL_BOOKS" ] && [ ! -d "$FINAL_BOOKS" ]; then
    echo "error: final books path is not a directory: $FINAL_BOOKS" >&2
    return 1
  fi
  if [ -e "$FINAL_CATALOG" ] && [ ! -f "$FINAL_CATALOG" ]; then
    echo "error: final catalog path is not a file: $FINAL_CATALOG" >&2
    return 1
  fi

  mv -- "$STAGED_BOOKS" "$PENDING_BOOKS"
  mv -- "$STAGED_CATALOG" "$PENDING_CATALOG"
  PUBLISHING=1

  if [ -e "$FINAL_BOOKS" ]; then
    HAD_FINAL_BOOKS=1
    mv -- "$FINAL_BOOKS" "$BACKUP_BOOKS"
  fi
  if [ -e "$FINAL_CATALOG" ]; then
    HAD_FINAL_CATALOG=1
    mv -- "$FINAL_CATALOG" "$BACKUP_CATALOG"
  fi

  INSTALLED_BOOKS=1
  mv -- "$PENDING_BOOKS" "$FINAL_BOOKS"
  INSTALLED_CATALOG=1
  mv -- "$PENDING_CATALOG" "$FINAL_CATALOG"
  PUBLISHED=1
}
