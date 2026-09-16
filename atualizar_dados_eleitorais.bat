@echo off
setlocal
cd /d "%~dp0"
title Painel Eleicoes 2026 - Atualizacao TSE e Modelo

echo ============================================================
echo   PAINEL ELEICOES 2026 - ATUALIZACAO DE DADOS E CALCULOS
echo ============================================================
echo.

if not exist imports mkdir imports

REM Prioriza arquivos oficiais mais recentes fornecidos pelo usuario.
REM Primeiro copia Downloads; depois a pasta do projeto, se houver ZIPs nela.
if exist "%USERPROFILE%\Downloads\consulta_cand_2026.zip" copy /Y "%USERPROFILE%\Downloads\consulta_cand_2026.zip" "imports\consulta_cand_2026.zip" >nul
if exist "%USERPROFILE%\Downloads\bem_candidato_2026.zip" copy /Y "%USERPROFILE%\Downloads\bem_candidato_2026.zip" "imports\bem_candidato_2026.zip" >nul
if exist "%~dp0consulta_cand_2026.zip" copy /Y "%~dp0consulta_cand_2026.zip" "imports\consulta_cand_2026.zip" >nul
if exist "%~dp0bem_candidato_2026.zip" copy /Y "%~dp0bem_candidato_2026.zip" "imports\bem_candidato_2026.zip" >nul

REM Valida um Python realmente executavel, nao apenas um alias do Windows Store.
set "PYBASE="
py -3 -c "import sys" >nul 2>nul
if not errorlevel 1 set "PYBASE=py -3"
if not defined PYBASE (
  python -c "import sys" >nul 2>nul
  if not errorlevel 1 set "PYBASE=python"
)
if not defined PYBASE (
  echo [ERRO] Python funcional nao encontrado.
  echo Instale Python 3 ou corrija o Python Launcher ^(py.exe^).
  pause
  exit /b 1
)

REM O venv fica no disco local para nao quebrar quando a unidade de rede
REM mudar de letra (X:, V:, etc.).
set "VENV_ROOT=%LOCALAPPDATA%\PainelEleicoes2026"
set "VENV_DIR=%VENV_ROOT%\.venv"

if exist "%VENV_DIR%\Scripts\python.exe" (
  "%VENV_DIR%\Scripts\python.exe" -c "import sys" >nul 2>nul
  if errorlevel 1 (
    echo [1/10] Ambiente virtual local invalido. Recriando...
    rmdir /S /Q "%VENV_DIR%"
  )
)

if not exist "%VENV_DIR%\Scripts\python.exe" (
  echo [1/10] Criando ambiente virtual local...
  if not exist "%VENV_ROOT%" mkdir "%VENV_ROOT%"
  %PYBASE% -m venv "%VENV_DIR%"
  if errorlevel 1 goto :erro
) else (
  echo [1/10] Ambiente virtual local OK.
)

set "PY=%VENV_DIR%\Scripts\python.exe"

echo [2/10] Atualizando dependencias...
"%PY%" -m pip install --upgrade pip >nul
if errorlevel 1 goto :erro
"%PY%" -m pip install requests
if errorlevel 1 goto :erro

echo [3/10] Sincronizando codigo com GitHub antes de gerar dados...
git --version >nul 2>nul
if errorlevel 1 (
  echo [AVISO] Git nao encontrado. A atualizacao seguira somente localmente.
  set "GITOK=0"
) else (
  set "GITOK=1"
  git diff --quiet
  if errorlevel 1 (
    echo [ERRO] Existem alteracoes rastreadas locais antes do git pull.
    echo Execute: git status
    echo Se forem apenas arquivos gerados pelo painel, use:
    echo git restore official-data.json election-history.json governadores-data.json model-results.json data.js
    pause
    exit /b 3
  )
  git diff --cached --quiet
  if errorlevel 1 (
    echo [ERRO] Existem alteracoes em stage antes do git pull.
    echo Revise com git status antes de continuar.
    pause
    exit /b 3
  )
  git pull --rebase
  if errorlevel 1 (
    echo [ERRO] Nao foi possivel sincronizar o codigo com o GitHub.
    pause
    exit /b 3
  )
)

echo [4/10] Atualizando candidaturas 2026...
"%PY%" scripts\update_tse.py
if errorlevel 1 goto :manual

echo [5/10] Atualizando governadores de todas as UFs...
"%PY%" scripts\update_governadores.py
if errorlevel 1 goto :erro

echo [6/10] Atualizando historico eleitoral 2022 e 2024...
"%PY%" scripts\update_history.py
if errorlevel 1 goto :erro

echo [7/10] Recalculando Ranking Territorial e Monte Carlo v3...
"%PY%" scripts\update_model.py
if errorlevel 1 goto :erro

echo [8/10] Conferindo arquivos gerados...
if not exist official-data.json goto :erro
if not exist governadores-data.json goto :erro
if not exist election-history.json goto :erro
if not exist model-results.json goto :erro

if "%GITOK%"=="0" goto :fim_local

echo [9/10] Preparando publicacao...
git add official-data.json election-history.json governadores-data.json model-results.json data.js 2>nul
git diff --cached --quiet
if not errorlevel 1 (
  echo [10/10] Nenhuma alteracao para publicar.
  goto :fim
)

git commit -m "Atualiza dados eleitorais e recalcula Monte Carlo v3"
if errorlevel 1 goto :fim_local

git push
if errorlevel 1 goto :fim_local

echo [10/10] Dados e calculos publicados no GitHub com sucesso.
goto :fim

:manual
echo.
echo ============================================================
echo   TSE BLOQUEOU A CONSULTA AUTOMATICA (HTTP 403)
echo ============================================================
echo.
echo Baixe novamente os arquivos oficiais mais recentes pelo navegador:
echo    consulta_cand_2026.zip
echo    bem_candidato_2026.zip
echo.
echo Salve em Downloads ou na pasta do projeto. Na proxima execucao o BAT
echo substitui automaticamente os ZIPs antigos da pasta imports.
echo.
start "" "https://dadosabertos.tse.jus.br/dataset/candidatos-2026"
pause
exit /b 2

:erro
echo.
echo A atualizacao terminou com erro. Nenhum recalculo parcial deve ser publicado.
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
echo   TSE + HISTORICO + ITR + MONTE CARLO V3 ATUALIZADOS
echo   O GitHub Pages fara novo deploy automaticamente.
echo ============================================================
pause
exit /b 0
