#!/bin/bash
# browser.sh [palm|plain] [caret.js options...]: run the caret suite in a
# headless Chromium on the host. "palm" (the default) gives the page a
# stand-in PalmSystem (app/palm-fake.js), so Enyo takes its device code
# paths; "plain" runs it as a desktop page. CHROME, PORT and HTTP_PORT
# override the browser binary and the two ports; SCALE sets the device
# scale factor (default 2, as a high-density phone). Enyo is loaded from
# framework/source; BUILD=1 compresses it first, as the enyo-1.0 recipe does,
# and loads framework/build/enyo-build.js, which is what apps on a device run.
set -e
T=$(cd "$(dirname "$0")" && pwd)
ENYO=$(cd "$T/../.." && pwd)
MODE=${1:-palm}; shift || true
CHROME=${CHROME:-chromium}
PORT=${PORT:-9335}
HTTP_PORT=${HTTP_PORT:-8767}
SCALE=${SCALE:-2}
Q="?debug=1"; [ -n "$BUILD" ] && Q="?build=1"
[ "$MODE" = palm ] && Q="$Q&palm=1"

# The app loads Enyo from its on-device path, so serve a root that has both.
# (Not a dot directory: a snap-packaged Chromium cannot use one for its profile.)
W=$T/out/www
mkdir -p "$W/usr/palm/frameworks/enyo"
if [ -n "$BUILD" ]; then
	# A copy, so that the build is not written into the checkout.
	rm -rf "$T/out/enyo-built" && mkdir -p "$T/out/enyo-built"
	cp -r "$ENYO/framework" "$T/out/enyo-built/"
	node "$ENYO/support/enyo-compress/enyo-compress.js" "$T/out/enyo-built/framework/source" \
		--no-color --make-enyo -o "$T/out/enyo-built/framework/build" >/dev/null
	ln -sfn "$T/out/enyo-built" "$W/usr/palm/frameworks/enyo/0.10"
else
	ln -sfn "$ENYO" "$W/usr/palm/frameworks/enyo/0.10"
fi
ln -sfn "$T/app" "$W/caret"

python3 -m http.server "$HTTP_PORT" --bind 127.0.0.1 --directory "$W" >/dev/null 2>&1 &
HTTP=$!
rm -rf "$T/out/profile"
"$CHROME" --headless=new --disable-gpu --no-first-run --remote-debugging-port="$PORT" \
	--user-data-dir="$T/out/profile" --window-size=450,800 --force-device-scale-factor="$SCALE" \
	--touch-events=enabled \
	"http://127.0.0.1:$HTTP_PORT/caret/index.html$Q" >/dev/null 2>&1 &
BROWSER=$!
trap 'kill $HTTP $BROWSER 2>/dev/null; wait $BROWSER 2>/dev/null' EXIT

for i in $(seq 1 50); do
	curl -s -m 1 "http://127.0.0.1:$PORT/json/list" 2>/dev/null | grep -q caret/index.html && break
	sleep 0.2
done
sleep 1
OUT=${OUT:-$T/out/results-$MODE} node "$T/caret.js" "http://127.0.0.1:$PORT" --page caret/index.html --no-long-press --no-ime-tap "$@"
