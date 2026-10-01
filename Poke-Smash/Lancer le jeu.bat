@echo off
chcp 65001 >nul
title Poke Smash
cd /d "%~dp0"

rem Lance un petit serveur local (Python) puis ouvre le jeu dans le navigateur.
where python >nul 2>nul
if %errorlevel%==0 (
  start "Poke Smash - serveur (laisse cette fenetre ouverte)" /min python serveur.py 8000
  goto open
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "Poke Smash - serveur (laisse cette fenetre ouverte)" /min py serveur.py 8000
  goto open
)

rem Pas de Python : on ouvre directement le fichier (marche dans Chrome / Edge).
start "" "%~dp0index.html"
exit /b

:open
timeout /t 2 /nobreak >nul
start "" http://localhost:8000
exit /b
