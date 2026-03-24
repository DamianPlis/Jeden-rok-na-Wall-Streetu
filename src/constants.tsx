import { StockPrices, GameState } from './types';

export const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export const MARKET_SCHEDULE: Record<number, { prices: StockPrices; state: any; newsPool: string[] }> = {
  0: { // January
    prices: { AAPL: 100, NVDA: 100, WMT: 100 },
    state: { sentiment: 'Neutral', newsFlash: 'Leden: Start nového roku! Trh je stabilní a plný očekávání.' },
    newsPool: ['Leden: Start nového roku! Trh je stabilní a plný očekávání.', 'Investoři plánují své strategie na nadcházejících 12 měsíců.']
  },
  1: { // February
    prices: { AAPL: 105, NVDA: 110, WMT: 102 },
    state: { sentiment: 'Bull', newsFlash: 'Únor: Technologické firmy hlásí silné zisky za minulý rok.' },
    newsPool: ['Únor: Technologické firmy hlásí silné zisky za minulý rok.', 'Poptávka po AI čipech NVDA roste rychleji, než se čekalo.']
  },
  2: { // March
    prices: { AAPL: 115, NVDA: 130, WMT: 105 },
    state: { sentiment: 'Bull', newsFlash: 'Březen: Jarní optimismus na Wall Street. Indexy rostou.' },
    newsPool: ['Březen: Jarní optimismus na Wall Street. Indexy rostou.', 'AAPL oznamuje novou generaci čipů.']
  },
  3: { // April
    prices: { AAPL: 110, NVDA: 120, WMT: 108 },
    state: { sentiment: 'Neutral', newsFlash: 'Duben: Trh si dává pauzu. Probíhá mírná korekce.' },
    newsPool: ['Duben: Trh si dává pauzu. Probíhá mírná korekce.', 'Inflační data jsou v souladu s očekáváním.']
  },
  4: { // May
    prices: { AAPL: 100, NVDA: 90, WMT: 110 },
    state: { sentiment: 'Bear', newsFlash: 'Květen: "Sell in May and go away?" Obavy z recese rostou.' },
    newsPool: ['Květen: "Sell in May and go away?" Obavy z recese rostou.', 'Geopolitické napětí zneklidňuje investory.']
  },
  5: { // June
    prices: { AAPL: 85, NVDA: 60, WMT: 115 },
    state: { sentiment: 'Bear', newsFlash: 'Červen: Velký výprodej v tech sektoru. NVDA pod tlakem.' },
    newsPool: ['Červen: Velký výprodej v tech sektoru. NVDA pod tlakem.', 'Regulátoři se zaměřují na AI monopol.']
  },
  6: { // July
    prices: { AAPL: 75, NVDA: 45, WMT: 120 },
    state: { sentiment: 'Bear', newsFlash: 'Červenec: Letní bouře na trzích. WMT se drží jako bezpečný přístav.' },
    newsPool: ['Červenec: Letní bouře na trzích. WMT se drží jako bezpečný přístav.', 'Spotřebitelé šetří, diskontní prodejci jako WMT profitují.']
  },
  7: { // August
    prices: { AAPL: 80, NVDA: 55, WMT: 118 },
    state: { sentiment: 'Neutral', newsFlash: 'Srpen: Trh hledá dno. Objevují se první nákupní příležitosti.' },
    newsPool: ['Srpen: Trh hledá dno. Objevují se první nákupní příležitosti.', 'Objemy obchodů jsou během dovolených nízké.']
  },
  8: { // September
    prices: { AAPL: 95, NVDA: 75, WMT: 110 },
    state: { sentiment: 'Bull', newsFlash: 'Září: Návrat k růstu. Technologický sektor se zotavuje.' },
    newsPool: ['Září: Návrat k růstu. Technologický sektor se zotavuje.', 'Nové zakázky pro NVDA z datových center.']
  },
  9: { // October
    prices: { AAPL: 110, NVDA: 95, WMT: 105 },
    state: { sentiment: 'Bull', newsFlash: 'Říjen: Výsledková sezóna překonává očekávání.' },
    newsPool: ['Říjen: Výsledková sezóna překonává očekávání.', 'AAPL hlásí rekordní prodeje v Číně.']
  },
  10: { // November
    prices: { AAPL: 130, NVDA: 120, WMT: 100 },
    state: { sentiment: 'Bull', newsFlash: 'Listopad: Předvánoční rallye začíná. Optimismus vrcholí.' },
    newsPool: ['Listopad: Předvánoční rallye začíná. Optimismus vrcholí.', 'Očekávání silné nákupní sezóny pomáhá všem sektorům.']
  },
  11: { // December
    prices: { AAPL: 150, NVDA: 140, WMT: 110 },
    state: { sentiment: 'Bull', newsFlash: 'Prosinec: Santa Claus rallye! Rok končí na maximech.' },
    newsPool: ['Prosinec: Santa Claus rallye! Rok končí na maximech.', 'Závěrečné zúčtování roku. Gratulujeme vítězům!']
  }
};

export const INITIAL_CAPITAL_MIN = 7500;
export const INITIAL_CAPITAL_MAX = 10000;
export const PASSIVE_FUND_RETURN = 0.08;
export const TRADING_FEE = 15;

export const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload, yAxis } = props;
  if (!payload) return null;

  const open = Number(payload.open);
  const close = Number(payload.close);
  const high = Number(payload.high);
  const low = Number(payload.low);

  if (isNaN(open) || isNaN(close) || isNaN(high) || isNaN(low)) {
    return null;
  }

  const isUp = close >= open;
  const color = isUp ? "#22c55e" : "#ef4444";
  
  // If yAxis scale is available, use it for wicks
  let highPx, lowPx, openPx, closePx;
  
  if (yAxis && yAxis.scale) {
    highPx = yAxis.scale(high);
    lowPx = yAxis.scale(low);
    openPx = yAxis.scale(open);
    closePx = yAxis.scale(close);
  } else {
    // Fallback if scale is missing (should not happen in Recharts Bar shape)
    // We use the y and height provided by Recharts which correspond to bodyRange
    const bodyMin = Math.min(open, close);
    const bodyMax = Math.max(open, close);
    const range = bodyMax - bodyMin;
    
    if (range === 0) {
      highPx = y - 10; // Dummy wicks
      lowPx = y + 10;
      openPx = y;
      closePx = y;
    } else {
      const scaleFactor = height / range;
      highPx = y - (high - bodyMax) * scaleFactor;
      lowPx = y + height + (bodyMin - low) * scaleFactor;
      openPx = isUp ? y + height : y;
      closePx = isUp ? y : y + height;
    }
  }

  const rectTop = Math.min(openPx, closePx);
  const rectHeight = Math.max(Math.abs(openPx - closePx), 2);

  return (
    <g>
      <line
        x1={x + width / 2}
        y1={highPx}
        x2={x + width / 2}
        y2={lowPx}
        stroke={color}
        strokeWidth={1}
      />
      <rect
        x={x}
        y={rectTop}
        width={width}
        height={rectHeight}
        fill={color}
      />
    </g>
  );
};
