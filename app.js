const CONFIG = {
  symbol: 'EUR/USD',
  displaySymbol: 'EUR/USD',
  twelveDataInterval: '5min',
  outputSize: 500,
  refreshMs: 60_000,
  requestTimeoutMs: 12_000,
  storageKey: 'maxxwebHighstock.twelveDataApiKey',
  twelveDataUrl(symbol, apiKey) {
    const params = new URLSearchParams({
      symbol,
      interval: this.twelveDataInterval,
      outputsize: String(this.outputSize),
      order: 'ASC',
      apikey: apiKey
    });

    return `https://api.twelvedata.com/time_series?${params}`;
  }
};

const state = {
  chart: null,
  refreshTimer: null,
  lastPointTime: null
};

const elements = {
  statusText: document.getElementById('feedStatus'),
  statusDot: document.getElementById('statusDot'),
  symbolSelector: document.getElementById('symbolSelector'),
  apiKeyButton: document.getElementById('apiKeyButton'),
  clearApiKeyButton: document.getElementById('clearApiKeyButton')
};

function getApiKey() {
  return window.localStorage.getItem(CONFIG.storageKey) || '';
}

function saveApiKey(apiKey) {
  window.localStorage.setItem(CONFIG.storageKey, apiKey.trim());
}

function clearApiKey() {
  window.localStorage.removeItem(CONFIG.storageKey);
}

function promptForApiKey() {
  const existingKey = getApiKey();
  const value = window.prompt(
    'Enter your Twelve Data API key. It will be stored only in this browser localStorage, not in GitHub.',
    existingKey
  );

  if (value === null) {
    return;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    clearApiKey();
    setFeedStatus('Twelve Data API key cleared. Set a key to load EUR/USD data.', 'idle');
    showEmptyChart('Twelve Data API key required', 'Click Set API Key and paste your Twelve Data key to load EUR/USD OHLC data.');
    return;
  }

  saveApiKey(trimmed);
  setFeedStatus('Twelve Data API key saved in browser. Loading EUR/USD data...', 'idle');
  startLiveRefresh();
}

function setFeedStatus(message, mode = 'idle') {
  if (elements.statusText) {
    elements.statusText.textContent = message;
  }

  if (elements.statusDot) {
    elements.statusDot.className = `feed-dot feed-dot-${mode}`;
  }
}

function formatTimestamp(value) {
  if (!value) {
    return 'n/a';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  }).format(new Date(value));
}

function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toOhlcSeries(payload) {
  const values = Array.isArray(payload?.values) ? payload.values : [];

  return values
    .map((row) => {
      const timestamp = Date.parse(`${row.datetime}Z`);
      const open = parseNumeric(row.open);
      const high = parseNumeric(row.high);
      const low = parseNumeric(row.low);
      const close = parseNumeric(row.close);

      if (!Number.isFinite(timestamp) || ![open, high, low, close].every(isValidNumber)) {
        return null;
      }

      return [timestamp, open, high, low, close];
    })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0]);
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchEurUsdOhlc() {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Twelve Data API key is required');
  }

  const url = CONFIG.twelveDataUrl(CONFIG.symbol, apiKey);
  const payload = await fetchWithTimeout(url, CONFIG.requestTimeoutMs);

  if (payload?.status === 'error' || payload?.code || payload?.message) {
    throw new Error(payload.message || `Twelve Data API error${payload.code ? ` ${payload.code}` : ''}`);
  }

  const data = toOhlcSeries(payload);

  if (data.length < 10) {
    throw new Error('Twelve Data response did not contain enough OHLC points');
  }

  return data;
}

function showEmptyChart(title, subtitle) {
  state.chart = Highcharts.stockChart('highstockChart', {
    chart: { backgroundColor: '#222222' },
    title: {
      text: title,
      style: { color: 'rgba(255,255,255,0.92)' }
    },
    subtitle: {
      text: subtitle,
      style: { color: 'rgba(255,255,255,0.65)' }
    },
    credits: { enabled: false },
    series: []
  });
}

