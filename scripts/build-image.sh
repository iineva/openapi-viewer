#!/usr/bin/env sh
set -eu

image_tag=${1:-openapi-viewer:latest}
docker build --tag "$image_tag" .
