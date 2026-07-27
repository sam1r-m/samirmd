#!/bin/bash
cd "$(dirname "$0")"
node scripts/process-photos.mjs
status=$?
echo
if [ $status -eq 0 ]; then
  echo "Finished. Reload photography.html in your browser."
else
  echo "Something went wrong (exit $status)."
fi
echo
read -r -p "Press Enter to close…"
exit $status
