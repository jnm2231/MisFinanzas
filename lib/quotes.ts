/**
 * Cotizaciones en tiempo (casi) real vía la API pública de Yahoo Finance.
 *
 * No requiere clave de API. Se consulta el endpoint de gráficos, que devuelve
 * el último precio de mercado (`regularMarketPrice`) del símbolo pedido.
 *
 * Símbolos de ejemplo:
 *  - Acciones: AAPL, TSLA, SAN.MC (Santander, Bolsa de Madrid)
 *  - ETFs:     VWCE.DE (Vanguard FTSE All-World, en EUR), CSPX.AS
 *  - Fondos:   los fondos indexados españoles suelen tener ISIN sin ticker público;
 *              en ese caso se deja el símbolo vacío y el valor se ajusta a mano.
 *
 * Importante: usa el ticker de la bolsa en EUR (sufijos .DE, .MC, .AS, .PA...)
 * para que el precio venga en euros; la app no convierte divisas.
 */

type YahooChartResponse = {
  chart?: {
    result?: {
      meta?: {
        regularMarketPrice?: number;
        currency?: string;
      };
    }[];
    error?: unknown;
  };
};

export type Quote = {
  price: number;
  currency: string;
};

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol.trim().toUpperCase()
    )}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as YahooChartResponse;
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    return { price: meta.regularMarketPrice, currency: meta.currency ?? 'EUR' };
  } catch {
    return null;
  }
}
