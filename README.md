# MaxxWeb Charts Highstock

A lightweight static demo page that keeps the MaxxWeb-style header and renders a Highcharts Highstock chart beneath it.

This repo is the Highstock equivalent of the TradingView-based `maxxweb-charts-demo` proof of concept. The page is intentionally simple: static HTML, CSS and JavaScript only.

## What it does

- Preserves the MaxxWeb-style logged-in navigation/header layout.
- Renders a Highstock candlestick/OHLC chart for `EUR/USD`.
- Uses the public Yahoo Finance chart endpoint for `EURUSD=X` data.
- Polls the public endpoint periodically and refreshes the chart when new data is available.
- Enables Highstock Stock Tools GUI on the chart.
- Preloads SMA and RSI indicators.
- Hides volume because FX spot does not have centralized exchange volume.
- Includes a single-symbol selector with only `EUR/USD`, matching the current demo scope.

## Files

- `index.html` — page structure, MaxxWeb-style header, Highstock script imports and chart shell.
- `styles.css` — header, toolbar, Highstock dark-theme layout and stock tools styling adjustments.
- `app.js` — public EUR/USD data fetch, OHLC transformation, Highstock chart initialization and periodic refresh.

## Public market data dependency

The demo currently uses Yahoo Finance's public chart endpoint for `EURUSD=X`.

This is suitable for a visual proof of concept, but it should not be treated as a production datafeed. The endpoint may be rate limited, blocked by browser/network policy, restricted by CORS, unavailable in some environments, or unsuitable for commercial use.

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
- Live refresh cadence depends on the public data provider. The demo polls periodically but only updates when the provider returns new OHLC data.
- If the chart does not load, check the browser console and network tab. Some browsers, networks or proxies may block the public data endpoint or CDN scripts.

## Production considerations

Before using this approach in MaxxWeb production, review:

- Highcharts/Highstock commercial licensing
- Public CDN use versus internally hosted assets
- Content Security Policy rules
- Firewall/proxy allowlists
- Data entitlement and symbol permissioning
- MaxxWeb session/user/firm context integration
- Mapping between MaxxWeb instruments and external chart symbols
- Whether Highstock should consume MaxxWeb's own streaming data rather than public internet data
