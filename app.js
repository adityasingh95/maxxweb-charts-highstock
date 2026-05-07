const CONFIG = {
  symbol: 'EUR/USD',
  displaySymbol: 'EUR/USD',
  defaultDataSource: 'twelvedata',
  twelveDataInterval: '5min',
  twelveDataOutputSize: 500,
  fxApiHistoryDays: 90,
  refreshMs: 60_000,
  requestTimeoutMs: 12_000,
  apiKeyStorageKey: 'maxxwebHighstock.twelveDataApiKey',
  dataSourceStorageKey: 'maxxwebHighstock.dataSource',
  twelveDataUrl(symbol, apiKey) {
    const params = new URLSearchParams({
      symbol,
      interval: this.twelveDataInterval,
      outputsize: String(this.twelveDataOutputSize),
      order: 'ASC',
      apikey: apiKey
    });

    return `https://api.twelvedata.com/time_series?${params}`;
  },
  fxApiHistoryUrl(fromDate, toDate) {
    const params = new URLSearchParams({
      from: fromDate,
      to: toDate
    });

    return `https://fxapi.app/api/history/EUR/USD.json?${params}`;
  }
};

const DATA_SOURCES = {
  twelvedata: {
    label: 'Twelve Data',
    badge: 'Twelve Data public API',
    subtitle: 'Highstock with Stock Tools, SMA and RSI enabled. Source: Twelve Data intraday OHLC API.'
  },
  fxapi: {
    label: 'fxapi.app',
    badge: 'fxapi.app no-key API',
    subtitle: 'Highstock with Stock Tools, SMA and RSI enabled. Source: fxapi.app daily rates, with demo OHLC synthesized from rate changes.'
  }
};

const LIGHT_THEME = {
  chartBackground: '#ffffff',
  plotBackground: '#ffffff',
  text: '#1f2937',
  mutedText: '#4b5563',
  grid: '#e5e7eb',
  axis: '#9ca3af',
  rangeButton: '#f3f4f6',
  rangeButtonHover: '#e5e7eb',
  rangeButtonSelected: '#d1d5db',
  tooltipBackground: '#ffffff',
  tooltipBorder: '#d1d5db',
  navigatorLine: '#6b7280',
  navigatorMask: 'rgba(107, 114, 128, 0.16)',
  scrollbarTrack: '#f3f4f6',
  scrollbarBar: '#cbd5e1',
  lastPrice: '#d97706'
};

const state = {
  chart: null,
  refreshTimer: null,
  lastPointTime: null,
  activeSource: CONFIG.defaultDataSource
};

const elements = {
  statusText: document.getElementById('feedStatus'),
  statusDot: document.getElementById('statusDot'),
  symbolSelector: document.getElementById('symbolSelector'),
  dataSourceSelector: document.getElementById('dataSourceSelector'),
  sourceBadge: document.getElementById('sourceBadge'),
  apiKeyButton: document.getElementById('apiKeyButton'),
  clearApiKeyButton: document.getElementById('clearApiKeyButton')
};

function getApiKey() {
  return window.localStorage.getItem(CONFIG.apiKeyStorageKey) || '';
}

function saveApiKey(apiKey) {
  window.localStorage.setItem(CONFIG.apiKeyStorageKey, apiKey.trim());
}

function clearApiKey() {
  window.localStorage.removeItem(CONFIG.apiKeyStorageKey);
}

function getStoredDataSource() {
  const stored = window.localStorage.getItem(CONFIG.dataSourceStorageKey);
  return DATA_SOURCES[stored] ? stored : CONFIG.defaultDataSource;
}

function saveDataSource(source) {
  window.localStorage.setItem(CONFIG.dataSourceStorageKey, source);
}

function setFeedStatus(message, mode = 'idle') {
  if (elements.statusText) {
    elements.statusText.textContent = message;
  }

  if (elements.statusDot) {
    elements.statusDot.className = `feed-dot feed-dot-${mode}`;
  }
}

