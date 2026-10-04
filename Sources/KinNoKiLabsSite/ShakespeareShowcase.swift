import Plot

/// One featured work, with honest availability states, inside the shared site shell.
func shakespeareMain() -> Node<HTML.BodyContext> {
    .raw(#"""
    <main class="shakespeare-main" aria-labelledby="shakespeare-title">
      <header class="shakespeare-hero">
        <div class="shakespeare-hero-copy">
          <p class="eyebrow">Shakespeare · A KinNoKi Labs collection</p>
          <h1 id="shakespeare-title">The Merchant of Venice</h1>
          <p class="shakespeare-byline">by William Shakespeare</p>
          <p class="shakespeare-intro">Original songs, an anime music video in production, and modern-English editions of the play, made in the studio and gathered here as they are ready.</p>
          <nav class="shakespeare-index" aria-label="On this page">
            <a href="#watch"><span aria-hidden="true">I</span> Watch</a>
            <a href="#listen"><span aria-hidden="true">II</span> Listen</a>
            <a href="#read"><span aria-hidden="true">III</span> Read</a>
            <a href="#sources">Sources</a>
            <a href="#code">Code</a>
          </nav>
        </div>
        <figure class="shakespeare-hero-art">
          <img src="/images/shakespeare/venice-arch.svg" width="440" height="320" alt="Concept illustration: a Venetian pointed arch over canal ripples">
          <figcaption class="shakespeare-art-caption">Concept illustration</figcaption>
        </figure>
      </header>

      <section id="watch" aria-labelledby="watch-title" class="shakespeare-section">
        <p class="eyebrow">I · Watch</p>
        <div class="shakespeare-watch-grid">
          <div>
            <h2 id="watch-title">Word Is Bond</h2>
            <p class="shakespeare-secondary">An anime music video told from Shylock's side.</p>
            <p class="shakespeare-status">Video in production</p>
            <p class="shakespeare-small shakespeare-muted">The film will appear here when it is released, with captions and a direct YouTube link.</p>
          </div>
          <figure class="shakespeare-film-panel">
            <img src="/images/shakespeare/bridge-night.svg" width="540" height="304" alt="Concept illustration: a Venetian bridge over water at night; video in production" loading="lazy">
            <figcaption class="shakespeare-art-caption">Concept illustration · Video in production</figcaption>
          </figure>
        </div>
      </section>

      <section id="listen" aria-labelledby="listen-title" class="shakespeare-section">
        <p class="eyebrow">II · Listen</p>
        <div class="shakespeare-album-card">
          <figure class="shakespeare-album-art">
            <img src="/images/shakespeare/caskets.svg" width="216" height="216" alt="Concept illustration: three caskets in gold, silver and lead" loading="lazy">
            <p class="shakespeare-album-wordmark" aria-hidden="true">Merchants<br>of Venice</p>
            <figcaption class="shakespeare-art-caption">Album art concept</figcaption>
          </figure>
          <div class="shakespeare-album-copy">
            <h2 id="listen-title">Merchants of Venice</h2>
            <p class="shakespeare-secondary shakespeare-album-byline">An album by Dan</p>
            <p>Fourteen original songs after Shakespeare, plus two bonus tracks.</p>
            <p class="shakespeare-small shakespeare-muted">16 songs · Bonus tracks “Word Is Bond” and “The Bond”</p>
            <div class="shakespeare-action-row">
              <a class="btn shakespeare-suno" href="https://suno.com/playlist/2a02c169-de0a-43e5-a6de-6184c804920f" target="_blank" rel="noopener noreferrer" aria-describedby="suno-new-tab">Listen on Suno <span aria-hidden="true">↗</span></a>
              <p id="suno-new-tab" class="shakespeare-small shakespeare-muted">Opens suno.com in a new tab</p>
            </div>
          </div>
        </div>
      </section>

      <section id="read" aria-labelledby="read-title" class="shakespeare-section">
        <p class="eyebrow">III · Read</p>
        <h2 id="read-title" class="shakespeare-sr-only">Read</h2>
        <p class="shakespeare-secondary shakespeare-edition-intro">Two modern-English editions, each as an EPUB and a chaptered M4B audiobook.</p>
        <div class="shakespeare-editions">
          <article class="shakespeare-edition">
            <div class="shakespeare-cover" aria-hidden="true">
              <span class="shakespeare-cover-title">The Merchant<br>of Venice</span>
              <span class="shakespeare-cover-edition">Modern-English<br>play</span>
              <span class="shakespeare-cover-caption">Cover concept</span>
            </div>
            <div class="shakespeare-edition-copy">
              <h3>Modern-English play</h3>
              <p class="shakespeare-small shakespeare-secondary">20 chapters · about 2h 19m audio</p>
              <p class="shakespeare-small shakespeare-secondary">EPUB and chaptered M4B audiobook</p>
              <p class="shakespeare-status">Release pending</p>
              <p class="shakespeare-small shakespeare-muted">Files, sizes and durations are listed here when the edition is released.</p>
            </div>
          </article>
          <article class="shakespeare-edition">
            <div class="shakespeare-cover" aria-hidden="true">
              <span class="shakespeare-cover-title">The Merchant<br>of Venice</span>
              <span class="shakespeare-cover-edition">Modern-English<br>novel</span>
              <span class="shakespeare-cover-caption">Cover concept</span>
            </div>
            <div class="shakespeare-edition-copy">
              <h3>Modern-English novel</h3>
              <p class="shakespeare-small shakespeare-secondary">20 chapters · about 2h 06m audio</p>
              <p class="shakespeare-small shakespeare-secondary">EPUB and chaptered M4B audiobook</p>
              <p class="shakespeare-status">Release pending</p>
              <p class="shakespeare-small shakespeare-muted">Files, sizes and durations are listed here when the edition is released.</p>
            </div>
          </article>
        </div>
      </section>

      <section id="sources" aria-labelledby="sources-title" class="shakespeare-section">
        <p class="eyebrow">Sources</p>
        <h2 id="sources-title" class="shakespeare-sr-only">Sources</h2>
        <div class="shakespeare-sources-grid">
          <div>
            <ul class="shakespeare-source-links">
              <li><a href="https://shakespeare.mit.edu/merchant/full.html" target="_blank" rel="noopener noreferrer" aria-describedby="shakespeare-new-tab">Source text — MIT Shakespeare, full text <span aria-hidden="true">↗</span></a><span class="shakespeare-small shakespeare-muted">shakespeare.mit.edu</span></li>
              <li><a href="https://www.folger.edu/explore/shakespeares-works/the-merchant-of-venice/read/" target="_blank" rel="noopener noreferrer" aria-describedby="shakespeare-new-tab">Reading reference — Folger Shakespeare Library <span aria-hidden="true">↗</span></a><span class="shakespeare-small shakespeare-muted">folger.edu</span></li>
            </ul>
            <p class="shakespeare-small shakespeare-secondary">Modern adaptation prepared with Codex for Dan Fakkeldy. Character narration is synthetic, voiced with Echo and Kokoro. Cover art is generated.</p>
            <p class="shakespeare-small shakespeare-secondary shakespeare-rights">Shakespeare's text is in the public domain. The licence for these new editions is still being settled.</p>
          </div>
          <aside class="shakespeare-play-note" aria-labelledby="play-note-title">
            <h3 id="play-note-title">A note on the play</h3>
            <p class="shakespeare-small shakespeare-secondary">The Merchant of Venice stages antisemitic prejudice and a coerced conversion. These editions keep that material in view rather than soften it. The attitudes of its characters belong to the characters, not to the studio.</p>
          </aside>
        </div>
      </section>

      <section id="code" aria-labelledby="code-title" class="shakespeare-section">
        <p class="eyebrow">Code</p>
        <h2 id="code-title" class="shakespeare-sr-only">Code</h2>
        <ul class="shakespeare-code-links">
          <li><a href="https://github.com/dfakkeldy/KinNoKiLabsSite" target="_blank" rel="noopener noreferrer" aria-describedby="shakespeare-new-tab">Website source <span aria-hidden="true">↗</span></a><span class="shakespeare-small shakespeare-muted">KinNoKiLabsSite on GitHub</span></li>
          <li><a href="https://github.com/dfakkeldy/explainer-audiobooks" target="_blank" rel="noopener noreferrer" aria-describedby="shakespeare-new-tab">Production methods <span aria-hidden="true">↗</span></a><span class="shakespeare-small shakespeare-muted">explainer-audiobooks on GitHub</span></li>
          <li class="shakespeare-code-pending"><span>Merchant project code</span><span class="shakespeare-status">Publication pending</span></li>
        </ul>
      </section>
      <p id="shakespeare-new-tab" class="shakespeare-sr-only">Opens in a new tab</p>
    </main>
    """#)
}
