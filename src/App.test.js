import { render, screen } from '@testing-library/react';
import App from './App';

test('renders OneLead login brand', async () => {
  render(<App />);
  expect(await screen.findByText('OneLead')).toBeInTheDocument();
});
