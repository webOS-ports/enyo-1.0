// Caret suite: taps into text the way a finger does, over the Chrome DevTools
// Protocol, and checks where the caret went - then selection, cut, copy and
// paste, a word still being typed (an IME composition) when the finger moves
// the caret, the arrow keys (as kbdscroll sends them) and a mouse pointer.
//
//   node caret.js <DevTools endpoint or ws:// URL> [options]
//
//   --page <text>     the page whose URL contains <text> (default: the test app)
//   --touch <how>     events (Input.dispatchTouchEvent, the default: a touch
//                     the browser turns into a tap as it does a finger) or
//                     gesture (Input.synthesizeTapGesture)
//   --no-long-press   skip the long press check, for a browser that does not
//                     select on a long press (a desktop one)
//   --inject adb:<serial>
//                     touch with real touchscreen events on that device
//                     (inject.py writes them to its evdev node), so that they
//                     go through the compositor and the browser's gesture
//                     detection as a finger's do; the only way to get a long
//                     press, or a tap that ends a composition, on LuneOS's
//                     runtime, which makes no tap of DevTools touches
//   --no-ime-tap      skip the word-being-typed check: it needs the touch to
//                     reach the browser's view, which finishes the composition
//                     (DevTools touches skip it; a device's real ones do not)
//   --only <field>    one field of the test app
//   --app             any app: test every visible text field it shows, without
//                     changing its text (the caret is read from selectionStart;
//                     fields that do not have one, such as email, are skipped
//                     unless --probe is given as well)
//   --probe           in --app mode, read the caret by typing a marker and
//                     undoing it, as the test app does
//
// Where the caret is: a marker character is typed (Input.insertText, as the
// keyboard commits text), its position read from the field's text, and the
// typing undone. That is what the user sees - where typing goes - and it
// works for the fields that have no selectionStart (type=email). A selection
// shows up the same way: typing replaces it.
//
// Coordinates: the page is measured in CSS pixels and the DevTools input
// coordinates are calibrated against it with two mouse moves, so a page zoom
// (WebAppMgr zooms legacy apps by the screen's pixel ratio) or a pinch is
// accounted for without knowing it. Fields in an iframe are offset by the
// iframe's position in its parent.
//
// Exit status 0 when every check passed. results.json goes to $OUT (default
// ./out-caret).
"use strict";

const fs = require("fs");
const path = require("path");
const {connect} = require("./cdp");

// ASCII: an email field turns anything else in its domain into punycode.
const MARK = "^";
const SETTLE_MS = 450;
const LONG_PRESS_MS = 1000;

