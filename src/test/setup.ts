import '@testing-library/jest-dom/vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  }),
})

const storage = new Map<string, string>()
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, value),
  },
})

class TestResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: TestResizeObserver })

Object.defineProperty(Element.prototype, 'scrollIntoView', { value: () => undefined })

const browserGetComputedStyle = window.getComputedStyle
window.getComputedStyle = ((element: Element) => browserGetComputedStyle(element)) as typeof window.getComputedStyle
