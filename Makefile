# Targets de ops para reconstruir as imagens Docker locais (dev + meta-dogfood).
# As imagens são taggeadas :latest — o que o compose dev/prod referencia por default.
# Ver docs/dogfood-meta.md (F5: rebuild após meta-onda que toca o worker/orquestrador)
# e docs/runbooks/deploy.md. O CI (.github/workflows/ci.yml, job "Build de imagens
# Docker") valida que TODOS estes targets buildam a cada PR/push.
.PHONY: help rebuild-meta-sandbox rebuild-worker rebuild-api rebuild-all

help:  ## lista os targets disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

rebuild-meta-sandbox:  ## sandbox de verify do meta-dogfood (Python + Node/openapi-typescript)
	docker build -t hdd-meta-sandbox:latest --target meta-sandbox backend

rebuild-worker:  ## worker (orquestrador) — rode após meta-onda que toca o worker (F5)
	docker build -t hdd-worker:latest --target worker backend

rebuild-api:  ## imagem da API do painel
	docker build -t hdd-api:latest --target api backend

rebuild-all: rebuild-api rebuild-worker rebuild-meta-sandbox  ## reconstrói todas as imagens de backend