function buildChart(data) {
  state.lastPointTime = data[data.length - 1][0];

  Highcharts.setOptions({
    lang: {
      rangeSelectorZoom: 'Range'
    },
    time: {
      timezone: 'UTC'
    }
  });

  state.chart = Highcharts.stockChart('highstockChart', {
    chart: {
      backgroundColor: '#222222',
      plotBackgroundColor: '#222222',
      spacingTop: 10,
      spacingRight: 18,
      spacingBottom: 10,
      spacingLeft: 6
    },

    title: {
      text: `${CONFIG.displaySymbol} Live OHLC`,
      align: 'left',
      style: {
        color: 'rgba(255,255,255,0.92)',
        fontSize: '15px',
        fontWeight: '600'
      }
    },

    subtitle: {
      text: 'Highstock with Stock Tools, SMA and RSI enabled. Source: Twelve Data public API.',
      align: 'left',
      style: {
        color: 'rgba(255,255,255,0.58)',
        fontSize: '12px'
      }
    },

    credits: {
      enabled: true,
      text: 'Highcharts Highstock',
      href: 'https://www.highcharts.com/products/highstock/'
    },

    rangeSelector: {
      selected: 1,
      inputEnabled: true,
      buttons: [
        { type: 'hour', count: 1, text: '1h' },
        { type: 'day', count: 1, text: '1d' },
        { type: 'day', count: 5, text: '5d' },
        { type: 'all', text: 'All' }
      ],
      buttonTheme: {
        fill: '#303030',
        stroke: 'rgba(255,255,255,0.1)',
        style: { color: 'rgba(255,255,255,0.78)' },
        states: {
          hover: { fill: '#3a3a3a' },
          select: { fill: '#6d6d6d', style: { color: '#ffffff' } }
        }
      },
      inputBoxBorderColor: 'rgba(255,255,255,0.18)',
      inputStyle: { color: 'rgba(255,255,255,0.82)' },
      labelStyle: { color: 'rgba(255,255,255,0.68)' }
    },

    stockTools: {
      gui: {
        enabled: true,
        visible: true,
        buttons: [
          'indicators',
          'separator',
          'simpleShapes',
          'lines',
          'crookedLines',
          'measure',
          'advanced',
          'toggleAnnotations',
          'separator',
          'verticalLabels',
          'flags',
          'separator',
          'zoomChange',
          'fullScreen',
          'typeChange',
          'separator',
          'currentPriceIndicator',
          'saveChart'
        ]
      }
    },

    navigation: {
      bindingsClassName: 'highcharts-bindings-wrapper'
    },

    tooltip: {
      split: true,
      backgroundColor: '#151515',
      borderColor: 'rgba(255,255,255,0.18)',
      style: { color: '#ffffff' },
      valueDecimals: 5
    },

    xAxis: {
      gridLineColor: 'rgba(255,255,255,0.06)',
      lineColor: 'rgba(255,255,255,0.14)',
      tickColor: 'rgba(255,255,255,0.14)',
      labels: { style: { color: 'rgba(255,255,255,0.72)' } },
      crosshair: {
        color: 'rgba(255,255,255,0.22)',
        width: 1
      }
    },

    yAxis: [
      {
        height: '72%',
        resize: { enabled: true },
        labels: {
          align: 'right',
          x: -3,
          style: { color: 'rgba(255,255,255,0.72)' }
        },
        title: { text: 'Price', style: { color: 'rgba(255,255,255,0.68)' } },
        gridLineColor: 'rgba(255,255,255,0.08)',
        opposite: true
      },
      {
        top: '76%',
        height: '24%',
        offset: 0,
        labels: {
          align: 'right',
          x: -3,
          style: { color: 'rgba(255,255,255,0.72)' }
        },
        title: { text: 'RSI', style: { color: 'rgba(255,255,255,0.68)' } },
        gridLineColor: 'rgba(255,255,255,0.08)',
        opposite: true,
        min: 0,
        max: 100,
        plotLines: [
          { value: 30, color: 'rgba(255,255,255,0.22)', width: 1, dashStyle: 'ShortDash' },
          { value: 70, color: 'rgba(255,255,255,0.22)', width: 1, dashStyle: 'ShortDash' }
        ]
      }
    ],

    navigator: {
      enabled: true,
      outlineColor: 'rgba(255,255,255,0.16)',
      maskFill: 'rgba(120,120,120,0.18)',
      series: {
        color: '#9aa4b2',
        lineColor: '#9aa4b2'
      },
      xAxis: {
        labels: { style: { color: 'rgba(255,255,255,0.56)' } }
      }
    },

    scrollbar: {
      enabled: true,
      barBackgroundColor: '#4b4b4b',
      barBorderColor: '#4b4b4b',
      buttonBackgroundColor: '#333333',
      buttonBorderColor: '#333333',
      rifleColor: 'rgba(255,255,255,0.55)',
      trackBackgroundColor: '#262626',
      trackBorderColor: '#262626'
    },

    plotOptions: {
      series: {
        dataGrouping: {
          enabled: true,
          forced: false
        }
      },
      candlestick: {
        color: '#d95f5f',
        upColor: '#38c172',
        lineColor: '#d95f5f',
        upLineColor: '#38c172'
      }
    },

    series: [
      {
        id: 'eurusd-ohlc',
        name: CONFIG.displaySymbol,
        type: 'candlestick',
        data,
        tooltip: { valueDecimals: 5 },
        lastPrice: {
          enabled: true,
          color: '#f2b84b',
          label: {
            enabled: true,
            backgroundColor: '#f2b84b',
            style: { color: '#111111' }
          }
        }
      },
      {
        id: 'eurusd-sma',
        name: 'SMA (14)',
        type: 'sma',
        linkedTo: 'eurusd-ohlc',
        params: { period: 14 },
        yAxis: 0,
        tooltip: { valueDecimals: 5 }
      },
      {
        id: 'eurusd-rsi',
        name: 'RSI (14)',
        type: 'rsi',
        linkedTo: 'eurusd-ohlc',
        params: { period: 14 },
        yAxis: 1,
        tooltip: { valueDecimals: 2 }
      }
    ],

    responsive: {
      rules: [
        {
          condition: { maxWidth: 900 },
          chartOptions: {
            stockTools: { gui: { visible: false } },
            rangeSelector: { inputEnabled: false }
          }
        }
      ]
    }
  });
}

