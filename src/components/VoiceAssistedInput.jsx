import { useEffect, useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Languages,
  ListPlus,
  LoaderCircle,
  Mic,
  MicOff,
  Search,
  Square,
  Volume2,
} from 'lucide-react';
import { useSpeechRecognition, VOICE_STATES } from '../hooks/useSpeechRecognition';
import { parseVoiceCommand } from '../lib/voiceCommands';
import { getVoiceCopy, VOICE_LANGUAGES } from '../lib/voiceCopy';

const PRIMARY_LANGS = VOICE_LANGUAGES.slice(0, 4);
const STATE_STYLES = {
  idle: {
    ring: 'border-slate-800 bg-slate-800 text-white',
    panel: 'border-slate-300 bg-white',
    badge: 'bg-slate-200 text-slate-900',
    label: 'Ready',
  },
  listening: {
    ring: 'border-amber-700 bg-amber-600 text-white',
    panel: 'border-amber-700 bg-amber-50',
    badge: 'bg-amber-700 text-white',
    label: 'Listening',
  },
  processing: {
    ring: 'border-sky-800 bg-sky-700 text-white',
    panel: 'border-sky-700 bg-sky-50',
    badge: 'bg-sky-800 text-white',
    label: 'Processing',
  },
  error: {
    ring: 'border-red-800 bg-red-700 text-white',
    panel: 'border-red-700 bg-red-50',
    badge: 'bg-red-800 text-white',
    label: 'Error',
  },
  success: {
    ring: 'border-emerald-800 bg-emerald-700 text-white',
    panel: 'border-emerald-700 bg-emerald-50',
    badge: 'bg-emerald-800 text-white',
    label: 'Success',
  },
};

function Waveform({ active }) {
  return (
    <div className="flex h-10 items-end justify-center gap-1" aria-hidden="true">
      {[8, 16, 24, 32, 24, 16, 10, 18, 28, 14].map((height, index) => (
        <span
          key={index}
          className={`w-1.5 rounded-full bg-amber-700 ${active ? 'animate-pulse motion-reduce:animate-none' : 'opacity-40'}`}
          style={{
            height: active ? `${height}px` : '8px',
            animationDelay: `${index * 70}ms`,
            animationDuration: '700ms',
          }}
        />
      ))}
    </div>
  );
}

