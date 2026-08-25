@echo off
setlocal
cd /d "%~dp0"
title Painel Eleicoes 2026 - Atualizacao TSE

 echo ============================================================
 echo   PAINEL ELEICOES 2026 - ATUALIZACAO DE DADOS ELEITORAIS
 echo ============================================================
 echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Python nao encontrado no PATH.
  echo Instale Python 3.12+ e marque a opcao Add Python to PATH.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/7] Criando ambiente virtual...
  python -m venv .venv
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

 echo [3/7] Atualizando candidaturas 2026 e bens dos monitorados...
"%PY%" scripts\update_tse.py
if errorlevel 1 goto :erro_tse

 echo [4/7] Atualizando historico eleitoral 2022 e 2024...
"%PY%" scripts\update_history.py
if errorlevel 1 (
  echo [AVISO] O historico nao foi atualizado. A base 2026 foi preservada.
)

 echo [5/7] Conferindo arquivos gerados...
if not exist official-data.json (
  echo [ERRO] official-data.json nao foi criado.
  goto :erro
)

 echo [6/7] Preparando Git...
git --version >nul 2>nul
if errorlevel 1 (
  echo [AVISO] Git nao encontrado. Os JSON foram atualizados apenas localmente.
  goto :fim_local
)

git pull --rebase
if errorlevel 1 (
  echo [AVISO] Nao foi possivel executar git pull. Revise conflitos antes de publicar.
  goto :fim_local
)

git add official-data.json election-history.json 2>nul
git diff --cached --quiet
if not errorlevel 1 (
  echo [7/7] Nenhuma alteracao para publicar.
  goto :fim
)

git commit -m "Atualiza base eleitoral oficial do TSE"
if errorlevel 1 goto :fim_local

git push
if errorlevel 1 (
  echo [AVISO] Dados atualizados, mas o push falhou. Execute git push posteriormente.
  goto :fim_local
)

 echo [7/7] Dados publicados no GitHub com sucesso.
goto :fim

:erro_tse
 echo.
 echo [ERRO] A consulta ao TSE falhou tambem nesta conexao.
 echo Tente novamente mais tarde. Nenhum arquivo oficial existente foi apagado.
goto :erro

:erro
 echo.
 echo A atualizacao terminou com erro.
 pause
 exit /b 1

:fim_local
 echo.
 echo Atualizacao local concluida. Verifique os arquivos antes de publicar.
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
