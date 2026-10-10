import Plot

/// A small collection with each work's current availability inside the shared shell.
func shakespeareCollectionMain() -> Node<HTML.BodyContext> {
    .raw(#"""
    <main class="shakespeare-main" aria-labelledby="shakespeare-title">
      <header class="shakespeare-collection-header">
        <p class="eyebrow">A KinNoKi Labs collection</p>
        <h1 id="shakespeare-title">Shakespeare</h1>
        <p class="shakespeare-intro">Songs, films and modern-English editions of Shakespeare, gathered here as each project becomes ready.</p>
      </header>
      <section class="shakespeare-section" aria-label="Works in the collection">
        <div class="shakespeare-work-grid">
          <article class="shakespeare-work-card" aria-labelledby="merchant-card-title">
            <p class="eyebrow">I · On the shelf</p>
            <h2 id="merchant-card-title"><a href="/shakespeare/merchant-of-venice/">The Merchant of Venice <span aria-hidden="true">→</span></a></h2>
            <p class="shakespeare-status">Album and editions available</p>
            <p class="shakespeare-secondary">Original songs after the play, two modern-English editions and their audiobooks, with an anime music video in production.</p>
            <dl class="shakespeare-formats">
              <div><dt>Available</dt><dd>16-song album on Suno · Play and novel EPUBs · M4B audiobooks</dd></div>
              <div><dt>Pending release</dt><dd>Anime music video</dd></div>
            </dl>
          </article>
          <article class="shakespeare-work-card" aria-labelledby="midsummer-card-title">
            <p class="eyebrow">II · In the studio</p>
            <h2 id="midsummer-card-title"><a href="/shakespeare/a-midsummer-nights-dream/">A Midsummer Night's Dream <span aria-hidden="true">→</span></a></h2>
            <p class="shakespeare-status">In progress</p>
            <p class="shakespeare-secondary">A new Shakespeare project in the studio. Its work page will gather the editions and media as they become ready.</p>
            <dl class="shakespeare-formats">
              <div><dt>Available</dt><dd>No public releases yet</dd></div>
            </dl>
          </article>
        </div>
      </section>
    </main>
    <script src="/shakespeare.js" defer></script>
    """#)
}

/// The Merchant playbill links released editions and keeps the unfinished film pending.
func shakespeareMerchantMain() -> Node<HTML.BodyContext> {
    .raw(#"""
    <main class="shakespeare-main" aria-labelledby="shakespeare-title">
      <a class="shakespeare-back-link" href="/shakespeare/"><span aria-hidden="true">←</span> Shakespeare collection</a>
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
        <p class="shakespeare-secondary shakespeare-edition-intro">Two modern-English editions, each as an EPUB and a chaptered M4B audiobook. These are public first-listen editions; human reading and listening review remain pending.</p>
        <div class="shakespeare-editions">
          <article class="shakespeare-edition">
            <img class="shakespeare-cover" src="/images/shakespeare/merchant-play-cover.png" width="1024" height="1536" alt="The Merchant of Venice, modern-English play: Shylock portrait cover" loading="lazy">
            <div class="shakespeare-edition-copy">
              <h3>Modern-English play</h3>
              <p class="shakespeare-small shakespeare-secondary">20 chapters · 2h 19m 14s audio</p>
              <p class="shakespeare-small shakespeare-secondary">EPUB 1.6 MB · M4B 35.9 MB</p>
              <div class="shakespeare-action-row shakespeare-downloads">
                <a class="btn shakespeare-download" href="https://github.com/dfakkeldy/explainer-audiobooks/releases/download/classic-merchant-of-venice-play-20261004T050000Z/merchant-of-venice-play.epub">Play EPUB</a>
                <a class="btn shakespeare-download" href="https://github.com/dfakkeldy/explainer-audiobooks/releases/download/classic-merchant-of-venice-play-20261004T050000Z/merchant-of-venice-play.m4b">Play audiobook</a>
              </div>
              <p class="shakespeare-small shakespeare-muted shakespeare-edition-notice"><a href="https://github.com/dfakkeldy/explainer-audiobooks/releases/tag/classic-merchant-of-venice-play-20261004T050000Z" target="_blank" rel="noopener noreferrer" aria-describedby="shakespeare-new-tab">Play credits &amp; reuse <span aria-hidden="true">↗</span></a></p>
            </div>
          </article>
          <article class="shakespeare-edition">
            <img class="shakespeare-cover" src="/images/shakespeare/merchant-novel-cover.png" width="1024" height="1536" alt="The Merchant of Venice, modern-English novel: Shylock portrait cover" loading="lazy">
            <div class="shakespeare-edition-copy">
              <h3>Modern-English novel</h3>
              <p class="shakespeare-small shakespeare-secondary">20 chapters · 2h 06m 18s audio</p>
              <p class="shakespeare-small shakespeare-secondary">EPUB 1.5 MB · M4B 32.8 MB</p>
              <div class="shakespeare-action-row shakespeare-downloads">
                <a class="btn shakespeare-download" href="https://github.com/dfakkeldy/explainer-audiobooks/releases/download/classic-merchant-of-venice-novel-20261004T050000Z/merchant-of-venice-novel.epub">Novel EPUB</a>
                <a class="btn shakespeare-download" href="https://github.com/dfakkeldy/explainer-audiobooks/releases/download/classic-merchant-of-venice-novel-20261004T050000Z/merchant-of-venice-novel.m4b">Novel audiobook</a>
              </div>
              <p class="shakespeare-small shakespeare-muted shakespeare-edition-notice"><a href="https://github.com/dfakkeldy/explainer-audiobooks/releases/tag/classic-merchant-of-venice-novel-20261004T050000Z" target="_blank" rel="noopener noreferrer" aria-describedby="shakespeare-new-tab">Novel credits &amp; reuse <span aria-hidden="true">↗</span></a></p>
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
            <p class="shakespeare-small shakespeare-secondary shakespeare-rights">Shakespeare's text is in the public domain. The modern adaptation, original notes and selected covers carry CC BY 4.0 terms for the rights Dan holds. Each audiobook has its own recording reuse notice. Music, models, voice packs and software retain their separate terms; see each edition's credits and reuse files.</p>
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
          <li><a href="https://github.com/dfakkeldy/explainer-audiobooks/tree/4bf38dd2b67ffb205344e4331b6dd78fc2668fb1/books/merchant-of-venice-play" target="_blank" rel="noopener noreferrer" aria-describedby="shakespeare-new-tab">Play edition source <span aria-hidden="true">↗</span></a><span class="shakespeare-small shakespeare-muted">Adaptation, covers and publication manifest</span></li>
          <li><a href="https://github.com/dfakkeldy/explainer-audiobooks/tree/4bf38dd2b67ffb205344e4331b6dd78fc2668fb1/books/merchant-of-venice-novel" target="_blank" rel="noopener noreferrer" aria-describedby="shakespeare-new-tab">Novel edition source <span aria-hidden="true">↗</span></a><span class="shakespeare-small shakespeare-muted">Adaptation, covers and publication manifest</span></li>
          <li class="shakespeare-code-pending"><span>Merchant project code</span><span class="shakespeare-status">Publication pending</span></li>
        </ul>
      </section>
      <p id="shakespeare-new-tab" class="shakespeare-sr-only">Opens in a new tab</p>
      <nav class="shakespeare-related" aria-label="More Shakespeare">
        <a href="/shakespeare/a-midsummer-nights-dream/">A Midsummer Night's Dream <span aria-hidden="true">→</span></a>
      </nav>
    </main>
    <script src="/shakespeare.js" defer></script>
    """#)
}

/// No Midsummer media or project-source URLs are published before their release.
func shakespeareMidsummerMain() -> Node<HTML.BodyContext> {
    .raw(#"""
    <main class="shakespeare-main" aria-labelledby="shakespeare-title">
      <a class="shakespeare-back-link" href="/shakespeare/"><span aria-hidden="true">←</span> Shakespeare collection</a>
      <header class="shakespeare-collection-header">
        <p class="eyebrow">Shakespeare · In the studio</p>
        <h1 id="shakespeare-title">A Midsummer Night's Dream</h1>
        <p class="shakespeare-byline">by William Shakespeare</p>
        <p class="shakespeare-intro">This project is in progress. Public editions, audio and other media will appear here when they are ready.</p>
      </header>
      <section id="project-status" class="shakespeare-section" aria-labelledby="project-status-title">
        <h2 id="project-status-title">In progress</h2>
        <p class="shakespeare-secondary">The project is being made in the studio. Release links will be added once the work, credits and licence are ready.</p>
        <dl class="shakespeare-formats shakespeare-release-status">
          <div><dt>Book editions</dt><dd>Release pending</dd></div>
          <div><dt>Audiobook</dt><dd>Release pending</dd></div>
          <div><dt>Video</dt><dd>Release pending</dd></div>
          <div><dt>Project code</dt><dd>Publication pending</dd></div>
        </dl>
      </section>
      <nav class="shakespeare-related" aria-label="More Shakespeare">
        <a href="/shakespeare/merchant-of-venice/">The Merchant of Venice <span aria-hidden="true">→</span></a>
      </nav>
    </main>
    <script src="/shakespeare.js" defer></script>
    """#)
}
