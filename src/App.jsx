import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, provider, db } from './firebase';

const SECTIONS = [['lectures', 'Lectures'], ['hw', 'HW'], ['doubts', 'Doubts']];
const DEF = { layout: 'columns', collapsed: false, accent: '#f97316', showPercent: true, wall: 'aurora', cd: { show: true, unit: 'days', color: '#f97316', size: 'm' } };
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const left = (date) => Math.round((new Date(date + 'T00:00') - new Date(iso(new Date()) + 'T00:00')) / 864e5);

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <div className="center muted">Loading…</div>;
  if (!user) return (
    <div className="center">
      <h2>Plan every day. Finish the syllabus.</h2>
      <button className="pill" onClick={() => signInWithPopup(auth, provider).catch((e) => alert('Login failed: ' + e.message))}>Continue with Google</button>
    </div>
  );
  return <Main user={user} />;
}

function Item({ t, labels, mains = [], upd, del }) {
  const on = labels.filter((l) => t.labelIds?.includes(l.id));
  const off = labels.filter((l) => !t.labelIds?.includes(l.id));
  return (
    <div className="item">
      <div className="row">
        {t.type === 'task' ? <input type="checkbox" checked={!!t.done} onChange={(e) => upd(t.id, { done: e.target.checked })} /> : <i className="ti ti-note muted" />}
        <span contentEditable suppressContentEditableWarning className={t.done ? 'done' : ''} onBlur={(e) => upd(t.id, { text: e.currentTarget.textContent })}>{t.text}</span>
        <button className="x" title="Delete" onClick={() => del(t.id)}><i className="ti ti-trash" /></button>
      </div>
      <div className="chips">
        {on.map((l) => <span key={l.id} className="chip" title="Remove label" onClick={() => upd(t.id, { labelIds: arrayRemove(l.id) })}>{l.name} ×</span>)}
        {off.length > 0 && (
          <select value="" onChange={(e) => e.target.value && upd(t.id, { labelIds: arrayUnion(e.target.value) })}>
            <option value="">+ label</option>
            {off.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        {t.type === 'task' && mains.length > 0 && (
          <select value={t.mainTaskId || ''} onChange={(e) => upd(t.id, { mainTaskId: e.target.value })}>
            <option value="">Main task</option>
            {mains.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

function Section({ id, title, items, add, ...p }) {
  const [v, setV] = useState('');
  const [type, setType] = useState('task');
  const done = items.filter((t) => t.done);
  return (
    <div className="card">
      <h3>{title}</h3>
      {items.filter((t) => !t.done).map((t) => <Item key={t.id} t={t} {...p} />)}
      <form className="add" onSubmit={(e) => { e.preventDefault(); add(id, v, type); setV(''); }}>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder={type === 'task' ? 'Add task' : 'Add note'} />
        <button type="button" title="Switch between task and note" onClick={() => setType(type === 'task' ? 'note' : 'task')}>
          <i className={'ti ' + (type === 'task' ? 'ti-checkbox' : 'ti-note')} />
        </button>
      </form>
      {done.length > 0 && <details><summary>{done.length} completed</summary>{done.map((t) => <Item key={t.id} t={t} {...p} />)}</details>}
    </div>
  );
}

function Countdown({ t, cd, go }) {
  if (!cd.show) return null;
  if (!t) return <button className="card cd" onClick={go}><div className="muted">No target yet</div><div className="big" style={{ color: cd.color }}>Set one</div></button>;
  const d = left(t.deadline);
  const hrs = Math.max(0, Math.ceil((new Date(t.deadline + 'T23:59') - new Date()) / 36e5));
  const val = d < 0 ? `${-d} days over` : cd.unit === 'weeks' ? `${Math.floor(d / 7)}w ${d % 7}d` : cd.unit === 'hours' ? `${hrs} hrs` : `${d} ${d === 1 ? 'day' : 'days'}`;
  return <div className={'card cd ' + cd.size}><div className="muted">{t.name}</div><div className="big" style={{ color: d < 0 ? '#ef4444' : cd.color }}>{val}</div></div>;
}

function Targets({ targets, base }) {
  const [n, setN] = useState(''); const [d, setD] = useState(''); const [note, setNote] = useState('');
  const add = (e) => {
    e.preventDefault();
    if (!n.trim() || !d) return;
    addDoc(collection(db, ...base, 'targets'), { name: n.trim(), deadline: d, note: note.trim(), pinned: false, createdAt: Date.now() });
    setN(''); setD(''); setNote('');
  };
  const pin = (id) => targets.forEach((t) => updateDoc(doc(db, ...base, 'targets', t.id), { pinned: t.id === id ? !t.pinned : false }));
  return (
    <div>
      <h2>Targets</h2>
      <form className="card tform" onSubmit={add}>
        <input value={n} onChange={(e) => setN(e.target.value)} placeholder="Target, e.g. Finish mechanics" />
        <input type="date" value={d} onChange={(e) => setD(e.target.value)} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Details (optional)" />
        <button className="pill">Add target</button>
      </form>
      {!targets.length && <div className="muted">No targets yet. Add a target with a deadline, then pin one to the countdown card.</div>}
      {[...targets].sort((a, b) => a.deadline.localeCompare(b.deadline)).map((t) => {
        const d = left(t.deadline);
        return (
          <div className="card trow" key={t.id}>
            <div><b>{t.name}</b><div className="muted">{t.deadline}{t.note && ' · ' + t.note}</div></div>
            <span style={{ color: d < 0 ? '#ef4444' : 'var(--accent)' }}>{d < 0 ? `${-d} days over` : `${d} days left`}</span>
            <button title="Show on countdown card" style={{ color: t.pinned ? 'var(--accent)' : undefined }} onClick={() => pin(t.id)}><i className={'ti ' + (t.pinned ? 'ti-pinned' : 'ti-pin')} /></button>
            <button title="Delete" onClick={() => deleteDoc(doc(db, ...base, 'targets', t.id))}><i className="ti ti-trash" /></button>
          </div>
        );
      })}
    </div>
  );
}

function Main({ user }) {
  const base = ['users', user.uid];
  const [tasks, setTasks] = useState([]); const [labels, setLabels] = useState([]); const [targets, setTargets] = useState([]);
  const [mains, setMains] = useState([]);
  const [s, setS] = useState(DEF);
  const [date, setDate] = useState(iso(new Date())); const [view, setView] = useState('day');
  const [open, setOpen] = useState(false); const [nl, setNl] = useState('');

  useEffect(() => {
    const sub = (n, f) => onSnapshot(collection(db, ...base, n), (q) => f(q.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const off = [sub('tasks', setTasks), sub('labels', setLabels), sub('targets', setTargets), sub('mainTasks', setMains),
      onSnapshot(doc(db, ...base, 'settings', 'profile'), (d) => d.exists() && setS({ ...DEF, ...d.data(), cd: { ...DEF.cd, ...d.data().cd } }))];
    return () => off.forEach((f) => f());
  }, [user.uid]);
  useEffect(() => { document.documentElement.style.setProperty('--accent', s.accent); }, [s.accent]);
  useEffect(() => { document.body.dataset.wall = s.wall; }, [s.wall]);

  const save = (p) => { const n = { ...s, ...p }; setS(n); setDoc(doc(db, ...base, 'settings', 'profile'), n); };
  const saveCd = (p) => save({ cd: { ...s.cd, ...p } });
  const add = (section, text, type) => text.trim() && addDoc(collection(db, ...base, 'tasks'), { text: text.trim(), type, section, date, done: false, labelIds: [], createdAt: Date.now() });
  const upd = (id, p) => updateDoc(doc(db, ...base, 'tasks', id), p);
  const del = (id) => deleteDoc(doc(db, ...base, 'tasks', id));
  const shift = (n) => { const d = new Date(date + 'T00:00'); d.setDate(d.getDate() + n); setDate(iso(d)); };

  const day = tasks.filter((t) => t.date === date).sort((a, b) => a.createdAt - b.createdAt);
  const checks = day.filter((t) => t.type === 'task');
  const pct = checks.length ? Math.round((checks.filter((t) => t.done).length / checks.length) * 100) : 0;
  const p = { labels, mains, upd, del };
  const target = targets.find((t) => t.pinned) || [...targets].filter((t) => left(t.deadline) >= 0).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  const cd = <Countdown t={target} cd={s.cd} go={() => setView('targets')} />;
  const sections = SECTIONS.map(([id, title]) => <Section key={id} id={id} title={title} items={day.filter((t) => t.section === id)} add={add} {...p} />);
  const lid = view.startsWith('label:') ? view.slice(6) : null;
  const lt = lid ? tasks.filter((t) => t.labelIds?.includes(lid)) : [];
  const nav = (v, icon, text) => (
    <button key={v} className={'nav' + (view === v ? ' on' : '')} title={text} onClick={() => setView(v)}><i className={'ti ' + icon} /><span className="lbl">{text}</span></button>
  );

  return (
    <div className={'app' + (s.collapsed ? ' mini' : '')}>
      <aside>
        <div className="brand"><b className="lbl">Planner</b><button title="Toggle icon-only sidebar" onClick={() => save({ collapsed: !s.collapsed })}><i className="ti ti-layout-sidebar-left-collapse" /></button></div>
        {s.layout === 'columns' && cd}
        {nav('day', 'ti-list-check', 'Day view')}
        {nav('calendar', 'ti-calendar', 'Calendar')}
        {nav('analysis', 'ti-chart-bar', 'Analysis')}
        {nav('targets', 'ti-target', 'Targets')}
        <div className="muted lbl grp">Labels</div>
        {labels.map((l) => nav('label:' + l.id, 'ti-tag', l.name))}
        <form className="lab-add" onSubmit={(e) => { e.preventDefault(); nl.trim() && addDoc(collection(db, ...base, 'labels'), { name: nl.trim() }); setNl(''); }}>
          <input value={nl} onChange={(e) => setNl(e.target.value)} placeholder="New label" />
        </form>
        <div className="grow" />
        <button className="nav" title="Settings" onClick={() => setOpen(true)}><i className="ti ti-settings" /><span className="lbl">Settings</span></button>
      </aside>

      <main>
        {view === 'calendar' && <Calendar tasks={tasks} open={(d) => { setDate(d); setView('day'); }} />}
        {view === 'analysis' && <Analysis tasks={tasks} mains={mains} base={base} p={p} />}
        {view === 'targets' && <Targets targets={targets} base={base} />}
        {lid && (
          <div>
            <h2>{labels.find((l) => l.id === lid)?.name}</h2>
            {!lt.length && <p className="muted">Nothing here yet. Add this label to a task from the Day view.</p>}
            {[...new Set(lt.map((t) => t.date))].sort().reverse().map((d) => (
              <div className="card" key={d} style={{ marginTop: 12 }}><h3>{d}</h3>{lt.filter((t) => t.date === d).map((t) => <Item key={t.id} t={t} {...p} />)}</div>
            ))}
          </div>
        )}
        {view === 'day' && (
          <>
            <header className="top">
              <div className="dnav">
                <button title="Previous day" onClick={() => shift(-1)}><i className="ti ti-chevron-left" /></button>
                <h2>{new Date(date + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
                <button title="Next day" onClick={() => shift(1)}><i className="ti ti-chevron-right" /></button>
                <button onClick={() => setDate(iso(new Date()))}>Today</button>
              </div>
              {s.showPercent && s.layout === 'columns' && <span className="muted">{pct}% done today</span>}
            </header>
            {s.layout === 'columns' ? <div className="cols">{sections}</div> : (
              <div className="stack">
                <div>{sections}</div>
                <div className="rail">
                  {cd}
                  {s.showPercent && <div className="card"><div className="muted">Today</div><div className="big">{pct}%</div><div className="bar"><i style={{ width: pct + '%' }} /></div></div>}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {open && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="card panel" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>
            <label>Layout<select value={s.layout} onChange={(e) => save({ layout: e.target.value })}><option value="columns">Columns</option><option value="stack">Stacked with side panel</option></select></label>
            <label>Icon-only sidebar<input type="checkbox" checked={s.collapsed} onChange={(e) => save({ collapsed: e.target.checked })} /></label>
            <label>Show today's completion<input type="checkbox" checked={s.showPercent} onChange={(e) => save({ showPercent: e.target.checked })} /></label>
            <label>Accent color<input type="color" value={s.accent} onChange={(e) => save({ accent: e.target.value })} /></label>
            <label>Wallpaper<select value={s.wall} onChange={(e) => save({ wall: e.target.value })}><option value="aurora">Aurora</option><option value="grid">Grid</option><option value="plain">Plain</option></select></label>
            <h3>Countdown card</h3>
            <label>Show card<input type="checkbox" checked={s.cd.show} onChange={(e) => saveCd({ show: e.target.checked })} /></label>
            <label>Show time as<select value={s.cd.unit} onChange={(e) => saveCd({ unit: e.target.value })}><option value="days">Days</option><option value="weeks">Weeks and days</option><option value="hours">Hours</option></select></label>
            <label>Size<select value={s.cd.size} onChange={(e) => saveCd({ size: e.target.value })}><option value="s">Small</option><option value="m">Medium</option><option value="l">Large</option></select></label>
            <label>Number color<input type="color" value={s.cd.color} onChange={(e) => saveCd({ color: e.target.value })} /></label>
            <p className="muted">Pick which target the card shows by pinning it in Targets.</p>
            <button className="pill" onClick={() => signOut(auth)}>Sign out ({user.displayName || user.email})</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Calendar({ tasks, open }) {
  const [m, setM] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const first = (m.getDay() + 6) % 7;
  const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const today = iso(new Date());
  const go = (n) => setM(new Date(m.getFullYear(), m.getMonth() + n, 1));
  return (
    <div>
      <header className="top">
        <div className="dnav">
          <button title="Previous month" onClick={() => go(-1)}><i className="ti ti-chevron-left" /></button>
          <h2>{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <button title="Next month" onClick={() => go(1)}><i className="ti ti-chevron-right" /></button>
        </div>
      </header>
      <div className="cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div className="muted" key={d}>{d}</div>)}
        {Array.from({ length: first }, (_, i) => <div key={'b' + i} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = iso(new Date(m.getFullYear(), m.getMonth(), i + 1));
          const ts = tasks.filter((t) => t.date === d && t.type === 'task');
          const done = ts.filter((t) => t.done).length;
          return (
            <button key={d} className={'day' + (d === today ? ' today' : '')} onClick={() => open(d)}>
              <b>{i + 1}</b>
              {ts.length > 0 && <><span className="muted">{done}/{ts.length} done</span><div className="bar"><i style={{ width: (done / ts.length) * 100 + '%' }} /></div></>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Analysis({ tasks, mains, base, p }) {
  const [range, setRange] = useState('daily');
  const [nm, setNm] = useState('');
  const today = iso(new Date());
  const md = new Date(); md.setDate(md.getDate() - ((md.getDay() + 6) % 7));
  const mon = iso(md);
  const sd = new Date(md); sd.setDate(sd.getDate() + 6);
  const sun = iso(sd);
  const rt = tasks.filter((t) => t.type === 'task' && (range === 'daily' ? t.date === today : range === 'weekly' ? t.date >= mon && t.date <= sun : t.date <= today));
  const done = rt.filter((t) => t.done).length;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const free = tasks.filter((t) => t.type === 'task' && !mains.some((m) => m.id === t.mainTaskId));
  return (
    <div>
      <header className="top">
        <h2>Analysis</h2>
        <div className="seg">{[['daily', 'Daily'], ['weekly', 'Weekly'], ['all', 'Till date']].map(([k, l]) => <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>)}</div>
      </header>
      <div className="cols">
        <div className="card"><div className="muted">Completed</div><div className="big">{done}</div></div>
        <div className="card"><div className="muted">Uncompleted</div><div className="big">{rt.length - done}</div></div>
        <div className="card"><div className="muted">Completion</div><div className="big">{pct(done, rt.length)}%</div><div className="bar"><i style={{ width: pct(done, rt.length) + '%' }} /></div></div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3>By section</h3>
        {SECTIONS.map(([id, title]) => {
          const a = rt.filter((t) => t.section === id); const d = a.filter((t) => t.done).length;
          return <div key={id} className="arow"><span>{title}</span><span className="muted">{d}/{a.length}</span><div className="bar"><i style={{ width: pct(d, a.length) + '%' }} /></div></div>;
        })}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Uncompleted tasks</h3>
        {rt.filter((t) => !t.done).length === 0 && <div className="muted">Nothing pending in this range.</div>}
        {rt.filter((t) => !t.done).sort((a, b) => a.date.localeCompare(b.date)).map((t) => <div key={t.id} className="row" style={{ padding: '3px 0' }}><span className="muted" style={{ width: 82 }}>{t.date}</span><span>{t.text}</span><span className="muted">{t.section}</span></div>)}
      </div>
      <h2 style={{ margin: '28px 0 12px' }}>Main tasks</h2>
      <form className="add" onSubmit={(e) => { e.preventDefault(); nm.trim() && addDoc(collection(db, ...base, 'mainTasks'), { title: nm.trim(), createdAt: Date.now() }); setNm(''); }}>
        <input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="New main task, e.g. Finish mechanics" />
        <button className="pill">Add</button>
      </form>
      {mains.map((m) => {
        const l = tasks.filter((t) => t.mainTaskId === m.id); const d = l.filter((t) => t.done).length;
        return (
          <div className="card" key={m.id} style={{ marginTop: 12 }}>
            <div className="trow"><div><b>{m.title}</b><div className="muted">{d}/{l.length} tasks done</div></div>
              <button title="Delete main task" onClick={() => deleteDoc(doc(db, ...base, 'mainTasks', m.id))}><i className="ti ti-trash" /></button></div>
            <div className="bar" style={{ marginBottom: 8 }}><i style={{ width: pct(d, l.length) + '%' }} /></div>
            {l.map((t) => <Item key={t.id} t={t} {...p} />)}
            <div className="chips" style={{ marginLeft: 0, marginTop: 8 }}>
              <select value="" onChange={(e) => e.target.value && updateDoc(doc(db, ...base, 'tasks', e.target.value), { mainTaskId: m.id })}>
                <option value="">+ Attach existing task</option>
                {free.map((t) => <option key={t.id} value={t.id}>{t.date} · {t.text}</option>)}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
