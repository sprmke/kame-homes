#!/usr/bin/env bash
# beforeShellExecution hook: allow/deny/ask for shell commands.
# Reads JSON with "command", "cwd" from stdin; outputs JSON with "permission", optional "user_message", "agent_message".

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/dev/prod-deploy-guard-lib.sh
source "$ROOT/scripts/dev/prod-deploy-guard-lib.sh"

input=$(cat)
if command -v jq >/dev/null 2>&1; then
  command_str=$(echo "$input" | jq -r '.command // empty')
else
  command_str=$(echo "$input" | grep -o '"command":"[^"]*"' | head -1 | sed 's/"command":"//;s/"$//' | sed 's/\\"/"/g')
fi

permission="allow"
user_message=""
agent_message=""

if prod_deploy_is_blocked "$command_str"; then
  permission="deny"
  user_message="Blocked: production Supabase/database deploy. Say unlock word kamewave in chat, then rerun with kamewave in the command."
  agent_message=$(prod_deploy_block_reason)
else
  case "$command_str" in
    *"rm -rf /"*|*"rm -rf /*"*|*"rm -rf ~"*)
      permission="deny"
      user_message="Blocked: recursive delete of root or home is not allowed."
      agent_message="The command was blocked because it would delete system or home directory. Use a specific path instead."
      ;;
    *"drop table"*|*"DROP TABLE"*)
      permission="ask"
      user_message="This command may drop database tables. Confirm before running."
      agent_message="The command contains DROP TABLE. The user must confirm before running."
      ;;
    *"stop:supabase:clean"*)
      permission="ask"
      user_message="stop:supabase:clean deletes local Docker data volumes. Confirm before running."
      agent_message="Local-only nuclear reset — confirm with the user first."
      ;;
    *"push --force"*|*"push -f "*|*"push -f"*)
      permission="ask"
      user_message="Force-push can overwrite remote history. Confirm before running."
      agent_message="Force-push requires explicit user confirmation."
      ;;
    *)
      ;;
  esac
fi

if command -v jq >/dev/null 2>&1; then
  jq -n \
    --arg permission "$permission" \
    --arg user_message "$user_message" \
    --arg agent_message "$agent_message" \
    '{permission: $permission, user_message: $user_message, agent_message: $agent_message}'
else
  echo "{\"permission\": \"$permission\", \"user_message\": \"$user_message\", \"agent_message\": \"$agent_message\"}"
fi
