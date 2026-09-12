const PRODUCE_GLOSSARY = [
  { keys: ['tomato', 'tomatoes', 'tamatar', 'टमाटर', 'ਟਮਾਟਰ', 'टोमॅटो'], query: 'tomato', category: 'Vegetables' },
  { keys: ['spinach', 'palak', 'पालक', 'ਪਾਲਕ'], query: 'spinach', category: 'Vegetables' },
  { keys: ['onion', 'pyaz', 'piaz', 'प्याज', 'ਪਿਆਜ', 'कांदा'], query: 'onion', category: 'Vegetables' },
  { keys: ['potato', 'aloo', 'आलू', 'ਆਲੂ', 'बटाटा'], query: 'potato', category: 'Vegetables' },
  { keys: ['okra', 'bhindi', 'lady finger', 'भिंडी', 'ਭਿੰਡੀ', 'भेंडी'], query: 'lady finger', category: 'Vegetables' },
  { keys: ['mango', 'mangoes', 'aam', 'आम', 'ਅੰਬ', 'आंबा'], query: 'mango', category: 'Fruits' },
  { keys: ['banana', 'kela', 'केला', 'ਕੇਲਾ', 'केळी'], query: 'banana', category: 'Fruits' },
  { keys: ['rice', 'chawal', 'basmati', 'चावल', 'ਚੌਲ', 'तांदूळ'], query: 'rice', category: 'Grains' },
  { keys: ['wheat', 'gehu', 'gehun', 'गेहूं', 'ਕਣਕ', 'गहू'], query: 'wheat', category: 'Grains' },
  { keys: ['honey', 'shahad', 'शहद', 'ਸ਼ਹਿਦ', 'मध'], query: 'honey', category: 'Pantry' },
  { keys: ['milk', 'doodh', 'दूध', 'ਦੁੱਧ', 'दूध'], query: 'milk', category: 'Pantry' },
];

const SEARCH_PREFIX = /^(?:search|find|show|look for|get|i want|खोजो|खोजना|ढूंढो|दिखाओ|मुझे|ਲੱਭੋ|ਵਿਖਾਓ|शोधा|दाखवा)\s+/i;
const LIST_PREFIX = /^(?:list|add|sell|upload|post|बेचो|बेचना|जोड़ो|लिस्ट|ਵੇਚੋ|ਜੋੜੋ|विका|विक्री)\s+/i;
const FILLER = /\b(?:please|for|me|my|the|a|an|some|nearby|fresh|organic|कृपया|मेरी|मेरा|कुछ|ताज़ा|ਤਾਜ਼ਾ|कृपया)\b/gi;

const UNIT_PATTERN = /(\d+(?:\.\d+)?)\s*(kg|kilo|kilos|kilogram|g|gram|grams|quintal|dozen|litre|liter|l|किलो|किलोग्राम|ਕਿਲੋ|किलो)/i;
const PRICE_PATTERN = /(?:at|for|@|में|ना|ਵਿਚ)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees?|rupee|per\s*(?:kg|kilo|unit)|रुपये|रुपए|ਰੁਪਏ)/i;

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function matchProduce(text) {
  const lower = text.toLowerCase();
  return PRODUCE_GLOSSARY.find((item) => item.keys.some((key) => lower.includes(key.toLowerCase())));
}

export function parseVoiceCommand(rawText, mode = 'search') {
  const text = normalize(rawText);
  if (!text) return { intent: mode, query: '', raw: '' };

  const looksLikeList = mode === 'list' || LIST_PREFIX.test(text);
  const cleaned = text.replace(LIST_PREFIX, '').replace(SEARCH_PREFIX, '').replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  const produce = matchProduce(cleaned || text);
  const unitMatch = (cleaned || text).match(UNIT_PATTERN);
  const priceMatch = (cleaned || text).match(PRICE_PATTERN);

  if (looksLikeList) {
    const nameFromSpeech = cleaned
      .replace(UNIT_PATTERN, ' ')
      .replace(PRICE_PATTERN, ' ')
      .replace(/\b(?:at|for|per|में|ना|ਵਿਚ)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      intent: 'list',
      query: produce?.query || nameFromSpeech || cleaned,
      raw: text,
      listing: {
        name: produce?.query ? produce.query.replace(/^\w/, (letter) => letter.toUpperCase()) : (nameFromSpeech || cleaned),
        category: produce?.category || 'Vegetables',
        availableQuantity: unitMatch ? Number(unitMatch[1]) : 1,
        unit: unitMatch ? (/g$/i.test(unitMatch[2]) && !/kg|kilo|किलो|ਕਿਲੋ/i.test(unitMatch[2]) ? 'g' : 'kg') : 'kg',
        price: priceMatch ? Number(priceMatch[1]) : 0,
        organic: /organic|जैविक|ਜੈਵਿਕ|सेंद्रिय/i.test(text),
        description: text,
      },
    };
  }

  return {
    intent: 'search',
    query: produce?.query || cleaned || text,
    category: produce?.category,
    raw: text,
  };
}
