import { useEffect, useState } from 'react';
import { Gavel, LoaderCircle, MapPin } from 'lucide-react';
import { listingApi } from '../api';

export default function AuctionBoard({ user, onNeedAuth, onToast, onError }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bidAmounts, setBidAmounts] = useState({});
  const [busyId, setBusyId] = useState('');
  const [form, setForm] = useState({ title: '', produce: '', category: 'Vegetables', totalQuantityKg: 500, startingPricePerKg: 18, minIncrementPerKg: 1, reservePricePerKg: 22, auctionEndsAt: '' });
  const [creating, setCreating] = useState(false);

  const load = () => listingApi.activeAuctions()
    .then(({ listings: next }) => setListings(next || []))
    .catch(() => setListings([]))
    .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const placeBid = async (listing) => {
    if (!user) {
      onNeedAuth?.();
      return;
    }
    const amount = Number(bidAmounts[listing._id] || listing.currentBidPerKg + listing.minIncrementPerKg);
    setBusyId(listing._id);
    try {
      await listingApi.bid({ listingId: listing._id, amountPerKg: amount });
      onToast?.(`Bid of ₹${amount}/kg placed`);
      await load();
    } catch (error) {
      onError?.(error.message);
    } finally {
      setBusyId('');
    }
  };

  const createAuction = async (event) => {
    event.preventDefault();
    if (!user) {
      onNeedAuth?.();
      return;
    }
    setCreating(true);
    try {
      const ends = form.auctionEndsAt ? new Date(form.auctionEndsAt) : new Date(Date.now() + 6 * 60 * 60 * 1000);
      await listingApi.create({
        transactionModel: 'auction',
        title: form.title || `${form.produce} bulk harvest`,
        produce: form.produce,
        category: form.category,
        totalQuantityKg: Number(form.totalQuantityKg),
        startingPricePerKg: Number(form.startingPricePerKg),
        minIncrementPerKg: Number(form.minIncrementPerKg),
        reservePricePerKg: Number(form.reservePricePerKg),
        auctionEndsAt: ends.toISOString(),
        sellerType: 'fpo',
      });
      onToast?.('Bulk auction is now live');
      setForm({ ...form, title: '', produce: '' });
      await load();
    } catch (error) {
      onError?.(error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-800">Bidding engine</p>
          <h2 className="text-2xl font-extrabold text-slate-900">Live FPO auctions</h2>
        </div>
      </div>
      {loading ? <p className="text-slate-800">Loading live auctions...</p> : listings.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((listing) => (
            <article key={listing._id} className="rounded-3xl border-2 border-slate-800 bg-white p-4">
              <p className="text-xs font-extrabold uppercase text-amber-800">{listing.bidCount} bids · reserve {listing.reserveMet ? 'met' : 'not met'}</p>
              <h3 className="mt-1 text-xl font-extrabold">{listing.title}</h3>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-700"><MapPin size={14} /> {listing.seller?.name || 'FPO'} · {listing.totalQuantityKg} kg</p>
              <p className="mt-3 text-3xl font-extrabold">₹{listing.currentBidPerKg || listing.startingPricePerKg}<small className="text-base font-bold">/kg</small></p>
              <p className="text-sm font-semibold text-slate-700">Ends {new Date(listing.auctionEndsAt).toLocaleString()} · min +₹{listing.minIncrementPerKg}</p>
              <div className="mt-3 flex gap-2">
                <input type="number" min={listing.currentBidPerKg + listing.minIncrementPerKg} value={bidAmounts[listing._id] ?? (listing.currentBidPerKg + listing.minIncrementPerKg)} onChange={(event) => setBidAmounts((current) => ({ ...current, [listing._id]: event.target.value }))} className="min-h-12 flex-1 rounded-xl border-2 border-slate-800 px-3 font-bold" aria-label={`Bid amount for ${listing.title}`} />
                <button type="button" onClick={() => placeBid(listing)} disabled={busyId === listing._id} className="flex min-h-12 min-w-28 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 font-extrabold text-white">
                  {busyId === listing._id ? <LoaderCircle className="animate-spin motion-reduce:animate-none" size={18} /> : <Gavel size={18} />}
                  Bid
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="rounded-2xl border-2 border-dashed border-slate-500 p-6 text-slate-800">No live auctions yet. Farmers can open a bulk lot below.</p>}

      <form className="mt-8 grid gap-3 rounded-3xl border-2 border-slate-800 bg-emerald-50 p-4 sm:grid-cols-2" onSubmit={createAuction}>
        <h3 className="text-lg font-extrabold sm:col-span-2">List a bulk auction</h3>
        <label className="grid gap-1 text-sm font-extrabold">Produce<input required value={form.produce} onChange={(event) => setForm({ ...form, produce: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3" /></label>
        <label className="grid gap-1 text-sm font-extrabold">Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3" /></label>
        <label className="grid gap-1 text-sm font-extrabold">Quantity kg<input type="number" min="1" value={form.totalQuantityKg} onChange={(event) => setForm({ ...form, totalQuantityKg: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3" /></label>
        <label className="grid gap-1 text-sm font-extrabold">Start ₹/kg<input type="number" min="1" value={form.startingPricePerKg} onChange={(event) => setForm({ ...form, startingPricePerKg: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3" /></label>
        <label className="grid gap-1 text-sm font-extrabold">Min increment<input type="number" min="1" value={form.minIncrementPerKg} onChange={(event) => setForm({ ...form, minIncrementPerKg: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3" /></label>
        <label className="grid gap-1 text-sm font-extrabold">Reserve ₹/kg<input type="number" min="1" value={form.reservePricePerKg} onChange={(event) => setForm({ ...form, reservePricePerKg: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3" /></label>
        <button type="submit" disabled={creating} className="min-h-14 rounded-2xl bg-slate-900 font-extrabold text-white sm:col-span-2">{creating ? 'Opening auction...' : 'Start auction'}</button>
      </form>
    </div>
  );
}