const argv = process.argv.slice(2);
const opt = {page: null, touch: "events", only: null, app: false, probe: false, longPress: true, imeTap: true, inject: null};
let endpoint = null;
for (let i = 0; i < argv.length; i++) {
	const a = argv[i];
	if (a === "--page") opt.page = argv[++i];
	else if (a === "--touch") opt.touch = argv[++i];
	else if (a === "--only") opt.only = argv[++i];
	else if (a === "--app") opt.app = true;
	else if (a === "--probe") opt.probe = true;
	else if (a === "--no-long-press") opt.longPress = false;
	else if (a === "--no-ime-tap") opt.imeTap = false;
	else if (a === "--inject") opt.inject = argv[++i];
	else if (!endpoint) endpoint = a;
	else throw new Error("unknown argument " + a);
}
if (!endpoint) {
	console.error("usage: node caret.js <endpoint|ws-url> [--page text] [--touch gesture|events] [--only field] [--app [--probe]]");
	process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Injected into every frame: measuring, reading and resetting fields.
const HELPER = `(() => {
if (window.__caret) return true;
const editable = (el) => el && (el.isContentEditable || el.tagName === "TEXTAREA" ||
	(el.tagName === "INPUT" && /^(text|email|search|url|tel|password|)$/i.test(el.type || "")));
const textOf = (el) => {
	if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return el.value;
	return (el.innerText || "").replace(/\\u00a0/g, " ").replace(/\\n$/, "");
};
const textNodes = (el) => {
	const out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	for (let n; (n = w.nextNode());) out.push(n);
	return out;
};
let canvas;
const width = (el, s) => {
	const cs = getComputedStyle(el);
	canvas = canvas || document.createElement("canvas");
	const c = canvas.getContext("2d");
	c.font = [cs.fontStyle, cs.fontVariant, cs.fontWeight, cs.fontSize, cs.fontFamily].join(" ");
	const ls = parseFloat(cs.letterSpacing) || 0;
	const shown = el.type === "password" ? "\\u2022".repeat(s.length) : s;
	return c.measureText(shown).width + ls * s.length;
};
window.__caret = {
	fields() {
		const marked = Array.from(document.querySelectorAll("[data-caret]")).map((el) => el.getAttribute("data-caret"));
		if (marked.length) return marked;
		// Any app: every visible editable field, named by its position.
		const all = Array.from(document.querySelectorAll("input, textarea, [contenteditable]")).filter((el) => {
			if (!editable(el) || el.disabled || el.readOnly) return false;
			const r = el.getBoundingClientRect();
			return r.width > 20 && r.height > 8 && r.bottom > 0 && r.top < innerHeight;
		});
		all.forEach((el, i) => el.setAttribute("data-caret-any", String(i)));
		return all.map((el, i) => "#" + i);
	},
	el(name) {
		return name[0] === "#" ? document.querySelector('[data-caret-any="' + name.slice(1) + '"]')
			: document.querySelector('[data-caret="' + name + '"]');
	},
	describe(name) {
		const el = this.el(name);
		return el ? {tag: el.tagName, type: el.type || null, editable: el.isContentEditable,
			hasSelectionApi: (() => { try { return typeof el.selectionStart === "number"; } catch (e) { return false; } })(),
			text: textOf(el)} : null;
	},
	text(name) {
		const el = this.el(name);
		return el ? textOf(el) : null;
	},
	// A point to tap for the caret to land at index k: a third of the way into
	// character k (nearer its left edge), or just past the end for the end.
	point(name, k) {
		const el = this.el(name);
		const r = el.getBoundingClientRect();
		if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
			const cs = getComputedStyle(el), t = el.value;
			const x0 = r.left + el.clientLeft + parseFloat(cs.paddingLeft) - el.scrollLeft;
			const wk = width(el, t.slice(0, k));
			const x = k < t.length ? x0 + wk + 0.3 * (width(el, t.slice(0, k + 1)) - wk)
				: Math.min(x0 + wk + 8, r.right - 3);
			return {x, y: r.top + r.height / 2};
		}
		let left = k, nodes = textNodes(el), rect = null;
		for (const n of nodes) {
			const len = n.data.length;
			if (left < len) {
				const range = document.createRange();
				range.setStart(n, left);
				range.setEnd(n, left + 1);
				rect = range.getClientRects()[0] || range.getBoundingClientRect();
				return {x: rect.left + 0.3 * rect.width, y: rect.top + rect.height / 2};
			}
			left -= len;
		}
		const n = nodes[nodes.length - 1];
		const range = document.createRange();
		range.setStart(n, n.data.length - 1);
		range.setEnd(n, n.data.length);
		rect = range.getBoundingClientRect();
		return {x: Math.min(rect.right + 8, r.right - 3), y: rect.top + rect.height / 2};
	},
	selection(name) {
		const el = this.el(name);
		try {
			if (typeof el.selectionStart === "number") return [el.selectionStart, el.selectionEnd];
		} catch (e) {}
		return null;
	},
	focused(name) {
		const el = this.el(name);
		return document.hasFocus() && document.activeElement === el;
	},
	blur() {
		const a = document.activeElement;
		if (a && a !== document.body) a.blur();
		const s = getSelection();
		s && s.removeAllRanges();
	},
	reset(name) {
		if (window.caretTest && window.caretTest.reset && name[0] !== "#") window.caretTest.reset(name);
	},
	frames() {
		return Array.from(document.querySelectorAll("iframe")).map((f) => {
			const r = f.getBoundingClientRect(), cs = getComputedStyle(f);
			return {src: f.src, x: r.left + f.clientLeft + parseFloat(cs.paddingLeft),
				y: r.top + f.clientTop + parseFloat(cs.paddingTop)};
		});
	},
	countSimulated() {
		if (!window.PalmSystem || window.__caretSim) return true;
		const ps = window.PalmSystem, orig = ps.simulateMouseClick;
		window.__caretSim = [];
		if (orig) {
			ps.simulateMouseClick = function (x, y, down) {
				window.__caretSim.push({x, y, down, t: Date.now()});
				return orig.apply(this, arguments);
			};
		}
		return true;
	},
	watchMoves() {
		if (window.__caretMove) return true;
		window.__caretMove = {x: NaN, y: NaN};
		addEventListener("mousemove", (e) => { window.__caretMove = {x: e.clientX, y: e.clientY}; }, true);
		return true;
	}
};
return true;
})()`;

async function main() {
	const target = await findTarget();
	console.log("page: " + target.url);
	const cdp = await connect(target.webSocketDebuggerUrl);
	const contexts = new Map(); // frameId -> contextId
	cdp.on((m) => {
		if (m.method === "Runtime.executionContextCreated") {
			const c = m.params.context;
			if (c.auxData && c.auxData.isDefault) contexts.set(c.auxData.frameId, c.id);
		} else if (m.method === "Runtime.executionContextDestroyed") {
			for (const [f, id] of contexts) if (id === m.params.executionContextId) contexts.delete(f);
		}
	});
	await cdp.send("Runtime.enable");
	await cdp.send("Page.enable");
	await sleep(300);

	const evalIn = async (frameId, expr) => {
		const r = await cdp.send("Runtime.evaluate", {expression: expr, contextId: contexts.get(frameId),
			returnByValue: true, awaitPromise: true});
		if (r.exceptionDetails) throw new Error(frameId + ": " + JSON.stringify(r.exceptionDetails).slice(0, 400));
		return r.result.value;
	};
	const call = (frameId, fn, ...args) =>
		evalIn(frameId, "window.__caret." + fn + "(" + args.map((a) => JSON.stringify(a)).join(",") + ")");

	// Frames, top first; fields per frame.
	const tree = (await cdp.send("Page.getFrameTree")).frameTree;
	const top = tree.frame.id;
	const frames = [{id: top, url: tree.frame.url, parent: null}];
	(tree.childFrames || []).forEach((c) => frames.push({id: c.frame.id, url: c.frame.url, parent: top}));
	const fields = [];
	for (const f of frames) {
		if (!contexts.has(f.id)) continue;
		await evalIn(f.id, HELPER);
		for (const name of await call(f.id, "fields")) {
			if (!opt.only || opt.only === name) fields.push({name, frame: f.id, parent: f.parent, url: f.url});
		}
	}
	await call(top, "countSimulated");
	await call(top, "watchMoves");

	// CSS pixels of the top frame -> DevTools input coordinates.
	const cal = await calibrate(cdp, () => evalIn(top, "window.__caretMove"));
	console.log(`calibration: css = ${cal.sx.toFixed(4)} * x + ${cal.ox.toFixed(1)}, ${cal.sy.toFixed(4)} * y + ${cal.oy.toFixed(1)}`
		+ ` (devicePixelRatio ${await evalIn(top, "devicePixelRatio")})`);
	const toInput = (p) => ({x: (p.x - cal.ox) / cal.sx, y: (p.y - cal.oy) / cal.sy});

	const frameOffset = async (field) => {
		if (!field.parent) return {x: 0, y: 0};
		const list = await call(field.parent, "frames");
		const hit = list.find((f) => f.src === field.url) || (list.length === 1 ? list[0] : null);
		if (!hit) throw new Error("cannot place the iframe of " + field.name);
		return {x: hit.x, y: hit.y};
	};
	const pointFor = async (field, k) => {
		const p = await call(field.frame, "point", field.name, k);
		const o = await frameOffset(field);
		return {x: p.x + o.x, y: p.y + o.y};
	};

	const input = makeInput(cdp, toInput, opt.inject ? await injector(top, evalIn) : null);
	const results = [];
	const check = (name, ok, detail) => {
		results.push({name, ok: !!ok, detail});
		console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  " + detail : ""));
	};

	// Where typing goes: [start, end) of what it replaces, or null.
	const probe = async (field) => {
		const before = await call(field.frame, "text", field.name);
		await cdp.send("Input.insertText", {text: MARK});
		await sleep(120);
		const after = await call(field.frame, "text", field.name);
		const i = after.indexOf(MARK);
		await input.key("z", "KeyZ", 90, 2); // undo
		await sleep(120);
		let restored = await call(field.frame, "text", field.name);
		if (restored !== before) {
			await call(field.frame, "reset", field.name);
			restored = await call(field.frame, "text", field.name);
		}
		if (i < 0) return {at: null, before, after};
		const removed = before.length - (after.length - 1);
		const consistent = after.slice(0, i) === before.slice(0, i) && after.slice(i + 1) === before.slice(i + removed);
		return {at: consistent ? [i, i + removed] : null, before, after};
	};
	const caretAt = async (field) => {
		if (!opt.app || opt.probe) return probe(field);
		const s = await call(field.frame, "selection", field.name);
		return {at: s, before: await call(field.frame, "text", field.name)};
	};
	const show = (r) => r.at ? (r.at[0] === r.at[1] ? "caret " + r.at[0] : "selection " + r.at[0] + "-" + r.at[1]) : "nothing typed (" + JSON.stringify(r.after) + ")";
	const expect = (label, r, want) => check(label, r.at && r.at[0] === want[0] && r.at[1] === want[1],
		"want " + (want[0] === want[1] ? "caret " + want[0] : "selection " + want[0] + "-" + want[1]) + ", got " + show(r));

	const wordAround = (t, k) => {
		let a = k, b = k;
		while (a > 0 && /\w/.test(t[a - 1])) a--;
		while (b < t.length && /\w/.test(t[b])) b++;
		return [a, b];
	};

	for (const field of fields) {
		const d = await call(field.frame, "describe", field.name);
		if (opt.app && !opt.probe && !d.hasSelectionApi) {
			console.log(`skip ${field.name} (${d.tag} ${d.type || ""}): no selectionStart; use --probe`);
			continue;
		}
		const F = `${field.name} [${d.tag.toLowerCase()}${d.type ? " " + d.type : ""}${field.parent ? ", in iframe" : ""}]`;
		if (!opt.app) await evalIn(top, `window.caretTest.show(${JSON.stringify(field.name)})`);
		if (field.name === "deep") await evalIn(top, "window.caretTest.setScrollTop(40)");
		await call(field.frame, "reset", field.name);
		// Read after the reset: a field left changed by an earlier run is put back first.
		const t = await call(field.frame, "text", field.name), n = t.length;
		if (n < 8) {
			console.log(`skip ${F}: needs some text to place a caret in (has ${JSON.stringify(t)})`);
			continue;
		}
		const sp = t.indexOf(" ");
		const k1 = sp + 3, k2 = n - 3, k3 = Math.min(6, n - 1);

		await call(field.frame, "blur");
		await sleep(150);
		await input.tap(await pointFor(field, k1));
		await sleep(SETTLE_MS);
		check(`${F}: a tap focuses it`, await call(field.frame, "focused", field.name));
		expect(`${F}: tap into it puts the caret where the finger was`, await caretAt(field), [k1, k1]);

		await input.tap(await pointFor(field, k2));
		await sleep(SETTLE_MS);
		expect(`${F}: a second tap moves the caret`, await caretAt(field), [k2, k2]);

		await input.tap(await pointFor(field, 2));
		await sleep(SETTLE_MS);
		expect(`${F}: a tap near the start`, await caretAt(field), [2, 2]);

		await input.tap(await pointFor(field, n));
		await sleep(SETTLE_MS);
		expect(`${F}: a tap past the end`, await caretAt(field), [n, n]);

		await input.click(await pointFor(field, k3));
		await sleep(SETTLE_MS);
		expect(`${F}: a pointer click puts the caret there`, await caretAt(field), [k3, k3]);

		await input.arrow("ArrowLeft", 37, 0);
		await input.arrow("ArrowLeft", 37, 0);
		await sleep(150);
		expect(`${F}: arrow keys move it from there`, await caretAt(field), [k3 - 2, k3 - 2]);

		await input.arrow("ArrowRight", 39, 8);
		await input.arrow("ArrowRight", 39, 8);
		await input.arrow("ArrowRight", 39, 8);
		await sleep(150);
		expect(`${F}: shift+arrows select from the caret`, await caretAt(field), [k3 - 2, k3 + 1]);

		if (opt.app) continue; // the rest changes the text

		// A long press selects the word under the finger.
		const kw = sp + 2, word = wordAround(t, kw), w = t.slice(word[0], word[1]);
		if (opt.longPress) {
			await input.longPress(await pointFor(field, kw));
			await sleep(SETTLE_MS);
			expect(`${F}: a long press selects the word`, await probe(field), word);
		}

		// The word selected from a tap at its start, as kbdscroll and a
		// keyboard do, so that what follows does not hang on the long press.
		const selectWord = async () => {
			await call(field.frame, "blur");
			await sleep(100);
			await input.tap(await pointFor(field, word[0]));
			await sleep(SETTLE_MS);
			for (let i = word[0]; i < word[1]; i++) await input.arrow("ArrowRight", 39, 8);
			await sleep(150);
		};

		// A tap away from the selection drops it and puts the caret there.
		await selectWord();
		await input.tap(await pointFor(field, k2));
		await sleep(SETTLE_MS);
		expect(`${F}: a tap away from a selection puts the caret there`, await probe(field), [k2, k2]);

		// Copy a word, tap somewhere else, paste: it goes in at the tap.
		await call(field.frame, "reset", field.name);
		await selectWord();
		await input.key("c", "KeyC", 67, 2);
		await sleep(150);
		// (Away from the selection: a tap inside one keeps it, for the edit pill.)
		await input.tap(await pointFor(field, k2));
		await sleep(SETTLE_MS);
		await input.key("v", "KeyV", 86, 2);
		await sleep(200);
		const pasted = await call(field.frame, "text", field.name);
		check(`${F}: copy, tap, paste puts the word at the tap`, pasted === t.slice(0, k2) + w + t.slice(k2),
			JSON.stringify(pasted));
		expect(`${F}: the caret is after the pasted word`, await probe(field), [k2 + w.length, k2 + w.length]);

		// A tap inside a selection: what happens is the runtime's choice (it
		// keeps it for the edit pill, or places the caret), so it is reported.
		await call(field.frame, "reset", field.name);
		await selectWord();
		await input.tap(await pointFor(field, word[0] + 2));
		await sleep(SETTLE_MS);
		console.log(`info ${F}: a tap inside a selection leaves ${show(await probe(field))}`);

		// Cut a word: it goes, and the caret stays where it was.
		await call(field.frame, "reset", field.name);
		await selectWord();
		await input.key("x", "KeyX", 88, 2);
		await sleep(200);
		const cut = await call(field.frame, "text", field.name);
		check(`${F}: cut takes the word out`, cut === t.slice(0, word[0]) + t.slice(word[1]), JSON.stringify(cut));
		expect(`${F}: the caret is where the word was`, await probe(field), [word[0], word[0]]);

		// A word still being typed when the finger moves the caret: it stays
		// where it was typed, and the next letter goes where the finger was.
		await call(field.frame, "reset", field.name);
		if (!opt.imeTap) continue;
		await input.tap(await pointFor(field, k3));
		await sleep(SETTLE_MS);
		await cdp.send("Input.imeSetComposition", {text: "xy", selectionStart: 2, selectionEnd: 2});
		await sleep(150);
		const composed = await call(field.frame, "text", field.name);
		const kc = composed.length - 3;
		await input.tap(await pointFor(field, kc));
		await sleep(SETTLE_MS);
		const r = await probe(field);
		check(`${F}: a word being typed stays put when the finger moves the caret`,
			r.before === t.slice(0, k3) + "xy" + t.slice(k3), JSON.stringify(r.before));
		expect(`${F}: ... and typing goes on where the finger was`, r, [kc, kc]);
		await call(field.frame, "reset", field.name);
	}

	if (!opt.app && !opt.only) {
		await evalIn(top, "window.caretTest.show(null)");
		await sleep(200);
		// One tap on a button is one click (the runtime's simulated click is
		// not a second one).
		const before = await evalIn(top, "window.caretTest.clicks()");
		const b = await evalIn(top, `(() => { const r = document.querySelector("[data-caret-button]").getBoundingClientRect();
			return {x: r.left + r.width / 2, y: r.top + r.height / 2}; })()`);
		await input.tap(b);
		await sleep(SETTLE_MS);
		const after = await evalIn(top, "window.caretTest.clicks()");
		check("a tap on a button clicks it once", after - before === 1, `${after - before} clicks`);

		// A drag that starts on a field scrolls, and does not move the caret.
		await evalIn(top, "window.caretTest.setScrollTop(0)");
		await call(top, "blur");
		await sleep(200);
		const deep = fields.find((f) => f.name === "deep");
		if (deep) {
			const p = await pointFor(deep, 4);
			await input.drag(p, -60);
			await sleep(SETTLE_MS + 300);
			const st = await evalIn(top, "window.caretTest.scrollTop()");
			check("a drag that starts on a field scrolls the scroller", st > 20, "scrollTop " + st);
			check("... and does not focus the field", !(await call(top, "focused", "deep")));
		}
		// Nothing asks the runtime for a click at a point of its own: it
		// lands elsewhere in a zoomed app or an iframe (see Gesture.js).
		const sim = await evalIn(top, "window.__caretSim ? window.__caretSim.length : null");
		if (sim !== null) check("no tap asks PalmSystem.simulateMouseClick for a click", sim === 0, sim + " calls");
	}

	const out = process.env.OUT || path.join(process.cwd(), "out-caret");
	fs.mkdirSync(out, {recursive: true});
	fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({page: target.url, touch: opt.touch, calibration: cal, results}, null, 1));
	const failed = results.filter((r) => !r.ok).length;
	console.log(`\n${results.length - failed} passed, ${failed} failed`);
	cdp.close();
	process.exit(failed ? 1 : 0);
}

