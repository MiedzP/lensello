# Steps through the pending migrations one at a time, putting each on the
# clipboard for the Supabase SQL editor.
#
# One file per paste, deliberately: running two of these in a single
# transaction has deadlocked against live app queries before, because they take
# exclusive locks in one order while the running app reads in the other. Each
# file also opens with `set lock_timeout = '10s'`, so a contended migration
# fails fast and visibly instead of hanging.

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$editor = 'https://supabase.com/dashboard/project/pzavguehexserzibscer/sql/new'

# Filename order is apply order, and it matters: every 1301xx/1306xx follow-up
# adds triggers, seed data or corrections to the 1200xx file above it. Applying
# a follow-up first will fail on a table that does not exist yet.
$migrations = @(
    @{ File = '20260813120000_client_portal.sql';         Name = 'Client portal + gallery display styles' }
    @{ File = '20260813120100_print_sales.sql';           Name = 'Print products, orders, lab fulfilment' }
    @{ File = '20260813120200_campaign_planner.sql';      Name = 'Campaign playbooks, checklists, calendar' }
    @{ File = '20260813120300_conversations.sql';         Name = 'Conversation threads + contact identities' }
    @{ File = '20260813120400_studio.sql';                Name = 'Creative studio + photo labels' }
    @{ File = '20260813120500_automations.sql';           Name = 'Automations, runs, API keys' }
    @{ File = '20260813120600_academy.sql';               Name = 'Academy, worksheets, business profile' }
    @{ File = '20260813130100_prints_followup.sql';       Name = 'Seed: starter UK print catalogue' }
    @{ File = '20260813130200_planner_followup.sql';      Name = 'Seed: 8 seasonal playbooks, 66 tasks' }
    @{ File = '20260813130300_conversations_followup.sql';Name = 'Threading triggers + backfill' }
    @{ File = '20260813130600_academy_followup.sql';      Name = 'Seed: academy modules + worksheets' }
)

Write-Host ''
Write-Host '  Lensello — apply migrations' -ForegroundColor Cyan
Write-Host '  ---------------------------' -ForegroundColor Cyan
Write-Host ''
Write-Host "  $($migrations.Count) files to apply, one at a time."
Write-Host '  Each one is copied to your clipboard. Paste it into the Supabase'
Write-Host '  SQL editor, press Run, then come back here and press Enter.'
Write-Host ''
Write-Host '  The SQL editor will open in your browser now.'
Write-Host ''
Read-Host '  Press Enter to start'

Start-Process $editor

$applied = 0
for ($i = 0; $i -lt $migrations.Count; $i++) {
    $m = $migrations[$i]
    $path = Join-Path $repo "supabase\migrations\$($m.File)"

    if (-not (Test-Path $path)) {
        Write-Host "  [$($i + 1)/$($migrations.Count)] MISSING: $($m.File)" -ForegroundColor Red
        continue
    }

    Get-Content -Raw -LiteralPath $path | Set-Clipboard

    Write-Host ''
    Write-Host "  [$($i + 1)/$($migrations.Count)] $($m.Name)" -ForegroundColor Yellow
    Write-Host "        $($m.File)  ->  copied to clipboard"
    Write-Host ''
    Write-Host '        Paste into the SQL editor and press Run.'

    $answer = Read-Host '        Enter when it succeeded, or S to skip, or Q to stop'

    switch ($answer.Trim().ToUpper()) {
        'Q' {
            Write-Host ''
            Write-Host "  Stopped. $applied of $($migrations.Count) applied." -ForegroundColor Cyan
            Write-Host '  Re-run this script any time; already-applied files will error'
            Write-Host '  harmlessly on "already exists", so skip those.'
            Write-Host ''
            Read-Host '  Press Enter to close'
            exit 0
        }
        'S' { Write-Host '        skipped' -ForegroundColor DarkGray }
        default {
            $applied++
            Write-Host '        done' -ForegroundColor Green
        }
    }
}

Write-Host ''
Write-Host "  Finished — $applied of $($migrations.Count) applied." -ForegroundColor Green
Write-Host ''
Read-Host '  Press Enter to close'
