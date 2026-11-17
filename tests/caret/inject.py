#!/usr/bin/env python3
# Touches on a device's touchscreen, as a finger makes them: written to its
# evdev node (multitouch protocol B), so they go through the compositor, the
# runtime and the browser's gesture detection like any other touch. Used by
# caret.js --inject; runs on the device.
#
#   inject.py info                       the touchscreen and its coordinate ranges
#   inject.py tap X Y HOLD_MS            press, hold, release (raw coordinates)
#   inject.py drag X Y DX DY STEPS       press, move in STEPS, release
import fcntl
import os
import struct
import sys
import time

EV_SYN, EV_KEY, EV_ABS = 0, 1, 3
SYN_REPORT = 0
BTN_TOUCH = 0x14a
ABS_MT_SLOT, ABS_MT_TOUCH_MAJOR, ABS_MT_POSITION_X, ABS_MT_POSITION_Y, ABS_MT_TRACKING_ID = 0x2f, 0x30, 0x35, 0x36, 0x39
EVIOCGBIT_ABS = 0x80404523  # EVIOCGBIT(EV_ABS, 64)


def eviocgabs(code):
    return 0x80184540 + code  # _IOR('E', 0x40 + code, struct input_absinfo)


def touchscreen():
    for name in sorted(os.listdir("/dev/input")):
        if not name.startswith("event"):
            continue
        path = "/dev/input/" + name
        try:
            fd = os.open(path, os.O_RDWR)
        except OSError:
            continue
        try:
            bits = bytearray(64)
            fcntl.ioctl(fd, EVIOCGBIT_ABS, bits)
            has = lambda c: bits[c // 8] & (1 << (c % 8))
            if has(ABS_MT_POSITION_X) and has(ABS_MT_POSITION_Y) and has(ABS_MT_TRACKING_ID):
                return fd, path
        except OSError:
            pass
        os.close(fd)
    sys.exit("no multitouch screen in /dev/input")


def absinfo(fd, code):
    buf = bytearray(24)
    fcntl.ioctl(fd, eviocgabs(code), buf)
    return struct.unpack("6i", bytes(buf))  # value, min, max, fuzz, flat, resolution


def main():
    fd, path = touchscreen()
    fmt = "llHHi"  # struct input_event: timeval, type, code, value

    def ev(t, c, v):
        sec = time.time()
        os.write(fd, struct.pack(fmt, int(sec), int((sec % 1) * 1e6), t, c, v))

    def frame(*events):
        for t, c, v in events:
            ev(t, c, v)
        ev(EV_SYN, SYN_REPORT, 0)

    tid = int(time.time() * 10) % 60000 + 1

    def down(x, y):
        frame((EV_ABS, ABS_MT_SLOT, 0), (EV_ABS, ABS_MT_TRACKING_ID, tid), (EV_ABS, ABS_MT_POSITION_X, x),
              (EV_ABS, ABS_MT_POSITION_Y, y), (EV_ABS, ABS_MT_TOUCH_MAJOR, 6), (EV_KEY, BTN_TOUCH, 1))

    def move(x, y):
        frame((EV_ABS, ABS_MT_SLOT, 0), (EV_ABS, ABS_MT_POSITION_X, x), (EV_ABS, ABS_MT_POSITION_Y, y))

    def up():
        frame((EV_ABS, ABS_MT_SLOT, 0), (EV_ABS, ABS_MT_TRACKING_ID, -1), (EV_KEY, BTN_TOUCH, 0))

    cmd = sys.argv[1]
    if cmd == "info":
        x, y = absinfo(fd, ABS_MT_POSITION_X), absinfo(fd, ABS_MT_POSITION_Y)
        print("%s %d %d %d %d" % (path, x[1], x[2], y[1], y[2]))
    elif cmd == "tap":
        x, y, hold = (int(a) for a in sys.argv[2:5])
        down(x, y)
        time.sleep(hold / 1000.0)
        up()
    elif cmd == "drag":
        x, y, dx, dy, steps = (int(a) for a in sys.argv[2:7])
        down(x, y)
        for i in range(1, steps + 1):
            time.sleep(0.016)
            move(x + dx * i // steps, y + dy * i // steps)
        time.sleep(0.03)
        up()
    else:
        sys.exit("unknown command " + cmd)


main()
