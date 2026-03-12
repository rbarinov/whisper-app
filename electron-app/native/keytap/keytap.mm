/**
 * keytap — Node N-API native addon for macOS CGEvent tap.
 *
 * Runs a CGEvent tap on a background thread inside the calling process,
 * which inherits Electron's Accessibility permission. Captures:
 *   - Regular keyDown / keyUp events
 *   - NX_SYSDEFINED (media key) events (Apple Silicon F3–F12)
 *
 * API:
 *   start(callback)  — start the event tap; callback(event) on each event
 *   stop()           — tear down the event tap
 *   setTargetKey(keyCode, nxKeyType)  — set which key to consume (block from other apps)
 *     keyCode: macOS virtual keyCode (e.g. 176 for F5 on Apple Silicon)
 *     nxKeyType: NX key type for media key matching (e.g. 22 for F5), or -1 if not a media key
 *
 * Events delivered to JS:
 *   { type: "keydown", keyCode: <number> }
 *   { type: "keyup",   keyCode: <number> }
 *   { type: "media",   nxKeyType: <number>, isDown: <bool> }
 */

#include <napi.h>
#import <CoreGraphics/CoreGraphics.h>
#import <AppKit/AppKit.h>
#include <thread>
#include <atomic>

// ── Global state ────────────────────────────────────────────────────

static Napi::ThreadSafeFunction tsfn;
static CFMachPortRef eventTap = nullptr;
static CFRunLoopRef tapRunLoop = nullptr;
static std::thread tapThread;
static std::atomic<bool> running{false};

// Target key to consume (block propagation)
static std::atomic<int> targetKeyCode{-1};
static std::atomic<int> targetNXKeyType{-1};
static const int ESCAPE_KEYCODE = 53;

// Track previous modifier flags to detect press/release
static CGEventFlags previousModifierFlags = 0;

// ── Event structs passed to JS thread ───────────────────────────────

enum class EventKind { KeyDown, KeyUp, Media };

struct KeytapEvent {
  EventKind kind;
  int code;       // keyCode or nxKeyType
  bool isDown;    // only meaningful for Media
  bool ctrlKey;
  bool altKey;
  bool shiftKey;
  bool metaKey;
};

// ── CGEvent tap callback ────────────────────────────────────────────

static CGEventRef eventTapCallback(
    CGEventTapProxy proxy,
    CGEventType type,
    CGEventRef event,
    void *userInfo)
{
  (void)proxy;
  (void)userInfo;

  // Re-enable if system disabled the tap
  if (type == kCGEventTapDisabledByTimeout || type == kCGEventTapDisabledByUserInput) {
    if (eventTap) {
      CGEventTapEnable(eventTap, true);
    }
    return event;
  }

  // PATH 1: NX_SYSDEFINED — media key events (Apple Silicon F-keys)
  if ((uint32_t)type == 14) {
    @autoreleasepool {
      NSEvent *nsEvent = [NSEvent eventWithCGEvent:event];
      if (!nsEvent || nsEvent.subtype != 8) {
        return event;
      }

      NSInteger data1 = nsEvent.data1;
      int mediaKeyCode = (int)((data1 & 0xFFFF0000) >> 16);
      int flags = (int)((data1 & 0x0000FF00) >> 8);
      bool isDown = (flags == 0x0A);
      bool isUp   = (flags == 0x0B);
      bool isRepeat = (data1 & 0x1) != 0;

      if (isRepeat) return event;

      if (isDown || isUp) {
        auto *ev = new KeytapEvent{EventKind::Media, mediaKeyCode, isDown, false, false, false, false};
        tsfn.NonBlockingCall(ev, [](Napi::Env env, Napi::Function jsCallback, KeytapEvent *ev) {
          auto obj = Napi::Object::New(env);
          obj.Set("type", "media");
          obj.Set("nxKeyType", ev->code);
          obj.Set("isDown", ev->isDown);
          jsCallback.Call({obj});
          delete ev;
        });

        // Consume (block) if this matches our target media key
        if (mediaKeyCode == targetNXKeyType.load()) {
          return NULL;
        }
      }
    }
    return event;
  }

  // PATH 2: Normal keyDown / keyUp
  if (type == kCGEventKeyDown || type == kCGEventKeyUp) {
    int64_t keyCode = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);
    int64_t autoRepeat = CGEventGetIntegerValueField(event, kCGKeyboardEventAutorepeat);
    if (autoRepeat) return event;

    CGEventFlags flags = CGEventGetFlags(event);
    bool ctrl  = (flags & kCGEventFlagMaskControl) != 0;
    bool alt   = (flags & kCGEventFlagMaskAlternate) != 0;
    bool shift = (flags & kCGEventFlagMaskShift) != 0;
    bool meta  = (flags & kCGEventFlagMaskCommand) != 0;

    EventKind kind = (type == kCGEventKeyDown) ? EventKind::KeyDown : EventKind::KeyUp;
    auto *ev = new KeytapEvent{kind, (int)keyCode, false, ctrl, alt, shift, meta};
    tsfn.NonBlockingCall(ev, [](Napi::Env env, Napi::Function jsCallback, KeytapEvent *ev) {
      auto obj = Napi::Object::New(env);
      obj.Set("type", ev->kind == EventKind::KeyDown ? "keydown" : "keyup");
      obj.Set("keyCode", ev->code);
      obj.Set("ctrlKey", ev->ctrlKey);
      obj.Set("altKey", ev->altKey);
      obj.Set("shiftKey", ev->shiftKey);
      obj.Set("metaKey", ev->metaKey);
      jsCallback.Call({obj});
      delete ev;
    });

    // Consume (block) if this matches our target key
    // Never block Escape — let it pass through to other apps
    int target = targetKeyCode.load();
    if (target >= 0 && (int)keyCode == target && (int)keyCode != ESCAPE_KEYCODE) {
      return NULL;
    }

    return event;
  }

  // PATH 3: Modifier key changes (kCGEventFlagsChanged)
  // macOS sends this instead of keyDown/keyUp for modifier keys.
  // We emit keydown/keyup so the JS side can track modifier state.
  if (type == kCGEventFlagsChanged) {
    int64_t keyCode = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);
    CGEventFlags flags = CGEventGetFlags(event);

    // Determine press vs release by comparing with previous flags
    CGEventFlags modifierMask = kCGEventFlagMaskControl | kCGEventFlagMaskAlternate |
                                kCGEventFlagMaskShift | kCGEventFlagMaskCommand;
    CGEventFlags newModifiers = flags & modifierMask;
    CGEventFlags oldModifiers = previousModifierFlags & modifierMask;
    previousModifierFlags = flags;

    bool isDown = (newModifiers & ~oldModifiers) != 0;

    bool ctrl  = (flags & kCGEventFlagMaskControl) != 0;
    bool alt   = (flags & kCGEventFlagMaskAlternate) != 0;
    bool shift = (flags & kCGEventFlagMaskShift) != 0;
    bool meta  = (flags & kCGEventFlagMaskCommand) != 0;

    EventKind kind = isDown ? EventKind::KeyDown : EventKind::KeyUp;
    auto *ev = new KeytapEvent{kind, (int)keyCode, false, ctrl, alt, shift, meta};
    tsfn.NonBlockingCall(ev, [](Napi::Env env, Napi::Function jsCallback, KeytapEvent *ev) {
      auto obj = Napi::Object::New(env);
      obj.Set("type", ev->kind == EventKind::KeyDown ? "keydown" : "keyup");
      obj.Set("keyCode", ev->code);
      obj.Set("ctrlKey", ev->ctrlKey);
      obj.Set("altKey", ev->altKey);
      obj.Set("shiftKey", ev->shiftKey);
      obj.Set("metaKey", ev->metaKey);
      jsCallback.Call({obj});
      delete ev;
    });

    return event;
  }

  return event;
}

