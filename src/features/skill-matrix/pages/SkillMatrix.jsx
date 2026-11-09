import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Search, Star } from 'lucide-react';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { getAuthToken } from '../../../utils/authSession.js';

const skillApi = axios.create({ baseURL: '/api' });
skillApi.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const STAR_LABEL = { 1: 'Basic', 2: 'Intermediate', 3: 'Proficient', 4: 'Master' };
const fmt = (value) => String(Number(value)).replace('.', ',');

function Stars({ count }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Bintang ${count}`}>
      {[1, 2, 3, 4].map((n) => (
        <Star key={n} className={`w-3.5 h-3.5 ${n <= count ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} aria-hidden="true" />
      ))}
    </span>
  );
}

const cardCls = 'bg-white rounded-[22px] border border-slate-200/80 shadow-[0_4px_24px_rgb(0,0,0,0.04)] p-4';

export default function SkillMatrix() {
  useDocumentTitle('Skill Matrix');
  const navigate = useNavigate();

  const [access, setAccess] = useState(null);
  const [positions, setPositions] = useState([]);
  const [position, setPosition] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('role');
  const [scores, setScores] = useState(new Map());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([skillApi.get('/skill-matrix/access'), skillApi.get('/skill-matrix/positions').catch(() => null)])
      .then(([accessRes, positionsRes]) => {
        setAccess(accessRes.data.data);
        setPositions(positionsRes?.data?.data ?? []);
      })
      .catch((err) => setError(err.response?.data?.message || 'Gagal memuat skill matrix'));
  }, []);

  const loadEmployees = useCallback((positionId, nextScope) => {
    setEmployees([]);
    return skillApi
      .get('/skill-matrix/employees', { params: { position_id: positionId, scope: nextScope } })
      .then((res) => setEmployees(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Gagal memuat karyawan'));
  }, []);

  const choosePosition = (p) => {
    setPosition(p);
    setMessage('');
    setScope('role');
    loadEmployees(p.id, 'role');
  };

  const changeScope = (nextScope) => {
    setScope(nextScope);
    loadEmployees(position.id, nextScope);
  };

  // Label bagian mengikuti nama posisi yang terhubung, misalnya Ironing Staff tampil "Tim Setrika".
  const roleLabel = (role) => positions.find((p) => p.role_key === role)?.name ?? role ?? '-';

  const chooseEmployee = async (e) => {
    setEmployee(e);
    setScores(new Map());
    setNote('');
    setError('');
    try {
      const res = await skillApi.get('/skill-matrix/assessments/latest', {
        params: { employee_id: e.employee_id, position_id: position.id },
      });
      const latest = res.data.data;
      // Mulai dari penilaian terakhir (oleh LO mana pun di cabang ini), supaya cukup mengubah yang berbeda.
      if (latest) {
        setScores(new Map(latest.details.map((d) => [d.indicator_id, d.score])));
        setNote(latest.note ?? '');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat penilaian terakhir');
    }
  };

  const indicatorIds = useMemo(() => position?.categories.flatMap((c) => c.indicators.map((i) => i.id)) ?? [], [position]);
  const missing = indicatorIds.filter((id) => !scores.has(id)).length;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await skillApi.post('/skill-matrix/assessments', {
        employee_id: employee.employee_id,
        position_id: position.id,
        note,
        scores: [...scores].map(([indicator_id, score]) => ({ indicator_id, score })),
      });
      const { score, star } = res.data.data;
      setMessage(`${employee.full_name}: ${fmt(score)} dari 4, Bintang ${star} (${STAR_LABEL[star]})`);
      setEmployee(null);
      await loadEmployees(position.id, scope);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan penilaian');
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (employee) setEmployee(null);
    else if (position) setPosition(null);
    else navigate('/');
  };

  const keyword = search.trim().toLowerCase();
  const visibleEmployees = employees.filter((e) => !keyword || e.full_name.toLowerCase().includes(keyword));
  const step = employee ? 3 : position ? 2 : 1;

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#F8FAFC] pb-32">
      <header className="w-full bg-gradient-to-b from-[#07111F] via-[#0B172B] to-[#0D1D38] text-white px-5 pt-6 pb-6 rounded-b-[32px] shadow-[0_10px_30px_rgb(11,23,43,0.25)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="Kembali"
            className="w-10 h-10 rounded-full border border-white/20 bg-white/10 flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[17px] font-extrabold tracking-tight leading-tight truncate">
              {employee ? employee.full_name : position ? position.name : 'Skill Matrix'}
            </h1>
            <p className="text-[11px] text-slate-300 mt-0.5 truncate">
              Langkah {step} dari 3 · {access?.outlets.map((o) => o.name).join(', ') || 'Penilaian karyawan Waschen'}
            </p>
          </div>
        </div>
      </header>

      <main className="px-5 pt-5 flex flex-col gap-3">
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">{error}</div>}
        {message && !employee && (
          <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-semibold text-emerald-700">
            Tersimpan. {message}
          </div>
        )}

        {access && !access.is_lo && (
          <div className={`${cardCls} text-center text-[12px] text-slate-500`}>Menu ini hanya untuk LO yang ditugaskan HR.</div>
        )}

        {access?.is_lo && step === 1 && (
          <>
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-500 px-1">1. Pilih posisi</h2>
            {positions.length === 0 && <div className={`${cardCls} text-center text-[12px] text-slate-400`}>Belum ada posisi skill matrix</div>}
            {positions.map((p) => (
              <button key={p.id} type="button" onClick={() => choosePosition(p)} className={`${cardCls} flex items-center justify-between gap-3 text-left active:scale-[.98] transition`}>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-slate-800">{p.name}</span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    {p.people_count} orang di cabangmu
                    {!p.ready && <span className="text-amber-600 font-semibold"> · Indikator belum diisi</span>}
                  </span>
                </span>
                <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" aria-hidden="true" />
              </button>
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-500 px-1">2. Pilih nama karyawan</h2>
            <label className="relative block">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama"
                aria-label="Cari nama karyawan"
                className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-[13px] outline-none focus:border-blue-500"
              />
            </label>
            {position.role_key && (
              <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-white border border-slate-200/80 p-1.5" role="tablist">
                {[
                  ['role', `${position.name} saja`],
                  ['all', 'Semua bagian'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={scope === value}
                    onClick={() => changeScope(value)}
                    className={`rounded-xl py-2 text-[12px] font-bold transition ${scope === value ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400 px-1">
              {position.role_key && scope === 'role'
                ? `Karyawan ${position.name} di cabangmu, sesuai data terbaru.`
                : 'Semua nama di cabangmu, tidak dibatasi bagian.'}
            </p>
            {employees.length === 0 && (
              <div className={`${cardCls} text-center text-[12px] text-slate-400`}>Tidak ada karyawan di bagian ini</div>
            )}
            {visibleEmployees.map((e) => (
              <button
                key={e.employee_id}
                type="button"
                onClick={() => chooseEmployee(e)}
                className={`${cardCls} flex items-center justify-between gap-3 text-left active:scale-[.98] transition`}
              >
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-bold text-slate-800 truncate">{e.full_name}</span>
                  <span className="block text-[11px] text-slate-400 truncate">{roleLabel(e.role)}</span>
                </span>
                {e.last_assessment ? (
                  <span className="flex flex-col items-end flex-shrink-0">
                    <Stars count={e.last_assessment.star} />
                    <span className="text-[10.5px] text-slate-400 mt-0.5">{fmt(e.last_assessment.score)} dari 4</span>
                  </span>
                ) : (
                  <span className="text-[10.5px] font-bold text-slate-400 flex-shrink-0">Belum dinilai</span>
                )}
              </button>
            ))}
          </>
        )}

        {step === 3 && !position.ready && (
          <div className={`${cardCls} text-center`}>
            <p className="text-[13px] font-bold text-slate-700">Indikator {position.name} belum diisi HR</p>
            <p className="text-[11.5px] text-slate-400 mt-1">Penilaian bisa dilakukan setelah HR mengisi kategori dan indikatornya di superapp.</p>
          </div>
        )}

        {step === 3 && position.ready && (
          <>
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-500 px-1">3. Nilai tiap indikator</h2>
            {position.categories.map((category) => (
              <section key={category.id} className={cardCls}>
                <h3 className="text-[13px] font-black text-slate-800 mb-3">
                  {category.name} · {fmt(category.weight)}%
                </h3>
                <ul className="space-y-4">
                  {category.indicators.map((indicator) => (
                    <li key={indicator.id}>
                      <p className="text-[12.5px] font-semibold text-slate-700 mb-2">{indicator.name}</p>
                      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={indicator.name}>
                        {[1, 2, 3, 4].map((value) => (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={scores.get(indicator.id) === value}
                            onClick={() => setScores((prev) => new Map(prev).set(indicator.id, value))}
                            className={`rounded-xl border py-2.5 text-[14px] font-black transition ${
                              scores.get(indicator.id) === value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <label className={`${cardCls} block`}>
              <span className="block text-[12.5px] font-bold text-slate-700 mb-2">Catatan (opsional)</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] outline-none focus:border-blue-500"
              />
            </label>
            <button
              type="button"
              onClick={save}
              disabled={saving || missing > 0}
              className="w-full rounded-2xl bg-blue-600 py-3.5 text-[13px] font-black text-white shadow-lg disabled:opacity-50 active:scale-[.98] transition"
            >
              {saving ? 'Menyimpan...' : missing > 0 ? `${missing} indikator belum dinilai` : 'Simpan'}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
