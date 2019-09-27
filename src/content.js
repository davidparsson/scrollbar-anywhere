
var ScrollbarAnywhere = (function() {

  // === Options ===

  var options = {debug:true, enabled:false}

  var port = chrome.extension.connect()
  port.onMessage.addListener(function(msg) {
    if (msg.saveOptions) {
      options = msg.saveOptions
      options.cursor = (options.cursor == "true")
      options.notext = (options.notext == "true")
      options.nolinks = (options.nolinks == "true")
      options.nobuttons = (options.nobuttons == "true")
      options.nolabels = (options.nolabels == "true")
      options.noimages = (options.noimages == "true")
      options.noembeds = (options.noembeds == "true")
      options.grab_and_drag = (options.grab_and_drag == "true")
      options.debug = (options.debug == "true")
      options.enabled = isEnabled(options.blacklist)
      options.browser_enabled = (options.browser_enabled == "true")
      debug("saveOptions: ",options)
    }
  })

  function isEnabled(blacklist) {
    if (!blacklist) {
      return true;
    }
    var blacklistedHosts = blacklist.split('\n');
    var hostname = document.location.hostname;
    for (var i = blacklistedHosts.length - 1; i >= 0; i--) {
      var blacklistedHost = blacklistedHosts[i].trim();
      if (hostname === blacklistedHost || hostname.endsWith('.' + blacklistedHost)) {
        return false;
      }
    }
    return true;
  }

  // === Debuggering ===

  function debug() {
    if (options.debug) {
      console.debug.apply(console,["SA:"].concat(Array.prototype.slice.call(arguments)))
    }
  }

  const DEBUG_INTERVAL = 100
  var lastDebug = 0

  function debugCont() {
    if (options.debug) {
      var now = Date.now()
      if (lastDebug+DEBUG_INTERVAL <= now) {
        lastDebug = now
        debug.apply(this,arguments)
      }
    }
  }


  // === Util ===

  String.prototype.padLeft = function(n,c) {
    if (!c) c = ' '
    var a = []
    for (var i = this.length; i < n; i++) a.push(c)
    a.push(this)
    return a.join('')
  }

  function formatCoord(n) {
    return new Number(n).toFixed(3).padLeft(8)
  }

  function formatVector(v) {
    return "["+formatCoord(v[0])+","+formatCoord(v[1])+"]"
  }


  // === Vector math ===

  function vadd(a,b)   { return [a[0]+b[0], a[1]+b[1]] }
  function vsub(a,b)   { return [a[0]-b[0], a[1]-b[1]] }
  function vmul(s,v)   { return [s*v[0], s*v[1]] }
  function vdiv(s,v)   { return [v[0]/s, v[1]/s] }
  function vmag2(v)    { return v[0]*v[0] + v[1]*v[1] }
  function vmag(v)     { return Math.sqrt(v[0]*v[0] + v[1]*v[1]) }
  function vunit(v)    { return vdiv(vmag(v),v) }

  // Test if the given point is directly over text
  var isOverText = (function() {
    var bonet = document.createElement("SPAN")
    return function(ev) {
      var mommy = ev.target
      if (mommy == null) return false
      for (var i = 0; i < mommy.childNodes.length; i++) {
        var baby = mommy.childNodes[i]
        if (baby.nodeType == Node.TEXT_NODE && baby.textContent.search(/\S/) != -1) {
          // debug("TEXT_NODE: '"+baby.textContent+"'")
          try {
            bonet.appendChild(mommy.replaceChild(bonet,baby))
            if (bonet.isSameNode(document.elementFromPoint(ev.clientX,ev.clientY))) return true
          } finally {
            if (baby.isSameNode(bonet.firstChild)) bonet.removeChild(baby)
            if (bonet.isSameNode(mommy.childNodes[i])) mommy.replaceChild(baby,bonet)
          }
        }
      }
      return false
    }
  })()


  /*
  large <html>.clientHeight:
    http://www.artima.com/scalazine/articles/twitter_on_scala.html

  small <html>.clientHeight:
    http://highscalability.com/scaling-twitter-making-twitter-10000-percent-faster

  short document.body
    http://damienkatz.net/2008/04/couchdb_language_change.html
  */

  // Test if a mouse event occurred over a scrollbar by testing if the
  // coordinates of the event are on the outside of a scrollable element.
  // The body element is treated separately since the visible size is
  // fetched differently depending on the doctype.
  function isOverScrollbar(ev) {
    var t = ev.target == document.documentElement ? document.scrollingElement : ev.target;
    if (t == document.scrollingElement) {
      var d = document.documentElement;
      var clientWidth;
      var clientHeight;
      if (d.scrollHeight == d.clientHeight && d.scrollHeight == d.offsetHeight) {
        // Guessing it's a no doctype document
        clientWidth = t.clientWidth;
        clientHeight = t.clientHeight;
      }
      else {
        clientWidth = d.clientWidth;
        clientHeight = d.clientHeight;
      }
      return (ev.offsetX - t.scrollLeft >= clientWidth ||
              ev.offsetY - t.scrollTop >= clientHeight);
    }
    else if (!isScrollable(t)) {
      return false;
    }
    else
    {
      return (ev.offsetX - t.scrollLeft >= t.clientWidth ||
              ev.offsetY - t.scrollTop >= t.clientHeight);
    }
  }

  // Can the given element be scrolled on either axis?
  // That is, is the scroll size greater than the client size
  // and the CSS overflow set to scroll or auto?
  function isScrollable(e) {
    var o
    if (e.scrollWidth > e.clientWidth) {
      o = document.defaultView.getComputedStyle(e)["overflow-x"]
      if (o == "auto" || o == "scroll") return true
    }
    if (e.scrollHeight > e.clientHeight) {
      o = document.defaultView.getComputedStyle(e)["overflow-y"]
      if (o == "auto" || o == "scroll") return true
    }
    return false
  }

  // Return the first ancestor (or the element itself) that is scrollable
  function findInnermostScrollable(e) {
    if (e == document.documentElement || e == document.body) return document.scrollingElement
    if (e == null || e == document.scrollingElement || isScrollable(e)) {
      return e
    } else {
      return arguments.callee(e.parentNode)
    }
  }

  // Don't drag when clicking on these elements
  const MANDATORY_OVERRIDE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']
  function hasMandatoryOverrideAncestor(e) {
    if (e == null) return false
    if (MANDATORY_OVERRIDE_TAGS.some(function(tag) { return tag == e.tagName })) return true
    return arguments.callee(e.parentNode)
  }

  function hasOptionalOverrideAncestor(e) {
    if (e == null) return false
    if (options.nolinks && e.tagName == 'A') return true
    if (options.nobuttons && (e.tagName == 'BUTTON' || hasRoleButtonAttribute(e))) return true
    if (options.nolabels && e.tagName == 'LABEL') return true
    if (options.noimages && e.tagName == 'IMG') return true
    if (options.noembeds && (e.tagName == 'OBJECT' || e.tagName == 'EMBED')) return true
    return arguments.callee(e.parentNode)
  }

  function hasRoleButtonAttribute(e) {
    // FIXME: github has a lot of links that look like buttons...
    if (e.attributes && e.attributes.role) {
      return e.attributes.role.value === 'button';
    }
    return false;
  }

  // === Clipboard Stuff ===
  var Clipboard = (function(){
    var blockElement = null

    function isPastable(e) {
      return e && e.tagName == 'INPUT' || e.tagName == 'TEXTAREA'
    }

    // Block the next paste event if a text element is active. This is a
    // workaround for middle-click paste not being preventable on Linux.
    function blockPaste() {
      var e = document.activeElement
      if (blockElement != e) {
        if (blockElement) unblockPaste()
        if (isPastable(e)) {
          debug("blocking paste for active text element", e)
          blockElement = e
          e.addEventListener('paste',onPaste,true)
        }
      }
    }

    function unblockPaste() {
      if (blockElement) {
        debug("unblocking paste", blockElement)
        blockElement.removeEventListener('paste',onPaste,true)
        blockElement = null
      }
    }

    function onPaste(ev) {
      var e = ev.target
      if (e) {
        if (blockElement == e) {
          blockElement = null
          ev.preventDefault()
        }
        e.removeEventListener('paste',arguments.callee,true)
      }
    }

    return { blockPaste: blockPaste,
             unblockPaste: unblockPaste }
  })()

  // === Scrollfix hack ===
  var ScrollFix = (function(){
    var scrollFixElement = null;
    var showingScrollFix = false;

    function createScrollFix() {
      var element = document.createElement('div');
      element.setAttribute('style', 'background: transparent none !important');
      element.style.position = 'fixed';
      element.style.top=0;
      element.style.right=0;
      element.style.bottom=0;
      element.style.left=0;
      element.style.zIndex=99999999;
      element.style.display='block';
      //element.style.borderRight='5px solid rgba(0,0,0,0.04)';
      return element;
    }

    function show() {
      if (scrollFixElement === null) {
        scrollFixElement = createScrollFix();
      }
      if (!showingScrollFix) {
        debug("showing scrollfix")
        document.body.appendChild(scrollFixElement);
        showingScrollFix = true;
      }
    }

    function hide() {
      if (showingScrollFix && scrollFixElement !== null && scrollFixElement.parentNode !== null) {
        debug("hiding scrollfix")
        scrollFixElement.parentNode.removeChild(scrollFixElement);
        showingScrollFix = false;
      }
    }

    return { show: show,
             hide: hide }
  })();

  // === Fake Selection ===

  var Selector = (function(){

    var startRange = null

    function start(x,y) {
      debug("Selector.start("+x+","+y+")")
      startRange = document.caretRangeFromPoint(x,y)
      var s = getSelection()
      s.removeAllRanges()
      s.addRange(startRange)
    }

    function update(x,y) {
      debug("Selector.update("+x+","+y+")")

           if (y < 0) y = 0
      else if (y >= innerHeight) y = innerHeight-1
           if (x < 0) x = 0
      else if (x >= innerWidth) x = innerWidth-1

      if (!startRange) start(x,y)
      var a = startRange
      var b = document.caretRangeFromPoint(x,y)

      if (b != null) {
        if (b.compareBoundaryPoints(Range.START_TO_START,a) > 0) {
          b.setStart(a.startContainer,a.startOffset)
        } else {
          b.setEnd(a.startContainer,a.startOffset)
        }

        var s = getSelection()
        s.removeAllRanges()
        s.addRange(b)
      }
    }

    function cancel() {
      debug("Selector.cancel()")
      startRange = null
      getSelection().removeAllRanges()
    }

    function scroll(ev) {
      var y = ev.clientY
      if (y < 0) {
        scrollBy(0,y)
        return true
      } else if (y >= innerHeight) {
        scrollBy(0,y-innerHeight)
        return true
      }
      return false
    }

    return { start: start,
             update: update,
             cancel: cancel,
             scroll: scroll }
  })()


  // === Motion ===

  var Motion = (function() {
    const MIN_SPEED_SQUARED = 1
    const FILTER_INTERVAL = 100
    var position = null
    var velocity = [0,0]
    var updateTime = null
    var impulses = []

    // ensure velocity is within min and max values
    // return if/not there is motion
    function clamp() {
      var speedSquared = vmag2(velocity)
      if (speedSquared <= MIN_SPEED_SQUARED) {
        velocity = [0,0]
        return false
      } else if (speedSquared > options.speed*options.speed) {
        velocity = vmul(options.speed,vunit(velocity))
      }
      return true
    }

    // zero velocity
    function stop() {
      impulses = []
      velocity = [0,0]
    }

    // impulsively move to given position and time
    // return if/not there is motion
    function impulse(pos,time) {
      position = pos
      updateTime = time

      while (impulses.length > 0 && (time - impulses[0].time) > FILTER_INTERVAL) impulses.shift()
      impulses.push({pos:pos,time:time})

      if (impulses.length < 2) {
        velocity = [0,0]
        return false
      } else {
        var a = impulses[0]
        var b = impulses[impulses.length-1]

        velocity = vdiv((b.time - a.time)/1000,
                        vsub(b.pos,a.pos))
        return clamp()
      }
    }

    // update free motion to given time
    // return if/not there is motion
    function glide(time) {
      impulses = []
      var moving

      if (updateTime == null) {
        moving = false
      } else {
        var deltaSeconds = (time-updateTime)/1000;
        var frictionMultiplier = Math.max(1-(options.friction/FILTER_INTERVAL), 0);
        frictionMultiplier = Math.pow(frictionMultiplier, deltaSeconds*FILTER_INTERVAL);
        velocity = vmul(frictionMultiplier, velocity);
        moving = clamp()
        position = vadd(position,vmul(deltaSeconds,velocity))
      }
      updateTime = time
      return moving
    }

    function getPosition() { return position }

    return { stop: stop,
             impulse: impulse,
             glide: glide,
             getPosition: getPosition }
  })()


  var Scroll = (function() {
    var scrolling = false
    var element
    var scrollOrigin
    var viewportSize
    var scrollSize
    var scrollListener
    var scrollMultiplier;

    // Return the size of the element as it appears in parent's layout
    function getViewportSize(el) {
      if (el == document.scrollingElement) {
        return [window.innerWidth, window.innerHeight]
      } else {
        return [el.clientWidth, el.clientHeight]
      }
    }

    // Start dragging given element
    function start(el) {
      if (element) stop()
      element = el
      viewportSize = getViewportSize(el)
      scrollSize = [el.scrollWidth, el.scrollHeight]
      scrollOrigin = [el.scrollLeft, el.scrollTop]
      if (options.grab_and_drag) {
        scrollMultiplier = [-options.scaling,
                            -options.scaling];
      }
      else {
        scrollMultiplier = [(scrollSize[0] / viewportSize[0]) * 1.15 * options.scaling,
                            (scrollSize[1] / viewportSize[1]) * 1.15 * options.scaling];
      }

    }

    // Move the currently dragged element relative to the starting position
    // and applying the the scaling setting.
    // Return if/not the element actually moved (i.e. if it did not hit a
    // boundary on both axes).
    function move(pos) {
      if (element) {
        var x = element.scrollLeft
        var y = element.scrollTop
        try {
          scrolling = true
          element.scrollLeft = scrollOrigin[0] + pos[0] * scrollMultiplier[0];
          element.scrollTop  = scrollOrigin[1] + pos[1] * scrollMultiplier[1];
        } finally {
          scrolling = false
        }
        return element.scrollLeft != x || element.scrollTop != y
      }
    }

    // Stop dragging
    function stop() {
      if (element) {
        element = null
        viewportSize = null
        scrollSize = null
        scrollOrigin = null
      }
    }

    function listen(fn) {
      scrollListener = fn
    }

    return { start: start,
             move: move,
             stop: stop,
             listen: listen }
  })()


  const LBUTTON=0, MBUTTON=1, RBUTTON=2
  const KEYS = ["shift","ctrl","alt","meta"]
  const KEYS_KEY_CODES = [16,17,18,91,92]
  const TIME_STEP = 10

  const STOP=0, CLICK=1, DRAG=2, GLIDE=3
  const ACTIVITIES = ["STOP","CLICK","DRAG","GLIDE"]
  for (var i = 0; i < ACTIVITIES.length; i++) window[ACTIVITIES[i]] = i

  var activity = STOP
  var blockContextMenu = false
  var mouseOrigin = null
  var dragElement = null

  function updateGlide() {
    if (activity == GLIDE) {
      debug("glide update");
      var moving = Motion.glide(performance.now());
      moving = Scroll.move(vsub(Motion.getPosition(),mouseOrigin)) && moving;
      if (moving) {
        setTimeout(updateGlide,TIME_STEP);
      } else {
        stopGlide();
      }
    }
  }

  function stopGlide() {
    debug("glide stop")
    activity = STOP
    Motion.stop()
    Scroll.stop()
  }

  function updateDrag(ev) {
    debug("drag update")
    var v = [ev.clientX,ev.clientY]
    var moving = false
    if (v[0] && v[1])
    {
      moving = Motion.impulse(v,ev.timeStamp)
      Scroll.move(vsub(v,mouseOrigin))
    }
    return moving
  }

  function startDrag(ev) {
    debug("drag start")
    activity = DRAG
    if (options.cursor) {
      document.body.style.cursor = "-webkit-grabbing";
      document.body.style.cursor = "-moz-grabbing";
      document.body.style.cursor = "grabbing";
    }
    Scroll.start(dragElement)
    return updateDrag(ev)
  }

  function stopDrag(ev) {
    debug("drag stop")
    if (options.cursor) document.body.style.cursor = "auto"
    Clipboard.unblockPaste()
    ScrollFix.hide()
    if (updateDrag(ev)) {
      window.setTimeout(updateGlide,TIME_STEP)
      activity = GLIDE
    } else {
      Scroll.stop()
      activity = STOP
    }
  }

  function onMouseDown(ev) {
    blockContextMenu = false

    if (!options.enabled) {
      debug("blacklisted domain, ignoring");
      return true;
    }

    if (!options.browser_enabled) {
      debug("browserAction is disabled, ignoring")
      return true;
    }

    switch (activity) {

    case GLIDE:
      stopGlide(ev)
      // fall through

    case STOP:
      if (!ev.target) {
        debug("target is null, ignoring")
        break
      }

      if (ev.button != options.button) {
        debug("wrong button, ignoring   ev.button="+ev.button+"   options.button="+options.button)
        break
      }

      if (!KEYS.every(function(key) { return (options['key_'+key]+'' == 'true') == ev[key+"Key"] })) {
        debug("wrong modkeys, ignoring")
        break
      }

      if (hasMandatoryOverrideAncestor(ev.target)) {
        debug("forbidden target element, ignoring",ev)
        break
      }

      if (hasOptionalOverrideAncestor(ev.target)) {
        debug("optional target element disabled, ignoring",ev)
        break
      }

      if (options.notext && isOverText(ev)) {
        debug("detected text node, ignoring")
        break
      }

      if (isOverScrollbar(ev)) {
        debug("detected scrollbar click, ignoring",ev)
        break
      }

      dragElement = findInnermostScrollable(ev.target)
      if (!dragElement) {
        debug("no scrollable ancestor found, ignoring",ev)
        break
      }

      debug("click MouseEvent=",ev," dragElement=",dragElement)
      activity = CLICK
      mouseOrigin = [ev.clientX,ev.clientY]
      Motion.impulse(mouseOrigin,ev.timeStamp)
      ev.preventDefault()
      if (ev.button == MBUTTON &&
          ev.target != document.activeElement) Clipboard.blockPaste()
      if (ev.button == RBUTTON &&
          (navigator.platform.match(/Mac/) || navigator.platform.match(/Linux/))) {
        blockContextMenu = true;
      }
      break

    default:
      debug("WARNING: illegal activity for mousedown: "+ACTIVITIES[activity]);
      if (options.cursor) document.body.style.cursor = "auto";
      Clipboard.unblockPaste();
      ScrollFix.hide();
      activity = STOP;
      return onMouseDown(ev);
    }
  }

  function onMouseMove(ev) {
    switch (activity) {

    case STOP: break

    case CLICK:
      if (ev.buttons == buttonToMouseMoveButtons(options.button)) {
        if (positionsWithinDistance(mouseOrigin, [ev.clientX, ev.clientY], 0)) {
          debug("ignore, short drag")
          break
        }
        if (options.button == RBUTTON) blockContextMenu = true
        ScrollFix.show();
        startDrag(ev)
        ev.preventDefault()
      }
      break

    case DRAG:
      if (ev.buttons == buttonToMouseMoveButtons(options.button)) {
        updateDrag(ev);
        ev.preventDefault();
      }
      break;

    case GLIDE: break

    default:
      debug("WARNING: unknown state: "+activity)
      break
    }
  }

  function onMouseUp(ev) {
    switch (activity) {

    case STOP: break

    case CLICK:
      debug("unclick, no drag")
      Clipboard.unblockPaste()
      ScrollFix.hide()
      if (ev.button == 0) getSelection().removeAllRanges()
      if (document.activeElement) document.activeElement.blur()
      if (ev.target) ev.target.focus()
      if (ev.button == options.button) activity = STOP
      break

    case DRAG:
      if (ev.button == options.button) {
        stopDrag(ev)
        ev.preventDefault()
      }
      break

    case GLIDE:
      stopGlide(ev)
      break

    default:
      debug("WARNING: unknown state: "+activity)
      break
    }
  }

  function onMouseOut(ev) {
    switch (activity) {

    case STOP: break

    case CLICK: break

    case DRAG:
      if (ev.toElement == null) stopDrag(ev)
      break

    case GLIDE: break

    default:
      debug("WARNING: unknown state: "+activity)
      break
    }
  }

  function onContextMenu(ev) {
    if (blockContextMenu) {
      blockContextMenu = false
      debug("blocking context menu")
      ev.preventDefault()
    }
  }

  function positionsWithinDistance(position1, position2, maxDistance) {
    var distance = vmag(vsub(position1, position2))
    return distance >= -maxDistance && distance <= maxDistance
  }

  function onAbortingAction(ev) {
    switch (activity) {

      case STOP: break

      case CLICK: break

      case DRAG: break

      case GLIDE:
        if (!KEYS_KEY_CODES.includes(ev.keyCode)) {
          debug("key pressed or wheel scrolled while gliding")
          stopGlide(ev)
        }
        break

      default:
        debug("WARNING: unknown state: "+activity)
        break
      }
  }

  return {
    init: function() {
      addEventListener("mousedown", onMouseDown, true)
      addEventListener("mouseup", onMouseUp, true)
      addEventListener("mousemove", onMouseMove, true)
      addEventListener("mouseout", onMouseOut, true)
      addEventListener("contextmenu", onContextMenu, true)
      addEventListener("keydown", onAbortingAction, true)
      addEventListener("wheel", onAbortingAction, true)
    }
  }

  function buttonToMouseMoveButtons(button) {
    if (button == LBUTTON) return 1
    if (button == MBUTTON) return 4
    if (button == RBUTTON) return 2
    return 0
  }

})()

ScrollbarAnywhere.init()
