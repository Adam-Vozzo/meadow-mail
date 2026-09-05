'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Mail,
  Map,
  BookOpen,
  Hammer,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  X,
  ArrowUpRight,
  Leaf,
  Package,
  Compass,
  Anchor,
  Footprints,
  RotateCcw,
} from 'lucide-react';
import {
  deliveries,
  initialState,
  type GameState,
  type Upgrade,
} from '../lib/game/state';
import type { MeadowEngine, Snapshot } from '../lib/game/engine';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { registerGameTools } from '../lib/game/webmcp';

export default function Home() {
  const mount = useRef<HTMLDivElement>(null),
    engine = useRef<MeadowEngine | null>(null);
  const [state, setState] = useState<GameState>(initialState());
  const [view, setView] = useState<Snapshot>({
    x: -18,
    z: 17,
    prompt: '',
    area: 'Willow Isle',
    time: '09:00',
    stamina: 100,
    sailing: false,
    distance: 0,
  });
  const [panel, setPanel] = useState<
    'map' | 'journal' | 'build' | 'help' | null
  >(null);
  const [toast, setToast] = useState(''),
    [sound, setSound] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let disposed = false;
    let unregister = () => {};
    import('../lib/game/engine')
      .then(({ MeadowEngine }) => {
        if (disposed || !mount.current) return;
        try {
          engine.current = new MeadowEngine(
            mount.current,
            setState,
            setView,
            (message) => {
              setToast(message);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setToast(''), 6500);
            },
          );
          unregister = registerGameTools(engine.current);
          setReady(true);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : 'The island could not load.',
          );
        }
      })
      .catch(() =>
        setError('The island could not load. Please refresh to try again.'),
      );
    return () => {
      disposed = true;
      unregister();
      engine.current?.dispose();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    engine.current?.setPaused(!!panel);
  }, [panel]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') setPanel(null);
      if (e.code === 'KeyM') setPanel((p) => (p === 'map' ? null : 'map'));
      if (e.code === 'KeyJ')
        setPanel((p) => (p === 'journal' ? null : 'journal'));
      if (e.code === 'KeyB') setPanel((p) => (p === 'build' ? null : 'build'));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const delivery = deliveries[state.delivered];
  const toggle = (next: typeof panel) =>
    setPanel((p) => (p === next ? null : next));
  const upgrade = (id: Upgrade) => engine.current?.upgrade(id);
  return (
    <main className="game-shell">
      <div
        ref={mount}
        className="world"
        aria-label="Meadow Mail 3D island. Use WASD to walk and E to interact."
      />
      <div className="vignette" />
      <header className="topbar">
        <div className="wordmark">
          <span className="brand-mark">
            <Mail size={25} strokeWidth={1.6} />
          </span>
          <div>
            <h1>Meadow Mail</h1>
            <p>A LITTLE POST. A BIG ADVENTURE.</p>
          </div>
        </div>
        <div className="weather">
          {Number(view.time.slice(0, 2)) >= 18 ||
          Number(view.time.slice(0, 2)) < 6 ? (
            <Moon size={19} />
          ) : (
            <Sun size={19} />
          )}
          <span>{view.time}</span>
          <i />
          <span>Day {Math.floor(state.elapsed / 480) + 1}</span>
          <span className="season"> · Early summer</span>
        </div>
        <div className="top-actions">
          <span className="stamp-count">
            ✦ <b>{state.stamps}</b> <span>stamps</span>
          </span>
          <button
            className="icon-button"
            aria-label={sound ? 'Mute ambience' : 'Enable ambience'}
            onClick={() => setSound(engine.current?.toggleSound() ?? false)}
          >
            {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <button
            className="icon-button help-button"
            aria-label="How to play"
            onClick={() => toggle('help')}
          >
            ?
          </button>
        </div>
      </header>
      <aside className="route-card">
        <div className="eyebrow">
          <span className="live-dot" /> YOUR POSTAL ROUND{' '}
          <span>
            {String(state.delivered + (delivery ? 1 : 0)).padStart(2, '0')} / 05
          </span>
        </div>
        <h2>
          {!delivery
            ? 'An island, a little closer.'
            : state.carrying
              ? delivery.title
              : 'A good day for a delivery.'}
        </h2>
        <p>
          {!delivery
            ? 'Every letter found its way home. Stay a while, build a route, or take the boat out.'
            : state.carrying
              ? delivery.hint
              : 'Your next bit of happiness is waiting at the post office.'}
        </p>
        <div className="recipient">
          <span className="recipient-icon">
            {state.carrying ? delivery?.animal : '✉'}
          </span>
          <div>
            <small>
              {state.carrying
                ? 'DELIVER TO'
                : !delivery
                  ? 'ROUND COMPLETE'
                  : 'PICK UP AT'}
            </small>
            <strong>
              {state.carrying
                ? delivery?.recipient
                : !delivery
                  ? 'Thank you, postie.'
                  : 'Willow Post Office'}
            </strong>
          </div>
          <ArrowUpRight size={19} />
        </div>
        <div className="route-footer">
          <span>
            {state.carrying
              ? delivery?.kind === 'package'
                ? '▣ Small parcel'
                : '✉ One lovely letter'
              : 'Take the scenic route'}
          </span>
          <span>{delivery ? `${Math.round(view.distance)} m` : '✓'}</span>
        </div>
      </aside>
      <div className="location">
        <span>THE MEADOW ARCHIPELAGO</span>
        <h2>{view.area}</h2>
        <p>
          {view.sailing
            ? 'A little further from shore.'
            : 'There’s no hurry here.'}
        </p>
      </div>
      <button
        className="mini-map"
        onClick={() => toggle('map')}
        aria-label="Open island map"
      >
        <IslandMap x={view.x} z={view.z} state={state} />
        <span>
          <Compass size={15} /> Willow & beyond <kbd>M</kbd>
        </span>
      </button>
      <div className="courier-status">
        <span className="status-icon">
          {view.sailing ? <Anchor size={20} /> : <Footprints size={20} />}
        </span>
        <div>
          <strong>
            {view.sailing ? 'The Little Mallow' : 'Rookie postie'}
            <span>{state.delivered}/5 delivered</span>
          </strong>
          <div className="stamina">
            <i style={{ width: `${view.stamina}%` }} />
          </div>
          <small>
            {view.sailing
              ? 'Follow the buoy trail to Gull Island'
              : state.carrying && delivery?.kind === 'package'
                ? 'Heavy parcel · hold Space to steady'
                : 'A full heart & comfortable shoes'}
          </small>
        </div>
      </div>
      <nav className="toolbar" aria-label="Game tools">
        <button
          onClick={() => toggle('map')}
          className={panel === 'map' ? 'active' : ''}
        >
          <Map size={19} /> Map <kbd>M</kbd>
        </button>
        <button
          onClick={() => toggle('journal')}
          className={panel === 'journal' ? 'active' : ''}
        >
          <BookOpen size={19} /> Journal <kbd>J</kbd>
        </button>
        <button
          onClick={() => toggle('build')}
          className={panel === 'build' ? 'active' : ''}
        >
          <Hammer size={19} /> Make a path <kbd>B</kbd>
        </button>
      </nav>
      <div className="controls-hint">
        <span>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> Move
        </span>
        <span>
          <kbd>Shift</kbd> Jog
        </span>
        <span>Drag to look · Scroll to zoom</span>
      </div>
      {view.prompt && !panel && (
        <button
          className="interaction"
          onClick={() => engine.current?.interact()}
        >
          <kbd>E</kbd>
          {view.prompt}
        </button>
      )}
      {toast && (
        <output className="toast">
          <Leaf size={19} />
          <span>{toast}</span>
        </output>
      )}
      <div className="touch-controls">
        <div>
          {[
            ['↑', 'KeyW'],
            ['←', 'KeyA'],
            ['↓', 'KeyS'],
            ['→', 'KeyD'],
          ].map(([label, code]) => (
            <button
              key={code}
              aria-label={`Move ${label}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                engine.current?.key(code, true);
              }}
              onPointerUp={() => engine.current?.key(code, false)}
              onPointerCancel={() => engine.current?.key(code, false)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {(!ready || error) && (
        <div className="loading-screen">
          <Mail size={40} />
          <h2>
            {error ? 'A little bump in the road.' : 'Packing your satchel…'}
          </h2>
          <p>{error || 'The island is waking up.'}</p>
          {error && (
            <button onClick={() => window.location.reload()}>Try again</button>
          )}
        </div>
      )}
      {panel && (
        <Dialog
          open={!!panel}
          onOpenChange={(open) => {
            if (!open) setPanel(null);
          }}
        >
          <DialogContent
            showCloseButton={false}
            className={`panel ${panel === 'map' ? 'map-panel' : ''}`}
            aria-label={panel}
          >
            <button
              className="close icon-button"
              onClick={() => setPanel(null)}
              aria-label="Close panel"
            >
              <X size={20} />
            </button>
            {panel === 'map' && (
              <>
                <div className="eyebrow">A POCKET GUIDE TO</div>
                <h2>The Meadow Archipelago</h2>
                <p>
                  Follow the gold marker. A bridge saves a long walk around the
                  creek.
                </p>
                <IslandMap x={view.x} z={view.z} state={state} large />
                <div className="map-legend">
                  <span>● You</span>
                  <span>✦ Destination</span>
                  <span>— Walking paths</span>
                  <span>··· Sailing route</span>
                </div>
              </>
            )}
            {panel === 'journal' && (
              <>
                <div className="eyebrow">LETTERS LEAVE A LITTLE SOMETHING</div>
                <h2>Your delivery journal</h2>
                <p>Five deliveries. A few new friends. A place to call home.</p>
                <div className="journal-list">
                  {deliveries.map((d, i) => (
                    <article
                      key={d.id}
                      className={i < state.delivered ? 'complete' : ''}
                    >
                      <span>{i < state.delivered ? '✓' : d.animal}</span>
                      <div>
                        <small>
                          {d.recipient} · {d.kind}
                        </small>
                        <h3>{d.title}</h3>
                        <p>
                          {i < state.delivered
                            ? d.story
                            : i === state.delivered
                              ? d.hint
                              : 'A story still waiting to be opened.'}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
            {panel === 'build' && (
              <>
                <div className="eyebrow">LEAVE THE PATH A LITTLE BETTER</div>
                <h2>Small things. Smoother journeys.</h2>
                <p>
                  Spend the thank-you stamps you earn. Improvements appear at
                  marked places on the island.
                </p>
                <div className="build-list">
                  {(
                    [
                      [
                        'bridge',
                        'Creek footbridge',
                        'Cross the creek directly instead of walking around its southern end.',
                        3,
                        Hammer,
                      ],
                      [
                        'garden',
                        'A garden path',
                        'Plant the meadow route. Walking through its flowers restores your energy.',
                        2,
                        Leaf,
                      ],
                      [
                        'shortcut',
                        'Woodland shortcut',
                        'Clear a gate in the northern fence and open a direct woodland route.',
                        2,
                        Footprints,
                      ],
                      [
                        'boots',
                        'Trail boots',
                        'Walk faster, jog longer, and carry parcels with less sway.',
                        3,
                        Package,
                      ],
                    ] as const
                  ).map(([id, title, description, cost, Icon]) => (
                    <article key={id}>
                      <Icon size={25} />
                      <div>
                        <h3>{title}</h3>
                        <p>{description}</p>
                      </div>
                      <button
                        disabled={state.upgrades[id] || state.stamps < cost}
                        onClick={() => upgrade(id)}
                      >
                        {state.upgrades[id] ? 'Made ✓' : `${cost} ✦`}
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
            {panel === 'help' && (
              <>
                <div className="eyebrow">WELCOME TO THE POSTAL SERVICE</div>
                <h2>A slower kind of adventure.</h2>
                <p>
                  Visit the red-roof post office, collect a delivery, and follow
                  the golden envelope to its recipient. Press E nearby to hand
                  it over.
                </p>
                <div className="help-grid">
                  <p>
                    <kbd>W A S D</kbd> or arrows to walk
                  </p>
                  <p>
                    <kbd>E</kbd> Collect, deliver, or board
                  </p>
                  <p>
                    <kbd>Shift</kbd> Jog while energy lasts
                  </p>
                  <p>
                    <kbd>Space</kbd> Steady a heavy parcel
                  </p>
                  <p>
                    <kbd>Drag</kbd> Turn the camera
                  </p>
                  <p>
                    <kbd>Scroll</kbd> Zoom in or out
                  </p>
                </div>
                <p>
                  Earn stamps to build paths and upgrade your boots. Oren’s
                  third delivery opens the boat. Sail to the next island, dock
                  by the wooden jetty, and meet Pip.
                </p>
                <p className="save-note">
                  Progress saves on this browser automatically. Closing a panel
                  resumes the world.
                </p>
                <button
                  className="reset-button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Start a new postal round? This replaces your saved progress on this browser.',
                      )
                    ) {
                      engine.current?.reset();
                      setPanel(null);
                    }
                  }}
                >
                  <RotateCcw size={16} /> Start a new round
                </button>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
      <div className="edition">FIELD NOTES — PROTOTYPE 01</div>
    </main>
  );
}
function IslandMap({
  x,
  z,
  state,
  large = false,
}: {
  x: number;
  z: number;
  state: GameState;
  large?: boolean;
}) {
  const target = state.carrying
    ? deliveries[state.delivered]?.position
    : [-17, -12];
  return (
    <svg
      viewBox="-53 -53 160 104"
      className={large ? 'island-map large' : 'island-map'}
      aria-label="Map showing Willow Isle, Gull Island, your position and your delivery destination"
    >
      <rect x="-53" y="-53" width="160" height="104" fill="#bddde0" />
      <circle cx="0" cy="0" r="45" fill="#e5d8a5" />
      <circle cx="0" cy="0" r="41" fill="#8eae6e" />
      <circle cx="80" cy="-15" r="20" fill="#e5d8a5" />
      <circle cx="80" cy="-15" r="17" fill="#9fba78" />
      <path d="M6 -41 V17" stroke="#bddde0" strokeWidth="5" fill="none" />
      <path
        d="M-18 17 L-17 -12 L-24 4 M-17 -12 L-11 -24 M-17 -12 L-4 0 L22 0 L22 -9 M-4 0 L0 21 L15 21 L22 0 L37 9"
        stroke="#e6d6a6"
        strokeWidth="2.5"
        fill="none"
      />
      <path
        d="M40 10 Q54 13 61 -15"
        stroke="#fff8dd"
        strokeWidth="1"
        strokeDasharray="2 2"
        fill="none"
      />
      {state.upgrades.bridge && (
        <path d="M2 0 H11" stroke="#8f6046" strokeWidth="3" />
      )}
      {[
        [-17, -12],
        [-24, 4],
        [-11, -24],
        [22, -9],
        [81, -18],
      ].map(([hx, hz], i) => (
        <rect
          key={i}
          x={hx - 2}
          y={hz - 2}
          width="4"
          height="4"
          rx="1"
          fill={i === 0 ? '#aa4e3e' : '#fff0cf'}
        />
      ))}
      {target && state.delivered < 5 && (
        <g transform={`translate(${target[0]} ${target[1]})`}>
          <circle r="5" fill="#f5c454" opacity=".4" />
          <path
            d="M0 -4 L1.3 -1.3 L4 0 L1.3 1.3 L0 4 L-1.3 1.3 L-4 0 L-1.3 -1.3Z"
            fill="#ffec9d"
            stroke="#8c632d"
            strokeWidth=".6"
          />
        </g>
      )}
      <circle
        cx={x}
        cy={z}
        r="2.4"
        fill="#b4472e"
        stroke="white"
        strokeWidth="1"
      />
      {large && (
        <>
          <text x="-26" y="34">
            WILLOW ISLE
          </text>
          <text x="69" y="12">
            GULL ISLAND
          </text>
          <text x="-48" y="-42">
            N ↑
          </text>
          <text x="42" y="37" className="sea-label">
            The Clover Sea
          </text>
        </>
      )}
    </svg>
  );
}
