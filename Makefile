.PHONY: install build run test dev-ui

install:
	python3 -m venv .venv
	.venv/bin/pip install -r requirements.txt
	cd frontend && npm install

build:
	cd frontend && npm run build

run:
	.venv/bin/python run.py

test:
	.venv/bin/pytest -v

dev-ui:
	cd frontend && npm run dev
