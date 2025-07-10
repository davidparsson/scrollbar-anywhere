const defaultOptions = {
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
  blocklist: '',
  browser_enabled: true,
}

self.addEventListener('install', async (event) => {
  console.log('Service worker installed')
})

self.addEventListener('activate', (event) => {
  console.log('Service worker activated')
  event.waitUntil(self.clients.claim())
  updateExtensionIcon()
})

function saveOptions(o) {
  console.log('Saving options:', o)
  chrome.storage.local.set(o)
}

async function getOptionsFromLocalStorage() {
  console.log('Converting options from localStorage...')

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER'],
    justification: 'Preserve options from previous versions',
  })

  const oldOptions = await chrome.runtime.sendMessage({
    action: 'getOptionsFromLocalStorage',
  })
  console.log('Old options:', oldOptions)

  await chrome.offscreen.closeDocument()

  console.log('Restored options from localStorage:', oldOptions)
  return oldOptions
}

function sanitizeOptions(loadedOptions) {
  const sanitizedOptions = {}
  
  // Handle migration from blacklist to blocklist
  if (loadedOptions.blacklist && !loadedOptions.blocklist) {
    loadedOptions.blocklist = loadedOptions.blacklist
  }
  
  for (var key in defaultOptions) {
    if (typeof loadedOptions[key] == 'undefined') {
      sanitizedOptions[key] = defaultOptions[key]
    } else {
      sanitizedOptions[key] = loadedOptions[key]
    }
  }
  return sanitizedOptions
}

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed:', details)
  let loadedOptions = await chrome.storage.local.get(null)

  if (
    details.reason === chrome.runtime.OnInstalledReason.UPDATE &&
    Object.keys(loadedOptions).length === 0
  ) {
    loadedOptions = await getOptionsFromLocalStorage()
  }

  const options = sanitizeOptions(loadedOptions)

  saveOptions(options)
})

chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started')
  updateExtensionIcon()
})

async function getBrowserEnabled() {
  const loadedOptions = await chrome.storage.local.get('browser_enabled')
  return loadedOptions.browser_enabled
}

async function updateExtensionIcon() {
  const browser_enabled = await getBrowserEnabled()
  setExtensionIcon(browser_enabled)
}

function setExtensionIcon(enabled) {
  if (enabled) {
    chrome.action.setIcon({ path: 'icon16.png' })
  } else {
    chrome.action.setIcon({ path: 'icon16dis.png' })
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  const browserEnabled = !(await getBrowserEnabled())
  saveOptions({ browser_enabled: browserEnabled })
})

chrome.storage.local.onChanged.addListener(function (changes, namespace) {
  for (var key in changes) {
    if (key === 'browser_enabled') {
      setExtensionIcon(changes[key].newValue)
    }
  }
})
