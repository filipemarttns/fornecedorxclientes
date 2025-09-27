@echo off

REM Ativa o ambiente virtual
call .\venv\Scripts\activate

REM Executa o bot
python -m whatsapp_relay.main %* 