#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo_name="noble-skywave-fieldbook"
gh auth status >/dev/null
github_owner="$(gh api user --jq .login)"
github_uid="$(gh api user --jq .id)"
if git remote get-url origin >/dev/null 2>&1; then
  echo 'This checkout already has an origin. Review it before publishing.' >&2
  exit 1
fi
if gh repo view "$github_owner/$repo_name" >/dev/null 2>&1; then
  echo 'That repository already exists. Choose a new name or inspect it before updating.' >&2
  exit 1
fi
npm test
node --check assets/app.js
git init -b main
git config user.name "$github_owner"
git config user.email "$github_uid+$github_owner@users.noreply.github.com"
git config credential.https://github.com.helper ''
git config --add credential.https://github.com.helper '!gh auth git-credential'
git add .
git commit -m 'Publish Skywave Fieldbook station map and HF planning tools'
gh repo create "$repo_name" --public --source . --remote origin --push --description 'Searchable Noble Skywave station map, HF circuit planning and private browser contact log. Community tool by NZ1.'
gh api --method POST "repos/$github_owner/$repo_name/pages" -f 'build_type=workflow'
echo "https://$github_owner.github.io/$repo_name/"
