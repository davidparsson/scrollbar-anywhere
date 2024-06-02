defaultOptions = {
  button: 2,
  key_shift: false,
  key_ctrl: false,
  key_alt: false,
  key_meta: false,
  scaling: 1,
  speed: 6000,
  friction: 10,
  cursor: true,
  notext: false,
  grab_and_drag: false,
  debug: false,
  blacklist: '',
  browser_enabled: true,
}

for (var k in defaultOptions)
  if (typeof localStorage[k] == 'undefined') localStorage[k] = defaultOptions[k]

function loadOptions() {
  var o = {}
  for (var k in defaultOptions) o[k] = localStorage[k]
  return o
}

clients = {}

chrome.extension.onConnect.addListener(function (port) {
  port.postMessage({ saveOptions: localStorage })
  var id = port.sender.tab.id + ':' + port.sender.frameId
  console.log('connect: ' + id)
  clients[id] = port
  port.onDisconnect.addListener(function () {
    console.log('disconnect: ' + id)
    delete clients[id]
  })
})

function saveOptions(o) {
  for (var k in o) {
    localStorage[k] = o[k]
  }

  for (var id in clients) {
    clients[id].postMessage({ saveOptions: localStorage })
  }
}

chrome.browserAction.onClicked.addListener(function (tab) {
  if (localStorage['browser_enabled'] == 'true') {
    localStorage['browser_enabled'] = 'false'
    chrome.browserAction.setIcon({ path: 'icon16dis.png' })
  } else {
    localStorage['browser_enabled'] = 'true'
    chrome.browserAction.setIcon({ path: 'icon16.png' })
  }
  saveOptions({ o: 'browser_enabled' })
})

// Inject content script into all existing tabs (doesn't work)
// This functionality requires
//  "permissions": ["tabs"]
// in manifest.json
/*
chrome.windows.getAll({populate:true}, function(wins) {
  wins.forEach(function(win) {
    win.tabs.forEach(function(tab) {
      chrome.tabs.executeScript(tab.id,{file:"content.js",allFrames:true});
    })
  })
})
*/
