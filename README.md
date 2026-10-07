# dhroxy-browser-extension

Browser extension that fetches your own data from Sundhed.dk as FHIR and lets you share what you choose 🇩🇰

Shipped to end users under the name **MitData**. It is the [dhroxy](https://github.com/c3po-initiative/dhroxy) sundhed.dk → FHIR R4 mapping, ported to JavaScript, running in your browser. No proxy server is needed.

> **Status: test version 0.3.0.** Not yet reviewed by the Chrome Web Store. Install manually as described below.

## How it works

1. **Session.** While you are logged in to sundhed.dk, the extension notes the anti-CSRF headers (`x-xsrf-token`, `conversation-uuid`, `page-app-id`) that your own tab sends. Cookies are never read, stored or copied.
2. **Fetch.** When you click, it runs the sundhed.dk API calls *inside your logged-in tab*, the same way the site itself does, and maps the answers to FHIR R4 locally (`mappers.js`).
3. **Choose.** The popup shows what was found, and you pick which data types to transfer. Until then the data stays in browser memory only.
4. **Upload.** On a second click it writes the chosen resources to the FHIR server set in the options, as one idempotent transaction bundle. Resource ids are deterministic (`sdk-` + 40 hex), so a re-upload updates rather than duplicates, and no CPR number appears in URLs.

## Install (Chrome / Edge, developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the repo folder (the one containing `manifest.json`).
4. Pin the MitData icon, log in to [sundhed.dk](https://www.sundhed.dk), and click the icon.

## Configuration

Open the extension's **Options** page:

| Setting | Default | Meaning |
| --- | --- | --- |
| FHIR server URL | `http://localhost:8090/fhir` | Where the transaction bundle is POSTed |
| Bearer token | *(empty)* | Optional `Authorization: Bearer …` for the FHIR server |
| Lab years | `2` | How many years of lab results to fetch |

Hosts other than sundhed.dk and localhost are requested as optional permissions when you save a server URL.

For a local FHIR server to test against, e.g. HAPI FHIR:

```
docker run -p 8090:8080 hapiproject/hapi:latest
```

and set the URL to `http://localhost:8090/fhir`.

## Files

```
manifest.json   MV3 manifest
background.js   service worker: header capture, fetch orchestration, upload
sundhed.js      sundhed.dk API calls (run inside your tab)
collect.js      gathers all sources and assembles the resource set
mappers.js      sundhed.dk → FHIR R4 mappers (ported from dhroxy)
fhirutil.js     helpers (pruning, references)
popup.*         the MitData popup UI
options.*       settings page
mitdata.css     shared styles
icons/          extension icons
```

## Related

- [dhroxy](https://github.com/c3po-initiative/dhroxy): the server-side sundhed.dk → FHIR proxy this is ported from
- [dhroxy-frontend-example](https://github.com/c3po-initiative/dhroxy-frontend-example)
- [HealthKitFHIR-Dhroxy](https://github.com/c3po-initiative/HealthKitFHIR-Dhroxy)

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
