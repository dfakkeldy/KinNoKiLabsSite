# KinNoKi Labs site — build & deploy
#
#   make publish         Generate the site into Output/, commit, and push.
#                        Cloudflare Pages serves the committed Output/ folder,
#                        so the push IS the deployment.
#   make preview         Generate and serve locally at http://localhost:8000
#   make generate        Generate Output/ only (no commit, no push)
#   make clean           Remove Swift build artifacts
#   make test-listen     Run the Listening Room pure-logic tests (node, dev-only)
#   make listen-catalog  Regenerate Resources/listen/books.json + per-book
#                        assets from local checkouts (Tools/build-listen-catalog.sh)

.PHONY: publish preview generate clean test test-listen test-games listen-catalog paired-covers

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

test: test-listen test-games

test-listen:
	node --test Tests/listen/*.test.mjs

test-games:
	node --test Tests/games/*.test.mjs

listen-catalog:
	Tools/build-listen-catalog.sh

paired-covers:
	Tools/sync-paired-cover-assets.sh
