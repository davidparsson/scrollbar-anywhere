# Scrollbar Anywhere

### **HELP WANTED:** This extension is becoming unusable due to Chrome's [deprecations for extensions](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3), and I don't have the time to fix this. See https://github.com/davidparsson/scrollbar-anywhere/pull/78 for progress.

An extension for Google Chrome that makes it possible to to scroll pages as if the scrollbar was right under your pointer. Just press the configured mouse button and move the mouse.

If you want grab-and-drag style scrolling, just set it up in the options.

The extension is based on the [Wet Banana extension](https://github.com/jedediah/wetbanana) and inspired by Scrollbar Anywhere for Firefox.

## Change Log

### 2.17

- Prevent the configured extra keys to interfere with scrolling.

### 2.16

- Stop gliding when a key is pressed or the mouse wheel is scrolled.
- Fix a bug where the default mouse click actions were incorrectly prevented.

### 2.15

- Fix a bug where having an empty blacklist would disable the extension for `file:///` URLs.

### 2.14

- Fix scrolling on some sites in Chrome v61+, by using `document.scrollingElement` as the outmost scrolling element, instead of `document.body`, even if `document.body` seems scrollable.

### 2.13

- Fix scrolling in Chrome v61+, by using `document.scrollingElement` as the outmost scrolling element, instead of `document.body`.

### 2.12

- Fix scrolling in Chrome v60+, by looking at the `buttons` property of the `mousemove` event.

### 2.11

- Add a blacklist, allowing users to disable scrolling on certain domains.
- Fixed a bug where settings in open multi-frame tabs were not updated.

### 2.10

- Fixed a bug where settings in open tabs were not updated.

### 2.9

- Fixed a bug where left-clicking would leave dragging enabled on some web pages.

### 2.8

- Fixed a bug where left-clicking would leave dragging enabled.

### 2.7

- Fixed gliding in Chrome v49+.

### 2.6

- Allow the extension to be used on file paths.

### 2.5

- Changed mouse cursor to grabbing when dragging. Thanks to [koMah](https://github.com/koMah).

### 2.4

- Fixed compatibility issues related to Change Colors extension

### 2.3

- Compatibility fixes for future versions of Chrome.

### 2.2

- Now enables clicks on gmail buttons (and similar) when scrolling with left mouse button.