function updateSourceControls() {
  const sourceConfig = DATA_SOURCES[state.activeSource];

  if (elements.dataSourceSelector) {
    elements.dataSourceSelector.value = state.activeSource;
  }

  if (elements.sourceBadge) {
    elements.sourceBadge.textContent = sourceConfig.badge;
  }

  const usesTwelveData = state.activeSource === 'twelvedata';

  if (elements.apiKeyButton) {
    elements.apiKeyButton.disabled = !usesTwelveData;
    elements.apiKeyButton.title = usesTwelveData
      ? 'Set Twelve Data API key'
      : 'fxapi.app mode does not require an API key';
  }

  if (elements.clearApiKeyButton) {
    elements.clearApiKeyButton.disabled = !usesTwelveData;
    elements.clearApiKeyButton.title = usesTwelveData
      ? 'Clear Twelve Data API key from this browser'
      : 'fxapi.app mode does not require an API key';
  }
}

function promptForApiKey() {
  if (state.activeSource !== 'twelvedata') {
    setFeedStatus('fxapi.app mode does not require an API key.', 'live');
    return;
  }

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

function formatDate(date) {
  return date.toISOString().slice(0, 10);
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

function toTwelveDataOhlcSeries(payload) {
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

function toFxApiSyntheticOhlcSeries(payload) {
  const rates = Array.isArray(payload?.rates) ? payload.rates : [];
  const sortedRates = rates
    .map((row) => ({
      timestamp: Date.parse(`${row.date}T00:00:00Z`),
      rate: parseNumeric(row.rate)
    }))
    .filter((row) => Number.isFinite(row.timestamp) && isValidNumber(row.rate))
    .sort((a, b) => a.timestamp - b.timestamp);

  return sortedRates.map((row, index) => {
    const previousClose = index > 0 ? sortedRates[index - 1].rate : row.rate;
    const open = previousClose;
    const close = row.rate;
    const move = Math.abs(close - open);
    const padding = Math.max(move * 0.35, close * 0.00025);
    const high = Math.max(open, close) + padding;
    const low = Math.min(open, close) - padding;

    return [row.timestamp, open, high, low, close];
  });
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

async function fetchTwelveDataOhlc() {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Twelve Data API key is required');
  }

  const url = CONFIG.twelveDataUrl(CONFIG.symbol, apiKey);
  const payload = await fetchWithTimeout(url, CONFIG.requestTimeoutMs);

  if (payload?.status === 'error' || payload?.code || payload?.message) {
    throw new Error(payload.message || `Twelve Data API error${payload.code ? ` ${payload.code}` : ''}`);
  }

  const data = toTwelveDataOhlcSeries(payload);

  if (data.length < 10) {
    throw new Error('Twelve Data response did not contain enough OHLC points');
  }

  return data;
}

async function fetchFxApiOhlc() {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setUTCDate(toDate.getUTCDate() - CONFIG.fxApiHistoryDays);

  const url = CONFIG.fxApiHistoryUrl(formatDate(fromDate), formatDate(toDate));
  const payload = await fetchWithTimeout(url, CONFIG.requestTimeoutMs);
  const data = toFxApiSyntheticOhlcSeries(payload);

  if (data.length < 10) {
    throw new Error('fxapi.app response did not contain enough historical rate points');
  }

  return data;
}

function getActiveSourceConfig() {
  return DATA_SOURCES[state.activeSource] || DATA_SOURCES[CONFIG.defaultDataSource];
}

async function fetchActiveOhlc() {
  if (state.activeSource === 'fxapi') {
    return fetchFxApiOhlc();
  }

  return fetchTwelveDataOhlc();
}

function showEmptyChart(title, subtitle) {
  state.chart = Highcharts.stockChart('highstockChart', {
    chart: { backgroundColor: LIGHT_THEME.chartBackground },
    title: {
      text: title,
      style: { color: LIGHT_THEME.text }
    },
    subtitle: {
      text: subtitle,
      style: { color: LIGHT_THEME.mutedText }
    },
    credits: { enabled: false },
    series: []
  });
}

function buildChart(data) {
  state.lastPointTime = data[data.length - 1][0];
  const sourceConfig = getActiveSourceConfig();

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
      backgroundColor: LIGHT_THEME.chartBackground,
      plotBackgroundColor: LIGHT_THEME.plotBackground,
      spacingTop: 10,
      spacingRight: 18,
      spacingBottom: 10,
      spacingLeft: 6
    },

    title: {
      text: `${CONFIG.displaySymbol} Live OHLC`,
      align: 'left',
      style: {
        color: LIGHT_THEME.text,
        fontSize: '15px',
        fontWeight: '600'
      }
    },

    subtitle: {
      text: sourceConfig.subtitle,
      align: 'left',
      style: {
        color: LIGHT_THEME.mutedText,
        fontSize: '12px'
      }
    },

    credits: {
      enabled: true,
      text: 'Highcharts Highstock',
      href: 'https://www.highcharts.com/products/highstock/'
    },

    rangeSelector: {
      selected: state.activeSource === 'fxapi' ? 3 : 1,
      inputEnabled: true,
      buttons: [
        { type: 'hour', count: 1, text: '1h' },
        { type: 'day', count: 1, text: '1d' },
        { type: 'day', count: 5, text: '5d' },
        { type: 'all', text: 'All' }
      ],
      buttonTheme: {
        fill: LIGHT_THEME.rangeButton,
        stroke: '#d1d5db',
        style: { color: LIGHT_THEME.text },
        states: {
          hover: { fill: LIGHT_THEME.rangeButtonHover },
          select: { fill: LIGHT_THEME.rangeButtonSelected, style: { color: '#111827' } }
        }
      },
      inputBoxBorderColor: '#d1d5db',
      inputStyle: { color: LIGHT_THEME.text },
      labelStyle: { color: LIGHT_THEME.mutedText }
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
      backgroundColor: LIGHT_THEME.tooltipBackground,
      borderColor: LIGHT_THEME.tooltipBorder,
      style: { color: LIGHT_THEME.text },
      valueDecimals: 5
    },

    xAxis: {
      gridLineColor: LIGHT_THEME.grid,
      lineColor: LIGHT_THEME.axis,
      tickColor: LIGHT_THEME.axis,
      labels: { style: { color: LIGHT_THEME.mutedText } },
      crosshair: {
        color: '#9ca3af',
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
          style: { color: LIGHT_THEME.mutedText }
        },
        title: { text: 'Price', style: { color: LIGHT_THEME.mutedText } },
        gridLineColor: LIGHT_THEME.grid,
        opposite: true
      },
      {
        top: '76%',
        height: '24%',
        offset: 0,
        labels: {
          align: 'right',
          x: -3,
          style: { color: LIGHT_THEME.mutedText }
        },
        title: { text: 'RSI', style: { color: LIGHT_THEME.mutedText } },
        gridLineColor: LIGHT_THEME.grid,
        opposite: true,
        min: 0,
        max: 100,
        plotLines: [
          { value: 30, color: '#cbd5e1', width: 1, dashStyle: 'ShortDash' },
          { value: 70, color: '#cbd5e1', width: 1, dashStyle: 'ShortDash' }
        ]
      }
    ],

    navigator: {
      enabled: true,
      outlineColor: '#cbd5e1',
      maskFill: LIGHT_THEME.navigatorMask,
      series: {
        color: LIGHT_THEME.navigatorLine,
        lineColor: LIGHT_THEME.navigatorLine
      },
      xAxis: {
        labels: { style: { color: LIGHT_THEME.mutedText } }
      }
    },

    scrollbar: {
      enabled: true,
      barBackgroundColor: LIGHT_THEME.scrollbarBar,
      barBorderColor: LIGHT_THEME.scrollbarBar,
      buttonBackgroundColor: LIGHT_THEME.rangeButton,
      buttonBorderColor: '#cbd5e1',
      rifleColor: '#64748b',
      trackBackgroundColor: LIGHT_THEME.scrollbarTrack,
      trackBorderColor: '#e5e7eb'
    },

    plotOptions: {
      series: {
        dataGrouping: {
          enabled: true,
          forced: false
        }
      },
      candlestick: {
        color: '#ef4444',
        upColor: '#22c55e',
        lineColor: '#b91c1c',
        upLineColor: '#15803d'
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
          color: LIGHT_THEME.lastPrice,
          label: {
            enabled: true,
            backgroundColor: LIGHT_THEME.lastPrice,
            style: { color: '#ffffff' }
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
  const sourceConfig = getActiveSourceConfig();

  try {
    updateSourceControls();
    setFeedStatus(`Refreshing ${sourceConfig.label} EUR/USD data...`, 'idle');
    const data = await fetchActiveOhlc();

    if (!state.chart || !state.chart.get('eurusd-ohlc')) {
      buildChart(data);
    } else {
      const mainSeries = state.chart.get('eurusd-ohlc');
      mainSeries.setData(data, true, false, false);
      state.lastPointTime = data[data.length - 1][0];
      state.chart.setTitle(
        { text: `${CONFIG.displaySymbol} Live OHLC` },
        { text: sourceConfig.subtitle }
      );
    }

    setFeedStatus(`${sourceConfig.label} data loaded. Last point: ${formatTimestamp(state.lastPointTime)} UTC`, 'live');
  } catch (error) {
    console.error(error);
    const needsKey = error?.message === 'Twelve Data API key is required';
    const message = error?.name === 'AbortError'
      ? `${sourceConfig.label} request timed out.`
      : error?.message || `Unable to load ${sourceConfig.label} market data.`;

    setFeedStatus(`${message}${needsKey ? '.' : ' Check browser console/network access.'}`, needsKey ? 'idle' : 'error');

    if (!state.chart) {
      showEmptyChart(
        needsKey ? 'Twelve Data API key required' : `Unable to load EUR/USD from ${sourceConfig.label}`,
        needsKey
          ? 'Click Set API Key and paste your Twelve Data key, or switch the Source selector to fxapi.app for no-key daily data.'
          : `The browser could not fetch ${sourceConfig.label}. Check provider availability, CORS, quota, proxy or firewall limits.`
      );
    }
  }
}

function startLiveRefresh() {
  window.clearInterval(state.refreshTimer);
  refreshChart();
  state.refreshTimer = window.setInterval(refreshChart, CONFIG.refreshMs);
}

function switchDataSource(source) {
  if (!DATA_SOURCES[source]) {
    return;
  }

  state.activeSource = source;
  saveDataSource(source);
  updateSourceControls();

  if (state.chart && typeof state.chart.destroy === 'function') {
    state.chart.destroy();
  }

  state.chart = null;
  startLiveRefresh();
}

window.addEventListener('DOMContentLoaded', () => {
  if (!window.Highcharts) {
    setFeedStatus('Highcharts could not be loaded from the CDN.', 'error');
    return;
  }

  state.activeSource = getStoredDataSource();
  updateSourceControls();

  if (elements.symbolSelector) {
    elements.symbolSelector.addEventListener('change', () => {
      elements.symbolSelector.value = CONFIG.symbol;
    });
  }

  if (elements.dataSourceSelector) {
    elements.dataSourceSelector.addEventListener('change', (event) => {
      switchDataSource(event.target.value);
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
      showEmptyChart('Twelve Data API key required', 'Click Set API Key and paste your Twelve Data key, or switch Source to fxapi.app for no-key daily data.');
    });
  }

  startLiveRefresh();
});
