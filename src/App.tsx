import { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  getDocs,
  collection,
  increment,
  arrayUnion,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { 
  GameState, 
  UserPortfolio, 
  StockPrices,
  Room,
  CandleData,
  Trade
} from './types';
import { cn } from './lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  LogOut, 
  LogIn, 
  ChevronRight, 
  ShieldAlert,
  Wallet,
  Briefcase,
  History,
  AlertCircle,
  Trophy,
  RefreshCw,
  Maximize2,
  Minimize2,
  Plus,
  Users,
  ArrowLeft,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries } from 'lightweight-charts';
import { useRef } from 'react';

import { 
  PRICE_IMPACT, 
  MARKET_SCHEDULE, 
  MONTH_NAMES, 
  INITIAL_CAPITAL_MIN, 
  INITIAL_CAPITAL_MAX, 
  PASSIVE_FUND_RETURN, 
  TRADING_FEE 
} from './constants';

function InfoTooltip({ content }: { content: string }) {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div className="relative inline-block ml-1 align-middle">
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="text-gray-500 hover:text-white transition-colors focus:outline-none"
      >
        <Info size={14} />
      </button>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#131722] border border-white/10 rounded shadow-2xl z-50 pointer-events-none"
          >
            <p className="text-[10px] text-gray-300 leading-tight font-sans">
              {content}
            </p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#131722]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface StockChartProps {
  ticker: keyof StockPrices;
  currentMonth: number;
  history: { [ticker: string]: CandleData[] };
  currentPrice: number;
  height?: string;
  isFocusMode?: boolean;
  trades?: Trade[];
  timeLeft?: number;
}

