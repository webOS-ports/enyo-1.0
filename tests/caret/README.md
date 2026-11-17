# Caret tests

`caret.js` taps into text fields the way a finger does and checks where the
caret went, over the Chrome DevTools Protocol. It needs Node 22 or newer and
nothing else.

The test app (`app/`) has one of each field a legacy app taps into, all
Enyo 1 controls:

| field    | what                                                         |
|----------|--------------------------------------------------------------|
| `plain`  | an `Input`                                                   |
| `email`  | an `Input` with `inputType: "email"`, which has no `selectionStart` |
| `rich`   | a `RichText` (a contenteditable `div`)                       |
| `deep`   | an `Input` inside a `Scroller`, scrolled                     |
| `framed` | an `Input` in an iframe, as Accounts shows the Email app's sign-in |

For each field it checks, as the user sees it:

- a tap focuses the field and puts the caret where the finger was: unfocused,
  focused, near the start, past the end;
- a tap at the top or the bottom of the field, above or below its letters,
  puts the caret on the line where the finger was along it: the whole field
  is the target, not only its letters;
- a finger slid along the letters, and one slid along the top of the field
  above them, takes the caret with it (Chromium's swipe to move the cursor,
  `--enable-features=SwipeToMoveCursor`; a runtime without it is reported as
  `info`);
- a pointer click (a mouse, the Q25's pointer) puts the caret there;
- the arrow keys move it from there and Shift+arrows select from it (what
  kbdscroll sends);
- a long press selects the word (on a device; `--no-long-press` in a desktop
  browser, which does not);
- a tap away from a selection drops it and puts the caret there;
- copy, tap, paste puts the text at the tap with the caret after it; cut
  takes it out with the caret where it was;
- a word still being typed (an IME composition, as the keyboard holds it)
  stays where it was typed when the finger moves the caret, and typing goes
  on at the tap (on a device; `--no-ime-tap` in a desktop browser).

And once for the page: one tap on a button is one click, a drag that starts
on a field scrolls the scroller and does not focus the field, and no tap asks
`PalmSystem.simulateMouseClick()` for a click (that click lands somewhere else
in a zoomed app or an iframe; see `framework/source/dom/Gesture.js`).

What a tap inside a selection does is the runtime's choice (keep it for the
edit pill, or place the caret), so it is reported as `info`, not checked.

Where the caret is, is read by typing a marker (as the keyboard commits text),
finding it in the field's text and undoing it: where typing goes is what the
user sees, and it works for fields without `selectionStart`. Coordinates are
calibrated against the page with two mouse moves, so WebAppMgr's page zoom
for legacy apps (the screen's pixel ratio) is accounted for without knowing
it.

## In a desktop browser

    ./browser.sh palm          # Enyo's device code paths (a stand-in PalmSystem)
    ./browser.sh plain         # Enyo's browser code paths
    BUILD=1 ./browser.sh palm  # the compressed build (enyo-build.js), as apps on a device load it

`browser.sh` serves this checkout's Enyo under the path apps load it from,
starts a headless Chromium at a device scale factor of 2 and runs the suite.
`CHROME`, `PORT`, `HTTP_PORT` and `SCALE` override the browser, the two ports
and the scale. Touches are sent with `Input.dispatchTouchEvent`, which the
browser turns into taps as it does a finger's.

## On a device

    ./device.sh <adb serial>
    SSH_OPTS="-o UserKnownHostsFile=..." ./device.sh ssh:root@localhost:5522   # VirtualBox image

installs the test app as `org.webosports.test.caret`, launches it, forwards
WebAppMgr's DevTools port (9998) and runs the suite. The screen has to be on
and unlocked. The app loads the device's Enyo, so this tests what is
installed there.

On a device with a touchscreen the touches are real ones: `inject.py` writes
them to its evdev node, so they go through the compositor and the browser's
gesture detection as a finger's do (LuneOS's runtime makes no tap or long
press of DevTools touches), calibrated against where the page sees them
land. Nobody should touch the device while it runs. Without a touchscreen
(the VirtualBox image), or with `DEVTOOLS_TOUCH=1`, DevTools touches are sent
and the long press and composition checks are left out.

    ./device.sh <adb serial> --app            # whatever app is in front
    ./device.sh <adb serial> --app --probe    # ... including email fields

runs the tap, pointer and arrow checks against the app in front (open the
field first: Accounts' email sign-in, a task in Tasks), reading the caret
from `selectionStart` so that no text is changed. `--probe` reads it by
typing and undoing, as the test app does, which also covers email fields.

Exit status 0 when every check passed; `results.json` goes to `$OUT`
(default `out/results-*`).
