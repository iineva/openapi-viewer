#!/usr/bin/env sh
set -eu

image_tag=${1:-openapi-viewer:latest}
environment_file=${ENV_FILE:-.env}

if [ ! -f "$environment_file" ]; then
  printf 'Environment file not found: %s\n' "$environment_file" >&2
  exit 1
fi

exec docker run --rm --env-file "$environment_file" -p 8080:8080 "$image_tag"
