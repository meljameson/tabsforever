import { useEffect } from 'react';
import { Board } from '../../src/components/Board';
import { Header } from '../../src/components/Header';
import { ToastBar } from '../../src/components/ToastBar';
import { useStore } from '../../src/model/store';

export default function App() {
  const init = useStore((s) => s.init);
  useEffect(() => init(), [init]);

  return (
    <div className="app">
      <Header />
      <Board />
      <ToastBar />
    </div>
  );
}
