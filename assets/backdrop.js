(function () {
  var WRAPPER_ID = "site-backdrop";
  var PURPLE_DARK = [0x22, 0x00, 0x55];
  var PURPLE_LIGHT = [0xe0, 0x55, 0xa8];
  var NUM_SPECIES = 5;
  var INTERACT_R = 62;
  var INTERACT_R2 = INTERACT_R * INTERACT_R;
  var HASH_CELL = 52;
  var FORCE = 0.088;
  var SPRING = 0.062;
  var MAX_DRIFT = 0.52;
  var DAMP = 0.991;
  var MAX_SPEED = 2.35;
  var ORBIT_R2 = 300 * 300;
  var ORBIT_MIN2 = 24 * 24;
  var ORBIT_STR = 2.9;
  var INJECT_N = 28;
  var DARKEN_RADIUS = 220;
  var DARKEN_POWER = 1.45;
  var DARKEN_RGB_MIX = 0.72;
  var DARKEN_ALPHA_BOOST = 0.42;
  var DOT_R_BASE = 1.35;
  var DOT_R_BOOST = 0.58;
  var DOT_R_PURPLE = 0.42;
  var PURPLE_PULSE_MS = 6200;
  var PURPLE_CLICK_CHAIN_MS = 820;
  var VIB_TIME = 0.021;
  var VIB_AMP = 3.25;
  var DOT_R_COMBO_STEP = 0.036;
  var DOT_R_COMBO_MAX = 0.5;

  var SPECIES_RGBA = [
    [22, 22, 22, 0.4],
    [95, 58, 78, 0.36],
    [48, 72, 98, 0.34],
    [72, 88, 52, 0.32],
    [105, 72, 48, 0.32],
  ];

  var MATRIX = [
    [-0.62, 0.38, -0.22, 0.28, -0.18],
    [0.38, -0.58, 0.32, -0.26, 0.34],
    [-0.22, 0.32, -0.55, 0.24, -0.36],
    [0.28, -0.26, 0.24, -0.52, 0.2],
    [-0.18, 0.34, -0.36, 0.2, -0.48],
  ];

  var wrapper;
  var canvas;
  var ctx;
  var dpr = 1;
  var wCss = 0;
  var hCss = 0;
  var pitch = 24;
  var particles;
  var gx;
  var gy;
  var bucketHeads;
  var nextIdx;
  var mx = NaN;
  var my = NaN;
  var injectSpecies = 0;
  var paused = false;
  var reducedMotion = false;
  var rafId = 0;
  var resizeTimer;
  var purplePulses = [];
  var clickCombo = 0;
  var lastClickAt = 0;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function hash32(ix, iy) {
    var h = ix * 374761393 + iy * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function seedLattice() {
    var target = 190;
    var area = wCss * hCss;
    pitch = Math.sqrt(area / target);
    pitch = Math.max(20, Math.min(34, pitch));

    var padX = pitch * 0.55;
    var padY = pitch * 0.55;
    var cols = Math.max(6, Math.floor((wCss - 2 * padX) / pitch) + 1);
    var rows = Math.max(6, Math.floor((hCss - 2 * padY) / pitch) + 1);
    var spanX = (cols - 1) * pitch;
    var spanY = (rows - 1) * pitch;
    var ox = (wCss - spanX) * 0.5;
    var oy = (hCss - spanY) * 0.5;

    particles = [];
    var iy;
    var ix;
    var hx;
    var hy;
    var h;
    for (iy = 0; iy < rows; iy++) {
      for (ix = 0; ix < cols; ix++) {
        hx = ox + ix * pitch;
        hy = oy + iy * pitch;
        h = hash32(ix, iy);
        particles.push({
          hx: hx,
          hy: hy,
          x: hx,
          y: hy,
          vx: 0,
          vy: 0,
          sp: h % NUM_SPECIES,
        });
      }
    }
  }

  function pageBgFill() {
    var raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--page-bg")
      .trim();
    return raw || "#f2f0eb";
  }

  function cursorSpot(p) {
    if (!Number.isFinite(mx)) return 0;
    var dx = p.x - mx;
    var dy = p.y - my;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d >= DARKEN_RADIUS) return 0;
    return Math.pow(1 - d / DARKEN_RADIUS, DARKEN_POWER);
  }

  function tickPurple(now) {
    if (reducedMotion) return;
    purplePulses = purplePulses.filter(function (pul) {
      return now - pul.t0 < PURPLE_PULSE_MS;
    });
    if (now - lastClickAt > 1400) {
      clickCombo *= 0.988;
      if (clickCombo < 0.08) clickCombo = 0;
    }
  }

  function registerPurpleClick(cx, cy, now) {
    if (reducedMotion) return;
    if (now - lastClickAt < PURPLE_CLICK_CHAIN_MS) {
      clickCombo = Math.min(16, clickCombo + 1);
    } else {
      clickCombo = 1;
    }
    lastClickAt = now;
    purplePulses.push({ x: cx, y: cy, t0: now, combo: clickCombo });
  }

  function purpleAt(px, py, now) {
    var heat = 0;
    var edgeBlend = 0;
    var wSum = 0;
    var k;
    var pul;
    var dx;
    var dy;
    var d;
    var R;
    var u;
    var fall;
    var age;
    var w;
    for (k = 0; k < purplePulses.length; k++) {
      pul = purplePulses[k];
      dx = px - pul.x;
      dy = py - pul.y;
      d = Math.sqrt(dx * dx + dy * dy);
      R = 175 + pul.combo * 16;
      if (d >= R) continue;
      u = d / R;
      fall =
        Math.pow(1 - u, 1.55) * (0.32 + pul.combo * 0.065);
      age = 1 - (now - pul.t0) / PURPLE_PULSE_MS;
      if (age < 0) age = 0;
      w = fall * (0.35 + 0.65 * age);
      heat += w;
      edgeBlend += u * w;
      wSum += w;
    }
    heat = Math.min(1.35, heat);
    if (wSum > 1e-6) edgeBlend /= wSum;
    else edgeBlend = 0;
    var comboBoost = 0.38 + 0.62 * Math.min(1, clickCombo / 12);
    return {
      heat: Math.min(1, heat) * comboBoost,
      edge: edgeBlend,
    };
  }

  function dotFillStyle(p, spot, pa) {
    if (spot === undefined) spot = cursorSpot(p);
    var base = SPECIES_RGBA[p.sp];
    var t = spot * DARKEN_RGB_MIX;
    var dk = 10;
    var r = base[0] * (1 - t) + dk * t;
    var g = base[1] * (1 - t) + dk * t;
    var b = base[2] * (1 - t) + dk * t;
    var a = Math.min(0.92, base[3] + spot * DARKEN_ALPHA_BOOST);

    if (pa && pa.heat > 0.004) {
      var pe = pa.edge;
      var pr = PURPLE_LIGHT[0] * (1 - pe) + PURPLE_DARK[0] * pe;
      var pg = PURPLE_LIGHT[1] * (1 - pe) + PURPLE_DARK[1] * pe;
      var pb = PURPLE_LIGHT[2] * (1 - pe) + PURPLE_DARK[2] * pe;
      var purpleMix =
        pa.heat * (0.48 + 0.38 * Math.min(1, clickCombo / 12));
      purpleMix = Math.min(0.88, purpleMix);
      r = r * (1 - purpleMix) + pr * purpleMix;
      g = g * (1 - purpleMix) + pg * purpleMix;
      b = b * (1 - purpleMix) + pb * purpleMix;
      a = Math.min(0.95, a + pa.heat * 0.28);
    }

    return (
      "rgba(" +
      (r | 0) +
      "," +
      (g | 0) +
      "," +
      (b | 0) +
      "," +
      a.toFixed(3) +
      ")"
    );
  }

  function readingColumnBand() {
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var inner = Math.min(42 * rem, wCss);
    var bleed = 14;
    var left = (wCss - inner) / 2 - bleed;
    var right = (wCss + inner) / 2 + bleed;
    left = Math.max(0, left);
    right = Math.min(wCss, right);
    return { left: left, width: right - left };
  }

  function buildGrid() {
    var i;
    var n = particles.length;
    if (nextIdx.length < n) {
      nextIdx = new Int32Array(n + 256);
    }
    var len = gx * gy;
    for (i = 0; i < len; i++) {
      bucketHeads[i] = -1;
    }
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      var cx = (p.x / HASH_CELL) | 0;
      var cy = (p.y / HASH_CELL) | 0;
      if (cx < 0) cx = 0;
      if (cy < 0) cy = 0;
      if (cx >= gx) cx = gx - 1;
      if (cy >= gy) cy = gy - 1;
      var ci = cy * gx + cx;
      nextIdx[i] = bucketHeads[ci];
      bucketHeads[ci] = i;
    }
  }

  function interact() {
    var n = particles.length;
    var i;
    var j;
    var pi;
    var pj;
    var dx;
    var dy;
    var d2;
    var d;
    var t;
    var wgt;
    var str;
    var ny;
    var nx;
    var head;
    var cx;
    var cy;
    var ci;
    var maxDrift = pitch * MAX_DRIFT;

    for (i = 0; i < n; i++) {
      pi = particles[i];
      var fx = 0;
      var fy = 0;
      cx = (pi.x / HASH_CELL) | 0;
      cy = (pi.y / HASH_CELL) | 0;
      if (cx < 0) cx = 0;
      if (cy < 0) cy = 0;
      if (cx >= gx) cx = gx - 1;
      if (cy >= gy) cy = gy - 1;
      for (ny = -1; ny <= 1; ny++) {
        for (nx = -1; nx <= 1; nx++) {
          ci = cy + ny;
          if (ci < 0 || ci >= gy) continue;
          var cj = cx + nx;
          if (cj < 0 || cj >= gx) continue;
          head = bucketHeads[ci * gx + cj];
          while (head >= 0) {
            j = head;
            head = nextIdx[head];
            if (j === i) continue;
            pj = particles[j];
            dx = pj.x - pi.x;
            dy = pj.y - pi.y;
            d2 = dx * dx + dy * dy;
            if (d2 < 0.5 || d2 > INTERACT_R2) continue;
            d = Math.sqrt(d2);
            t = 1 - d / INTERACT_R;
            wgt = t * t;
            str = MATRIX[pi.sp][pj.sp] * FORCE * wgt;
            fx += (dx / d) * str;
            fy += (dy / d) * str;
          }
        }
      }

      fx += (pi.hx - pi.x) * SPRING;
      fy += (pi.hy - pi.y) * SPRING;

      if (Number.isFinite(mx)) {
        dx = mx - pi.x;
        dy = my - pi.y;
        d2 = dx * dx + dy * dy;
        if (d2 < ORBIT_R2 && d2 > ORBIT_MIN2) {
          d = Math.sqrt(d2);
          fx += (-dy / d) * (ORBIT_STR / d);
          fy += (dx / d) * (ORBIT_STR / d);
        }
      }

      pi.vx += fx;
      pi.vy += fy;
      pi.vx *= DAMP;
      pi.vy *= DAMP;
      var sp = Math.sqrt(pi.vx * pi.vx + pi.vy * pi.vy);
      if (sp > MAX_SPEED) {
        pi.vx = (pi.vx / sp) * MAX_SPEED;
        pi.vy = (pi.vy / sp) * MAX_SPEED;
      }
    }

    for (i = 0; i < n; i++) {
      pi = particles[i];
      pi.x += pi.vx;
      pi.y += pi.vy;
      dx = pi.x - pi.hx;
      dy = pi.y - pi.hy;
      d2 = dx * dx + dy * dy;
      if (d2 > maxDrift * maxDrift) {
        d = Math.sqrt(d2);
        pi.x = pi.hx + (dx / d) * maxDrift;
        pi.y = pi.hy + (dy / d) * maxDrift;
        var nd = dx / d;
        var ne = dy / d;
        var vn = pi.vx * nd + pi.vy * ne;
        if (vn > 0) {
          pi.vx -= vn * nd * 0.85;
          pi.vy -= vn * ne * 0.85;
        }
      }
    }
  }

  function draw() {
    if (!ctx) return;
    var now = performance.now();
    tickPurple(now);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = pageBgFill();
    ctx.fillRect(0, 0, wCss, hCss);
    var i;
    var p;
    var spot;
    var rad;
    var pa;
    var vib;
    var tt;
    var ox;
    var oy;
    var drawX;
    var drawY;
    var comboR;
    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      spot = cursorSpot(p);
      pa = purpleAt(p.x, p.y, now);
      comboR = Math.min(DOT_R_COMBO_MAX, clickCombo * DOT_R_COMBO_STEP);
      rad =
        DOT_R_BASE +
        spot * DOT_R_BOOST +
        pa.heat * DOT_R_PURPLE +
        comboR;
      ctx.fillStyle = dotFillStyle(p, spot, pa);
      tt = now * VIB_TIME;
      vib = reducedMotion
        ? 0
        : pa.heat * (1.15 + Math.min(clickCombo, 12) * 0.14) * VIB_AMP;
      ox =
        Math.sin(tt + p.hx * 0.11) *
        Math.cos(tt * 0.73 + p.hy * 0.09) *
        vib;
      oy =
        Math.cos(tt * 0.88 + p.hx * 0.07) *
        Math.sin(tt * 0.55 + p.hy * 0.12) *
        vib;
      drawX = p.x + ox;
      drawY = p.y + oy;
      ctx.beginPath();
      ctx.arc(
        Math.round(drawX * 2) / 2,
        Math.round(drawY * 2) / 2,
        rad,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    var band = readingColumnBand();
    ctx.fillStyle = pageBgFill();
    ctx.globalAlpha = 1;
    ctx.fillRect(band.left, 0, band.width, hCss);
  }

  function inject(cx, cy) {
    var sp = injectSpecies % NUM_SPECIES;
    injectSpecies++;
    var scored = particles
      .map(function (p, idx) {
        var ddx = p.hx - cx;
        var ddy = p.hy - cy;
        return { idx: idx, d: ddx * ddx + ddy * ddy };
      })
      .sort(function (a, b) {
        return a.d - b.d;
      });
    var k;
    var p;
    var ang;
    for (k = 0; k < INJECT_N && k < scored.length; k++) {
      p = particles[scored[k].idx];
      p.sp = sp;
      ang = Math.random() * Math.PI * 2;
      p.vx += Math.cos(ang) * 1.15;
      p.vy += Math.sin(ang) * 1.15;
    }
  }

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    wCss = window.innerWidth;
    hCss = window.innerHeight;
    gx = Math.ceil(wCss / HASH_CELL) + 1;
    gy = Math.ceil(hCss / HASH_CELL) + 1;
    var blen = gx * gy;
    bucketHeads = new Int32Array(blen);
    bucketHeads.fill(-1);

    canvas.width = Math.round(wCss * dpr);
    canvas.height = Math.round(hCss * dpr);
    canvas.style.width = wCss + "px";
    canvas.style.height = hCss + "px";
    ctx = canvas.getContext("2d", { alpha: false });

    seedLattice();
    nextIdx = new Int32Array(Math.max(particles.length + 400, 800));
    purplePulses = [];
    clickCombo = 0;
    lastClickAt = 0;
    draw();
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    if (reducedMotion) return;
    if (!paused) {
      buildGrid();
      interact();
    }
    draw();
  }

  function staticSettle() {
    var s;
    for (s = 0; s < 420; s++) {
      buildGrid();
      interact();
    }
    draw();
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      layout();
    }, 120);
  }

  function isTypingTarget(el) {
    if (!el || !el.tagName) return false;
    var t = el.tagName.toLowerCase();
    if (t === "input" || t === "textarea" || t === "select") return true;
    return el.isContentEditable;
  }

  function mount() {
    reducedMotion = prefersReducedMotion();

    wrapper = document.createElement("div");
    wrapper.id = WRAPPER_ID;
    wrapper.setAttribute("aria-hidden", "true");

    canvas = document.createElement("canvas");
    canvas.className = "backdrop-particles";
    canvas.setAttribute("role", "presentation");

    var veil = document.createElement("div");
    veil.className = "backdrop-veil";

    wrapper.appendChild(canvas);
    wrapper.appendChild(veil);
    document.body.insertBefore(wrapper, document.body.firstChild);

    layout();

    if (reducedMotion) {
      staticSettle();
    } else {
      rafId = requestAnimationFrame(loop);
    }

    window.addEventListener("resize", onResize);

    function setPointerCanvas(clientX, clientY) {
      var r = canvas.getBoundingClientRect();
      mx = clientX - r.left;
      my = clientY - r.top;
    }

    window.addEventListener(
      "mousemove",
      function (e) {
        setPointerCanvas(e.clientX, e.clientY);
      },
      { passive: true }
    );
    window.addEventListener(
      "touchmove",
      function (e) {
        if (e.touches.length) {
          setPointerCanvas(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );
    window.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches.length) {
          setPointerCanvas(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );
    window.addEventListener("touchend", function () {
      mx = NaN;
      my = NaN;
    });

    canvas.addEventListener("click", function (e) {
      var rect = canvas.getBoundingClientRect();
      var cx = e.clientX - rect.left;
      var cy = e.clientY - rect.top;
      inject(cx, cy);
      registerPurpleClick(cx, cy, performance.now());
      draw();
    });

    window.addEventListener("keydown", function (e) {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      paused = !paused;
    });

    window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .addEventListener("change", function (e) {
        reducedMotion = e.matches;
        cancelAnimationFrame(rafId);
        rafId = 0;
        if (reducedMotion) {
          staticSettle();
        } else {
          paused = false;
          rafId = requestAnimationFrame(loop);
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
