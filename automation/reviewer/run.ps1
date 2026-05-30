[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [int]$PR
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

$promptPath = Join-Path $PSScriptRoot 'prompt.md'
$promptTemplate = Get-Content -Raw $promptPath
$prompt = $promptTemplate.Replace('{PR_NUMBER}', "$PR")

Write-Host "Invoking reviewer agent for PR #$PR" -ForegroundColor Cyan
$prompt | claude --print --dangerously-skip-permissions
