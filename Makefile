# KinNoKi Labs site — build & deploy
#
#   make publish   Generate the site into Output/, commit, and push.
#                  Cloudflare Pages serves the committed Output/ folder,
#                  so the push IS the deployment.
#   make preview   Generate and serve locally at http://localhost:8000
#   make generate  Generate Output/ only (no commit, no push)
#   make clean     Remove Swift build artifacts

.PHONY: publish preview generate clean

generate:
	publish generate

publish: generate
	git add -A
	git commit -m "chore: regenerate site ($$(date +%Y-%m-%d\ %H:%M))" || echo "Nothing to commit."
	git push
	@echo "Pushed — Cloudflare Pages will deploy momentarily."

preview:
	publish run

clean:
	swift package clean
