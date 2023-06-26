import { render } from 'preact';
import './style.css';

import { Clue } from './ui/Clue';

export function App() {
	return Clue();
}

let container;
if (container = document.getElementById('app')) {
	render(<App />, container);
}

