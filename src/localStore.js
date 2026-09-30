// Local storage fallback store for guest mode & offline environments

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

const STORAGE_KEY = 'jee_planner_guest_data_v1';

function getInitialData() {
  const today = iso(new Date());
  const inDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return iso(d);
  };

  return {
    tasks: [
      { id: 't1', text: 'Rotational Motion - Moment of Inertia of Disc & Sphere', type: 'task', section: 'lectures', date: today, done: true, labelIds: ['l_phy'], createdAt: Date.now() - 18000000 },
      { id: 't2', text: 'Coordination Compounds - Isomerism & CFT', type: 'task', section: 'lectures', date: today, done: false, labelIds: ['l_chem'], createdAt: Date.now() - 14400000 },
      { id: 't3', text: 'Definite Integration - Kings Property & Periodic Functions', type: 'task', section: 'lectures', date: today, done: false, labelIds: ['l_math'], createdAt: Date.now() - 10800000 },
      { id: 't4', text: 'HC Verma Ch 10: Questions 1 to 25', type: 'task', section: 'hw', date: today, done: true, labelIds: ['l_phy'], createdAt: Date.now() - 7200000 },
      { id: 't5', text: 'MS Chouhan: Coordination Compounds Exercise 1', type: 'task', section: 'hw', date: today, done: false, labelIds: ['l_chem'], createdAt: Date.now() - 3600000 },
      { id: 't6', text: 'Cengage Calculus: Concept Application 4.1 to 4.3', type: 'task', section: 'hw', date: today, done: false, labelIds: ['l_math'], createdAt: Date.now() - 1800000 },
      { id: 't7', text: 'Formula sheet: memorize parallel and perpendicular axis theorems', type: 'note', section: 'hw', date: today, done: false, labelIds: ['l_phy'], createdAt: Date.now() - 1200000 },
      { id: 't8', text: 'Clarify instantaneous axis of rotation during rolling without slipping', type: 'task', section: 'doubts', date: today, done: false, labelIds: ['l_phy'], createdAt: Date.now() - 600000 },
      { id: 't9', text: 'Ask sir about optical isomerism in [Co(en)2Cl2]+', type: 'task', section: 'doubts', date: today, done: false, labelIds: ['l_chem'], createdAt: Date.now() - 300000 },
    ],
    labels: [
      { id: 'l_phy', name: 'Physics' },
      { id: 'l_chem', name: 'Chemistry' },
      { id: 'l_math', name: 'Maths' },
    ],
    targets: [
      { id: 'tg1', name: 'Finish Rotational Dynamics + HC Verma', deadline: inDays(6), note: 'Complete all solved examples and exercise questions', pinned: true, createdAt: Date.now() },
      { id: 'tg2', name: 'Complete Coordination Compounds Syllabus', deadline: inDays(14), note: 'NCERT + PYQs (2019-2024)', pinned: false, createdAt: Date.now() },
      { id: 'tg3', name: 'JEE Main Full Syllabus Mock Test #1', deadline: inDays(25), note: 'Aim for 200+ marks', pinned: false, createdAt: Date.now() },
    ],
    events: [
      { id: 'ev1', title: 'JEE Mock Test - Part Syllabus', date: today, type: 'test', time: '14:00', note: 'Physics + Chemistry test', createdAt: Date.now() },
      { id: 'ev2', title: 'Physics Formula Revision', date: inDays(2), type: 'revision', time: '10:00', note: 'Mechanics chapters', createdAt: Date.now() },
      { id: 'ev3', title: 'Calculus Assignment Submission', date: inDays(5), type: 'deadline', time: '23:59', note: 'Chapters 1 to 4', createdAt: Date.now() },
    ],
    settings: {
      profile: {
        layout: 'columns',
        collapsed: false,
        accent: '#f97316',
        showPercent: true,
        wall: 'aurora',
        cd: { show: true, unit: 'days', color: '#f97316', size: 'm' },
      },
    },
  };
}

class LocalStore {
  constructor() {
    this.listeners = new Set();
    this.data = this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    const initial = getInitialData();
    this.save(initial);
    return initial;
  }

  save(data) {
    this.data = data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
    this.notify();
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error(e);
      }
    });
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getCollection(name) {
    return this.data[name] || [];
  }

  getDoc(colName, docId) {
    if (colName === 'settings' && docId === 'profile') {
      return this.data.settings?.profile || null;
    }
    const col = this.getCollection(colName);
    return col.find((d) => d.id === docId) || null;
  }

  addDoc(colName, item) {
    const id = 'loc_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
    const newDoc = { id, ...item };
    const current = [...(this.data[colName] || []), newDoc];
    this.save({ ...this.data, [colName]: current });
    return { id };
  }

  updateDoc(colName, docId, patch) {
    if (colName === 'settings' && docId === 'profile') {
      const current = this.data.settings?.profile || {};
      const updated = { ...current, ...patch };
      this.save({
        ...this.data,
        settings: { ...(this.data.settings || {}), profile: updated },
      });
      return;
    }

    const col = this.data[colName] || [];
    const updated = col.map((item) => {
      if (item.id !== docId) return item;
      const next = { ...item };
      for (const [key, val] of Object.entries(patch)) {
        if (val && typeof val === 'object' && val._mockOp) {
          if (val._mockOp === 'arrayUnion') {
            const arr = Array.isArray(next[key]) ? [...next[key]] : [];
            val._elements.forEach((el) => {
              if (!arr.includes(el)) arr.push(el);
            });
            next[key] = arr;
          } else if (val._mockOp === 'arrayRemove') {
            const arr = Array.isArray(next[key]) ? [...next[key]] : [];
            next[key] = arr.filter((el) => !val._elements.includes(el));
          }
        } else {
          next[key] = val;
        }
      }
      return next;
    });

    this.save({ ...this.data, [colName]: updated });
  }

  deleteDoc(colName, docId) {
    const col = this.data[colName] || [];
    const updated = col.filter((item) => item.id !== docId);
    this.save({ ...this.data, [colName]: updated });
  }

  setDoc(colName, docId, data) {
    if (colName === 'settings' && docId === 'profile') {
      this.save({
        ...this.data,
        settings: { ...(this.data.settings || {}), profile: data },
      });
      return;
    }
    this.updateDoc(colName, docId, data);
  }
}

export const localStore = new LocalStore();
