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

class TestResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: TestResizeObserver })

Object.defineProperty(Element.prototype, 'scrollIntoView', { value: () => undefined })

const browserGetComputedStyle = window.getComputedStyle
window.getComputedStyle = ((element: Element) => browserGetComputedStyle(element)) as typeof window.getComputedStyle
