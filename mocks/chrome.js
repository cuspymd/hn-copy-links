// The extension namespace the unit suite runs against. Async APIs answer as
// promises only: passing a callback throws by name here, because on Firefox a
// callback in a trailing options slot is never called and the code goes
// silently dead. Failing loudly in tests is how that stays impossible.

function guardNoCallback(api, args) {
  for (const arg of args) {
    if (typeof arg === 'function') {
      throw new Error(`${api} was called with a callback. Use the promise form.`);
    }
  }
}

const store = new Map();

const chrome = {
  storage: {
    local: {
      async get(keys, ...rest) {
        guardNoCallback('storage.local.get', rest);
        if (keys === null || keys === undefined) {
          return Object.fromEntries(store);
        }
        const names = Array.isArray(keys) ? keys : [keys];
        const result = {};
        for (const name of names) {
          if (store.has(name)) result[name] = store.get(name);
        }
        return result;
      },
      async set(items, ...rest) {
        guardNoCallback('storage.local.set', rest);
        for (const [name, value] of Object.entries(items)) {
          store.set(name, value);
        }
      },
      async clear(...rest) {
        guardNoCallback('storage.local.clear', rest);
        store.clear();
      },
      // Test-only handles, not part of the extension API.
      __store: store,
      __reset() {
        store.clear();
      },
    },
  },
  i18n: {
    // The unit suite asserts on message names, not translations.
    getMessage(name) {
      return name;
    },
  },
};

export default chrome;
