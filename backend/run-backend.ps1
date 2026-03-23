# Backend Server Startup Script
Write-Host "Starting Backend Server..." -ForegroundColor Green
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found. Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Please update .env with your database credentials!" -ForegroundColor Yellow
    Write-Host ""
}

# Run npm dev
npm run dev