async function refreshChart() {
  try {
    setFeedStatus('Refreshing Twelve Data EUR/USD data...', 'idle');
    const data = await fetchEurUsdOhlc();

    if (!state.chart || !state.chart.get('eurusd-ohlc')) {
      buildChart(data);
    } else {
      const mainSeries = state.chart.get('eurusd-ohlc');
      mainSeries.setData(data, true, false, false);
      state.lastPointTime = data[data.length - 1][0];
      state.chart.setTitle(
        { text: `${CONFIG.displaySymbol} Live OHLC` },
        { text: 'Highstock with Stock Tools, SMA and RSI enabled. Source: Twelve Data public API.' }
      );
    }

    setFeedStatus(`Live public data loaded. Last point: ${formatTimestamp(state.lastPointTime)} UTC`, 'live');
  } catch (error) {
    console.error(error);
    const needsKey = error?.message === 'Twelve Data API key is required';
    const message = error?.name === 'AbortError'
      ? 'Twelve Data request timed out.'
      : error?.message || 'Unable to load Twelve Data market data.';

    setFeedStatus(`${message}${needsKey ? '.' : ' Check browser console/network access.'}`, needsKey ? 'idle' : 'error');

    if (!state.chart) {
      showEmptyChart(
        needsKey ? 'Twelve Data API key required' : 'Unable to load EUR/USD Twelve Data',
        needsKey
          ? 'Click Set API Key and paste your Twelve Data key. The key is stored only in your browser localStorage.'
          : 'The browser could not fetch Twelve Data. Check the API key, quota, CORS, proxy, firewall or temporary provider limits.'
      );
    }
  }
}

function startLiveRefresh() {
  window.clearInterval(state.refreshTimer);
  refreshChart();
  state.refreshTimer = window.setInterval(refreshChart, CONFIG.refreshMs);
}

window.addEventListener('DOMContentLoaded', () => {
  if (!window.Highcharts) {
    setFeedStatus('Highcharts could not be loaded from the CDN.', 'error');
    return;
  }

  if (elements.symbolSelector) {
    elements.symbolSelector.addEventListener('change', () => {
      elements.symbolSelector.value = CONFIG.symbol;
    });
  }

  if (elements.apiKeyButton) {
    elements.apiKeyButton.addEventListener('click', promptForApiKey);
  }

  if (elements.clearApiKeyButton) {
    elements.clearApiKeyButton.addEventListener('click', () => {
      clearApiKey();
      window.clearInterval(state.refreshTimer);
      state.chart = null;
      setFeedStatus('Twelve Data API key cleared. Set a key to load EUR/USD data.', 'idle');
      showEmptyChart('Twelve Data API key required', 'Click Set API Key and paste your Twelve Data key to load EUR/USD OHLC data.');
    });
  }

  startLiveRefresh();
});
