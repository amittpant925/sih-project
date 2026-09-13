import { useEffect, useState } from 'react';
import { Check, Leaf, LoaderCircle, QrCode, Search, ShieldCheck } from 'lucide-react';
import { batchApi } from '../api';

export default function BatchTrace({ initialBatchId = '', user, onNeedAuth, onToast, onError }) {
  const [batchId, setBatchId] = useState(initialBatchId);
  const [verification, setVerification] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ produce: '', category: 'Vegetables', qualityGrade: 'A', quantityKg: 20, harvestDate: new Date().toISOString().slice(0, 10), latitude: '30.3165', longitude: '78.0322', farmAddress: 'Dehradun' });
  const [created, setCreated] = useState(null);
  const [creating, setCreating] = useState(false);

  const lookup = async (id = batchId) => {
    const value = String(id || '').trim();
    if (!value) return;
    setBusy(true);
    try {
      const result = await batchApi.verify(value);
      setVerification(result.verification);
    } catch (error) {
      setVerification(null);
      onError?.(error.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialBatchId) lookup(initialBatchId);
  }, [initialBatchId]);

  const createBatch = async (event) => {
    event.preventDefault();
    if (!user) {
      onNeedAuth?.();
      return;
    }
    setCreating(true);
    try {
      const result = await batchApi.create(form);
      setCreated(result);
      setBatchId(result.batch.batchId);
      setVerification(result.batch);
      onToast?.(`QR batch ${result.batch.batchId} is ready`);
    } catch (error) {
      onError?.(error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:px-[9vw]">
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-800">Farm to table</p>
      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Scan a harvest. Trust the journey.</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-800">Every DirectFarm batch carries a signed QR with GPS, harvest date, grade, and farmer ID. No sign-in needed to verify.</p>

      <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); lookup(); }}>
        <label className="grid flex-1 gap-1 text-sm font-extrabold text-slate-900">
          Batch ID
          <input value={batchId} onChange={(event) => setBatchId(event.target.value)} placeholder="DF-BATCH-..." className="min-h-14 rounded-2xl border-2 border-slate-800 bg-white px-4 text-lg font-semibold" />
        </label>
        <button type="submit" className="mt-auto flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-base font-extrabold text-white">
          {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" size={20} /> : <Search size={20} />}
          Verify batch
        </button>
      </form>

      {verification && (
        <section className="mt-8 grid gap-6 rounded-3xl border-2 border-slate-800 bg-white p-5 shadow-[0_10px_0_#1e293b] lg:grid-cols-[240px_1fr]">
          {verification.qrDataUrl && <img src={verification.qrDataUrl} alt={`QR code for batch ${verification.batchId}`} className="mx-auto h-60 w-60 rounded-2xl border-2 border-slate-800" />}
          <div>
            <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-emerald-800"><ShieldCheck size={16} /> {verification.authenticity?.signatureValid ? 'Signature verified' : 'Signature mismatch'}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">{verification.produce} · Grade {verification.qualityGrade}</h2>
            <p className="mt-1 text-base text-slate-800">{verification.freshness?.summary}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><dt className="text-xs font-extrabold uppercase text-slate-600">Farm</dt><dd className="font-bold">{verification.farm?.name}</dd></div>
              <div><dt className="text-xs font-extrabold uppercase text-slate-600">Harvest</dt><dd className="font-bold">{new Date(verification.harvestDate).toLocaleDateString()}</dd></div>
              <div><dt className="text-xs font-extrabold uppercase text-slate-600">GPS</dt><dd className="font-bold">{verification.farm?.gps?.latitude}, {verification.farm?.gps?.longitude}</dd></div>
              <div><dt className="text-xs font-extrabold uppercase text-slate-600">Freshness</dt><dd className="font-bold">{verification.freshness?.remainingHours}h remaining</dd></div>
            </dl>
            <ol className="mt-5 grid gap-2">
              {(verification.history || []).map((step, index) => (
                <li key={`${step.stage}-${index}`} className="flex gap-3 rounded-xl bg-emerald-50 p-3">
                  <Check className="mt-0.5 shrink-0 text-emerald-800" size={18} />
                  <span><strong className="block">{step.label}</strong><small className="text-slate-700">{step.location} · {new Date(step.recordedAt).toLocaleString()}</small></span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <section className="mt-10 rounded-3xl border-2 border-slate-800 bg-lime-100 p-5">
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900"><QrCode size={22} /> Stamp a new harvest QR</h2>
        <p className="mt-1 text-base text-slate-800">Farmers sign a batch, generate a QR, and store GPS plus grade for consumers.</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={createBatch}>
          <label className="grid gap-1 text-sm font-extrabold">Produce<input required value={form.produce} onChange={(event) => setForm({ ...form, produce: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 font-semibold" /></label>
          <label className="grid gap-1 text-sm font-extrabold">Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 font-semibold"><option>Vegetables</option><option>Fruits</option><option>Grains</option><option>Pantry</option></select></label>
          <label className="grid gap-1 text-sm font-extrabold">Quality grade<select value={form.qualityGrade} onChange={(event) => setForm({ ...form, qualityGrade: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 font-semibold"><option>A+</option><option>A</option><option>B</option><option>C</option></select></label>
          <label className="grid gap-1 text-sm font-extrabold">Quantity (kg)<input type="number" min="1" value={form.quantityKg} onChange={(event) => setForm({ ...form, quantityKg: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 font-semibold" /></label>
          <label className="grid gap-1 text-sm font-extrabold">Harvest date<input type="date" value={form.harvestDate} onChange={(event) => setForm({ ...form, harvestDate: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 font-semibold" /></label>
          <label className="grid gap-1 text-sm font-extrabold">Farm address<input value={form.farmAddress} onChange={(event) => setForm({ ...form, farmAddress: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 font-semibold" /></label>
          <label className="grid gap-1 text-sm font-extrabold">Latitude<input value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 font-semibold" /></label>
          <label className="grid gap-1 text-sm font-extrabold">Longitude<input value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 font-semibold" /></label>
          <button type="submit" disabled={creating} className="min-h-14 cursor-pointer rounded-2xl bg-slate-900 text-base font-extrabold text-white sm:col-span-2">{creating ? 'Signing batch...' : 'Generate signed QR'}</button>
        </form>
        {created && <p className="mt-3 flex items-center gap-2 font-bold text-emerald-900"><Leaf size={16} /> Public verify link: {created.batch.verifyUrl}</p>}
      </section>
    </main>
  );
}
