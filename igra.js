// Adriatic Servis – igra (prvi prototip)
// Lik sam trči udesno, tap ili razmaknica = skok. Doskok na brod donosi novac, pad u more završava igru.

// ---------- POSTAVKE (ovdje se lako mijenjaju brojevi) ----------
const SIRINA = 720, VISINA = 1280;
const RAZINA_MORA = 1010;      // gdje je površina mora (y)
const VRH_MULA = 900;          // gdje je gornja ploha mula (y)
const BRZINA_TRCANJA = 280;    // koliko brzo lik ide udesno
const SNAGA_SKOKA = 1000;      // koliko visoko skače
const GRAVITACIJA = 2200;
const VISINA_LIKA = 170;       // visina lika na ekranu
const SIRINA_BRODA = 620;      // širina broda na ekranu

// Brodovi redom. "palubaPosto" = na kojoj visini slike (0 = vrh, 1 = dno) lik stoji.
const BRODOVI = [
  { kljuc: 'brod-arience',   ime: 'Arience',   novac: 50,  palubaPosto: 0.70 },
  { kljuc: 'brod-angelique', ime: 'Angelique', novac: 100, palubaPosto: 0.76 },
  { kljuc: 'brod-nixie',     ime: 'Nixie',     novac: 150, palubaPosto: 0.80 },
  { kljuc: 'brod-deepblue',  ime: 'Deep Blue', novac: 175, palubaPosto: 0.76 },
];

// Razmaci mora između mula i brodova (u točkicama)
const MORE_IZMEDU = 160;
const SIRINA_MULA = 520;

// Značke prema ukupnom iznosu
const BRONCA = 150, SREBRO = 300, ZLATO = 475; // 475 € = svi brodovi

const LIKOVI = ['tin', 'dinko', 'roko', 'marijela', 'toni'];
const IMENA = { tin: 'Tin', dinko: 'Dinko', roko: 'Roko', marijela: 'Marijela', toni: 'Toni' };
const PLAVA = 0x0a3d91, PLAVA_TXT = '#0a3d91';

// ---------- POMOĆNO ----------
function citajRekord() {
  try { return parseInt(localStorage.getItem('as-rekord') || '0', 10) || 0; } catch (e) { return 0; }
}
function spremiRekord(v) {
  try { localStorage.setItem('as-rekord', String(v)); } catch (e) { /* npr. privatni prozor */ }
}
// Retro pixel font koji ima i hrvatska slova (č, ć, š, ž, đ)
const FONT = '"VT323", monospace';

// ---------- ZVUKOVI (retro "piskanje" kao u Mariju, bez datoteka) ----------
const Zvuk = {
  ctx: null,
  ukljuci() {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* bez zvuka */ }
  },
  // jedan ton: frekvencija od f1 do f2, trajanje u sekundama, kašnjenje
  ton(f1, f2, traj, kasni = 0, vrsta = 'square', glasnoca = 0.12) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + kasni;
    const o = c.createOscillator(), g = c.createGain();
    o.type = vrsta;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + traj);
    g.gain.setValueAtTime(glasnoca, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + traj);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + traj + 0.02);
  },
  skok() { this.ton(300, 700, 0.18); },
  novac() { this.ton(988, 988, 0.08); this.ton(1319, 1319, 0.35, 0.08); },
  pljus() {
    const c = this.ctx; if (!c) return;
    const len = c.sampleRate * 0.5, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0.35;
    s.connect(f).connect(g).connect(c.destination); s.start();
  },
  kraj() { [523, 392, 330, 262].forEach((f, i) => this.ton(f, f, 0.22, 0.3 + i * 0.2, 'triangle', 0.18)); },
  pobjeda() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.ton(f, f, 0.18, i * 0.13, 'square', 0.1)); },
};

