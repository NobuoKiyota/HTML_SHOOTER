@echo off
cd /d %~dp0
echo Updating game settings directly from Excel...
python tools/update_settings.py
pause
