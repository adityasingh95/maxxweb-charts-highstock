# MaxxWeb Charts Highstock

A lightweight static demo page that keeps the MaxxWeb-style header and renders a Highcharts Highstock chart beneath it.

This repo is the Highstock equivalent of the TradingView-based `maxxweb-charts-demo` proof of concept. The page is intentionally simple: static HTML, CSS and JavaScript only.

## What it does

- Preserves the MaxxWeb-style logged-in navigation/header layout.
- Renders a Highstock candlestick/OHLC chart for `EUR/USD`.
- Uses Twelve Data's public API for `EUR/USD` time-series OHLC data.
- Polls the API periodically and refreshes the chart when new data is available.
- Enables Highstock Stock Tools GUI on the chart.
- Preloads SMA and RSI indicators.
- Hides volume because FX spot does not have centralized exchange volume.
- Includes a single-symbol selector with only `EUR/USD`, matching the current demo scope.
- Keeps the Twelve Data API key out of GitHub by storing it in browser `localStorage` after the user enters it through the page.

## Files

- `index.html` — page structure, MaxxWeb-style header, Highstock script imports, API-key controls and chart shell.
- `styles.css` — header, toolbar, API-key controls, Highstock dark-theme layout and stock tools styling adjustments.
- `app.js` — Twelve Data fetch, OHLC transformation, Highstock chart initialization and periodic refresh.

## API key setup

This is a public static GitHub Pages demo, so the Twelve Data API key must not be committed into the repository.

When the page opens:

1. Click **Set API Key**.
2. Paste your Twelve Data API key.
3. The key is stored only in that browser's `localStorage`.
4. The chart will fetch `EUR/USD` OHLC data from Twelve Data.

To remove the key from the browser, click **Clear Key**.

## Public market data dependency

The demo currently uses Twelve Data's `time_series` endpoint for `EUR/USD`.

This is suitable for a visual proof of concept, but it should not be treated as a production datafeed. Availability, refresh cadence, quota, licensing, rate limits and commercial-use rights depend on the Twelve Data plan and account configuration.

For a production MaxxWeb implementation, the chart should eventually connect to a controlled market data source, such as:

- MaxxWeb/MaxxTrader pricing infrastructure
- An approved market data vendor
- A licensed Highcharts-compatible data service
- A backend adapter that normalizes FX chart data into `[timestamp, open, high, low, close]` format

## Highstock features enabled

The demo loads Highstock through CDN scripts and enables:

- Stock Tools GUI
- Technical indicators
- SMA overlay
- RSI oscillator pane
- Resizable panes
- Advanced annotations
- Current price indicator
- Fullscreen
- Exporting / save chart
- Range selector
- Navigator
- Scrollbar
- Crosshair / split tooltip

## Run locally

Because this is a static site, serving it from a local HTTP server is recommended.

### Python

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Notes

- The header logo points to `./assets/images/logo.png`.
- Add your real `logo.png` file at that path for a complete visual match.
- The current implementation provides only `EUR/USD` in the selector.
- Live refresh cadence depends on the Twelve Data API interval, quota and data availability.
- If the chart does not load, check that the API key is entered correctly and that the browser can reach Twelve Data and Highcharts CDN assets.

## Production considerations

Before using this approach in MaxxWeb production, review:

- Highcharts/Highstock commercial licensing
- Twelve Data licensing and API-plan restrictions
- Public CDN use versus internally hosted assets
- Content Security Policy rules
- Firewall/proxy allowlists
- Data entitlement and symbol permissioning
- MaxxWeb session/user/firm context integration
- Mapping between MaxxWeb instruments and external chart symbols
- Whether Highstock should consume MaxxWeb's own streaming data rather than public internet data