// Pikselizirani oblak (napravi se jednom kao slika)
function napraviOblak(scena) {
  if (scena.textures.exists('oblak')) return;
  const g = scena.make.graphics({ add: false });
  const P = 12; // veličina "piksela"
  const oblik = [
    '....XXXX........',
    '..XXXXXXXX.XXX..',
    '.XXXXXXXXXXXXXX.',
    'XXXXXXXXXXXXXXXX',
    '.XXXXXXXXXXXXXX.',
  ];
  oblik.forEach((red, y) => [...red].forEach((ch, x) => {
    if (ch === 'X') { g.fillStyle(y >= 3 ? 0xdcecff : 0xffffff).fillRect(x * P, y * P, P, P); }
  }));
  g.generateTexture('oblak', 16 * P, 5 * P);
  g.destroy();
}

// Gumb: plavi pravokutnik s bijelim tekstom
function napraviGumb(scena, x, y, tekst, klik) {
  const g = scena.add.rectangle(x, y, 440, 110, PLAVA).setStrokeStyle(6, 0xffffff).setInteractive({ useHandCursor: true });
  const t = scena.add.text(x, y, tekst, { fontFamily: FONT, fontSize: '56px', color: '#ffffff' }).setOrigin(0.5);
  g.on('pointerdown', () => { Zvuk.ukljuci(); klik(); });
  // lagano "pulsiranje" da se vidi da se može kliknuti
  scena.tweens.add({ targets: [g, t], scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  return [g, t];
}

// ---------- 1. UČITAVANJE SLIKA ----------
class Ucitavanje extends Phaser.Scene {
  constructor() { super('Ucitavanje'); }
  preload() {
    this.scale.refresh();
    this.add.text(SIRINA / 2, VISINA / 2, 'UČITAVANJE...', { fontFamily: FONT, fontSize: '48px', color: '#ffffff' }).setOrigin(0.5);
    LIKOVI.forEach(l => this.load.image('lik-' + l, 'slike/lik-' + l + '.png'));
    BRODOVI.forEach(b => this.load.image(b.kljuc, 'slike/' + b.kljuc + '.png'));
    this.load.image('mul', 'slike/mul.png');
    this.load.image('more', 'slike/more.png');
    this.load.image('logo', 'slike/logo.png');
    this.load.image('palma', 'slike/palma.png');
    ['zlatna', 'srebrna', 'broncana'].forEach(m => this.load.image('medalja-' + m, 'slike/medalja-' + m + '.png'));
  }
  create() {
    // ?lik=ime u adresi preskače izbornike (za brzo testiranje)
    const p = new URLSearchParams(location.search).get('lik');
    if (LIKOVI.includes(p)) this.scene.start('Igra', { lik: p });
    else this.scene.start('Pocetak');
  }
}

// ---------- 2. POČETNI EKRAN ----------
class Pocetak extends Phaser.Scene {
  constructor() { super('Pocetak'); }
  create() {
    this.scale.refresh();
    this.cameras.main.setBackgroundColor('#ffffff');
    const cx = SIRINA / 2;
    const logo = this.add.image(cx, 400, 'logo');
    logo.setScale(480 / logo.width);
    this.tweens.add({ targets: logo, y: 385, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add.text(cx, 720, 'ADRIATIC SERVIS', { fontFamily: FONT, fontSize: '84px', color: PLAVA_TXT }).setOrigin(0.5);
    this.add.text(cx, 790, 'ured Split · 2026.', { fontFamily: FONT, fontSize: '40px', color: '#3a6fc4' }).setOrigin(0.5);
    napraviGumb(this, cx, 1000, 'POKRENI IGRU', () => this.scene.start('Odabir'));
    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('Odabir'));
    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Odabir'));
  }
}

// ---------- 3. ODABIR LIKA ----------
class Odabir extends Phaser.Scene {
  constructor() { super('Odabir'); }
  create() {
    this.scale.refresh();
    this.cameras.main.setBackgroundColor('#ffffff');
    this.odabran = null;
    const cx = SIRINA / 2;
    this.naslov = this.add.text(cx, 130, 'ODABERI LIKA', { fontFamily: FONT, fontSize: '80px', color: PLAVA_TXT }).setOrigin(0.5);

    // 3 lika gore, 2 dolje
    const mjesta = [[130, 520], [360, 520], [590, 520], [245, 940], [475, 940]];
    this.kartice = LIKOVI.map((l, i) => {
      const [x, y] = mjesta[i];
      const slika = this.add.image(x, y, 'lik-' + l).setOrigin(0.5, 1);
      slika.setScale(280 / slika.height);
      const ime = this.add.text(x, y + 20, IMENA[l], { fontFamily: FONT, fontSize: '44px', color: PLAVA_TXT }).setOrigin(0.5, 0);
      slika.setInteractive({ useHandCursor: true });
      slika.on('pointerover', () => slika.setTint(0xdde8ff));
      slika.on('pointerout', () => slika.clearTint());
      slika.on('pointerdown', () => this.odaberi(l));
      return { l, slika, ime };
    });
  }

  odaberi(lik) {
    if (this.odabran) return;
    this.odabran = lik;
    const cx = SIRINA / 2;
    this.naslov.setText(IMENA[lik].toUpperCase());

    this.kartice.forEach(k => {
      k.slika.disableInteractive().clearTint();
      if (k.l !== lik) {
        // ostali nestanu
        this.tweens.add({ targets: [k.slika, k.ime], alpha: 0, scale: 0.2, duration: 350, onComplete: () => { k.slika.destroy(); k.ime.destroy(); } });
      } else {
        k.ime.destroy();
        const s = k.slika, velika = 480 / s.height;
        // odabrani doleti na sredinu i poraste
        this.tweens.add({
          targets: s, x: cx, y: 920, scale: velika, duration: 500, ease: 'Back.out',
          onComplete: () => this.skokVeselja(s, velika),
        });
      }
    });
  }

  // Animacija "skok od veselja": stisne se, poskoči, doskoči, pa lagano diše
  skokVeselja(s, v) {
    const y0 = s.y;
    const koraci = [
      { scaleX: v * 1.12, scaleY: v * 0.88, duration: 120 },                              // čučne
      { y: y0 - 130, scaleX: v * 0.92, scaleY: v * 1.1, duration: 280, ease: 'Quad.out' }, // skok
      { y: y0, scaleX: v, scaleY: v, duration: 260, ease: 'Quad.in' },                     // pad
      { scaleX: v * 1.1, scaleY: v * 0.9, duration: 90 },                                  // doskok
      { scaleX: v, scaleY: v, duration: 90 },
    ];
    const sljedeci = (i) => {
      if (i < koraci.length) {
        this.tweens.add({ targets: s, ...koraci[i], onComplete: () => sljedeci(i + 1) });
        return;
      }
      // nakon skoka: lagano "disanje" i gumb KRENI
      this.tweens.add({ targets: s, scaleY: v * 1.03, y: y0 - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const kreni = () => this.scene.start('Igra', { lik: this.odabran });
      napraviGumb(this, SIRINA / 2, 1090, 'KRENI', kreni);
      this.input.keyboard.once('keydown-SPACE', kreni);
      this.input.keyboard.once('keydown-ENTER', kreni);
    };
    sljedeci(0);
  }
}

// ---------- 4. SCENA IGRE ----------
class Igra extends Phaser.Scene {
  constructor() { super('Igra'); }

  init(data) {
    this.odabrani = (data && LIKOVI.includes(data.lik)) ? data.lik : 'tin';
  }

  create() {
    this.scale.refresh(); // prilagodi veličinu ekranu (važno na mobitelu)
    this.novac = 0;
    this.gotovo = false;
    this.krenuo = false;

    // Nebo (privremeno: obična plava boja dok ne stigne vaša pozadina)
    const nebo = this.add.graphics().setScrollFactor(0);
    nebo.fillGradientStyle(0x2f7fe0, 0x2f7fe0, 0x9fd6ff, 0x9fd6ff, 1);
    nebo.fillRect(0, 0, SIRINA, RAZINA_MORA);

    // Oblaci (pomiču se sporije od mula – izgleda kao dubina, kao u Mariju)
    napraviOblak(this);
    for (let i = 0; i < 14; i++) {
      this.add.image(150 + i * 420 + Math.random() * 150, 140 + Math.random() * 380, 'oblak')
        .setScrollFactor(0.4).setScale(0.8 + Math.random() * 0.6).setAlpha(0.95);
    }

    // More (vaša slika mora, ponavlja se)
    this.more = this.add.tileSprite(0, RAZINA_MORA, SIRINA, VISINA - RAZINA_MORA, 'more')
      .setOrigin(0, 0).setScrollFactor(0);

    // Staze: mul, more, brod, more, mul ...
    this.podloge = this.physics.add.staticGroup();
    let x = 0;
    x = this.dodajMul(x, SIRINA_MULA + 100); // početni mul je malo dulji
    BRODOVI.forEach(b => {
      x += MORE_IZMEDU;
      x = this.dodajBrod(x, b);
      x += MORE_IZMEDU;
      x = this.dodajMul(x, SIRINA_MULA);
    });
    this.krajX = x - 200; // kad lik dođe ovdje, prošao je sve brodove
    this.physics.world.setBounds(0, 0, x, VISINA + 400);
    this.physics.world.checkCollision.down = false;

    // Lik
    this.lik = this.physics.add.sprite(160, VRH_MULA - 10, 'lik-' + this.odabrani).setOrigin(0.5, 1);
    const s = VISINA_LIKA / this.lik.height;
    this.lik.setScale(s);
    this.lik.body.setSize(this.lik.width * 0.5, this.lik.height * 0.95);
    this.lik.body.setOffset(this.lik.width * 0.25, this.lik.height * 0.05);
    this.lik.setGravityY(GRAVITACIJA);
    this.lik.setDepth(10);
    this.physics.add.collider(this.lik, this.podloge, (l, p) => this.naPodlozi(p));

    // Kamera prati lika vodoravno
    this.cameras.main.setBounds(0, 0, x, VISINA);
    this.cameras.main.startFollow(this.lik, true, 1, 0, -170, 0);

    // Iznos gore lijevo
    this.tekstNovac = this.add.text(24, 24, '0 €', {
      fontFamily: FONT, fontSize: '64px', color: '#ffffff', stroke: '#0a3d91', strokeThickness: 8,
    }).setScrollFactor(0).setDepth(100);

    // Upute na početku
    this.uputa = this.add.text(SIRINA / 2, 300, 'TAPNI ZA START\n\nTAP ili RAZMAKNICA\n= SKOK', {
      fontFamily: FONT, fontSize: '52px', color: '#ffffff', align: 'center', stroke: '#0a3d91', strokeThickness: 8, lineSpacing: 16,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    // Kontrole
    this.input.on('pointerdown', () => this.skoci());
    this.input.keyboard.on('keydown-SPACE', () => this.skoci());
    this.input.keyboard.on('keydown-UP', () => this.skoci());
  }

  dodajMul(x, sirina) {
    // gornja ploha + zid mula do dna ekrana
    this.add.tileSprite(x, VRH_MULA, sirina, VISINA - VRH_MULA, 'mul').setOrigin(0, 0).setDepth(2);
    // palma na mulu (iza lika)
    const palma = this.add.image(x + 70, VRH_MULA + 6, 'palma').setOrigin(0.15, 1).setDepth(1);
    palma.setScale(300 / palma.height);
    this.tweens.add({ targets: palma, angle: 2, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const p = this.add.zone(x + sirina / 2, VRH_MULA + 10, sirina, 20);
    this.podloge.add(p);
    p.vrsta = 'mul';
    return x + sirina;
  }

  dodajBrod(x, b) {
    const slika = this.add.image(x, RAZINA_MORA + 12, b.kljuc).setOrigin(0, 1).setDepth(3);
    slika.setScale(SIRINA_BRODA / slika.width);
    const visina = slika.displayHeight;
    const palubaY = RAZINA_MORA + 12 - visina * (1 - b.palubaPosto);
    // lagano ljuljanje broda
    this.tweens.add({ targets: slika, y: slika.y + 5, duration: 1400 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // podloga po kojoj lik hoda (samo odozgo)
    const p = this.add.zone(x + SIRINA_BRODA / 2, palubaY + 10, SIRINA_BRODA * 0.92, 20);
    this.podloge.add(p);
    p.body.checkCollision.down = false; p.body.checkCollision.left = false; p.body.checkCollision.right = false;
    p.vrsta = 'brod';
    p.brod = b;
    p.naplaceno = false;
    return x + SIRINA_BRODA;
  }

  naPodlozi(p) {
    if (p.vrsta === 'brod' && !p.naplaceno) {
      p.naplaceno = true;
      this.novac += p.brod.novac;
      this.tekstNovac.setText(this.novac + ' €');
      Zvuk.novac();
      this.tweens.add({ targets: this.tekstNovac, scale: 1.25, duration: 120, yoyo: true });
      this.prikaziPlus('+' + p.brod.novac + ' €  ' + p.brod.ime);
    }
  }

  prikaziPlus(tekst) {
    const t = this.add.text(this.lik.x, this.lik.y - VISINA_LIKA - 20, tekst, {
      fontFamily: FONT, fontSize: '40px', color: '#ffe14d', stroke: '#0a3d91', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: t.y - 110, alpha: 0, duration: 1300, onComplete: () => t.destroy() });
  }

  skoci() {
    if (this.gotovo) return;
    Zvuk.ukljuci();
    // prvi tap samo pokrene trčanje
    if (!this.krenuo) { this.krenuo = true; this.uputa.destroy(); return; }
    const b = this.lik.body;
    if ((b.blocked.down || b.touching.down) && b.velocity.y >= 0) {
      this.lik.setVelocityY(-SNAGA_SKOKA);
      Zvuk.skok();
    }
  }

  update() {
    this.more.tilePositionX = this.cameras.main.scrollX;
    if (this.gotovo) return;
    this.lik.setVelocityX(this.krenuo ? BRZINA_TRCANJA : 0);

    // njihanje dok trči (kao hodanje u Mariju), ravno dok je u zraku
    const naTlu = this.lik.body.touching.down || this.lik.body.blocked.down;
    this.lik.angle = (this.krenuo && naTlu) ? Math.sin(this.time.now / 70) * 5 : 0;

    if (this.lik.y > RAZINA_MORA + 60) this.kraj(false);       // pao u more
    else if (this.lik.x > this.krajX) this.kraj(true);         // prošao sve brodove
  }

  kraj(prosao) {
    this.gotovo = true;
    if (this.uputa.active) this.uputa.destroy();
    this.lik.setVelocity(0, prosao ? 0 : 200);
    this.lik.setGravityY(prosao ? 0 : 300);
    this.lik.angle = 0;
    if (prosao) {
      this.lik.body.setAllowGravity(false);
      Zvuk.pobjeda();
    } else {
      this.pljusak(this.lik.x);
      Zvuk.pljus();
      Zvuk.kraj();
    }
    let rekord = citajRekord();
    if (this.novac > rekord) { rekord = this.novac; spremiRekord(rekord); }
    this.time.delayedCall(prosao ? 300 : 700, () => this.prikaziKraj(prosao, rekord));
  }

  // kapljice vode kad lik padne u more
  pljusak(x) {
    for (let i = 0; i < 16; i++) {
      const k = this.add.rectangle(x + (Math.random() - 0.5) * 60, RAZINA_MORA, 12, 12, i % 3 ? 0xffffff : 0x9fd6ff).setDepth(20);
      this.tweens.add({
        targets: k, x: k.x + (Math.random() - 0.5) * 260, y: RAZINA_MORA - 80 - Math.random() * 160,
        duration: 350, ease: 'Quad.out', yoyo: true, onComplete: () => k.destroy(),
      });
    }
  }

  prikaziKraj(prosao, rekord) {
    const cx = SIRINA / 2;
    const sloj = this.add.container(0, 0).setScrollFactor(0).setDepth(200);
    sloj.add(this.add.rectangle(0, 0, SIRINA, VISINA, 0x0a3d91, 0.55).setOrigin(0));
    sloj.add(this.add.rectangle(cx, 640, 640, 900, 0xffffff).setStrokeStyle(10, 0x0a3d91));

    const t = (y, tekst, vel, boja = '#0a3d91') => {
      const o = this.add.text(cx, y, tekst, {
        fontFamily: FONT, fontSize: Math.round(vel * 1.5) + 'px', color: boja, align: 'center', lineSpacing: 12,
        wordWrap: { width: 560 },
      }).setOrigin(0.5);
      sloj.add(o);
      return o;
    };

    t(270, prosao ? 'SVI BRODOVI\nPREĐENI!' : 'PAO SI\nU MORE!', 36);
    t(400, 'Osvojeno: ' + this.novac + ' €', 26);
    t(450, 'Najbolji: ' + rekord + ' €', 22, '#3a6fc4');

    // Značka / poruka
    const n = this.novac;
    if (n >= BRONCA) {
      const [medalja, ime] = n >= ZLATO ? ['zlatna', 'ZLATNI AGENT'] : n >= SREBRO ? ['srebrna', 'SREBRNI AGENT'] : ['broncana', 'BRONČANI AGENT'];
      const m = this.add.image(cx, 590, 'medalja-' + medalja);
      m.setScale(190 / m.height);
      sloj.add(m);
      // medalja "iskoči" i lagano se njiše
      const s = m.scale;
      m.setScale(0);
      this.tweens.add({ targets: m, scale: s, duration: 450, ease: 'Back.out' });
      this.tweens.add({ targets: m, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      t(710, ime, 30);
      if (n >= ZLATO) t(790, 'OPERACIJSKI MENADŽER\nZA PODRUČJE SPLITA', 20, '#3a6fc4');
    } else {
      t(640, 'LUČKA UPRAVA SPLIT NE ODOBRAVA PRISTUP ZA ISPIT POLAGANJA ZA ZVANJE POMORSKOG AGENTA.\n\nOSTAJEŠ OFFICE SUPPORT.', 20);
    }

    // Gumb Ponovi
    const gumb = this.add.rectangle(cx, 950, 380, 110, 0x0a3d91).setStrokeStyle(6, 0xffffff).setInteractive({ useHandCursor: true });
    const gt = this.add.text(cx, 950, 'PONOVI', { fontFamily: FONT, fontSize: '56px', color: '#ffffff' }).setOrigin(0.5);
    sloj.add([gumb, gt]);
    const ponovi = () => this.scene.restart({ lik: this.odabrani });
    gumb.on('pointerdown', (p, lx, ly, e) => { e && e.stopPropagation && e.stopPropagation(); ponovi(); });
    this.input.keyboard.once('keydown-ENTER', ponovi);
    this.time.delayedCall(400, () => this.input.keyboard.once('keydown-SPACE', ponovi));
  }
}

// ---------- POKRETANJE ----------
function pokreni() {
  window.igra = new Phaser.Game({
    // Kad se igra otvori dvoklikom (file://), WebGL ne smije čitati slike pa koristimo Canvas
    type: location.protocol === 'file:' ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'igra',
    width: SIRINA,
    height: VISINA,
    backgroundColor: '#2f7fe0',
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    loader: { imageLoadType: 'HTMLImageElement' },
    scene: [Ucitavanje, Pocetak, Odabir, Igra],
  });
  const osvjezi = () => window.igra.scale.refresh();
  window.addEventListener('resize', osvjezi);
  window.addEventListener('orientationchange', () => setTimeout(osvjezi, 300));
}
// pričekaj retro font (najviše 2 sekunde) pa pokreni
Promise.race([
  document.fonts ? document.fonts.load('20px "VT323"') : Promise.resolve(),
  new Promise(r => setTimeout(r, 2000)),
]).then(pokreni, pokreni);
