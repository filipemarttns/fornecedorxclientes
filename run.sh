#!/bin/bash

# Ativa o ambiente virtual
source venv/bin/activate

# Executa o bot
python -m whatsapp_relay.main "$@" 