function StockChart({ ticker, currentMonth, history, currentPrice, height = "h-80", isFocusMode = false, trades = [], timeLeft }: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  const data = useMemo(() => {
    const tickerHistory = [...(history[ticker] || [])].sort((a, b) => a.time - b.time);
    const tickerTrades = trades.filter(t => t.ticker === ticker);

    const baseData = [...tickerHistory];
    
    const lastHistoryCandle = baseData[baseData.length - 1];
    const liveOpen = lastHistoryCandle ? lastHistoryCandle.close : currentPrice;
    
    // Ensure liveTime is at least 1 second ahead of lastHistoryCandle
    const liveTime = lastHistoryCandle 
      ? Math.max(lastHistoryCandle.time + 1000, Date.now()) 
      : Date.now();

    baseData.push({
      time: liveTime,
      open: liveOpen,
      high: Math.max(liveOpen, currentPrice),
      low: Math.min(liveOpen, currentPrice),
      close: currentPrice
    });

    // Deduplicate by second to prevent lightweight-charts errors
    const deduplicated: CandleData[] = [];
    const seenSeconds = new Set<number>();
    
    // Sort by time to ensure order
    baseData.sort((a, b) => a.time - b.time);

    // Keep the latest candle for each second
    for (let i = baseData.length - 1; i >= 0; i--) {
      const candle = baseData[i];
      const second = Math.floor(candle.time / 1000);
      if (!seenSeconds.has(second)) {
        deduplicated.unshift(candle);
        seenSeconds.add(second);
      }
    }

    if (deduplicated.length === 1) {
      const dummy: CandleData = {
        ...deduplicated[0],
        time: deduplicated[0].time - 60000,
      };
      deduplicated.unshift(dummy);
    }

    return deduplicated.map((c) => {
      const trade = tickerTrades.find(t => Math.abs(t.time - c.time) < 2000);
      return {
        ...c,
        trade: trade ? {
          type: trade.amount > 0 ? 'BUY' : 'SELL',
          amount: Math.abs(trade.amount),
          price: trade.price
        } : null
      };
    });
  }, [ticker, history, trades, currentPrice]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#050505' },
        textColor: '#d1d4dc',
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.3)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.3)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: 'rgba(224, 227, 235, 0.1)',
          style: 3, // Dashed
          labelBackgroundColor: '#131722',
        },
        horzLine: {
          width: 1,
          color: 'rgba(224, 227, 235, 0.1)',
          style: 3, // Dashed
          labelBackgroundColor: '#131722',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.1)',
        visible: true,
        scaleMargins: {
          top: 0.2,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 12,
      },
      handleScroll: true,
      handleScale: true,
    });

    // Add Watermark
    (chart as any).applyOptions({
      watermark: {
        visible: true,
        fontSize: isFocusMode ? 48 : 24,
        horzAlign: 'center',
        vertAlign: 'center',
        color: 'rgba(255, 255, 255, 0.03)',
        text: ticker,
      },
    });

    let series;
    let volumeSeries;
    try {
      series = (chart as any).addCandlestickSeries({
        upColor: '#22c55e', // Bright green
        downColor: '#ef4444', // Red
        borderVisible: true,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        priceLineVisible: true,
        priceLineWidth: 1,
        priceLineColor: '#d1d4dc',
        priceLineStyle: 3, // Dashed
        lastValueVisible: true,
      });
      
      volumeSeries = (chart as any).addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '', // Overlay mode
      });
      
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8, // Volume at the bottom 20%
          bottom: 0,
        },
      });
    } catch (e) {
      series = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        priceLineVisible: true,
        priceLineWidth: 1,
        priceLineColor: '#d1d4dc',
        priceLineStyle: 3, // Dashed
        lastValueVisible: true,
      });
    }

    chartRef.current = chart;
    seriesRef.current = series;
    (chartRef.current as any).volumeSeries = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !data.length) return;

    const formattedData = data.map(d => ({
      time: (Math.floor(d.time / 1000)) as any,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    seriesRef.current.setData(formattedData);

    if ((chartRef.current as any).volumeSeries) {
      const volumeData = data.map(d => ({
        time: (Math.floor(d.time / 1000)) as any,
        value: Math.abs(d.close - d.open) * 1000 + Math.random() * 500,
        color: d.close >= d.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
      }));
      (chartRef.current as any).volumeSeries.setData(volumeData);
    }

    const markers = data
      .filter(d => d.trade)
      .map(d => ({
        time: (Math.floor(d.time / 1000)) as any,
        position: d.trade!.type === 'BUY' ? 'belowBar' : 'aboveBar',
        color: '#26a69a',
        shape: d.trade!.type === 'BUY' ? 'arrowUp' : 'arrowDown',
        text: d.trade!.type === 'BUY' ? 'BUY' : 'SELL',
      }));

    if (seriesRef.current && typeof seriesRef.current.setMarkers === 'function') {
      seriesRef.current.setMarkers(markers);
    }
    
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  const lastIsUp = data[data.length - 1]?.close >= data[data.length - 1]?.open;

  // Simulated Technical Analysis based on last 5 candles
  const technicalAnalysis = useMemo(() => {
    if (data.length < 5) return 'NEUTRÁLNÍ';
    const last5 = data.slice(-5);
    const upCount = last5.filter(d => d.close > d.open).length;
    if (upCount >= 4) return 'SILNÝ NÁKUP';
    if (upCount >= 3) return 'NÁKUP';
    if (upCount <= 1) return 'SILNÝ PRODEJ';
    if (upCount <= 2) return 'PRODEJ';
    return 'NEUTRÁLNÍ';
  }, [data]);

  const analysisColor = useMemo(() => {
    if (technicalAnalysis.includes('NÁKUP')) return 'text-[#22c55e]';
    if (technicalAnalysis.includes('PRODEJ')) return 'text-[#ef4444]';
    return 'text-gray-400';
  }, [technicalAnalysis]);

  return (
    <div className={cn(height, "w-full bg-[#050505] rounded-none border border-[#1a1a1a] shadow-2xl relative overflow-hidden font-mono")}>
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#131722] p-1 px-2 border border-white/10 rounded-sm">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", lastIsUp ? "bg-[#22c55e]" : "bg-[#ef4444]")} />
            <span className="text-[10px] text-gray-300 uppercase tracking-[0.1em] font-bold">LIVE</span>
            <InfoTooltip content="Zobrazuje aktuální tržní data v reálném čase." />
          </div>
          <div className="text-[10px] text-white font-bold bg-[#131722] p-1 px-2 border border-white/10 rounded-sm uppercase tracking-wider flex items-center">
            {ticker} <span className="text-gray-500 ml-1">USD</span>
            <InfoTooltip content="Symbol akcie (např. AAPL pro Apple)." />
          </div>
          {isFocusMode && timeLeft !== undefined && (
            <div className="text-[10px] text-white font-bold bg-[#131722] p-1 px-2 border border-white/10 rounded-sm flex items-center gap-2">
              <span className="text-gray-500">DALŠÍ:</span>
              <span className={cn("tabular-nums", timeLeft <= 10 ? "text-yellow-500" : "text-[#22c55e]")}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}
          <div className={cn("text-[10px] font-bold bg-[#131722] p-1 px-2 border border-white/10 rounded-sm uppercase tracking-wider flex items-center", analysisColor)}>
            {technicalAnalysis}
            <InfoTooltip content="Automatická analýza trendu na základě posledních 5 svíček." />
          </div>
        </div>
        
        {data.length > 0 && (
          <div className="flex items-center gap-3 bg-[#131722]/40 backdrop-blur-sm p-1 px-2 text-[10px] font-medium border border-white/5 rounded-sm">
            <div className="flex items-center gap-1">
              <span className="text-gray-500">O</span>
              <span className={lastIsUp ? "text-[#22c55e]" : "text-[#ef4444]"}>{data[data.length - 1].open.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">H</span>
              <span className={lastIsUp ? "text-[#22c55e]" : "text-[#ef4444]"}>{data[data.length - 1].high.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">L</span>
              <span className={lastIsUp ? "text-[#22c55e]" : "text-[#ef4444]"}>{data[data.length - 1].low.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">C</span>
              <span className={lastIsUp ? "text-[#22c55e]" : "text-[#ef4444]"}>{data[data.length - 1].close.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <span className="text-gray-500">V</span>
              <span className="text-gray-300">
                {(Math.abs(data[data.length - 1].close - data[data.length - 1].open) * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <InfoTooltip content="Open (Otevírací), High (Nejvyšší), Low (Nejnižší), Close (Zavírací) cena a Volume (Objem) pro aktuální období." />
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4 z-10 text-right pointer-events-none flex flex-col items-end gap-1">
        <div className={cn("text-2xl font-black tracking-tighter bg-[#131722] p-1 px-3 border border-white/10 rounded-sm shadow-xl", lastIsUp ? "text-[#22c55e]" : "text-[#ef4444]")}>
          ${currentPrice.toFixed(2)}
        </div>
        {data.length > 1 && (
          <div className={cn("text-[10px] font-bold bg-[#131722] px-2 py-0.5 border border-white/10 rounded-sm", lastIsUp ? "text-[#22c55e]" : "text-[#ef4444]")}>
            {currentPrice >= data[data.length - 2].close ? '+' : ''}{((currentPrice - data[data.length - 2].close) / data[data.length - 2].close * 100).toFixed(2)}%
          </div>
        )}
      </div>
      
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [portfolio, setPortfolio] = useState<UserPortfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusTicker, setFocusTicker] = useState<keyof StockPrices>('AAPL');
  const [newRoomName, setNewRoomName] = useState("");
  const [isLockingPassive, setIsLockingPassive] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(60);

  const isAdmin = useMemo(() => {
    if (!user || !roomId) return false;
    const room = rooms.find(r => r.id === roomId);
    return room?.createdBy === user.uid;
  }, [user, roomId, rooms]);

  // Reset locking state when room changes
  useEffect(() => {
    setIsLockingPassive(false);
  }, [roomId]);

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      console.log('Auth state changed:', u ? `User: ${u.email}` : 'No user');
      setUser(u);
      setLoading(false);
      if (u) setError(null);
    });
  }, []);

  // Rooms List Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(10));
    return onSnapshot(q, (snap) => {
      const r = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(r);
    });
  }, [user]);

  // Game State Listener (Room Specific)
  useEffect(() => {
    if (!user || !roomId) {
      setGameState(null);
      return;
    }

    let isCreator = false;

    const unsub = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Room;
        setGameState(data.gameState);
        isCreator = data.createdBy === user.uid;
        if (data.gameState.currentMonth === 11) {
          setShowGameOver(true);
        } else {
          setShowGameOver(false);
        }
      }
    }, (err) => {
      console.error('GameState Snapshot Error:', err);
      if (err.code === 'permission-denied') {
        setError('Market data access denied.');
      }
    });

    // Auto-delete room when admin leaves
    return () => {
      unsub();
      if (isCreator && roomId) {
        // We use a separate async call to delete, but we don't await it in the cleanup
        deleteDoc(doc(db, 'rooms', roomId)).catch(e => console.error("Failed to auto-delete room:", e));
      }
    };
  }, [user, roomId]);

  // Portfolio Listener (Room Specific)
  useEffect(() => {
    if (!user || !roomId) {
      setPortfolio(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'rooms', roomId, 'portfolios', user.uid), (snap) => {
      if (snap.exists()) {
        setPortfolio(snap.data() as UserPortfolio);
      } else {
        // Initialize portfolio in this room
        const randomCapital = Math.floor(Math.random() * (INITIAL_CAPITAL_MAX - INITIAL_CAPITAL_MIN + 1)) + INITIAL_CAPITAL_MIN;
        const initialPortfolio: UserPortfolio = {
          uid: user.uid,
          roomId: roomId,
          email: user.email || '',
          cash: randomCapital,
          startingCapital: randomCapital,
          shares: { AAPL: 0, NVDA: 0, WMT: 0 },
          passiveFund: 0,
          isPassiveLocked: false,
          trades: []
        };
        setDoc(doc(db, 'rooms', roomId, 'portfolios', user.uid), initialPortfolio);
      }
    }, (err) => {
      console.error('Portfolio Snapshot Error:', err);
      if (err.code === 'permission-denied') {
        setError('Portfolio access denied.');
      }
    });
    return unsub;
  }, [user, roomId]);

  // Dividend & Final Return Logic
  useEffect(() => {
    if (!portfolio || !gameState || !user || !roomId) return;

    // Monthly Dividend (WMT pays $2 every month)
    const month = gameState.currentMonth;
    if (!portfolio.isDividendPaid?.[month]) {
      const dividend = portfolio.shares.WMT * 2;
      const updatedDividends = { ...(portfolio.isDividendPaid || {}), [month]: true };
      
      if (dividend > 0) {
        updateDoc(doc(db, 'rooms', roomId, 'portfolios', user.uid), {
          cash: portfolio.cash + dividend,
          isDividendPaid: updatedDividends
        });
      } else {
        updateDoc(doc(db, 'rooms', roomId, 'portfolios', user.uid), { isDividendPaid: updatedDividends });
      }
    }

    // December Final Return
    if (gameState.currentMonth === 11 && !portfolio.isFinalPaid) {
      const finalReturn = portfolio.passiveFund * (1 + PASSIVE_FUND_RETURN);
      if (finalReturn > 0) {
        updateDoc(doc(db, 'rooms', roomId, 'portfolios', user.uid), {
          cash: portfolio.cash + finalReturn,
          passiveFund: 0,
          isFinalPaid: true
        });
      } else {
        updateDoc(doc(db, 'rooms', roomId, 'portfolios', user.uid), { isFinalPaid: true });
      }
    }
  }, [gameState?.currentMonth, portfolio?.uid, roomId]);

  // Timer Logic
  useEffect(() => {
    if (!gameState || gameState.isPaused || !gameState.nextTickAt) {
      setTimeLeft(60);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((gameState.nextTickAt! - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0 && isAdmin) {
        handleNextMonth();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState?.nextTickAt, gameState?.isPaused, isAdmin]);

  const handleCreateRoom = async () => {
    if (!user || !newRoomName.trim()) return;
    
    const initialState: GameState = {
      currentMonth: 0,
      isPaused: true,
      nextTickAt: null,
      sentiment: MARKET_SCHEDULE[0].state.sentiment,
      newsFlash: MARKET_SCHEDULE[0].state.newsFlash,
      prices: MARKET_SCHEDULE[0].prices,
      history: {
        AAPL: [{ time: Date.now(), open: MARKET_SCHEDULE[0].prices.AAPL, high: MARKET_SCHEDULE[0].prices.AAPL, low: MARKET_SCHEDULE[0].prices.AAPL, close: MARKET_SCHEDULE[0].prices.AAPL }],
        NVDA: [{ time: Date.now(), open: MARKET_SCHEDULE[0].prices.NVDA, high: MARKET_SCHEDULE[0].prices.NVDA, low: MARKET_SCHEDULE[0].prices.NVDA, close: MARKET_SCHEDULE[0].prices.NVDA }],
        WMT: [{ time: Date.now(), open: MARKET_SCHEDULE[0].prices.WMT, high: MARKET_SCHEDULE[0].prices.WMT, low: MARKET_SCHEDULE[0].prices.WMT, close: MARKET_SCHEDULE[0].prices.WMT }]
      }
    };

    const roomRef = await addDoc(collection(db, 'rooms'), {
      name: newRoomName,
      createdBy: user.uid,
      createdAt: Date.now(),
      gameState: initialState
    });

    setRoomId(roomRef.id);
    setNewRoomName("");
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      if (result.user) {
        setUser(result.user);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError('Tato doména není v Firebase konzoli povolena. Přidejte ji prosím do Authorized domains.');
      } else {
        setError(`Přihlášení se nezdařilo: ${err.message || 'Zkuste to prosím znovu.'}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setRoomId(null);
  };

  const handleNextMonth = async () => {
    if (!isAdmin || !gameState || !roomId) return;

    // Prevent double-triggering for the same month
    if (gameState.currentMonth >= 11) {
      await updateDoc(doc(db, 'rooms', roomId), {
        'gameState.isPaused': true,
        'gameState.nextTickAt': null
      });
      return;
    }

    const nextM = gameState.currentMonth + 1;
    const schedule = MARKET_SCHEDULE[nextM];
    const randomNews = schedule.newsPool[Math.floor(Math.random() * schedule.newsPool.length)];
    
    const nextPrices = { ...schedule.prices };
    
    // Prepare updates for each ticker
    const updates: any = {
      'gameState.currentMonth': nextM,
      'gameState.sentiment': schedule.state.sentiment,
      'gameState.newsFlash': randomNews,
      'gameState.nextTickAt': Date.now() + 60000
    };

    (['AAPL', 'NVDA', 'WMT'] as const).forEach(ticker => {
      const tickerHistory = gameState.history?.[ticker] || [];
      const lastCandle = tickerHistory[tickerHistory.length - 1];
      const open = gameState.prices[ticker] || (lastCandle ? lastCandle.close : 100);
      const close = nextPrices[ticker];
      
      // Use a slightly more dramatic high/low for month transitions
      const volatility = Math.abs(close - open) * 0.2 + 2;
      
      const newCandle: CandleData = {
        time: Date.now() + Math.random() * 1000, // Ensure uniqueness and slight offset
        open,
        close,
        high: Math.max(open, close) + (Math.random() * volatility),
        low: Math.min(open, close) - (Math.random() * volatility)
      };
      
      updates[`gameState.prices.${ticker}`] = close;
      updates[`gameState.history.${ticker}`] = arrayUnion(newCandle);
    });

    try {
      await updateDoc(doc(db, 'rooms', roomId), updates);
    } catch (err) {
      console.error("Failed to advance month:", err);
    }
  };

  const handleTogglePause = async () => {
    if (!isAdmin || !gameState || !roomId) return;
    
    const newPaused = !gameState.isPaused;
    await updateDoc(doc(db, 'rooms', roomId), {
      'gameState.isPaused': newPaused,
      'gameState.nextTickAt': newPaused ? null : Date.now() + (timeLeft * 1000)
    });
  };

  const handleStartGame = async () => {
    if (!isAdmin || !gameState || !roomId) return;
    
    await updateDoc(doc(db, 'rooms', roomId), {
      'gameState.isPaused': false,
      'gameState.nextTickAt': Date.now() + 60000
    });
  };

  const handleResetGame = async () => {
    if (!isAdmin || !roomId) return;
    
    const initialState: GameState = {
      currentMonth: 0,
      isPaused: true,
      nextTickAt: null,
      sentiment: MARKET_SCHEDULE[0].state.sentiment,
      newsFlash: MARKET_SCHEDULE[0].state.newsFlash,
      prices: MARKET_SCHEDULE[0].prices,
      history: {
        AAPL: [{ time: Date.now(), open: MARKET_SCHEDULE[0].prices.AAPL, high: MARKET_SCHEDULE[0].prices.AAPL, low: MARKET_SCHEDULE[0].prices.AAPL, close: MARKET_SCHEDULE[0].prices.AAPL }],
        NVDA: [{ time: Date.now(), open: MARKET_SCHEDULE[0].prices.NVDA, high: MARKET_SCHEDULE[0].prices.NVDA, low: MARKET_SCHEDULE[0].prices.NVDA, close: MARKET_SCHEDULE[0].prices.NVDA }],
        WMT: [{ time: Date.now(), open: MARKET_SCHEDULE[0].prices.WMT, high: MARKET_SCHEDULE[0].prices.WMT, low: MARKET_SCHEDULE[0].prices.WMT, close: MARKET_SCHEDULE[0].prices.WMT }]
      }
    };

    await updateDoc(doc(db, 'rooms', roomId), { gameState: initialState });
  };

  const handleTrade = async (ticker: keyof StockPrices, amount: number) => {
    if (!user || !portfolio || !gameState || !roomId) return;
    
    const currentPrice = gameState.prices[ticker] || 100;
    const tradeValue = currentPrice * Math.abs(amount);

    if (amount > 0) { // Buy
      const totalCost = tradeValue + TRADING_FEE;
      if (portfolio.cash < totalCost) {
        setError(`Nedostatek prostředků! Potřebujete $${totalCost.toLocaleString()} (včetně poplatku $${TRADING_FEE})`);
        return;
      }
      
      const newTrade: Trade = {
        ticker,
        amount,
        price: currentPrice,
        time: Date.now()
      };
      
      await updateDoc(doc(db, 'rooms', roomId, 'portfolios', user.uid), {
        cash: portfolio.cash - totalCost,
        [`shares.${ticker}`]: portfolio.shares[ticker] + amount,
        trades: arrayUnion(newTrade)
      });

      const priceChange = PRICE_IMPACT * amount;
      const nextPrice = currentPrice + priceChange;

      // Record trade as a candle
      const tickerHistory = gameState.history?.[ticker] || [];
      const lastCandle = tickerHistory[tickerHistory.length - 1];
      const open = lastCandle ? lastCandle.close : currentPrice;
      const time = lastCandle ? Math.max(Date.now(), lastCandle.time + 1000) : Date.now();

      const newCandle: CandleData = {
        time,
        open,
        close: nextPrice,
        high: Math.max(open, nextPrice) + (Math.random() * 2),
        low: Math.min(open, nextPrice) - (Math.random() * 2)
      };

      if (!isNaN(nextPrice)) {
        await updateDoc(doc(db, 'rooms', roomId), {
          [`gameState.prices.${ticker}`]: increment(priceChange),
          [`gameState.history.${ticker}`]: arrayUnion(newCandle)
        });
      }

    } else { // Sell
      if (portfolio.shares[ticker] < Math.abs(amount)) {
        setError('Nemáte dostatek akcií!');
        return;
      }

      const netProceeds = tradeValue - TRADING_FEE;
      
      const newTrade: Trade = {
        ticker,
        amount,
        price: currentPrice,
        time: Date.now()
      };

      await updateDoc(doc(db, 'rooms', roomId, 'portfolios', user.uid), {
        cash: portfolio.cash + netProceeds,
        [`shares.${ticker}`]: portfolio.shares[ticker] + amount,
        trades: arrayUnion(newTrade)
      });

      const priceChange = PRICE_IMPACT * amount; // amount is negative
      const nextPrice = currentPrice + priceChange;

      // Record trade as a candle
      const tickerHistory = gameState.history?.[ticker] || [];
      const lastCandle = tickerHistory[tickerHistory.length - 1];
      const open = lastCandle ? lastCandle.close : currentPrice;
      const time = lastCandle ? Math.max(Date.now(), lastCandle.time + 1000) : Date.now();

      const newCandle: CandleData = {
        time,
        open,
        close: nextPrice,
        high: Math.max(open, nextPrice) + (Math.random() * 2),
        low: Math.min(open, nextPrice) - (Math.random() * 2)
      };

      if (!isNaN(nextPrice)) {
        await updateDoc(doc(db, 'rooms', roomId), {
          [`gameState.prices.${ticker}`]: increment(priceChange),
          [`gameState.history.${ticker}`]: arrayUnion(newCandle)
        });
      }
    }
    setError(null);
  };

  const handleLockPassive = async (amount: number) => {
    if (!user || !portfolio || !gameState || !roomId || isLockingPassive) return;
    if (gameState.currentMonth > 0) {
      setError('Pasivní fond je k dispozici pouze v lednu.');
      return;
    }
    if (portfolio.isPassiveLocked) {
      setError('Do pasivního fondu můžete vložit prostředky pouze jednou.');
      return;
    }

    if (amount > 0) {
      if (portfolio.cash < amount) {
        setError('Nedostatek hotovosti!');
        return;
      }
      setIsLockingPassive(true);
      try {
        await updateDoc(doc(db, 'rooms', roomId, 'portfolios', user.uid), {
          cash: portfolio.cash - amount,
          passiveFund: portfolio.passiveFund + amount,
          isPassiveLocked: true
        });
        // We don't set isLockingPassive(false) here because we want the UI
        // to stay locked until the onSnapshot listener updates the portfolio state.
      } catch (err: any) {
        console.error("Lock passive error:", err);
        setError('Nepodařilo se uzamknout prostředky. Zkuste to prosím znovu.');
        setIsLockingPassive(false);
      }
    }
  };

  const handleTriggerEvent = async () => {
    if (!isAdmin || !gameState || !roomId) return;
    
    const schedule = MARKET_SCHEDULE[gameState.currentMonth];
    const randomNews = schedule.newsPool[Math.floor(Math.random() * schedule.newsPool.length)];
    
    await updateDoc(doc(db, 'rooms', roomId), { 
      'gameState.newsFlash': randomNews
    });
  };

  const renderASCIIChart = (ticker: keyof StockPrices) => {
    if (!gameState) return null;
    const history = Array.from({ length: gameState.currentMonth + 1 }, (_, i) => MARKET_SCHEDULE[i].prices[ticker]);
    const max = Math.max(...Object.values(MARKET_SCHEDULE).map(s => s.prices[ticker]));
    const min = Math.min(...Object.values(MARKET_SCHEDULE).map(s => s.prices[ticker]));
    
    const bars = history.map(p => {
      const height = Math.round(((p - min) / (max - min || 1)) * 5);
      const chars = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
      return chars[height] || ' ';
    }).join('');

    return `[ ${bars.padEnd(5, ' ')} ] $${MARKET_SCHEDULE[gameState.currentMonth].prices[ticker]}`;
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] flex items-center justify-center font-mono">Loading Simulation...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] flex items-center justify-center p-4 font-mono">
        <div className="max-w-md w-full bg-[#1a1a1a] border-2 border-[#2a2b2e] p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)]">
          <h1 className="text-3xl font-bold mb-6 italic serif text-white">Jeden rok na Wall Street</h1>
          <p className="mb-8 text-gray-400">Přihlaste se do banky a začněte svou simulaci.</p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border-2 border-red-500 text-red-500 text-sm font-bold flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-2 bg-white text-black p-4 hover:bg-gray-200 transition-colors font-bold disabled:opacity-50"
          >
            {isLoggingIn ? (
              <RefreshCw size={20} className="animate-spin" />
            ) : (
              <LogIn size={20} />
            )}
            {isLoggingIn ? 'Přihlašování...' : 'Přihlásit se přes Google'}
          </button>
        </div>
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] flex items-center justify-center p-4 font-mono">
        <div className="max-w-4xl w-full space-y-8">
          <div className="flex justify-between items-center border-b-2 border-[#2a2b2e] pb-6">
            <h1 className="text-4xl font-black italic serif uppercase tracking-tighter text-white">Lobby</h1>
            <button onClick={handleLogout} className="flex items-center gap-2 hover:underline text-sm opacity-70 hover:opacity-100">
              <LogOut size={16} /> Odhlásit se
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Create Room */}
            <div className="bg-[#1a1a1a] border-2 border-[#2a2b2e] p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)]">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                <Plus size={20} /> Vytvořit novou místnost
                <InfoTooltip content="Vytvořte novou herní místnost, kde budete správcem a můžete ovládat čas simulace." />
              </h2>
              <p className="text-sm text-gray-400 mb-6">Spusťte novou simulaci. Budete správcem této místnosti.</p>
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Název místnosti (např. Wall Street 2026)"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-[#0a0a0a] border-2 border-[#2a2b2e] p-4 text-white focus:border-white outline-none transition-colors"
                />
                <button 
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim()}
                  className="w-full bg-white text-black p-4 font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  VYTVOŘIT MÍSTNOST
                </button>
              </div>
            </div>

            {/* Join Room */}
            <div className="bg-[#1a1a1a] border-2 border-[#2a2b2e] p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)]">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                <Users size={20} /> Připojit se k místnosti
                <InfoTooltip content="Vstupte do již vytvořené místnosti a soutěžte s ostatními hráči v reálném čase." />
              </h2>
              <p className="text-sm text-gray-400 mb-6">Vstupte do existující simulace a soutěžte s ostatními.</p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {rooms.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 italic">Nebyly nalezeny žádné aktivní místnosti.</div>
                ) : (
                  rooms.map(room => (
                    <button 
                      key={room.id}
                      onClick={() => setRoomId(room.id)}
                      className="w-full flex items-center justify-between bg-[#0a0a0a] border-2 border-[#2a2b2e] p-4 hover:border-white transition-all group"
                    >
                      <div className="text-left">
                        <div className="font-bold text-white group-hover:text-white">{room.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                          Vytvořeno {new Date(room.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-gray-500 group-hover:text-white" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentPrices = gameState?.prices || null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] font-mono p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-[#2a2b2e] pb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowLeaveConfirm(true)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
              title="Back to Lobby"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-4xl font-black italic serif uppercase tracking-tighter text-white">
                {rooms.find(r => r.id === roomId)?.name || "Jeden rok na Wall Street"}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-white text-black px-2 py-0.5 text-xs uppercase font-bold">Živá simulace</span>
                <span className="text-xs opacity-50">{user.email}</span>
                {isAdmin && <span className="text-[10px] bg-yellow-600 text-black px-1 font-bold">SPRÁVCE</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsFocusMode(!isFocusMode)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-2",
                isFocusMode 
                  ? "bg-white text-black border-white" 
                  : "bg-transparent text-white border-[#2a2b2e] hover:border-white"
              )}
            >
              {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFocusMode ? "Zavřít detail" : "Detailní graf"}
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 hover:underline text-sm opacity-70 hover:opacity-100">
              <LogOut size={16} /> Odhlásit se
            </button>
          </div>
        </header>

        {/* Market Status */}
        {!isFocusMode && (
          <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#1a1a1a] border-2 border-[#2a2b2e] p-6 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]">
              <h2 className="text-xs uppercase opacity-50 mb-2 italic serif flex items-center">
                Aktuální měsíc
                <InfoTooltip content="Simulace probíhá po dobu 12 měsíců (leden až prosinec)." />
              </h2>
              <div className="text-4xl font-bold text-white uppercase tracking-tighter">
                {MONTH_NAMES[gameState?.currentMonth ?? 0]}
              </div>
            </div>
            <div className="bg-[#1a1a1a] border-2 border-[#2a2b2e] p-6 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)] flex flex-col justify-between">
              <h2 className="text-xs uppercase opacity-50 mb-2 italic serif flex items-center">
                Další měsíc za
                <InfoTooltip content="Čas zbývající do konce aktuálního měsíce a přechodu na další." />
              </h2>
              <div className={cn(
                "text-5xl font-black tabular-nums",
                timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-white"
              )}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
              {isAdmin && (
                <div className="flex gap-2 mt-4">
                  {gameState?.nextTickAt ? (
                    <button 
                      onClick={handleTogglePause}
                      className="flex-1 bg-white text-black text-[10px] font-bold py-1 hover:bg-gray-200 uppercase flex items-center justify-center gap-1"
                    >
                      {gameState.isPaused ? 'Pokračovat' : 'Pozastavit'}
                      <InfoTooltip content="Pozastaví nebo spustí časovač simulace." />
                    </button>
                  ) : (
                    <button 
                      onClick={handleStartGame}
                      className="flex-1 bg-green-600 text-white text-[10px] font-bold py-1 hover:bg-green-500 uppercase flex items-center justify-center gap-1"
                    >
                      Spustit hru
                      <InfoTooltip content="Spustí simulaci prvního měsíce." />
                    </button>
                  )}
                  <button 
                    onClick={handleResetGame}
                    className="flex-1 bg-red-900/20 border border-red-500 text-red-500 text-[10px] font-bold py-1 hover:bg-red-900/40 uppercase flex items-center justify-center gap-1"
                  >
                    Reset
                    <InfoTooltip content="Vynuluje hru a vrátí všechny hráče na začátek." />
                  </button>
                </div>
              )}
            </div>
            <div className={cn(
              "border-2 border-[#2a2b2e] p-6 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]",
              gameState?.sentiment === 'Bull' ? "bg-green-900/20 border-green-500/50" : gameState?.sentiment === 'Bear' ? "bg-red-900/20 border-red-500/50" : "bg-[#1a1a1a]"
            )}>
              <h2 className="text-xs uppercase opacity-50 mb-2 italic serif flex items-center">
                Nálada na trhu
                <InfoTooltip content="Býčí trh (Bull) znamená rostoucí ceny, Medvědí trh (Bear) znamená klesající ceny." />
              </h2>
              <div className="text-4xl font-bold flex items-center gap-2 text-white">
                {gameState?.sentiment === 'Bull' ? 'Býčí' : gameState?.sentiment === 'Bear' ? 'Medvědí' : 'Neutrální'}
                {gameState?.sentiment === 'Bull' && <TrendingUp size={32} className="text-green-500" />}
                {gameState?.sentiment === 'Bear' && <TrendingDown size={32} className="text-red-500" />}
              </div>
            </div>
            <div className="bg-[#1a1a1a] border-2 border-white p-6 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]">
              <h2 className="text-xs uppercase opacity-50 mb-2 italic serif text-white/50 flex items-center">
                Blesková zpráva
                <InfoTooltip content="Aktuální událost, která může ovlivnit ceny akcií na trhu." />
              </h2>
              <p className="text-sm leading-tight italic font-bold text-white">"{gameState?.newsFlash}"</p>
            </div>
          </section>
        )}

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-red-900/20 text-red-400 p-4 border-2 border-red-500/50 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={20} />
                <span className="font-bold">{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-xs underline">Zavřít</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Dashboard */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {isFocusMode ? (
            <div className="fixed inset-0 z-40 bg-[#050505] flex flex-col">
              {/* Focus Mode Header */}
              <div className="bg-[#1a1a1a] border-b border-[#2a2b2e] p-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setIsFocusMode(false)}
                    className="p-2 hover:bg-white/10 text-white transition-colors"
                  >
                    <ArrowLeft size={24} />
                  </button>
                  <div className="flex gap-2">
                    {(['AAPL', 'NVDA', 'WMT'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setFocusTicker(t)}
                        className={cn(
                          "px-4 py-2 text-xs font-bold transition-all",
                          focusTicker === t 
                            ? "bg-white text-black" 
                            : "bg-[#2a2b2e] text-gray-400 hover:text-white"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-[10px] uppercase opacity-50 text-gray-400 flex items-center justify-end">
                      Aktuální měsíc
                      <InfoTooltip content="Simulace probíhá po dobu 12 měsíců (leden až prosinec)." />
                    </div>
                    <div className="text-xl font-bold text-white uppercase tracking-tighter">
                      {MONTH_NAMES[gameState?.currentMonth ?? 0]}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase opacity-50 text-gray-400 flex items-center justify-end">
                      Další měsíc za
                      <InfoTooltip content="Čas zbývající do konce aktuálního měsíce a přechodu na další." />
                    </div>
                    <div className={cn(
                      "text-xl font-bold tabular-nums",
                      timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-white"
                    )}>
                      {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase opacity-50 text-gray-400 flex items-center justify-end">
                      Dostupná hotovost
                      <InfoTooltip content="Peníze, které můžete použít k nákupu akcií nebo vložení do pasivního fondu." />
                    </div>
                    <div className="text-xl font-bold text-white">${portfolio?.cash.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase opacity-50 text-gray-400 flex items-center justify-end">
                      Akcie {focusTicker}
                      <InfoTooltip content="Počet akcií této společnosti, které aktuálně vlastníte." />
                    </div>
                    <div className="text-xl font-bold text-white">{portfolio?.shares[focusTicker] || 0}</div>
                  </div>
                </div>
              </div>

              {/* Focus Mode Content */}
              <div className="flex-1 flex overflow-hidden">
                {/* Chart Area */}
                <div className="flex-1 relative">
                  <StockChart 
                    ticker={focusTicker} 
                    currentMonth={gameState?.currentMonth ?? 0} 
                    history={gameState?.history || {}}
                    currentPrice={currentPrices?.[focusTicker] || 100}
                    height="h-full"
                    isFocusMode={true}
                    trades={portfolio?.trades}
                    timeLeft={timeLeft}
                  />
                </div>

                {/* Focus Mode Sidebar */}
                <div className="w-80 bg-[#1a1a1a] border-l border-[#2a2b2e] p-6 flex flex-col gap-8">
                  <div>
                    <h3 className="text-xs uppercase opacity-50 mb-4 italic serif flex items-center">
                      Obchodní panel
                      <InfoTooltip content="Zde můžete provádět rychlé obchody s vybranou akcií." />
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-[#0a0a0a] p-4 border border-[#2a2b2e]">
                        <div className="text-[10px] uppercase text-gray-500 mb-1 flex items-center">
                          Tržní cena
                          <InfoTooltip content="Aktuální cena za jednu akcii na trhu." />
                        </div>
                        <div className="text-3xl font-black text-white">${currentPrices?.[focusTicker].toFixed(2)}</div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handleTrade(focusTicker, 1)}
                          className="bg-green-600 text-white py-4 font-bold hover:bg-green-500 transition-colors uppercase text-xs"
                        >
                          KOUPIT 1 ks
                        </button>
                        <button 
                          onClick={() => handleTrade(focusTicker, -1)}
                          className="bg-red-600 text-white py-4 font-bold hover:bg-red-500 transition-colors uppercase text-xs"
                        >
                          PRODAT 1 ks
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handleTrade(focusTicker, 10)}
                          className="bg-green-600/20 border border-green-600 text-green-500 py-3 font-bold hover:bg-green-600/30 transition-colors uppercase text-[10px]"
                        >
                          KOUPIT 10 ks
                        </button>
                        <button 
                          onClick={() => handleTrade(focusTicker, -10)}
                          className="bg-red-600/20 border border-red-600 text-red-500 py-3 font-bold hover:bg-red-600/30 transition-colors uppercase text-[10px]"
                        >
                          PRODAT 10 ks
                        </button>
                      </div>
                      <div className="text-[10px] text-gray-500 text-center flex items-center justify-center gap-1">
                        Poplatek: ${TRADING_FEE}
                        <InfoTooltip content="Poplatek za každou provedenou transakci (nákup i prodej)." />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xs uppercase opacity-50 mb-4 italic serif flex items-center">
                      Podrobnosti o pozici
                      <InfoTooltip content="Informace o vašem aktuálním vlastnictví této akcie." />
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-[#2a2b2e] pb-2">
                        <span className="text-xs text-gray-400 flex items-center">
                          Celková hodnota
                          <InfoTooltip content="Aktuální tržní hodnota všech vašich akcií této společnosti." />
                        </span>
                        <span className="text-sm font-bold text-white">
                          ${((portfolio?.shares[focusTicker] || 0) * (currentPrices?.[focusTicker] || 0)).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-[#2a2b2e] pb-2">
                        <span className="text-xs text-gray-400 flex items-center">
                          Průměrná nákupní cena
                          <InfoTooltip content="Průměrná cena, za kterou jste tyto akcie nakoupili." />
                        </span>
                        <span className="text-sm font-bold text-white">$100.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-600/10 border border-yellow-600/50 p-4">
                    <div className="text-[10px] uppercase text-yellow-500 font-bold mb-1 flex items-center">
                      Nálada na trhu
                      <InfoTooltip content="Býčí trh (Bull) znamená rostoucí ceny, Medvědí trh (Bear) znamená klesající ceny." />
                    </div>
                    <div className="text-lg font-black text-white italic serif">
                      {gameState?.sentiment === 'Bull' ? 'Býčí' : gameState?.sentiment === 'Bear' ? 'Medvědí' : 'Neutrální'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={cn(
              "grid gap-8",
              isFocusMode ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
            )}>
          {/* Market Data */}
          <div className="space-y-6">
            <div className="bg-[#1a1a1a] border-2 border-[#2a2b2e] overflow-hidden shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)]">
              <div className="bg-[#2a2b2e] text-white px-4 py-2 text-xs uppercase font-bold flex justify-between items-center">
                <span>{isFocusMode ? "Přehled trhu (Režim soustředění)" : "Tržní ceny"}</span>
                <span className="flex items-center gap-1 opacity-50"><History size={12} /> Živý přenos</span>
              </div>
              <div className={cn(
                "divide-y-2 divide-[#2a2b2e]",
                isFocusMode ? "grid grid-cols-1 md:grid-cols-3 divide-y-0 divide-x-2" : ""
              )}>
                {(['AAPL', 'NVDA', 'WMT'] as const).map((ticker) => {
                  const price = currentPrices?.[ticker] ?? 100;
                  const prevPrice = gameState && gameState.currentMonth > 0 
                    ? MARKET_SCHEDULE[gameState.currentMonth - 1].prices[ticker] 
                    : 100;
                  const diff = price - prevPrice;

                  return (
                    <div key={ticker} className={cn(
                      "p-4 flex flex-col group hover:bg-white/5 transition-colors",
                      isFocusMode ? "p-8" : "flex-row items-center justify-between"
                    )}>
                      <div className={cn(
                        "flex items-center gap-4",
                        isFocusMode ? "flex-col items-start mb-4" : ""
                      )}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white text-black flex items-center justify-center font-bold">
                            {ticker[0]}
                          </div>
                          <div>
                            <div className="font-bold text-xl text-white flex items-center">
                              {ticker}
                              {ticker === 'WMT' && (
                                <InfoTooltip content="WMT vyplácí dividendu $2 každý měsíc za každou drženou akcii." />
                              )}
                            </div>
                            <div className="text-2xl font-bold text-white">${price}</div>
                            <div className={cn(
                              "text-xs font-bold flex items-center gap-1",
                              diff > 0 ? "text-green-500" : diff < 0 ? "text-red-500" : "text-gray-500"
                            )}>
                              {diff > 0 ? '+' : ''}{diff} {diff !== 0 && (diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="w-full">
                        <StockChart 
                          ticker={ticker} 
                          currentMonth={gameState?.currentMonth ?? 0} 
                          history={gameState?.history || {}}
                          currentPrice={currentPrices?.[ticker] || 100}
                          height={isFocusMode ? "h-96" : "h-64"}
                          trades={portfolio?.trades}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trading Controls */}
            {!isFocusMode && gameState && gameState.currentMonth < 11 && (
              <div className="bg-[#1a1a1a] border-2 border-[#2a2b2e] p-6 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)]">
                <h3 className="text-xs uppercase opacity-50 mb-4 italic serif flex items-center">
                  Obchodní parket
                  <InfoTooltip content="Zde můžete nakupovat nebo prodávat akcie. Každý obchod stojí malý poplatek." />
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {(['AAPL', 'NVDA', 'WMT'] as const).map((ticker) => (
                    <div key={ticker} className="space-y-2">
                      <div className="text-center font-bold text-white">{ticker}</div>
                      <button 
                        onClick={() => handleTrade(ticker, 1)}
                        className="w-full bg-white text-black py-2 text-xs font-bold hover:bg-gray-200 transition-colors"
                      >
                        KOUPIT 1
                      </button>
                      <button 
                        onClick={() => handleTrade(ticker, -1)}
                        className="w-full border-2 border-[#2a2b2e] py-2 text-xs font-bold hover:bg-white/10 transition-colors"
                      >
                        PRODAT 1
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-[10px] text-gray-500 flex items-center justify-center gap-1">
                  Poplatek za obchod: ${TRADING_FEE}
                  <InfoTooltip content="Poplatek za každou provedenou transakci (nákup i prodej)." />
                </div>
              </div>
            )}

            {/* Passive Fund (Q0 only) */}
            {gameState?.currentMonth === 0 && !portfolio?.isPassiveLocked && !isLockingPassive && (
              <div className="bg-blue-900/20 border-2 border-blue-500/50 p-6 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)]">
                <h3 className="text-xs uppercase text-blue-400 opacity-50 mb-2 italic serif flex items-center">
                  Příležitost v pasivním fondu
                  <InfoTooltip content="Garantovaný výnos 8 % na konci roku. Prostředky jsou však uzamčeny a nelze je vybrat dříve." />
                </h3>
                <p className="text-sm mb-4 text-blue-100/70">Uzamkněte svůj kapitál pro garantovaný výnos 8 % na konci Q4. Vysoká stabilita, nulová volatilita.</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleLockPassive(Math.floor((portfolio?.startingCapital || 10000) * 0.25))}
                    disabled={isLockingPassive || (portfolio && portfolio.cash < (portfolio.startingCapital * 0.25))}
                    className="flex-1 bg-blue-600 text-white py-2 text-xs font-bold hover:bg-blue-500 transition-colors disabled:opacity-50"
                  >
                    UZAMKNOUT 25% (${Math.floor((portfolio?.startingCapital || 10000) * 0.25).toLocaleString()})
                  </button>
                  <button 
                    onClick={() => handleLockPassive(Math.floor((portfolio?.startingCapital || 10000) * 0.5))}
                    disabled={isLockingPassive || (portfolio && portfolio.cash < (portfolio.startingCapital * 0.5))}
                    className="flex-1 bg-blue-600 text-white py-2 text-xs font-bold hover:bg-blue-500 transition-colors disabled:opacity-50"
                  >
                    UZAMKNOUT 50% (${Math.floor((portfolio?.startingCapital || 10000) * 0.5).toLocaleString()})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Portfolio & Admin */}
          {!isFocusMode && (
            <div className="space-y-6">
              <div className="bg-[#1a1a1a] border-2 border-[#2a2b2e] p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)] relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#2a2b2e] text-white px-3 py-1 text-[10px] uppercase font-bold tracking-widest">Portfolio</div>
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#0a0a0a] border-2 border-[#2a2b2e] text-white">
                      <Wallet size={24} />
                    </div>
                    <div>
                      <div className="text-xs uppercase opacity-50 italic serif flex items-center">
                        Dostupná hotovost
                        <InfoTooltip content="Peníze, které můžete použít k nákupu akcií nebo vložení do pasivního fondu." />
                      </div>
                      <div className="text-4xl font-bold text-white">${portfolio?.cash.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-xs uppercase opacity-50 italic serif">
                        <Briefcase size={14} /> Vaše pozice
                        <InfoTooltip content="Počet akcií jednotlivých společností, které aktuálně vlastníte." />
                      </div>
                      <div className="space-y-2">
                        {(['AAPL', 'NVDA', 'WMT'] as const).map(ticker => (
                          <div key={ticker} className="flex justify-between items-center border-b border-[#2a2b2e] border-dashed pb-1">
                            <span className="font-bold">{ticker}</span>
                            <span className="text-white">{portfolio?.shares[ticker] || 0} ks</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-xs uppercase opacity-50 italic serif">
                        <ShieldAlert size={14} /> Pasivní fond
                        <InfoTooltip content="Garantovaný výnos 8 % na konci roku. Prostředky jsou však uzamčeny a nelze je vybrat dříve." />
                      </div>
                      <div className="text-2xl font-bold text-white">${portfolio?.passiveFund.toLocaleString()}</div>
                      <div className="text-[10px] opacity-50">Uzamčeno do prosince (+8%)</div>
                    </div>
                  </div>

                  <div className="pt-6 border-t-2 border-[#2a2b2e] border-dashed">
                    <div className="text-xs uppercase opacity-50 italic serif mb-1 flex items-center">
                      Celková hodnota portfolia
                      <InfoTooltip content="Součet hotovosti, hodnoty akcií a prostředků v pasivním fondu." />
                    </div>
                    <div className="text-3xl font-black text-white">
                      ${(
                        (portfolio?.cash || 0) + 
                        (portfolio?.passiveFund || 0) + 
                        (Object.entries(portfolio?.shares || {}).reduce((acc: number, [t, q]) => acc + (q as number) * (currentPrices?.[t as keyof StockPrices] || 0), 0))
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Controls */}
              {isAdmin && (
                <div className="bg-[#1a1a1a] border-2 border-yellow-600/50 p-6 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)]">
                  <div className="flex items-center gap-2 text-yellow-500 mb-4">
                    <ShieldAlert size={20} />
                    <h3 className="text-xs uppercase font-bold italic serif flex items-center">
                      Správa hry (Správce)
                      <InfoTooltip content="Pouze zakladatel místnosti může ovládat čas a spouštět náhodné události." />
                    </h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {gameState?.nextTickAt ? (
                        <button 
                          onClick={handleTogglePause}
                          className="flex-[2] bg-yellow-600 text-black py-4 font-bold flex items-center justify-center gap-2 hover:bg-yellow-500 transition-colors"
                        >
                          {gameState.isPaused ? 'POKRAČOVAT V SIMULACI' : 'POZASTAVIT SIMULACI'}
                        </button>
                      ) : (
                        <button 
                          onClick={handleStartGame}
                          className="flex-[2] bg-green-600 text-white py-4 font-bold flex items-center justify-center gap-2 hover:bg-green-500 transition-colors"
                        >
                          SPUSTIT SIMULACI
                        </button>
                      )}
                      <button 
                        onClick={handleTriggerEvent}
                        className="flex-1 border-2 border-yellow-600 text-yellow-500 py-4 font-bold flex items-center justify-center gap-2 hover:bg-yellow-600/10 transition-colors"
                      >
                        NÁHODNÁ UDÁLOST
                      </button>
                    </div>
                    <button 
                      onClick={handleResetGame}
                      className={cn(
                        "w-full py-3 font-bold flex items-center justify-center gap-2 transition-colors",
                        gameState?.currentMonth === 11 
                          ? "bg-white text-black hover:bg-gray-200" 
                          : "border-2 border-white text-white hover:bg-white/10"
                      )}
                    >
                      <RefreshCw size={18} /> {gameState?.currentMonth === 11 ? 'RESETOVAT SIMULACI' : 'VYNUTIT RESET'}
                    </button>
                  </div>
                  <p className="text-[10px] text-yellow-500 mt-2 opacity-70">Pouze Kristián může ovládat čas trhu. Aktuální měsíc: {MONTH_NAMES[gameState?.currentMonth ?? 0]}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>

        {/* Game Over Summary */}
        <AnimatePresence>
          {showGameOver && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            >
              <div className="max-w-2xl w-full bg-[#1a1a1a] border-4 border-white p-8 shadow-[16px_16px_0px_0px_rgba(255,255,255,0.1)] relative">
                <div className="absolute -top-6 -right-6 bg-yellow-500 border-4 border-white p-4 rotate-12">
                  <Trophy size={48} className="text-black" />
                </div>
                <h2 className="text-5xl font-black italic serif uppercase mb-4 text-white">Výroční zpráva</h2>
                <p className="text-xl mb-8 border-l-4 border-white pl-4 italic text-gray-300">
                  "Trh se uzavřel. Přežili jste jeden rok na Wall Street. Podívejme se na váš konečný výsledek."
                </p>
                
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div className="space-y-2">
                    <div className="text-xs uppercase opacity-50 text-gray-400 flex items-center">
                      Celkové jmění
                      <InfoTooltip content="Konečná hodnota vašeho portfolia (hotovost + akcie) na konci roku." />
                    </div>
                    <div className="text-4xl font-bold text-white">
                      ${(
                        (portfolio?.cash || 0) + 
                        (Object.entries(portfolio?.shares || {}).reduce((acc: number, [t, q]) => acc + (q as number) * (gameState?.prices?.[t as keyof StockPrices] || 0), 0))
                      ).toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs uppercase opacity-50 text-gray-400 flex items-center">
                      Zisk/Ztráta
                      <InfoTooltip content="Rozdíl mezi vaším počátečním kapitálem a konečným jměním." />
                    </div>
                    <div className={cn(
                      "text-4xl font-bold",
                      ((portfolio?.cash || 0) + (Object.entries(portfolio?.shares || {}).reduce((acc: number, [t, q]) => acc + (q as number) * (gameState?.prices?.[t as keyof StockPrices] || 0), 0))) >= (portfolio?.startingCapital || 0) ? "text-green-500" : "text-red-500"
                    )}>
                      {((portfolio?.cash || 0) + (Object.entries(portfolio?.shares || {}).reduce((acc: number, [t, q]) => acc + (q as number) * (gameState?.prices?.[t as keyof StockPrices] || 0), 0))) >= (portfolio?.startingCapital || 0) ? '+' : ''}
                      {(((portfolio?.cash || 0) + (Object.entries(portfolio?.shares || {}).reduce((acc: number, [t, q]) => acc + (q as number) * (gameState?.prices?.[t as keyof StockPrices] || 0), 0))) - (portfolio?.startingCapital || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="bg-[#0a0a0a] p-4 border-2 border-[#2a2b2e] mb-8">
                  <h3 className="font-bold uppercase text-xs mb-2 text-gray-500">Konečné složení portfolia</h3>
                  <div className="flex gap-4">
                    {(['AAPL', 'NVDA', 'WMT'] as const).map(t => (
                      <div key={t} className="flex-1 text-center border-r border-[#2a2b2e] last:border-none">
                        <div className="text-lg font-bold text-white">{portfolio?.shares[t] || 0}</div>
                        <div className="text-[10px] uppercase opacity-50">{t}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => setShowGameOver(false)}
                  className="w-full bg-white text-black py-4 font-bold hover:bg-gray-200 transition-colors uppercase tracking-widest"
                >
                  Zpět na přehled
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer / Educational */}
        <footer className="text-center text-[10px] uppercase opacity-30 pt-12">
          Jeden rok na Wall Street © 2026 • Volatilita je váš přítel • Býčí trhy vytvářejí bohatství, medvědí trhy vytvářejí příležitosti.
        </footer>
        {/* Leave Confirmation Modal */}
        <AnimatePresence>
          {showLeaveConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="max-w-md w-full bg-[#1a1a1a] border-2 border-white p-8 shadow-[12px_12px_0px_0px_rgba(255,255,255,0.1)]"
              >
                <div className="flex items-center gap-3 text-yellow-500 mb-4">
                  <AlertCircle size={24} />
                  <h2 className="text-xl font-black uppercase italic serif">Opustit hru?</h2>
                </div>
                <p className="text-sm opacity-70 mb-6 leading-relaxed">
                  Opravdu chcete tuto místnost opustit? 
                  {isAdmin && (
                    <span className="block mt-2 text-red-400 font-bold">
                      Varování: Jako správce trvale smažete tuto místnost pro všechny.
                    </span>
                  )}
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      setRoomId(null);
                      setShowLeaveConfirm(false);
                    }}
                    className="flex-1 bg-white text-black py-3 font-bold hover:bg-gray-200 transition-colors"
                  >
                    ODEJÍT
                  </button>
                  <button 
                    onClick={() => setShowLeaveConfirm(false)}
                    className="flex-1 border-2 border-white text-white py-3 font-bold hover:bg-white/10 transition-colors"
                  >
                    ZRUŠIT
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
