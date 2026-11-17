// Minimal Chrome DevTools Protocol client (Node 22 built-in WebSocket).
"use strict";

async function connect(wsUrl) {
	const ws = new WebSocket(wsUrl);
	await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
	let id = 0;
	const pending = new Map(), listeners = [];
	ws.onmessage = (m) => {
		const msg = JSON.parse(m.data);
		if (msg.id && pending.has(msg.id)) {
			const {res, rej} = pending.get(msg.id);
			pending.delete(msg.id);
			msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
		} else if (msg.method) {
			listeners.forEach((l) => l(msg));
		}
	};
	// The page or its renderer going away (a crash, the card closed) fails
	// whatever is waiting, instead of leaving it pending for ever.
	let closed = null;
	ws.onclose = () => {
		closed = new Error("DevTools connection closed: the page, its renderer or WebAppMgr went away");
		for (const {rej} of pending.values()) rej(closed);
		pending.clear();
	};
	const send = (method, params = {}) => new Promise((res, rej) => {
		if (closed) return rej(closed);
		const i = ++id;
		pending.set(i, {res, rej});
		ws.send(JSON.stringify({id: i, method, params}));
	});
	return {send, on: (fn) => listeners.push(fn), close: () => ws.close()};
}

module.exports = {connect};
