@echo off
setlocal
cd /d "%~dp0"
title Painel Eleicoes 2026 - Atualizacao TSE

 echo ============================================================
 echo   PAINEL ELEICOES 2026 - ATUALIZACAO DE DADOS ELEITORAIS
 echo ============================================================
 echo.

if not exist imports mkdir imports

if exist "%USERPROFILE%\Downloads\consulta_cand_2026.zip" if not exist "imports\consulta_cand_2026.zip" copy /Y "%USERPROFILE%\Downloads\consulta_cand_2026.zip" "imports\consulta_cand_2026.zip" >nul
if exist "%USERPROFILE%\Downloads\bem_candidato_2026.zip" if not exist "imports\bem_candidato_2026.zip" copy /Y "%USERPROFILE%\Downloads\bem_candidato_2026.zip" "imports\bem_candidato_2026.zip" >nul

where py >nul 2>nul
if not errorlevel 1 (
  set "PYBASE=py"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo [ERRO] Python nao encontrado.
    pause
    exit /b 1
  )
  set "PYBASE=python"
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/7] Criando ambiente virtual...
  %PYBASE% -m venv .venv
  if errorlevel 1 goto :erro
) else (
  echo [1/7] Ambiente virtual ja existe.
)

set "PY=.venv\Scripts\python.exe"
set "PIP=.venv\Scripts\pip.exe"

echo [2/7] Atualizando dependencias...
"%PY%" -m pip install --upgrade pip >nul
"%PIP%" install requests
if errorlevel 1 goto :erro

echo [3/7] Atualizando candidaturas 2026...
"%PY%" scripts\update_tse.py
if errorlevel 1 goto :manual

echo [4/7] Atualizando historico eleitoral 2022 e 2024...
"%PY%" scripts\update_history.py
if errorlevel 1 echo [AVISO] Historico nao atualizado nesta execucao.

echo [5/7] Conferindo arquivos gerados...
if not exist official-data.json goto :erro

echo [6/7] Preparando Git...
git --version >nul 2>nul
if errorlevel 1 goto :fim_local

git pull --rebase
if errorlevel 1 goto :fim_local

git add official-data.json election-history.json 2>nul
git diff --cached --quiet
if not errorlevel 1 goto :fim

git commit -m "Atualiza base eleitoral oficial do TSE"
if errorlevel 1 goto :fim_local

git push
if errorlevel 1 goto :fim_local

echo [7/7] Dados publicados no GitHub com sucesso.
goto :fim

:manual
echo.
echo ============================================================
echo   TSE BLOQUEOU A CONSULTA AUTOMATICA (HTTP 403)
echo ============================================================
echo.
echo O painel agora aceita os arquivos oficiais baixados pelo navegador.
echo.
echo 1. Abra:
echo    https://dadosabertos.tse.jus.br/dataset/candidatos-2026
echo.
echo 2. Baixe os recursos:
echo    - Candidatos
 echo    - Bens de candidatos
 echo.
echo 3. Salve/mova para a pasta imports com os nomes:
echo    imports\consulta_cand_2026.zip
echo    imports\bem_candidato_2026.zip
 echo.
echo Se o navegador salvar esses nomes em Downloads, este BAT copiara automaticamente na proxima execucao.
echo.
start "" "https://dadosabertos.tse.jus.br/dataset/candidatos-2026"
pause
exit /b 2

:erro
echo.
echo A atualizacao terminou com erro.
pause
exit /b 1

:fim_local
echo.
echo Atualizacao local concluida. O push nao foi realizado automaticamente.
pause
exit /b 0

:fim
echo.
echo ============================================================
echo   ATUALIZACAO CONCLUIDA
 echo   O GitHub Pages fara novo deploy automaticamente.
echo ============================================================
pause
exit /b 0