export default function VoiceAssistedInput({
  languageCode = 'en-IN',
  onLanguageChange,
  query,
  onQueryChange,
  onSearch,
  onListHarvest,
  listingBusy = false,
}) {
  const inputId = useId();
  const liveId = useId();
  const [mode, setMode] = useState('search');
  const [showAllLangs, setShowAllLangs] = useState(false);
  const [typedValue, setTypedValue] = useState(query || '');
  const [listing, setListing] = useState({ name: '', category: 'Vegetables', availableQuantity: 1, unit: 'kg', price: '', organic: false });
  const copy = getVoiceCopy(languageCode);
  const { state, interimTranscript, finalTranscript, error, supported, start, stop, reset } = useSpeechRecognition({ lang: languageCode });
  const status = STATE_STYLES[state] || STATE_STYLES.idle;
  const liveText = interimTranscript || finalTranscript;
  const errorMessage = !supported
    ? copy.errorUnsupported
    : error === 'denied'
      ? copy.errorDenied
      : error === 'network'
        ? copy.errorNetwork
        : error === 'no-speech'
          ? copy.errorGeneric
          : copy.errorGeneric;
  const languages = showAllLangs ? VOICE_LANGUAGES : PRIMARY_LANGS;

  useEffect(() => {
    setTypedValue(query || '');
  }, [query]);

  useEffect(() => {
    if (state !== VOICE_STATES.success || !finalTranscript) return undefined;
    const parsed = parseVoiceCommand(finalTranscript, mode);
    if (parsed.intent === 'list') {
      setMode('list');
      setListing({
        name: parsed.listing.name,
        category: parsed.listing.category,
        availableQuantity: parsed.listing.availableQuantity,
        unit: parsed.listing.unit,
        price: parsed.listing.price || '',
        organic: parsed.listing.organic,
      });
      setTypedValue(parsed.query);
      onQueryChange?.(parsed.query);
    } else {
      setMode('search');
      setTypedValue(parsed.query);
      onQueryChange?.(parsed.query);
      onSearch?.(parsed.query, parsed.category);
    }
    const timer = window.setTimeout(() => reset(), 2400);
    return () => window.clearTimeout(timer);
  }, [finalTranscript, state]);

  const statusMessage = useMemo(() => {
    if (state === VOICE_STATES.listening) return copy.listening;
    if (state === VOICE_STATES.processing) return copy.processing;
    if (state === VOICE_STATES.error) return errorMessage;
    if (state === VOICE_STATES.success) return mode === 'list' ? copy.successList : copy.successSearch;
    return copy.tapToSpeak;
  }, [copy, errorMessage, mode, state]);

  const submitTyped = (event) => {
    event.preventDefault();
    const value = typedValue.trim();
    if (!value) return;
    if (mode === 'search') {
      onQueryChange?.(value);
      onSearch?.(value);
      return;
    }
    const parsed = parseVoiceCommand(value, 'list');
    setListing((current) => ({ ...current, ...parsed.listing, name: parsed.listing.name || current.name }));
  };

  const publishListing = () => {
    if (!listing.name || !listing.price) return;
    onListHarvest?.({
      name: listing.name,
      category: listing.category,
      description: listing.name,
      price: Number(listing.price),
      unit: listing.unit,
      availableQuantity: Number(listing.availableQuantity) || 1,
      organic: Boolean(listing.organic),
    });
  };

  return (
    <section className="w-full rounded-3xl border-2 border-slate-800 bg-white p-4 shadow-[0_12px_0_#1e293b] sm:p-6" aria-labelledby="voice-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-800">
            <Volume2 size={14} aria-hidden="true" /> DirectFarm Voice
          </p>
          <h2 id="voice-title" className="text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">{copy.title}</h2>
          <p className="mt-1 text-base leading-6 text-slate-800">{copy.subtitle}</p>
        </div>
        <span className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-extrabold ${status.badge}`} aria-live="polite">
          {status.label}
        </span>
      </div>

      <div className="mb-4" role="radiogroup" aria-label={copy.languageLabel}>
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Languages size={16} aria-hidden="true" /> {copy.languageLabel}
        </p>
        <div className="flex flex-wrap gap-2">
          {languages.map((language) => {
            const selected = language.code === languageCode;
            return (
              <button
                key={language.code}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onLanguageChange?.(language.code, language.label)}
                className={`min-h-12 min-w-12 cursor-pointer rounded-2xl border-2 px-3 text-sm font-extrabold transition duration-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-400 bg-slate-100 text-slate-900 hover:border-slate-900'}`}
              >
                <span className="block text-[11px] tracking-wide">{language.script}</span>
                {language.native}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowAllLangs((current) => !current)}
            className="min-h-12 cursor-pointer rounded-2xl border-2 border-dashed border-slate-500 px-4 text-sm font-bold text-slate-800 hover:border-slate-900 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {showAllLangs ? copy.fewerLanguages : copy.moreLanguages}
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Voice mode">
        {[
          { id: 'search', label: copy.searchMode, icon: Search },
          { id: 'list', label: copy.listMode, icon: ListPlus },
        ].map((item) => {
          const Icon = item.icon;
          const selected = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMode(item.id)}
              className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-3 text-base font-extrabold transition duration-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${selected ? 'border-emerald-900 bg-emerald-700 text-white' : 'border-slate-400 bg-slate-50 text-slate-900'}`}
            >
              <Icon size={22} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={submitTyped} className={`rounded-3xl border-2 p-3 sm:p-4 ${status.panel}`}>
        <label htmlFor={inputId} className="mb-2 block text-sm font-extrabold text-slate-900">{copy.inputLabel}</label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <input
            id={inputId}
            value={typedValue}
            onChange={(event) => {
              setTypedValue(event.target.value);
              onQueryChange?.(event.target.value);
            }}
            placeholder={mode === 'list' ? copy.placeholderList : copy.placeholderSearch}
            autoComplete="off"
            className="min-h-16 w-full rounded-2xl border-2 border-slate-800 bg-white px-4 text-lg font-semibold text-slate-900 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          />
          <button
            type="button"
            onClick={state === VOICE_STATES.listening ? stop : start}
            disabled={!supported && state !== VOICE_STATES.listening}
            aria-pressed={state === VOICE_STATES.listening}
            aria-describedby={liveId}
            aria-label={state === VOICE_STATES.listening ? copy.stop : copy.tapToSpeak}
            className={`relative mx-auto flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-full border-4 shadow-[0_6px_0_#0f172a] transition duration-200 active:translate-y-1 active:shadow-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60 sm:mx-0 ${status.ring}`}
          >
              {state === VOICE_STATES.listening ? <Square size={30} fill="currentColor" /> : state === VOICE_STATES.processing ? <LoaderCircle size={34} className="animate-spin motion-reduce:animate-none" /> : state === VOICE_STATES.error ? <MicOff size={34} /> : state === VOICE_STATES.success ? <Check size={34} strokeWidth={3} /> : <Mic size={34} />}
            {state === VOICE_STATES.listening && (
              <span className="pointer-events-none absolute inset-[-10px] rounded-full border-4 border-amber-500 motion-safe:animate-ping motion-reduce:animate-none" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p id={liveId} className="min-h-6 text-base font-bold text-slate-900" aria-live="assertive">
            {statusMessage}
          </p>
          {state === VOICE_STATES.error && (
            <button
              type="button"
              onClick={start}
              className="min-h-12 cursor-pointer rounded-xl bg-red-800 px-5 text-base font-extrabold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {copy.retry}
            </button>
          )}
        </div>

        <div className="mt-3 rounded-2xl bg-slate-900 px-4 py-3 text-white" aria-live="polite">
          <p className="text-xs font-extrabold uppercase tracking-widest text-amber-300">{copy.live}</p>
          <p className="mt-1 min-h-7 text-lg font-semibold">{liveText || copy.idleHint}</p>
          {state === VOICE_STATES.listening && <Waveform active />}
        </div>
      </form>

      {state === VOICE_STATES.error && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl border-2 border-red-800 bg-red-50 p-3 text-base font-semibold text-red-900" role="alert">
          <AlertCircle className="mt-0.5 shrink-0" size={22} aria-hidden="true" />
          {errorMessage}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(mode === 'list' ? copy.examplesList : copy.examplesSearch).map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setTypedValue(example);
              if (mode === 'search') {
                onQueryChange?.(example);
                onSearch?.(example);
                return;
              }
              const parsed = parseVoiceCommand(example, 'list');
              setListing((current) => ({ ...current, ...parsed.listing, name: parsed.listing.name || current.name }));
            }}
            className="min-h-11 cursor-pointer rounded-full border-2 border-slate-800 bg-lime-200 px-4 text-sm font-extrabold text-slate-900 hover:bg-lime-300 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {example}
          </button>
        ))}
      </div>

      {mode === 'list' && (
        <div className="mt-5 grid gap-3 rounded-3xl border-2 border-slate-800 bg-emerald-50 p-4">
          <p className="text-base font-semibold text-slate-900">{copy.editHint}</p>
          <label className="grid gap-1 text-sm font-extrabold text-slate-900">
            {copy.name}
            <input value={listing.name} onChange={(event) => setListing((current) => ({ ...current, name: event.target.value }))} className="min-h-14 rounded-xl border-2 border-slate-800 bg-white px-3 text-lg font-semibold" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-extrabold text-slate-900">
              {copy.category}
              <select value={listing.category} onChange={(event) => setListing((current) => ({ ...current, category: event.target.value }))} className="min-h-14 rounded-xl border-2 border-slate-800 bg-white px-3 text-lg font-semibold">
                <option>Vegetables</option>
                <option>Fruits</option>
                <option>Grains</option>
                <option>Pantry</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-extrabold text-slate-900">
              {copy.unit}
              <select value={listing.unit} onChange={(event) => setListing((current) => ({ ...current, unit: event.target.value }))} className="min-h-14 rounded-xl border-2 border-slate-800 bg-white px-3 text-lg font-semibold">
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="dozen">dozen</option>
                <option value="500g">500g</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-extrabold text-slate-900">
              {copy.quantity}
              <input type="number" min="1" inputMode="numeric" value={listing.availableQuantity} onChange={(event) => setListing((current) => ({ ...current, availableQuantity: event.target.value }))} className="min-h-14 rounded-xl border-2 border-slate-800 bg-white px-3 text-lg font-semibold" />
            </label>
            <label className="grid gap-1 text-sm font-extrabold text-slate-900">
              {copy.price}
              <input type="number" min="1" inputMode="numeric" value={listing.price} onChange={(event) => setListing((current) => ({ ...current, price: event.target.value }))} className="min-h-14 rounded-xl border-2 border-slate-800 bg-white px-3 text-lg font-semibold" />
            </label>
          </div>
          <button
            type="button"
            onClick={publishListing}
            disabled={listingBusy || !listing.name || !listing.price}
            className="mt-1 flex min-h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 text-lg font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            {listingBusy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" size={22} /> : <ListPlus size={22} />}
            {copy.confirmList}
          </button>
        </div>
      )}
    </section>
  );
}
