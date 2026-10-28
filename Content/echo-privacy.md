# Echo Privacy Policy

Echo is made by Daniel Vincent Fakkeldy, operating as KinNoKi Labs. You can play and study local audiobooks without creating an Echo account. Echo stores its library records, reading and listening progress, notes, study cards and settings on your device. Features vary by platform. The optional network features below have different data handling; using local files does not mean every feature is offline or uses only private iCloud storage.

## Local books, narration and study

Playback, reading, narration synthesis and audio-to-text alignment process your files on your device. Narration and transcription may first download model or tokenizer files from Hugging Face. These downloads disclose the requested model and normal connection information, such as your IP address, to the hosting service; they do not send your book text or audio for remote inference. Hugging Face explains its handling and retention in its [privacy policy](https://huggingface.co/privacy).

On supported devices, Echo can draft study cards with Apple's on-device Foundation Models. Echo also supports optional external AI. The selected generation preference determines which route is used; Auto can use an external provider once one is configured.

## Optional external AI

If you configure an external AI provider and generate study cards with it, Echo sends book passages and their source identifiers to that provider. Generation can include section excerpts, a generated book brief and batches of source text. It sends the model selection and your provider credential so the service can process the request under your provider account. This feature sends text; it does not upload your audio recordings, selected photos or the EPUB file container as part of these requests.

The available presets are Anthropic, DeepSeek, Moonshot/Kimi and Z.ai/GLM. You can edit the endpoint or use a custom compatible service. The configuration screen describes the text transfer. Credentials are stored in the system Keychain. Remove Token disables generation with that stored provider configuration. Test Connection sends a small test prompt and your credential to the configured service.

The provider's terms and account settings govern its access, use, retention and deletion. At the time of this policy review:

- [Anthropic's commercial API retention notice](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) describes deletion of standard API inputs and outputs within 30 days, with exceptions for particular services, agreements, safety and legal obligations. That is not an unconditional deadline for every request.
- [DeepSeek's service privacy policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html) excludes downstream developers' end-user processing rules. It does not establish retention, training or IP-location handling for Echo's API requests; those API-specific practices remain unverified.
- [Kimi OpenPlatform's policy](https://platform.kimi.ai/docs/agreement/userprivacy) describes retaining information as needed for its purposes and using information to improve and train its technology; Echo does not assign it a fixed deletion deadline.
- [Z.ai's API Data Processing Addendum](https://docs.z.ai/legal-agreement/privacy-policy) says API input and generated content are processed in real time without server storage. Other customer data can be stored for API operation or legal requirements.

Echo does not impose one retention period on all providers or custom services. Deleting a local card or removing a credential does not delete information already held by a provider. Use the provider's controls or contact it for those requests.

## Public alignment lookup

When external fetching is permitted and the app can access its configured CloudKit container, importing a book can look for matching public alignment anchors. Echo sends Apple a deterministic record identifier derived from the book's title, author and duration. This lookup does not publish your local anchors, audio, full book text or notes. An ordinary lookup failure can fall back to local alignment; the app can also find no matching record.

The current release does not expose an action for uploading alignments to the public database. This is separate from the optional lookup and from files in your private iCloud storage. The lookup description does not promise that a matching record exists or that a request will succeed.

If you shared an alignment using another build, removing local anchors, deleting a local book or signing out does not itself delete public copies. Echo's client sets no automatic expiry for shared alignment records and has no in-app deletion control for them. We do not state a fixed retention period for past public alignments or guarantee removal of copies obtained by other users. You can contact us with privacy questions or requests using the address below.

## Optional Audiobookshelf connection

If you connect an Audiobookshelf server, Echo sends your login to that server and uses the resulting credentials to browse, search and download its library. For books imported from that server, Echo exchanges book identifiers and listening progress, including playback position, duration and completion state. Progress updates can continue while you listen.

The server operator controls its accounts, logs and stored progress. Echo defaults to HTTPS; a local HTTP connection requires explicit confirmation in the connection flow. Disconnecting clears the local connection and credentials and attempts server sign-out. It does not erase the server's account or listening history.

## Articles, exports and other applications

Capturing a website article downloads its HTML and selected images from the corresponding sites. Those sites receive the requested URLs and connection information and apply their own policies. Echo extracts and stores captured content locally. Sending that content to an external study-card provider is a separate use of the AI feature above.

You can export or share books, notes, cards and media to destinations you choose. On macOS, exporting through AnkiConnect sends selected card text and deck information to Anki running on the same Mac. The destination application controls any later synchronization or sharing.

## Optional Watch Inbox webhook

If you configure Watch Inbox, Echo sends your dictated text to the HTTPS webhook you choose through your paired iPhone. Each message includes a unique capture identifier, capture time and the source name echo-watch. When a book is open, its metadata title and listening position are included as context; if that title is unavailable, context is omitted. Native dictation follows your Apple device settings and Apple's privacy policy.

Pending messages are stored locally on the watch and iPhone until the endpoint accepts them. Echo then removes the pending text and keeps a hashed identifier receipt locally to avoid sending the same capture again. The webhook key is stored in the iPhone Keychain. Previous endpoint configurations are retained so already-queued messages keep their original destination unless you choose Use Current Inbox for Queued Messages, which moves those pending captures to the current endpoint while keeping their unique identifiers, text and capture metadata. The operator of your chosen webhook controls its processing, logs and retention. Endpoint acceptance does not confirm that a recipient has saved or acted on a message.

## Location, photos, microphone and Apple devices

Context Memory is optional and off by default. With permission, Echo can obtain the device's location and round its coordinates to two decimal places before asking Apple's geocoding service for a place name. The device may supply a precise location fix before rounding. Echo stores the rounded context and place name locally. Delete Context Memory removes the app's local context records and cached place data; it does not erase third-party records or device backups.

Microphone permission supports recording voice memos. Photo access supports selected images and saving exported media to Photos. Echo keeps these recordings and imported images locally in the traced features. A Watch voice memo can transfer to the paired iPhone using Apple's device communication services. Apple may fetch Photos or files from your personal iCloud account when you select them.

Apple manages App Store purchases, system backups and any files you choose to keep in Apple cloud storage. Those services follow [Apple's privacy policy](https://www.apple.com/legal/privacy/en-ww/) and your Apple settings. This does not mean every Echo record is automatically synchronized through private iCloud.

## Support and your choices

If you choose to email support, we receive your email address and the content you send. We retain support emails indefinitely. We do not currently operate a support-email deletion system. Echo can prepare a feedback message with your category, rating and message, plus optional app, system, device, locale and time-zone information. Review the message in your mail application before sending. Posting a GitHub issue makes the information you submit visible according to GitHub's settings and [policy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

You can remove local content using Echo's controls, disable optional permissions in system Settings, remove an AI token, disconnect Audiobookshelf, and choose what to export or share. Copies in backups, exports, public alignment records and external services have separate handling. We do not promise a single deletion deadline for all of them.

For privacy questions or requests, contact [hello@kinnokilabs.com](mailto:hello@kinnokilabs.com). Echo support is available at [echo@kinnokilabs.com](mailto:echo@kinnokilabs.com). Mail sent to these KinNoKi support and privacy addresses is routed through Apple iCloud Mail, subject to [Apple's privacy policy](https://www.apple.com/legal/privacy/en-ww/).