// ── Background thread: create tap + run loop ────────────────────────

static void tapThreadFunc() {
  CGEventMask mask =
      (1 << kCGEventKeyDown) |
      (1 << kCGEventKeyUp) |
      (1 << kCGEventFlagsChanged) |
      (1 << 14); // NX_SYSDEFINED

  eventTap = CGEventTapCreate(
      kCGSessionEventTap,
      kCGHeadInsertEventTap,
      kCGEventTapOptionDefault,
      mask,
      eventTapCallback,
      nullptr);

  if (!eventTap) {
    auto *ev = new KeytapEvent{EventKind::KeyDown, -1, false, false, false, false, false};
    tsfn.NonBlockingCall(ev, [](Napi::Env env, Napi::Function jsCallback, KeytapEvent *ev) {
      auto obj = Napi::Object::New(env);
      obj.Set("type", "error");
      obj.Set("message", "CGEvent tap failed — Accessibility permission required");
      jsCallback.Call({obj});
      delete ev;
    });
    return;
  }

  CFRunLoopSourceRef source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0);
  tapRunLoop = CFRunLoopGetCurrent();
  CFRunLoopAddSource(tapRunLoop, source, kCFRunLoopCommonModes);
  CGEventTapEnable(eventTap, true);
  CFRelease(source);

  // Signal ready
  auto *ev = new KeytapEvent{EventKind::KeyDown, 0, false, false, false, false, false};
  tsfn.NonBlockingCall(ev, [](Napi::Env env, Napi::Function jsCallback, KeytapEvent *ev) {
    auto obj = Napi::Object::New(env);
    obj.Set("type", "ready");
    jsCallback.Call({obj});
    delete ev;
  });

  CFRunLoopRun();

  // Cleanup after run loop stops
  if (eventTap) {
    CGEventTapEnable(eventTap, false);
    CFMachPortInvalidate(eventTap);
    CFRelease(eventTap);
    eventTap = nullptr;
  }
  tapRunLoop = nullptr;
}

// ── JS API ──────────────────────────────────────────────────────────

static Napi::Value Start(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  if (running.load()) {
    Napi::Error::New(env, "keytap already running").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsFunction()) {
    Napi::TypeError::New(env, "Expected callback function").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  tsfn = Napi::ThreadSafeFunction::New(
      env,
      info[0].As<Napi::Function>(),
      "keytap_callback",
      0,   // unlimited queue
      1);  // one thread

  running.store(true);
  tapThread = std::thread(tapThreadFunc);
  tapThread.detach();

  return env.Undefined();
}

static Napi::Value Stop(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  if (!running.load()) {
    return env.Undefined();
  }

  running.store(false);

  if (tapRunLoop) {
    CFRunLoopStop(tapRunLoop);
  }

  tsfn.Release();

  return env.Undefined();
}

/**
 * setTargetKey(keyCode: number, nxKeyType: number)
 * Sets which key the event tap should consume (block from other apps).
 * Pass -1 to disable consumption.
 */
static Napi::Value SetTargetKey(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  if (info.Length() >= 1 && info[0].IsNumber()) {
    targetKeyCode.store(info[0].As<Napi::Number>().Int32Value());
  }
  if (info.Length() >= 2 && info[1].IsNumber()) {
    targetNXKeyType.store(info[1].As<Napi::Number>().Int32Value());
  }

  return env.Undefined();
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("stop", Napi::Function::New(env, Stop));
  exports.Set("setTargetKey", Napi::Function::New(env, SetTargetKey));
  return exports;
}

NODE_API_MODULE(keytap, Init)
