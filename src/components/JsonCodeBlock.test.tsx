import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import JsonCodeBlock from './JsonCodeBlock'

it('renders JSON values with Prism syntax tokens', () => {
  render(<JsonCodeBlock value={{ count: 2, name: 'Ada' }} />)

  expect(screen.getByLabelText('JSON content').querySelector('.token.property')).toHaveTextContent('"count"')
  expect(screen.getByLabelText('JSON content').querySelector('.token.number')).toHaveTextContent('2')
  expect(screen.getByLabelText('JSON content').querySelector('.token.string')).toHaveTextContent('"Ada"')
})

it('renders circular values without throwing', () => {
  const value: { self?: unknown } = {}
  value.self = value

  render(<JsonCodeBlock value={value} />)

  expect(screen.getAllByLabelText('JSON content').at(-1)).toHaveTextContent('[Circular]')
})