async function findTarget() {
	if (endpoint.startsWith("ws")) return {url: endpoint, webSocketDebuggerUrl: endpoint};
	const list = await (await fetch(endpoint.replace(/\/$/, "") + "/json/list")).json();
	const pages = list.filter((t) => t.type === "page");
	const want = opt.page || (opt.app ? null : "caret");
	const match = pages.filter((t) => !want || t.url.includes(want) || t.title.includes(want));
	if (!match.length) throw new Error("no page matching " + want + " in " + pages.map((p) => p.url).join(", "));
	return match[0];
}

async function calibrate(cdp, readMove) {
	const at = async (x, y) => {
		await cdp.send("Input.dispatchMouseEvent", {type: "mouseMoved", x, y});
		await sleep(80);
		return readMove();
	};
	const a = await at(10, 10), b = await at(110, 210);
	if (!a || !b || isNaN(a.x) || isNaN(b.x)) throw new Error("calibration: no mousemove reached the page");
	const sx = (b.x - a.x) / 100, sy = (b.y - a.y) / 200;
	return {sx, sy, ox: a.x - sx * 10, oy: a.y - sy * 10};
}

// Real touches on the device (inject.py), placed by calibrating two of them
// against where the page sees them land: in the empty part of the page, below
// the fields.
async function injector(top, evalIn) {
	const m = /^adb:(.+)$/.exec(opt.inject);
	if (!m) throw new Error("--inject takes adb:<serial>");
	const {execFileSync} = require("child_process");
	const adb = (...a) => execFileSync("adb", ["-s", m[1], ...a], {encoding: "utf8"}).trim();
	const remote = "/home/root/caret-inject.py";
	adb("push", path.join(__dirname, "inject.py"), remote);
	const info = adb("shell", "python3 " + remote + " info").split(/\s+/);
	const [x0, x1, y0, y1] = info.slice(1).map(Number);
	console.log(`touchscreen ${info[0]}: x ${x0}..${x1}, y ${y0}..${y1}`);
	const run = (...a) => adb("shell", "python3 " + remote + " " + a.join(" "));
	await evalIn(top, `(() => { document.activeElement && document.activeElement.blur();
		window.__caretTouch = null;
		if (!window.__caretTouchWatch) { window.__caretTouchWatch = true;
			addEventListener("touchstart", (e) => { const t = e.changedTouches[0];
				window.__caretTouch = {x: t.clientX, y: t.clientY}; }, true); }
		return true; })()`);
	await sleep(1200); // the keyboard goes down
	const probe = async (fx, fy) => {
		const raw = {x: Math.round(x0 + fx * (x1 - x0)), y: Math.round(y0 + fy * (y1 - y0))};
		await evalIn(top, "window.__caretTouch = null, true");
		run("tap", raw.x, raw.y, 40);
		await sleep(400);
		const css = await evalIn(top, "window.__caretTouch");
		if (!css) throw new Error("an injected touch did not reach the page (is it in front, the screen on and unlocked?)");
		return {raw, css};
	};
	const a = await probe(0.3, 0.72), b = await probe(0.7, 0.82);
	const kx = (b.raw.x - a.raw.x) / (b.css.x - a.css.x), ky = (b.raw.y - a.raw.y) / (b.css.y - a.css.y);
	console.log(`touch calibration: raw = ${kx.toFixed(3)} * css x + ${(a.raw.x - kx * a.css.x).toFixed(1)}, `
		+ `${ky.toFixed(3)} * css y + ${(a.raw.y - ky * a.css.y).toFixed(1)}`);
	const raw = (q) => ({x: Math.round(a.raw.x + (q.x - a.css.x) * kx), y: Math.round(a.raw.y + (q.y - a.css.y) * ky)});
	return {
		async tap(q, hold) {
			const p = raw(q);
			run("tap", p.x, p.y, hold);
		},
		async drag(q, dy) {
			const p = raw(q);
			run("drag", p.x, p.y, 0, Math.round(dy * ky), 12);
		}
	};
}

