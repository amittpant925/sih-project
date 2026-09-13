import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowRight, Bell, Building2, Check, ChevronDown, CircleUserRound, Leaf, MapPin, Menu, QrCode,
  Minus, Plus, Search, ShoppingBasket, Sparkles, Star, Truck, Volume2, VolumeX, X,
} from 'lucide-react';
import { authApi, batchApi, listingApi, orderApi, productApi } from './api';
import AuctionBoard from './components/AuctionBoard';
import BatchTrace from './components/BatchTrace';
import VoiceAssistedInput from './components/VoiceAssistedInput';

const products = [
  { id: 1, name: 'Red tomatoes', farmer: 'Maya Organics', price: 34, unit: 'kg', distance: 2.4, stock: 120, harvest: 'Harvested today', rating: 4.9, quality: 'Premium', category: 'Vegetables', color: 'tomato', organic: true, image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=700&q=80', farmerLocation: 'Rajpur Road, Dehradun' },
  { id: 2, name: 'Alphonso mangoes', farmer: 'Kisan Collective', price: 180, unit: 'kg', distance: 4.8, stock: 64, harvest: 'Harvested yesterday', rating: 4.8, quality: 'Premium', category: 'Fruits', color: 'mango', organic: false, image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=700&q=80', farmerLocation: 'Selaqui, Dehradun' },
  { id: 3, name: 'Basmati rice', farmer: 'Green Valley FPO', price: 92, unit: 'kg', distance: 6.2, stock: 420, harvest: 'Milled this week', rating: 4.7, quality: 'Standard', category: 'Grains', color: 'rice', organic: true, image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=700&q=80', farmerLocation: 'Doiwala, Dehradun' },
  { id: 4, name: 'Baby spinach', farmer: 'Maya Organics', price: 28, unit: '250g', distance: 2.4, stock: 38, harvest: 'Harvested today', rating: 4.9, quality: 'Premium', category: 'Vegetables', color: 'spinach', organic: true, image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=700&q=80', farmerLocation: 'Rajpur Road, Dehradun' },
  { id: 5, name: 'Forest honey', farmer: 'Hill Roots Farm', price: 320, unit: '500g', distance: 8.7, stock: 21, harvest: 'Bottled this month', rating: 4.6, quality: 'Artisanal', category: 'Pantry', color: 'honey', organic: true, image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=700&q=80', farmerLocation: 'Mussoorie Road' },
  { id: 6, name: 'Lady finger', farmer: 'Sundar Farms', price: 42, unit: 'kg', distance: 3.1, stock: 74, harvest: 'Harvested today', rating: 4.8, quality: 'Standard', category: 'Vegetables', color: 'okra', organic: false, image: 'https://images.unsplash.com/photo-1425543103986-22abb7d7ea1f?w=700&q=80', farmerLocation: 'Clement Town, Dehradun' },
];

const categories = ['All produce', 'Vegetables', 'Fruits', 'Grains', 'Pantry'];
const indianLanguages = [
  ['English', 'en-IN'], ['हिन्दी', 'hi-IN'], ['বাংলা', 'bn-IN'], ['తెలుగు', 'te-IN'],
  ['मराठी', 'mr-IN'], ['தமிழ்', 'ta-IN'], ['ગુજરાતી', 'gu-IN'], ['ಕನ್ನಡ', 'kn-IN'],
  ['മലയാളം', 'ml-IN'], ['ਪੰਜਾਬੀ', 'pa-IN'], ['ଓଡ଼ିଆ', 'or-IN'], ['অসমীয়া', 'as-IN'],
];

function App() {
  const [view, setView] = useState('marketplace');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All produce');
  const [sort, setSort] = useState('Recommended');
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [location, setLocation] = useState('Dehradun');
  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [toast, setToast] = useState('');
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showPayment, setShowPayment] = useState(false);
  const [apiProducts, setApiProducts] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [apiError, setApiError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [locationCoords, setLocationCoords] = useState(null);
  const [language, setLanguage] = useState('English');
  const [voiceLanguage, setVoiceLanguage] = useState('en-IN');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [listingBusy, setListingBusy] = useState(false);
  const [verifyBatchId, setVerifyBatchId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrAuthSession = params.get('qrAuth');
    if (qrAuthSession) {
      setShowAuth(true);
      setAuthMode('qr-approve');
    }
    const pathMatch = window.location.pathname.match(/\/verify-batch\/([^/]+)/);
    const batchFromQuery = params.get('batch');
    if (pathMatch?.[1] || batchFromQuery) {
      setVerifyBatchId(decodeURIComponent(pathMatch?.[1] || batchFromQuery));
      setView('trace');
    }
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem('directfarm_token')) {
      authApi.me().then(({ user: currentUser }) => setUser(currentUser)).catch(() => window.localStorage.removeItem('directfarm_token'));
    }
  }, []);

  useEffect(() => {
    setLoadingProducts(true);
    productApi.list({ search: query, category, sort: sort === 'Price: low to high' ? 'price-asc' : sort === 'Price: high to low' ? 'price-desc' : 'recommended' })
      .then(({ products: remoteProducts }) => {
        setApiProducts(remoteProducts.map((product) => ({ ...product, id: product._id, farmer: product.farmer?.name || 'Verified farmer', stock: product.availableQuantity, harvest: product.harvestDate ? `Harvested ${new Date(product.harvestDate).toLocaleDateString()}` : 'Fresh harvest', color: 'tomato', distance: 0, rating: 4.8 })));
      })
      .catch(() => setApiProducts(null))
      .finally(() => setLoadingProducts(false));
  }, [category, query, sort]);

  useEffect(() => {
    setVisibleCount(6);
  }, [category, query, sort]);

  useEffect(() => {
    document.documentElement.lang = voiceLanguage.split('-')[0] || 'en';
  }, [voiceLanguage]);

  const filteredProducts = useMemo(() => {
    const sourceProducts = apiProducts || products;
    const result = sourceProducts.filter((product) => {
      const matchesSearch = `${product.name} ${product.farmer}`.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === 'All produce' || product.category === category;
      return matchesSearch && matchesCategory;
    });
    return [...result].sort((a, b) => {
      if (sort === 'Price: low to high') return a.price - b.price;
      if (sort === 'Nearest first') return a.distance - b.distance;
      if (sort === 'Highest rated' || sort === 'Best quality') return b.rating - a.rating || a.price - b.price;
      if (sort === 'Price: high to low') return b.price - a.price;
      return a.id - b.id;
    });
  }, [apiProducts, category, query, sort]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        setVisibleCount((current) => Math.min(current + 6, filteredProducts.length));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredProducts.length]);

  const addToCart = (product) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }];
    });
    setToast(`${product.name} added to your basket`);
    window.setTimeout(() => setToast(''), 2200);
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const updateCartQuantity = (productId, change) => {
    setCart((current) => current
      .map((item) => item.id === productId ? { ...item, quantity: item.quantity + change } : item)
      .filter((item) => item.quantity > 0));
  };

  const speak = (text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    const languageCode = indianLanguages.find(([label]) => label === language)?.[1] || 'en-IN';
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCode;
    utterance.rate = 0.92;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const handleCheckout = async () => {
    if (!user) {
      setShowCart(false);
      setShowAuth(true);
      setToast('Sign in to place your order');
      return;
    }
    if (!locationCoords) {
      setShowLocation(true);
      setToast('Allow location access so we can calculate the nearest farmer and delivery option');
      return;
    }
    setShowPayment(true);
  };

  const handleVoiceSearch = (nextQuery, nextCategory) => {
    setQuery(nextQuery);
    if (nextCategory) setCategory(nextCategory);
    setToast(`Searching for ${nextQuery}`);
    speak(`Searching for ${nextQuery}`);
  };

  const handleListHarvest = async (listing) => {
    if (!user) {
      setShowAuth(true);
      setToast('Sign in as a farmer to list your harvest');
      return;
    }
    if (user.role !== 'farmer') {
      setToast('Switch to a farmer account to list harvest');
      return;
    }
    setListingBusy(true);
    try {
      await productApi.create(listing);
      await listingApi.create({
        transactionModel: 'fixed-price',
        title: listing.name,
        produce: listing.name,
        category: listing.category || 'Vegetables',
        description: listing.description || listing.name,
        totalQuantityKg: Number(listing.availableQuantity) || 1,
        pricePerKg: Number(listing.price),
        organic: Boolean(listing.organic),
      });
      if (locationCoords) {
        await batchApi.create({
          produce: listing.name,
          category: listing.category,
          qualityGrade: 'A',
          quantityKg: listing.availableQuantity,
          harvestDate: new Date().toISOString(),
          latitude: locationCoords.latitude,
          longitude: locationCoords.longitude,
          farmAddress: location,
        });
      }
      setToast(`${listing.name} is listed at ₹${listing.price}/kg with a traceable batch`);
      speak(`${listing.name} is now listed for nearby buyers`);
      setQuery(listing.name);
    } catch (error) {
      setApiError(error.message);
    } finally {
      setListingBusy(false);
    }
  };

  const completePayment = async () => {
    setPlacingOrder(true);
    try {
      await orderApi.create({ items: cart.map((item) => ({ product: item.id, quantity: item.quantity })), deliveryMethod, paymentMethod: 'upi', paymentStatus: 'paid' });
      setCart([]);
      setShowPayment(false);
      setShowCart(false);
      setView('orders');
      setToast('Payment noted and order placed');
    } catch (error) {
      setApiError(error.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Open menu"><Menu size={20} /></button>
        <button className="brand" onClick={() => setView('marketplace')}><span className="brand-mark"><Leaf size={19} /></span>direct<span>farm</span></button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === 'marketplace' ? 'active' : ''} onClick={() => setView('marketplace')}>Marketplace</button>
          <button className={view === 'orders' ? 'active' : ''} onClick={() => setView('orders')}>My orders</button>
          <button className={view === 'bulk' ? 'active' : ''} onClick={() => setView('bulk')}>Bulk buying <span className="new-pill">New</span></button>
          <button className={view === 'trace' ? 'active' : ''} onClick={() => setView('trace')}>Trace harvest</button>
        </nav>
        <div className="top-actions">
          <button className="location-button" onClick={() => setShowLocation(true)}><MapPin size={16} /><span>{location}</span><ChevronDown size={14} /></button>
          <button className="icon-button" aria-label="Notifications"><Bell size={19} /><i /></button>
          <button className="profile-button" onClick={() => user ? (window.localStorage.removeItem('directfarm_token'), setUser(null), setToast('Signed out')) : setShowAuth(true)}><CircleUserRound size={23} /><span>{user?.name || 'Sign in'}</span></button>
          <label className="language-picker" title="Choose language"><span>भाषा</span><select value={language} onChange={(event) => { const nextLanguage = event.target.value; setLanguage(nextLanguage); const nextCode = indianLanguages.find(([label]) => label === nextLanguage)?.[1] || 'en-IN'; setVoiceLanguage(nextCode); setToast(`Language changed to ${nextLanguage}`); }} aria-label="Choose language">{indianLanguages.map(([label]) => <option key={label}>{label}</option>)}</select></label>
          <button className={`voice-button ${voiceEnabled ? 'active' : ''}`} onClick={() => { setVoiceEnabled((current) => !current); speak(voiceEnabled ? 'Voice assistance off' : 'Welcome to DirectFarm. Fresh food from nearby farmers.'); }} aria-label={voiceEnabled ? 'Turn voice assistance off' : 'Turn voice assistance on'}>{voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button className="basket-button" onClick={() => setShowCart(true)} aria-label="Open basket"><ShoppingBasket size={19} /><b>{cartCount}</b></button>
        </div>
      </header>

      {view === 'trace' ? <BatchTrace initialBatchId={verifyBatchId} user={user} onNeedAuth={() => setShowAuth(true)} onToast={setToast} onError={setApiError} /> : view === 'marketplace' ? <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> Your neighborhood, freshly harvested</p>
            <h1>Good food has<br /><em>a shorter journey.</em></h1>
            <p className="hero-text">Find produce from farmers around you. Fair prices for them, better freshness for you.</p>
            <div className="search-bar"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tomatoes, mangoes, rice..." aria-label="Search produce" /><kbd>⌘ K</kbd></div>
            <div className="hero-meta"><span><MapPin size={15} /> Showing farms within 10 km</span><span className="meta-divider" /><span><Truck size={15} /> Free pickup available</span><button className="speak-copy" onClick={() => speak('Find fresh produce from farmers near you. Fair prices and free pickup are available.')}>{voiceEnabled ? <Volume2 size={14} /> : null} Listen</button></div>
          </div>
          <div className="hero-art" aria-label="Illustration of a farm basket"><div className="sun" /><div className="hill hill-back" /><div className="hill hill-front" /><div className="produce produce-one">✦</div><div className="produce produce-two">●</div><div className="produce produce-three">◆</div><div className="basket-art" /></div>
        </section>

        <section className="px-6 py-6 sm:px-[9vw]">
          <VoiceAssistedInput
            languageCode={voiceLanguage}
            query={query}
            listingBusy={listingBusy}
            onLanguageChange={(code, label) => {
              setVoiceLanguage(code);
              const matched = indianLanguages.find(([, value]) => value === code)?.[0] || label;
              setLanguage(matched);
              setToast(`Language changed to ${matched}`);
            }}
            onQueryChange={setQuery}
            onSearch={handleVoiceSearch}
            onListHarvest={handleListHarvest}
          />
        </section>

        <section className="insight-strip"><div className="insight-icon"><Sparkles size={18} /></div><p><strong>More harvest, less travel.</strong> Your nearby farms have saved an estimated 248 delivery kilometers this week.</p><button onClick={() => setToast('Impact details are coming soon')}>See our impact <ArrowRight size={15} /></button></section>

        <section className="market-section">
          <div className="section-heading"><div><p className="section-kicker">Picked for you</p><h2>Fresh around Dehradun</h2></div><button className="text-button" onClick={() => { setCategory('All produce'); setQuery(''); }}>View all <ArrowRight size={16} /></button></div>
          <div className="category-row">{categories.map((item) => <button key={item} className={category === item ? 'category active' : 'category'} onClick={() => setCategory(item)}>{item}</button>)}<span className="category-spacer" /><label className="sort-select">Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option>Recommended</option><option>Best quality</option><option>Nearest first</option><option>Price: low to high</option><option>Price: high to low</option><option>Highest rated</option></select><ChevronDown size={14} /></label></div>
          {loadingProducts ? <div className="empty-state"><Leaf size={24} /><h3>Finding nearby harvests...</h3><p>Checking fresh inventory from local farms.</p></div> : filteredProducts.length ? <><div className="recommendation-strip"><Sparkles size={16} /><span><strong>Good with your basket:</strong> Explore a different price point or quality grade from nearby farmers.</span></div><div className="product-grid">{filteredProducts.slice(0, visibleCount).map((product, index) => <ProductCard key={product.id} product={product} onAdd={(item) => { addToCart(item); speak(`${item.name} from ${item.farmer} added to your basket.`); }} featured={index === 0 && !query && category === 'All produce'} />)}</div>{visibleCount < filteredProducts.length && <div className="load-more"><Leaf size={17} /><span>Loading more nearby harvests...</span></div>}</> : <div className="empty-state"><Leaf size={24} /><h3>No produce found</h3><p>Try a different search or category.</p></div>}
        </section>
      </main> : view === 'orders' ? <OrdersView onShop={() => setView('marketplace')} /> : <BulkBuyingView onBack={() => setView('marketplace')} onToast={setToast} user={user} onNeedAuth={() => setShowAuth(true)} onError={setApiError} />}

      {showCart && <CartDrawer cart={cart} total={cartTotal} deliveryMethod={deliveryMethod} onDeliveryMethod={setDeliveryMethod} onCheckout={handleCheckout} placingOrder={placingOrder} onClose={() => setShowCart(false)} onShop={() => { setShowCart(false); setView('marketplace'); }} onUpdateQuantity={updateCartQuantity} />}
      {showPayment && <PaymentDialog total={cartTotal} placingOrder={placingOrder} onClose={() => setShowPayment(false)} onPaid={completePayment} />}
      {showLocation && <LocationDialog current={location} onClose={() => setShowLocation(false)} onLocation={(coords) => { setLocationCoords(coords); setToast('Location permission granted. Nearest farms are prioritized.'); }} onSave={(nextLocation) => { setLocation(nextLocation); setShowLocation(false); setToast(`Showing farms near ${nextLocation}`); }} />}
      {showAuth && <AuthDialog mode={authMode} onModeChange={setAuthMode} onClose={() => setShowAuth(false)} onSuccess={(currentUser, token) => { window.localStorage.setItem('directfarm_token', token); setUser(currentUser); setShowAuth(false); setToast(`Welcome, ${currentUser.name}`); }} />}
      {apiError && <div className="error-banner" role="alert">{apiError}<button onClick={() => setApiError('')}><X size={15} /></button></div>}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
      <footer><span>© 2026 directfarm</span><span>Fair food, closer to home.</span><span>Built for farmers and their communities.</span></footer>
    </div>
  );
}

function ProductCard({ product, onAdd, featured }) {
  return <article className={`product-card ${featured ? 'featured' : ''}`}>
    <div className={`product-image ${product.color}`}>{product.image && <img src={product.image} alt={product.name} />}<div className="image-label">{product.category === 'Vegetables' ? 'VEG' : product.category === 'Fruits' ? 'FRUIT' : product.category.toUpperCase()}</div><div className="product-shape" /><span className="fresh-badge">{product.harvest.includes('today') ? 'Fresh today' : product.harvest}</span></div>
    <div className="product-info"><div className="product-title-row"><h3>{product.name}</h3>{product.organic && <span className="organic-mark">Organic</span>}</div><p className="farmer-name"><span className="verified-dot">✓</span>{product.farmer} <small>· {product.quality || 'Quality checked'}</small></p><div className="product-details"><span><MapPin size={13} /> {product.distance ? `${product.distance} km` : 'Nearby'}</span><span><Star size={13} fill="currentColor" /> {product.rating}</span><span>{product.stock} {product.unit} left</span></div><p className="farmer-location"><MapPin size={12} /> {product.farmerLocation || 'Location shared after selection'}</p><div className="price-row"><span className="price">₹{product.price}<small>/{product.unit}</small></span><button className="add-button" onClick={() => onAdd(product)}><Plus size={16} /> Add</button></div></div>
  </article>;
}

function CartDrawer({ cart, total, deliveryMethod, onDeliveryMethod, onCheckout, placingOrder, onClose, onShop, onUpdateQuantity }) {
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  return <div className="drawer-backdrop" onClick={onClose}><aside className="cart-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="section-kicker">Your basket</p><h2>{checkoutStarted ? 'Pickup, made simple' : cart.length ? 'Ready when you are' : 'Your basket is empty'}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>{checkoutStarted ? <div className="checkout-preview"><div className="checkout-success"><Leaf size={27} /><strong>Your basket is ready</strong><p>Choose a no-cost pickup or a low-cost local delivery option.</p></div><div className="delivery-options"><p className="section-kicker">How would you like it?</p>{[['pickup', 'Farm pickup', '₹0 · Collect from the farmer'], ['drop', 'Farmer drop', '₹0 · Within the local delivery radius'], ['platform', 'DirectFarm delivery', 'Calculated by distance']].map(([value, label, detail]) => <button key={value} className={deliveryMethod === value ? 'delivery-option selected' : 'delivery-option'} onClick={() => onDeliveryMethod(value)}><span className="delivery-radio">{deliveryMethod === value && <Check size={12} />}</span><span><strong>{label}</strong><small>{detail}</small></span></button>)}</div><div className="checkout-summary"><span>Basket total</span><strong>₹{total}</strong></div><button className="checkout-button" disabled={placingOrder} onClick={onCheckout}>{placingOrder ? 'Placing order...' : 'Place order'} <ArrowRight size={17} /></button></div> : cart.length ? <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.id}><div className={`cart-thumb ${item.color}`} /><div className="cart-item-copy"><strong>{item.name}</strong><span>{item.farmer}</span><b>₹{item.price} / {item.unit}</b></div><div className="quantity"><button aria-label={`Decrease ${item.name}`} onClick={() => onUpdateQuantity(item.id, -1)}><Minus size={13} /></button><span>{item.quantity}</span><button aria-label={`Increase ${item.name}`} onClick={() => onUpdateQuantity(item.id, 1)}><Plus size={13} /></button></div></div>)}</div><div className="checkout-box"><div><span>Basket total</span><strong>₹{total}</strong></div><small><Leaf size={14} /> Pickup is free. Delivery options at checkout.</small><button className="checkout-button" onClick={() => setCheckoutStarted(true)}>Continue to checkout <ArrowRight size={17} /></button></div></> : <div className="cart-empty"><ShoppingBasket size={36} /><p>Local harvests will appear here.</p><button className="checkout-button" onClick={onShop}>Explore the marketplace <ArrowRight size={17} /></button></div>}</aside></div>;
}

function AuthDialog({ mode, onModeChange, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'household' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [qrData, setQrData] = useState('');
  const [qrSession, setQrSession] = useState(null);

  useEffect(() => {
    if (mode !== 'qr') return undefined;
    let cancelled = false;
    let timer;
    authApi.createQrSession().then(async (session) => {
      const data = await QRCode.toDataURL(session.authUrl, { width: 220, margin: 2 });
      if (cancelled) return;
      setQrSession(session);
      setQrData(data);
      const poll = async () => {
        try {
          const result = await authApi.qrStatus(session.id);
          if (result.status === 'approved') return onSuccess(result.user, result.token);
        } catch { /* Keep waiting until the one-time session expires. */ }
        timer = window.setTimeout(poll, 1800);
      };
      timer = window.setTimeout(poll, 1800);
    }).catch((requestError) => setError(requestError.message));
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [mode, onSuccess]);
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = mode === 'register' ? await authApi.register(form) : await authApi.login({ email: form.email, password: form.password });
      const qrAuthSession = new URLSearchParams(window.location.search).get('qrAuth');
      if (mode === 'qr-approve' && qrAuthSession) {
        await authApi.approveQrSession(qrAuthSession, result.token);
        setError('This device is approved. Return to the original browser.');
        return;
      }
      onSuccess(result.user, result.token);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };
  if (mode === 'qr') return <div className="modal-backdrop" onClick={onClose}><div className="location-dialog auth-dialog qr-dialog" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="section-kicker">Passwordless sign in</p><h2>Scan to sign in</h2></div><button type="button" className="close-button" onClick={onClose}><X size={20} /></button></div><p className="dialog-copy">Scan this code with a phone already signed in to DirectFarm, then approve the browser session.</p>{qrData ? <img className="qr-image" src={qrData} alt="QR code for DirectFarm sign in" /> : <div className="qr-loading"><QrCode size={32} /> Creating secure code...</div>}<p className="qr-status">{qrSession ? 'Waiting for approval...' : 'Creating a one-time session...'}</p><button type="button" className="text-button auth-switch" onClick={() => onModeChange('login')}>Use email and password</button></div></div>;
  return <div className="modal-backdrop" onClick={onClose}><form className="location-dialog auth-dialog" onClick={(event) => event.stopPropagation()} onSubmit={submit}><div className="drawer-head"><div><p className="section-kicker">{mode === 'qr-approve' ? 'QR sign in' : mode === 'login' ? 'Welcome back' : 'Join DirectFarm'}</p><h2>{mode === 'qr-approve' ? 'Approve this browser' : mode === 'login' ? 'Sign in to order' : 'Create your account'}</h2></div><button type="button" className="close-button" onClick={onClose}><X size={20} /></button></div><p className="dialog-copy">{mode === 'qr-approve' ? 'Sign in on this device to approve the waiting browser session.' : 'Use QR sign in for a faster checkout on a trusted device.'}</p>{mode === 'register' && <input className="auth-input" required placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /> }<input className="auth-input" required type="email" placeholder="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><input className="auth-input" required minLength="8" type="password" placeholder="Password (8+ characters)" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />{mode === 'register' && <select className="auth-input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="household">Household customer</option><option value="farmer">Farmer / seller</option><option value="bulk-buyer">Bulk buyer</option></select>}{error && <p className="auth-error">{error}</p>}<button className="checkout-button" disabled={submitting}>{submitting ? 'Please wait...' : mode === 'qr-approve' ? 'Approve browser' : mode === 'login' ? 'Sign in' : 'Create account'}</button>{mode !== 'qr-approve' && <><button type="button" className="qr-link" onClick={() => onModeChange('qr')}><QrCode size={15} /> Sign in with QR</button><button type="button" className="text-button auth-switch" onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create a new account' : 'I already have an account'}</button></>}</form></div>;
}

function PaymentDialog({ total, placingOrder, onClose, onPaid }) {
  const [qrData, setQrData] = useState('');
  const vpa = import.meta.env.VITE_UPI_VPA || 'directfarm@upi';
  useEffect(() => {
    const paymentUri = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=DirectFarm&am=${total.toFixed(2)}&cu=INR&tn=DirectFarm%20basket`;
    QRCode.toDataURL(paymentUri, { width: 240, margin: 2 }).then(setQrData);
  }, [total, vpa]);
  return <div className="modal-backdrop" onClick={onClose}><div className="location-dialog payment-dialog" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="section-kicker">Secure checkout</p><h2>Pay by UPI QR</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div><div className="payment-total"><span>Amount to pay</span><strong>₹{total}</strong></div>{qrData && <img className="qr-image" src={qrData} alt="UPI payment QR code" />}<p className="qr-status">Scan with any UPI app and complete the payment.</p><p className="payment-vpa">UPI ID: {vpa}</p><button className="checkout-button" disabled={placingOrder} onClick={onPaid}>{placingOrder ? 'Confirming order...' : 'I have paid'}</button><small className="payment-note">Demo confirmation only. Production must verify the payment with a gateway webhook before fulfilling an order.</small></div></div>;
}

function LocationDialog({ current, onClose, onLocation, onSave }) {
  const [value, setValue] = useState(current);
  const requestDeviceLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => onLocation({ latitude: coords.latitude, longitude: coords.longitude }), () => {});
  };
  return <div className="modal-backdrop" onClick={onClose}><div className="location-dialog" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="section-kicker">Your location</p><h2>Find farms closer to you</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div><p className="dialog-copy">Allow location access to rank farmers by distance. Your location is only used to calculate nearby matches and delivery options.</p><button className="location-permission" onClick={requestDeviceLocation}><MapPin size={16} /> Use my current location</button><label className="location-input"><MapPin size={17} /><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search city or locality" autoFocus /></label><button className="checkout-button" onClick={() => onSave(value.trim() || current)}>Save location <ArrowRight size={17} /></button></div></div>;
}

function BulkBuyingView({ onBack, onToast, user, onNeedAuth, onError }) {
  return <main className="bulk-view"><div className="bulk-hero"><div><p className="section-kicker">For restaurants, retailers & institutions</p><h1>Buy direct.<br /><em>Plan with confidence.</em></h1><p>Post what you need and receive offers from verified farms nearby. Combine multiple farmers when one harvest is not enough.</p><button className="primary-button" onClick={() => onToast('Requirement form is ready for the next release')}>Post a requirement <ArrowRight size={16} /></button></div><div className="bulk-art"><Building2 size={54} /><span>500 kg</span><small>potatoes needed</small></div></div><div className="bulk-grid"><section className="bulk-panel"><p className="section-kicker">How it works</p><div className="bulk-step"><b>01</b><span><strong>Share your requirement</strong><small>Product, quantity, budget and required date.</small></span></div><div className="bulk-step"><b>02</b><span><strong>Compare local offers</strong><small>See price, distance and fulfillment details.</small></span></div><div className="bulk-step"><b>03</b><span><strong>Accept the best fit</strong><small>One farmer or a coordinated group of farmers.</small></span></div></section><section className="bulk-panel opportunity-panel"><p className="section-kicker">Open opportunities near Dehradun</p><div className="opportunity"><span className="opportunity-icon">P</span><div><strong>Potatoes for a hostel</strong><small>500 kg · ₹20–25/kg · required in 6 days</small></div><span className="distance">4.8 km</span></div><div className="opportunity"><span className="opportunity-icon">R</span><div><strong>Fresh rice for a retailer</strong><small>300 kg · max ₹92/kg · required in 12 days</small></div><span className="distance">7.2 km</span></div><button className="text-button" onClick={onBack}>Browse household produce <ArrowRight size={16} /></button></section></div><AuctionBoard user={user} onNeedAuth={onNeedAuth} onToast={onToast} onError={onError} /></main>;
}

function OrdersView({ onShop }) {
  return <main className="orders-view"><div className="orders-header"><div><p className="section-kicker">Your activity</p><h1>My orders</h1><p>Track every order from a nearby farm to your table.</p></div><button className="primary-button" onClick={onShop}>Shop produce <ArrowRight size={16} /></button></div><div className="order-card"><div className="order-status"><span className="status-dot" /> Live update · Preparing your order</div><div className="order-main"><div className="order-icon tomato"><div className="product-shape" /></div><div><h3>2 kg Red tomatoes</h3><p>From Maya Organics · 2.4 km away</p><span>Order #DF-1048 · Pickup today, 5:30 PM</span></div><strong>₹68</strong></div><div className="order-progress"><span className="done">Order placed</span><span className="done">Accepted by farm</span><span className="current">Being prepared</span><span>Ready for pickup</span></div><div className="tracking-card"><div><Truck size={18} /><strong>Live delivery timeline</strong><span>Last updated just now · farm is 2.4 km away</span></div><button onClick={() => window.alert('Live map tracking will appear here when the delivery partner is assigned.')}>View live map <ArrowRight size={15} /></button></div></div><div className="order-empty"><Leaf size={22} /><h3>That’s all for now</h3><p>Your completed orders will show up here.</p></div></main>;
}

export default App;