#!/bin/bash

# Configuration
MONITOR_DIR="/Users/lucasdickey/Documents/code/stripe-projects/gemini/gemini-test"
REPO_ROOT="/Users/lucasdickey/Documents/code/stripe-projects"
INTERVAL=30
LOG_FILE="/Users/lucasdickey/Documents/code/stripe-projects/gemini/monitor.log"

exec >> "$LOG_FILE" 2>&1

cd "$REPO_ROOT" || exit 1

# Initial commit of project structure
if [[ ! -f "$MONITOR_DIR/.initial_committed" ]]; then
  echo "$(date): Committing initial project structure in $MONITOR_DIR..."
  git add "$MONITOR_DIR"
  git commit -m "Initial project structure created by 'stripe projects init' in gemini-test"
  git push origin main
  touch "$MONITOR_DIR/.initial_committed"
fi

echo "$(date): Starting monitoring of $MONITOR_DIR every $INTERVAL seconds..."

while true; do
  # Check if there are changes in the target directory
  if [[ -n $(git status --porcelain "$MONITOR_DIR") ]]; then
    echo "$(date): Changes detected in $MONITOR_DIR. Committing..."
    git add "$MONITOR_DIR"
    
    # Generate a descriptive message
    # Get a list of changed files for the message
    CHANGED_FILES=$(git diff --cached --name-only "$MONITOR_DIR" | xargs -I {} basename {} | paste -sd ", " -)
    MSG="Update gemini-test: changed $CHANGED_FILES"
    
    git commit -m "$MSG"
    git push origin main
    echo "$(date): Changes committed and pushed."
  fi
  sleep "$INTERVAL"
done