function makeInput(cdp, toInput, inj) {
	const touchEvents = async (pts, holdMs) => {
		await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [pts[0]]});
		for (const p of pts.slice(1)) {
			await sleep(16);
			await cdp.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: [p]});
		}
		await sleep(holdMs);
		await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
	};
	const round = (q) => ({x: Math.round(q.x), y: Math.round(q.y)});
	const at = (q) => round(toInput(q));
	return {
		async tap(q) {
			if (inj) return inj.tap(q, 40);
			const p = at(q);
			if (opt.touch === "events") return touchEvents([round(p)], 40);
			await cdp.send("Input.synthesizeTapGesture", {...round(p), duration: 40, tapCount: 1, gestureSourceType: "touch"});
		},
		async longPress(q) {
			if (inj) return inj.tap(q, LONG_PRESS_MS);
			const p = at(q);
			if (opt.touch === "events") return touchEvents([round(p)], LONG_PRESS_MS);
			await cdp.send("Input.synthesizeTapGesture", {...round(p), duration: LONG_PRESS_MS, tapCount: 1, gestureSourceType: "touch"});
		},
		async drag(q, dy) {
			if (inj) return inj.drag(q, dy);
			const p = toInput(q);
			dy = dy * (toInput({x: 0, y: 100}).y - toInput({x: 0, y: 0}).y) / 100;
			const pts = [];
			for (let i = 0; i <= 10; i++) pts.push(round({x: p.x, y: p.y + dy * i / 10}));
			if (opt.touch === "events") return touchEvents(pts, 30);
			await cdp.send("Input.synthesizeScrollGesture", {...round(p), yDistance: Math.round(dy), speed: 400,
				gestureSourceType: "touch", preventFling: true});
		},
		async click(p0) {
			const q = at(p0);
			await cdp.send("Input.dispatchMouseEvent", {type: "mouseMoved", ...q});
			await cdp.send("Input.dispatchMouseEvent", {type: "mousePressed", ...q, button: "left", buttons: 1, clickCount: 1});
			await sleep(40);
			await cdp.send("Input.dispatchMouseEvent", {type: "mouseReleased", ...q, button: "left", buttons: 0, clickCount: 1});
		},
		async arrow(key, vk, modifiers) {
			await cdp.send("Input.dispatchKeyEvent", {type: "rawKeyDown", key, code: key, windowsVirtualKeyCode: vk, modifiers});
			await cdp.send("Input.dispatchKeyEvent", {type: "keyUp", key, code: key, windowsVirtualKeyCode: vk, modifiers});
		},
		async key(key, code, vk, modifiers) {
			await cdp.send("Input.dispatchKeyEvent", {type: "rawKeyDown", key, code, windowsVirtualKeyCode: vk, modifiers});
			await cdp.send("Input.dispatchKeyEvent", {type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers});
		}
	};
}

// Nothing left to wait on but the run not finished: a promise that will never
// settle. Say so and fail, rather than exit 0 half-way.
process.on("beforeExit", () => {
	console.error("the run stopped before it finished (a DevTools call never answered)");
	process.exit(2);
});

main().catch((e) => {
	console.error(e.stack || e);
	process.exit(2);
});
