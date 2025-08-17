@echo off
setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION
title Nuke history (keep current files)

where git >nul 2>nul || (echo Git not found in PATH.& pause & exit /b 1)
if not exist ".git" (echo This folder is not a Git repo.& pause & exit /b 1)

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "CUR=%%b"
if "%CUR%"=="HEAD" (echo You are in a detached HEAD. Checkout your branch first.& pause & exit /b 1)

set "TARGET=%CUR%"
set /p TARGET=Target branch to clean (default: %CUR%): 
if "%TARGET%"=="" set "TARGET=%CUR%"

echo(
echo Repo: %CD%
echo Current branch: %CUR%
echo Target branch:  %TARGET%
echo(
echo This will REWRITE HISTORY of %TARGET% to a single commit (keeping current files).
echo A remote backup branch will be created first.
echo(
pause

git fetch --all --prune
for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString(\"yyyyMMdd-HHmmss\")"') do set "TS=%%i"
set "BK=backup/%TS%-%TARGET%"

echo(
echo Creating remote backup "%BK%" ...
git branch "%BK%" "%TARGET%" || (echo Failed to create backup branch.& pause & exit /b 1)
git push -u origin "%BK%" || (echo Failed to push backup branch.& pause & exit /b 1)

echo(
echo ===== Creating single-commit tree =====
echo Checking out %TARGET%...
git checkout "%TARGET%" || (echo Cannot checkout %TARGET%.& pause & exit /b 1)

set "TEMP=%TARGET%-clean-%TS%"
echo Creating orphan branch %TEMP% ...
git checkout --orphan "%TEMP%" || (echo Orphan checkout failed.& pause & exit /b 1)

echo Staging files...
git add -A

echo Creating single clean commit...
git commit -m "Initial clean history" || (echo Commit failed.& pause & exit /b 1)

echo(
echo Pushing orphan HEAD to origin/%TARGET% (force-with-lease)...
echo (Disable branch protection or allow force-push if blocked.)
git push --force-with-lease origin HEAD:"%TARGET%" || (echo Force-push failed.& pause & exit /b 1)

echo(
echo Relinking local branches...
git checkout --detach || (echo Failed to detach HEAD.& pause & exit /b 1)

git branch -M "%TARGET%" "%TARGET%-old-%TS%" 2>nul
git branch -m "%TEMP%" "%TARGET%" || (echo Local rename failed.& pause & exit /b 1)
git checkout "%TARGET%" || (echo Failed to checkout %TARGET%.& pause & exit /b 1)

echo(
echo Done! %TARGET% now has a SINGLE commit (remote + local).
echo Remote backup kept at origin/%BK%
echo You may delete the backup later with:
echo   git push origin --delete %BK%
echo(
pause
endlocal
