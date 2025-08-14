const listeners = {};
export function on(evt, cb) { (listeners[evt] ||= new Set()).add(cb); return () => off(evt, cb); }
export function off(evt, cb) { listeners[evt]?.delete(cb); }
export function emit(evt, payload) { listeners[evt]?.forEach(fn => fn(payload)); }
