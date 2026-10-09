import { useState } from 'react';
import { hostname } from '../model/ops';

/** Stored favicon, or a letter avatar when there is none or it fails to load. */
export function Favicon({ src, url }: { src?: string; url: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img className="favicon" src={src} alt="" onError={() => setFailed(true)} />;
  }
  const letter = (hostname(url)[0] ?? '?').toUpperCase();
  return (
    <span className="favicon favicon--letter" aria-hidden>
      {letter}
    </span>
  );
}
