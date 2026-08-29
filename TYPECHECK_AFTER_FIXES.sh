#!/bin/bash
# Verify TypeScript compilation after validator fixes

cd /c/Users/mcpag/lensello/apps/web

echo "═══════════════════════════════════════════════════════════"
echo "🔍 TypeScript Compilation Check - After Validator Fixes"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Count before
BEFORE=$(npm run typecheck 2>&1 | grep "error TS" | wc -l)

echo "📊 Running full TypeScript check..."
npm run typecheck 2>&1 | tee typecheck-results.txt

# Count after
AFTER=$(grep "error TS" typecheck-results.txt | wc -l)

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📈 Results Summary"
echo "═══════════════════════════════════════════════════════════"
echo "Errors before fixes: ~80"
echo "Errors after fixes: $AFTER"

if [ $AFTER -eq 0 ]; then
  echo ""
  echo "🎉 SUCCESS! All TypeScript errors fixed!"
  echo ""
  echo "Next steps:"
  echo "1. npm run build"
  echo "2. Test features"
  echo "3. Deploy!"
else
  echo ""
  echo "⏳ Still fixing $AFTER remaining errors..."
  echo ""
  echo "Top remaining errors:"
  grep "error TS" typecheck-results.txt | head -10
fi

echo ""
