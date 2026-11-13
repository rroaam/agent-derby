#!/bin/sh
# Xcode > Settings > Behaviors > Build > Succeeds > Run: pick this file.
curl -s -m 1 -o /dev/null -H 'X-Derby: 1' -H 'Content-Type: application/json' \
  -d '{"agent":"xcode","name":"Xcode","task":"builds","state":"done","note":"build succeeded"}' \
  "http://127.0.0.1:${DERBY_PORT:-4777}/event" 2>/dev/null
exit 0
