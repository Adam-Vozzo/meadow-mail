import * as T from 'three';
import { animal, ground, makeWorld, type WorldAssets } from './world';
import {
  canWalk,
  deliver,
  deliveries,
  DOCK,
  FAR_DOCK,
  initialState,
  isLand,
  parseSave,
  pickUp,
  POST,
  purchase,
  type GameState,
  type Upgrade,
} from './state';

export type Snapshot = {
  x: number;
  z: number;
  prompt: string;
  area: string;
  time: string;
  stamina: number;
  sailing: boolean;
  distance: number;
};
const SAVE_KEY = 'meadow-mail-v1';
export class MeadowEngine {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(48, 1, 0.1, 600);
  private renderer: T.WebGLRenderer;
  private assets: WorldAssets;
  private fox = animal('fox');
  private cargo = new T.Group();
  private state: GameState;
  private keys = new Set<string>();
  private sun = new T.DirectionalLight('#fff1cf', 2.4);
  private sky = new T.HemisphereLight('#e7f2df', '#819255', 2);
  private yaw = 0.45;
  private zoom = 29;
  private elevation = 0.72;
  private dragging = false;
  private paused = false;
  private hidden = false;
  private disposed = false;
  private sailing = false;
  private stamina = 100;
  private tired = false;
  private frame = 0;
  private last = 0;
  private sinceUI = 0;
  private sinceSave = 0;
  private sinceState = 0;
  private stepTime = 0;
  private audio: AudioContext | null = null;
  private sound = false;
  private nextNote = 0;
  private resizeObserver: ResizeObserver;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    .matches;
  private host: HTMLDivElement;
  private onState: (state: GameState) => void;
  private onView: (view: Snapshot) => void;
  private notify: (message: string) => void;
  constructor(
    host: HTMLDivElement,
    onState: (s: GameState) => void,
    onView: (s: Snapshot) => void,
    notify: (s: string) => void,
  ) {
    this.host = host;
    this.onState = onState;
    this.onView = onView;
    this.notify = notify;
    try {
      this.state = parseSave(localStorage.getItem(SAVE_KEY));
    } catch {
      this.state = initialState();
    }
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Playable 3D Meadow Mail island',
    );
    host.appendChild(this.renderer.domElement);
    this.scene.background = new T.Color('#b6dacf');
    this.scene.fog = new T.Fog('#b6dacf', 80, 240);
    this.sun.position.set(-35, 65, 35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -65,
      right: 65,
      top: 65,
      bottom: -65,
      near: 1,
      far: 180,
    });
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.sun, this.sky, this.sun.target);
    this.assets = makeWorld(this.scene);
    this.scene.add(this.fox);
    const parcel = new T.Mesh(
      new T.BoxGeometry(0.65, 0.54, 0.6),
      new T.MeshStandardMaterial({ color: '#d8b47b', roughness: 1 }),
    );
    parcel.castShadow = true;
    this.cargo.add(parcel);
    for (const size of [
      [0.68, 0.05, 0.63],
      [0.06, 0.57, 0.63],
    ])
      this.cargo.add(
        new T.Mesh(
          new T.BoxGeometry(...(size as [number, number, number])),
          new T.MeshStandardMaterial({ color: '#f0d99f' }),
        ),
      );
    this.cargo.position.set(0, 1.68, -0.45);
    this.fox.add(this.cargo);
    this.fox.position.set(
      this.state.x,
      ground(this.state.x, this.state.z),
      this.state.z,
    );
    this.applyState();
    this.camera.position
      .copy(this.fox.position)
      .add(
        new T.Vector3(
          Math.sin(this.yaw) * this.zoom,
          this.zoom * this.elevation,
          Math.cos(this.yaw) * this.zoom,
        ),
      );
    this.camera.lookAt(this.fox.position.clone().add(new T.Vector3(0, 1, 0)));
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    this.resize();
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    window.addEventListener('pagehide', this.save);
    document.addEventListener('visibilitychange', this.visibility);
    const c = this.renderer.domElement;
    c.addEventListener('pointerdown', this.pointerDown);
    c.addEventListener('pointermove', this.pointerMove);
    c.addEventListener('pointerup', this.pointerUp);
    c.addEventListener('pointercancel', this.pointerUp);
    c.addEventListener('wheel', this.wheel, { passive: false });
    c.addEventListener('webglcontextlost', this.contextLost);
    this.frame = requestAnimationFrame(this.animate);
  }
  private resize = () => {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
  private keyDown = (e: KeyboardEvent) => {
    if (
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
        e.code,
      ) &&
      !this.paused
    )
      e.preventDefault();
    this.keys.add(e.code);
    if (e.code === 'KeyE' && !e.repeat) this.interact();
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private blur = () => {
    this.keys.clear();
    this.dragging = false;
  };
  private visibility = () => {
    this.hidden = document.hidden;
    this.keys.clear();
    if (this.hidden) this.save();
  };
  private pointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  private pointerMove = (e: PointerEvent) => {
    if (this.dragging && !this.paused) {
      this.yaw -= e.movementX * 0.006;
      this.elevation = T.MathUtils.clamp(
        this.elevation + e.movementY * 0.004,
        0.35,
        1.3,
      );
    }
  };
  private pointerUp = () => {
    this.dragging = false;
  };
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom = T.MathUtils.clamp(this.zoom + e.deltaY * 0.023, 10, 48);
  };
  private contextLost = (e: Event) => {
    e.preventDefault();
    this.save();
    this.notify(
      'The graphics connection paused. Refresh to resume from your saved progress.',
    );
  };
  key(code: string, pressed: boolean) {
    if (pressed) this.keys.add(code);
    else this.keys.delete(code);
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    this.keys.clear();
  }
  getStatus() {
    return {
      delivered: this.state.delivered,
      carrying: this.state.carrying,
      stamps: this.state.stamps,
      upgrades: { ...this.state.upgrades },
      destination: this.getTarget(),
      position: { x: this.fox.position.x, z: this.fox.position.z },
      sailing: this.sailing,
    };
  }
  private getTarget() {
    return this.state.carrying
      ? deliveries[this.state.delivered]?.position
      : POST;
  }
  private distance(p: readonly number[]) {
    return Math.hypot(this.fox.position.x - p[0], this.fox.position.z - p[1]);
  }
  private getPrompt() {
    if (this.sailing) {
      if (this.distance(DOCK) < 8) return 'Dock at Willow Isle';
      if (this.distance(FAR_DOCK) < 8) return 'Dock at Gull Island';
      return '';
    }
    if (this.state.delivered < 5 && this.distance(POST) < 3)
      return this.state.carrying
        ? 'Your satchel is ready. Find your recipient.'
        : 'Collect your next delivery';
    const target = this.getTarget();
    if (this.state.carrying && target && this.distance(target) < 3.2)
      return `Deliver to ${deliveries[this.state.delivered].recipient}`;
    if (this.distance(DOCK) < 5 || this.distance(FAR_DOCK) < 5)
      return this.state.delivered >= 3
        ? 'Board the Little Mallow'
        : 'Oren’s delivery will open the boat';
    return '';
  }
  interact() {
    if (this.paused || this.hidden) return;
    if (this.sailing) {
      const dock =
        this.distance(DOCK) < 8
          ? DOCK
          : this.distance(FAR_DOCK) < 8
            ? FAR_DOCK
            : null;
      if (dock) {
        this.sailing = false;
        this.fox.position.set(dock[0], ground(dock[0], dock[1]), dock[1]);
        this.assets.boat.position.set(dock === DOCK ? 44 : 59, -0.05, dock[1]);
        this.save();
        this.notify(
          dock === DOCK
            ? 'Home again. The kettle is probably on.'
            : 'Welcome to Gull Island. Pip is by the lighthouse.',
        );
      }
      return;
    }
    if (
      this.distance(POST) < 3 &&
      !this.state.carrying &&
      this.state.delivered < 5
    ) {
      this.state = pickUp(this.state);
      this.applyState();
      this.save();
      this.chime();
      this.notify(
        `Packed: ${deliveries[this.state.delivered].title} Follow the gold envelope.`,
      );
      return;
    }
    const target = this.getTarget();
    if (this.state.carrying && target && this.distance(target) < 3.2) {
      const letter = deliveries[this.state.delivered];
      this.state = deliver(this.state);
      this.applyState();
      this.save();
      this.chime();
      this.notify(`${letter.story} +3 stamps`);
      return;
    }
    if (this.distance(DOCK) < 5 || this.distance(FAR_DOCK) < 5) {
      if (this.state.delivered < 3) {
        this.notify(
          'Deliver Oren’s workshop blueprints to unlock the Little Mallow.',
        );
        return;
      }
      const home = this.distance(DOCK) < 5;
      this.sailing = true;
      this.fox.position.set(home ? 44 : 59, 0.2, home ? 9 : -15);
      this.assets.boat.position.copy(this.fox.position);
      this.notify(
        'WASD to sail. Follow the buoys, then press E near a jetty to dock.',
      );
    }
  }
  upgrade(id: Upgrade) {
    const next = purchase(this.state, id);
    if (next === this.state) return;
    this.state = next;
    this.applyState();
    this.save();
    this.chime();
    this.notify(
      {
        bridge:
          'A little less creek, a little more connection. Your footbridge is ready.',
        garden: 'A flower-lined path now restores your energy as you walk.',
        shortcut: 'The woodland gate is open. A new way through the trees.',
        boots: 'New trail boots! Faster steps and steadier parcels.',
      }[id],
    );
  }
  reset() {
    this.state = initialState();
    this.sailing = false;
    this.stamina = 100;
    this.fox.position.set(-18, ground(-18, 17), 17);
    this.assets.boat.position.set(44, -0.05, 9);
    this.applyState();
    this.save();
    this.notify(
      'A fresh round. Your first parcel is waiting at the post office.',
    );
  }
  private applyState() {
    const a = this.assets,
      s = this.state;
    a.bridge.visible = s.upgrades.bridge;
    a.garden.visible = s.upgrades.garden;
    a.gate.visible = !s.upgrades.shortcut;
    a.seedGarden.visible = s.delivered >= 1;
    a.picnic.visible = s.delivered >= 2;
    a.workshop.visible = s.delivered >= 3;
    a.boat.visible = s.delivered >= 3;
    a.beacon.intensity = s.delivered >= 4 ? 12 : 0;
    this.cargo.visible = s.carrying;
    const molly = s.delivered >= 2 ? [-15, -23] : [-24, 4];
    a.creatures[0].position.set(molly[0], ground(molly[0], molly[1]), molly[1]);
    this.onState({ ...s, upgrades: { ...s.upgrades } });
  }
  private save = () => {
    if (this.disposed) return;
    this.state.x = this.sailing ? -18 : this.fox.position.x;
    this.state.z = this.sailing ? 17 : this.fox.position.z;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch {
      /* Private browsing or full storage: play remains available. */
    }
  };
  private walkable(x: number, z: number) {
    return (
      canWalk(x, z, this.state) &&
      !this.assets.colliders.some(
        (c) => Math.hypot(x - c.x, z - c.z) < c.radius + 0.28,
      ) &&
      !(this.state.delivered >= 3 && Math.hypot(x - 31, z - 1) < 2.6)
    );
  }
  private move(dt: number) {
    const forward =
      Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
      Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const right =
      Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
      Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const moving = !!(forward || right),
      heavy =
        this.state.carrying &&
        deliveries[this.state.delivered]?.kind === 'package',
      steady = this.keys.has('Space');
    if (this.stamina <= 1) this.tired = true;
    if (this.stamina > 22) this.tired = false;
    const jog =
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) &&
      !this.tired &&
      moving &&
      !steady;
    const inGarden =
      this.state.upgrades.garden &&
      Math.hypot(this.fox.position.x + 20, this.fox.position.z - 6) < 11;
    this.stamina = T.MathUtils.clamp(
      this.stamina +
        (jog && !this.sailing
          ? -(this.state.upgrades.boots ? 9 : 15)
          : inGarden
            ? 35
            : 12) *
          dt,
      0,
      100,
    );
    if (moving) {
      let dx = right * Math.cos(this.yaw) - forward * Math.sin(this.yaw),
        dz = -right * Math.sin(this.yaw) - forward * Math.cos(this.yaw);
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
      const speed = this.sailing
        ? 9
        : (jog ? 7 : 4.2) *
          (this.state.upgrades.boots ? 1.3 : 1) *
          (heavy ? 0.77 : 1) *
          (steady ? 0.8 : 1);
      const sway =
        heavy && !steady && !this.sailing
          ? Math.sin(this.stepTime * 1.4) *
            0.3 *
            (this.state.upgrades.boots ? 0.35 : 1)
          : 0;
      const x = this.fox.position.x + (dx - dz * sway) * dt * speed,
        z = this.fox.position.z + (dz + dx * sway) * dt * speed;
      if (this.sailing) {
        if (!isLand(x, z) && x > -53 && x < 110 && z > -60 && z < 58) {
          this.fox.position.x = x;
          this.fox.position.z = z;
        }
      } else {
        if (this.walkable(x, this.fox.position.z)) this.fox.position.x = x;
        if (this.walkable(this.fox.position.x, z)) this.fox.position.z = z;
      }
      const angle = Math.atan2(dx, dz);
      this.fox.rotation.y +=
        Math.atan2(
          Math.sin(angle - this.fox.rotation.y),
          Math.cos(angle - this.fox.rotation.y),
        ) * Math.min(1, dt * 12);
      this.stepTime += dt * (jog ? 13 : 9);
    }
    const stride = moving && !this.sailing ? Math.sin(this.stepTime) * 0.6 : 0;
    this.fox.getObjectByName('leftLeg')!.rotation.x = stride;
    this.fox.getObjectByName('rightLeg')!.rotation.x = -stride;
    this.fox.getObjectByName('leftArm')!.rotation.x = -stride * 0.6;
    this.fox.getObjectByName('rightArm')!.rotation.x = stride * 0.6;
    this.cargo.rotation.z =
      heavy && moving && !steady && !this.reduced
        ? Math.sin(this.stepTime * 0.7) * 0.16
        : 0;
    let y = ground(this.fox.position.x, this.fox.position.z);
    if (
      this.state.upgrades.bridge &&
      this.fox.position.x > 2 &&
      this.fox.position.x < 10.5 &&
      Math.abs(this.fox.position.z) < 2.2
    )
      y =
        ground(2, 0) +
        0.3 +
        Math.sin(((this.fox.position.x - 2) / 8.5) * Math.PI) * 0.55;
    if (this.sailing) {
      y = 0.42;
      this.assets.boat.position.set(
        this.fox.position.x,
        -0.02 + Math.sin(this.state.elapsed * 2) * 0.06,
        this.fox.position.z,
      );
      this.assets.boat.rotation.y = this.fox.rotation.y;
    }
    this.fox.position.y =
      y +
      (moving && !this.sailing && !this.reduced
        ? Math.abs(Math.sin(this.stepTime)) * 0.07
        : 0);
  }
  private animate = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min((time - (this.last || time)) / 1000, 0.05);
    this.last = time;
    if (this.hidden) return;
    if (!this.paused) {
      this.state.elapsed += dt;
      this.move(dt);
      this.sinceSave += dt;
      if (this.sinceSave > 3) {
        this.save();
        this.sinceSave = 0;
      }
      this.sinceState += dt;
      if (this.sinceState > 1) {
        this.onState({ ...this.state, upgrades: { ...this.state.upgrades } });
        this.sinceState = 0;
      }
    }
    const t = this.state.elapsed,
      a = this.assets;
    if (!this.reduced) {
      a.windmill.rotation.z = t * 0.38;
      a.boat.rotation.z = Math.sin(t * 1.8) * 0.035;
      for (let i = 0; i < a.buoys.length; i++)
        a.buoys[i].position.y = Math.sin(t * 1.4 + i) * 0.07;
      for (let i = 0; i < a.birds.length; i++) {
        const b = a.birds[i],
          angle = t * (0.07 + i * 0.004) + i * 1.6,
          range = 18 + i * 3;
        b.position.set(
          18 + Math.cos(angle) * range,
          11 + Math.sin(t * 0.4 + i) * 0.7 + (i % 3) * 2,
          -8 + Math.sin(angle) * range * 0.6,
        );
        b.rotation.y = -angle;
        b.children[0].rotation.z = Math.sin(t * 5 + i) * 0.35;
        b.children[1].rotation.z = -Math.sin(t * 5 + i) * 0.35;
      }
      for (let i = 0; i < a.clouds.length; i++) {
        a.clouds[i].position.x += dt * 0.25;
        if (a.clouds[i].position.x > 180) a.clouds[i].position.x = -140;
      }
      for (let i = 0; i < a.creatures.length; i++) {
        const c = a.creatures[i];
        c.rotation.y = Math.sin(t * 0.3 + i) * 0.4 + i;
        const base = ground(c.position.x, c.position.z);
        c.position.y = base + Math.max(0, Math.sin(t * 1.4 + i)) * 0.045;
      }
    }
    for (let i = 0; i < a.wildlife.length; i++) {
      const b = a.wildlife[i],
        [hx, hz] = b.userData.home as number[],
        angle = t * 0.18 + i;
      b.position.set(hx + Math.sin(angle) * 1.4, 0, hz + Math.cos(angle) * 1.4);
      b.position.y =
        ground(b.position.x, b.position.z) +
        (this.reduced ? 0 : Math.abs(Math.sin(t * 3 + i)) * 0.08);
      b.rotation.y = angle + Math.PI / 2;
    }
    for (let i = 0; i < a.ducks.length; i++) {
      const d = a.ducks[i],
        angle = t * 0.06 + i * 0.6;
      d.position.set(
        -37 + Math.sin(angle) * 3,
        -0.03,
        28 + Math.cos(angle) * 3,
      );
      d.rotation.y = angle + Math.PI / 2;
    }
    const day = (t / 480 + 0.375) % 1,
      daylight = T.MathUtils.clamp(
        Math.sin(day * Math.PI * 2) * 1.5 + 0.35,
        0.12,
        1,
      );
    this.sun.intensity = 0.2 + daylight * 2.2;
    this.sky.intensity = 0.65 + daylight * 1.45;
    const bg = new T.Color('#344d68').lerp(new T.Color('#b6dacf'), daylight);
    this.scene.background = bg;
    (this.scene.fog as T.Fog).color.copy(bg);
    const target = this.getTarget();
    a.marker.visible = !!target && this.state.delivered < 5;
    a.ring.visible = a.marker.visible;
    if (target) {
      const y = ground(target[0], target[1]);
      a.marker.position.set(
        target[0],
        y + 4.3 + (this.reduced ? 0 : Math.sin(t * 2) * 0.18),
        target[1],
      );
      a.marker.rotation.y = this.yaw;
      a.ring.position.set(target[0], y + 0.07, target[1]);
    }
    const pos = this.fox.position,
      desired = new T.Vector3(
        pos.x + Math.sin(this.yaw) * this.zoom,
        pos.y + this.zoom * this.elevation,
        pos.z + Math.cos(this.yaw) * this.zoom,
      );
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 5));
    this.camera.lookAt(pos.x, pos.y + 1.2, pos.z);
    this.sun.position.set(pos.x - 35, 65, pos.z + 35);
    this.sun.target.position.set(pos.x, 0, pos.z);
    this.sinceUI += dt;
    if (this.sinceUI > 0.1) {
      this.sinceUI = 0;
      const minutes = Math.floor(day * 1440);
      this.onView({
        x: pos.x,
        z: pos.z,
        prompt: this.getPrompt(),
        area: this.sailing
          ? 'The Clover Sea'
          : pos.x > 53
            ? 'Gull Island'
            : pos.z < -19
              ? 'Bramblewood'
              : pos.x > 10
                ? 'Windmill Reach'
                : 'Willow Isle',
        time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
        stamina: this.stamina,
        sailing: this.sailing,
        distance: target ? this.distance(target) : 0,
      });
    }
    if (this.sound && !this.paused && t > this.nextNote) {
      this.chime(true);
      this.nextNote = t + 4 + Math.random() * 4;
    }
    this.renderer.render(this.scene, this.camera);
  };
  toggleSound() {
    try {
      if (!this.audio) this.audio = new AudioContext();
      this.sound = !this.sound;
      if (this.sound) {
        void this.audio.resume();
        this.chime();
      } else void this.audio.suspend();
      return this.sound;
    } catch {
      this.notify('Audio is unavailable in this browser.');
      return false;
    }
  }
  private chime(ambient = false) {
    if (!this.audio || !this.sound) return;
    const now = this.audio.currentTime;
    [0, 1, 2].forEach((i) => {
      const oscillator = this.audio!.createOscillator(),
        gain = this.audio!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = (
        ambient ? [261.63, 329.63, 392] : [523.25, 659.25, 783.99]
      )[i];
      gain.gain.setValueAtTime(0, now + i * 0.14);
      gain.gain.linearRampToValueAtTime(
        ambient ? 0.018 : 0.045,
        now + i * 0.14 + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 1.8);
      oscillator.connect(gain).connect(this.audio!.destination);
      oscillator.start(now + i * 0.14);
      oscillator.stop(now + i * 0.14 + 2);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
  dispose() {
    this.save();
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
    window.removeEventListener('pagehide', this.save);
    document.removeEventListener('visibilitychange', this.visibility);
    const c = this.renderer.domElement;
    c.removeEventListener('pointerdown', this.pointerDown);
    c.removeEventListener('pointermove', this.pointerMove);
    c.removeEventListener('pointerup', this.pointerUp);
    c.removeEventListener('pointercancel', this.pointerUp);
    c.removeEventListener('wheel', this.wheel);
    c.removeEventListener('webglcontextlost', this.contextLost);
    const materials = new Set<T.Material>(),
      geometries = new Set<T.BufferGeometry>();
    this.scene.traverse((obj) => {
      if (obj instanceof T.Mesh) {
        geometries.add(obj.geometry);
        for (const m of Array.isArray(obj.material)
          ? obj.material
          : [obj.material])
          materials.add(m);
      }
      if (obj instanceof T.Sprite) materials.add(obj.material);
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => {
      if ('map' in m && (m as T.MeshStandardMaterial).map)
        (m as T.MeshStandardMaterial).map!.dispose();
      m.dispose();
    });
    this.renderer.dispose();
    c.remove();
    void this.audio?.close();
  }
}
