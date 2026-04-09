import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router';
import type {MetaFunction} from 'react-router';

export const meta: MetaFunction = () => {
  return [{title: 'About | TRENDSBYAFEEZ'}];
};

const PHRASES = ['IF YOU SAW ME', 'I WAS NOT THERE'];
const CITIES = ['PARIS', 'JOHANNESBURG', 'DUBAI', 'LONDON', 'TOKYO'];
const GLYPH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*!?/|^~<>';
const SCRAMBLE_DURATION = 700;

function useGlyphScramble(target: string) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = Date.now();
    const chars = target.split('');

    function tick() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / SCRAMBLE_DURATION, 1);

      const result = chars.map((char, i) => {
        if (char === ' ') return ' ';
        const charResolveAt = i / chars.length;
        if (progress >= charResolveAt + 0.15) return char;
        return GLYPH_CHARS[Math.floor(Math.random() * GLYPH_CHARS.length)];
      });

      setDisplay(result.join(''));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return display;
}

export default function AboutPage() {
  const [index, setIndex] = useState(0);
  const [cityIndex, setCityIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % PHRASES.length);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCityIndex((i) => (i + 1) % CITIES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const scrambled = useGlyphScramble(PHRASES[index]);
  const scrambledCity = useGlyphScramble(CITIES[cityIndex]);

  return (
    <div className="page-about">
      <span className="page-about__bg-glyph" aria-hidden="true">
        {scrambled}
      </span>

      <p className="page-about__eyebrow"> {scrambledCity}</p>

      <h1 className="page-about__title">{scrambled}</h1>

      <p className="page-about__body">
        SEEING IS BELIEVING.
      </p>

      <nav className="page-about__actions" aria-label="About navigation">
        <Link to="/collections" className="page-about__link">
          Shop Now
        </Link>

      </nav>
    </div>
  );
}
