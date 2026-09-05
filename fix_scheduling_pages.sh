#!/bin/bash

# Add "use client" back to all scheduling pages
for file in apps/web/src/app/\(app\)/scheduling/*/page.tsx apps/web/src/app/\(app\)/scheduling/*/\[*\]/page.tsx; do
  if [ -f "$file" ]; then
    # Skip if already has "use client"
    if ! grep -q "^'use client'" "$file"; then
      sed -i '1i'"'"'use client'"'"';' "$file"
      echo "Added 'use client' to: $file"
    fi
  fi
done
