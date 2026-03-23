@echo off
echo Starting Backend Server...
echo.

REM Check if .env exists
if not exist .env (
    echo Warning: .env file not found. Copying from .env.example...
    copy .env.example .env
    echo Please update .env with your database credentials!
    echo.
)

REM Run npm dev
call npm run dev

pause
