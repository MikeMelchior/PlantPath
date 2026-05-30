[CmdletBinding(DefaultParameterSetName='Issue')]
param(
    [Parameter(ParameterSetName='Issue', Mandatory=$true)]
    [int]$Issue,
    [Parameter(ParameterSetName='TodoLine', Mandatory=$true)]
    [int]$TodoLine
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

$gitBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($gitBranch -ne 'main') {
    throw "Not on main (currently on '$gitBranch'). Switch to main before invoking the coder."
}
$gitStatus = git status --porcelain
if ($gitStatus) {
    throw "Working tree not clean. Commit or stash before invoking the coder."
}

if ($PSCmdlet.ParameterSetName -eq 'Issue') {
    $taskDescription = "Issue #$Issue. Read it with ``gh issue view $Issue`` and work the task described there."
} else {
    $todoPath = Join-Path $repoRoot 'TODO.md'
    if (-not (Test-Path $todoPath)) { throw "TODO.md not found at $todoPath" }
    $todoLines = Get-Content $todoPath
    if ($TodoLine -lt 1 -or $TodoLine -gt $todoLines.Count) {
        throw "TODO line $TodoLine out of range (1-$($todoLines.Count))"
    }
    $line = $todoLines[$TodoLine - 1]
    $taskDescription = "TODO.md line ${TodoLine}: '$line'. Work this task. Your PR must also tick the box on line $TodoLine of TODO.md from ``- [ ]`` to ``- [x]``."
}

$promptPath = Join-Path $PSScriptRoot 'prompt.md'
$promptTemplate = Get-Content -Raw $promptPath
$prompt = $promptTemplate -replace '\{TASK_DESCRIPTION\}', $taskDescription

Write-Host "Invoking coder agent for: $taskDescription" -ForegroundColor Cyan
claude -p $prompt --dangerously-skip-permissions
