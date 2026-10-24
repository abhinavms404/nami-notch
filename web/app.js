// src/core/anim.ts
var Ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: (t) => {
    const c1 = 1.7;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  lin: (t) => t,
  easeIn: (t) => t * t * t
};
var lerp = (a, b, t) => a + (b - a) * t;
function cubicBezier(x1, y1, x2, y2) {
  const cx = (t) => (1 - t) ** 2 * 3 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
  const cy = (t) => (1 - t) ** 2 * 3 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
  return (x) => {
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 12; i++) {
      const v = cx(t);
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return cy(t);
  };
}
var closeCurve = cubicBezier(0.45, 0, 0.2, 1);

// src/core/sound.ts
var Sound = {
  play(_name) {
  }
};

// src/nami/outfits.ts
var EXP = 2.7;
var VIEW_TILT = -0.3;
var ACC_PITCH = 0.4;
var EYE_W = 0.25;
var EYE_H = 0.27;
var EYE_SP = 0.37;
var EYE_P = -0.12;
var SIMPLIFY_BELOW_R = 16;
function makeHead(R, yaw = 0, pitch = 0, physDx = 0, physDy = 0) {
  return {
    R,
    rx: R * 1.14,
    ry: R * 0.88,
    yaw,
    pitch,
    physDx,
    physDy
  };
}
function ringR(y) {
  const a = Math.min(1, Math.abs(y));
  return Math.pow(1 - Math.pow(a, EXP), 1 / EXP);
}
function proj(H, p) {
  const [x, y, z] = p;
  const cy = Math.cos(H.yaw);
  const sy = Math.sin(H.yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const pitch = VIEW_TILT + H.pitch * ACC_PITCH;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y2 = y * cp + z1 * sp;
  const z2 = -y * sp + z1 * cp;
  return {
    x: x1 * H.rx,
    y: -y2 * H.ry,
    z: z2
  };
}
function surf(y, lon, s = 1) {
  const r = ringR(y) * s;
  return [
    r * Math.sin(lon),
    y,
    r * Math.cos(lon)
  ];
}
function frontSilhouette(pts) {
  const n = pts.length;
  if (n < 2) return pts;
  let minI = 0;
  let maxI = 0;
  for (let i = 1; i < n; i++) {
    if (pts[i].x < pts[minI].x) minI = i;
    if (pts[i].x > pts[maxI].x) maxI = i;
  }
  if (minI === maxI) return [
    pts[minI]
  ];
  const walk = (step) => {
    const out = [];
    let i = minI;
    for (; ; ) {
      out.push(pts[i]);
      if (i === maxI || out.length > n) break;
      i = (i + step + n) % n;
    }
    return out;
  };
  const a = walk(1);
  const b = walk(-1);
  const za = a.reduce((s, q) => s + q.z, 0) / a.length;
  const zb = b.reduce((s, q) => s + q.z, 0) / b.length;
  return za >= zb ? a : b;
}
function ring(H, y, s, n = 120) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(proj(H, surf(y, -Math.PI + i / n * 2 * Math.PI, s)));
  return pts;
}
function frontArc(H, y, s) {
  return frontSilhouette(ring(H, y, s));
}
function capClip(H, y, s, extraTop = 3) {
  const arc = frontArc(H, y, s);
  const p = new Path2D();
  if (arc.length === 0) return p;
  p.moveTo(arc[0].x - H.rx, arc[0].y);
  for (const q of arc) p.lineTo(q.x, q.y);
  const last = arc[arc.length - 1];
  p.lineTo(last.x + H.rx, last.y);
  p.lineTo(H.rx * 2, -H.ry * extraTop);
  p.lineTo(-H.rx * 2, -H.ry * extraTop);
  p.closePath();
  return p;
}
function invert(p, H) {
  const q = new Path2D();
  q.rect(-H.rx * 4, -H.ry * 4, H.rx * 8, H.ry * 8);
  q.addPath(p);
  return q;
}
function fillAll(ctx2, H) {
  ctx2.fillRect(-H.rx * 4, -H.ry * 4, H.rx * 8, H.ry * 8);
}
function bodyOutline(rx, ry) {
  const p = new Path2D();
  const n = 96;
  const e = 2 / EXP;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const x = rx * Math.sign(ca) * Math.pow(Math.abs(ca), e);
    const y = ry * Math.sign(sa) * Math.pow(Math.abs(sa), e);
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}
function lin(ctx2, x0, y0, x1, y1, stops) {
  const g = ctx2.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function rad(ctx2, x, y, r0, r1, stops) {
  const g = ctx2.createRadialGradient(x, y, r0, x, y, Math.max(1e-3, r1));
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function polyline(ctx2, pts) {
  ctx2.beginPath();
  pts.forEach((q, i) => i ? ctx2.lineTo(q.x, q.y) : ctx2.moveTo(q.x, q.y));
}
function roundRect(ctx2, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx2.beginPath();
  ctx2.moveTo(x + rr, y);
  ctx2.arcTo(x + w, y, x + w, y + h, rr);
  ctx2.arcTo(x + w, y + h, x, y + h, rr);
  ctx2.arcTo(x, y + h, x, y, rr);
  ctx2.arcTo(x, y, x + w, y, rr);
  ctx2.closePath();
}
function eyeFrames(H) {
  return [
    -1,
    1
  ].map((sd) => {
    const eyeYaw = sd * EYE_SP + H.yaw;
    const eyePitch = EYE_P + H.pitch;
    const cp = Math.cos(eyePitch);
    return {
      sd,
      visible: Math.cos(eyeYaw) * cp > 0.04,
      x: Math.sin(eyeYaw) * cp * H.rx,
      y: -Math.sin(eyePitch) * H.ry,
      fx: Math.max(0.18, Math.cos(eyeYaw)),
      fy: Math.max(0.18, cp),
      w: H.R * EYE_W,
      h: H.R * EYE_H
    };
  });
}
function pompom(ctx2, x, y, r, base2 = "#FFFFFF", shade = "#D5D9E2") {
  ctx2.save();
  ctx2.translate(x, y);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const br = r * (0.34 + 0.06 * Math.sin(i * 2.3));
    const bx = Math.cos(a) * r * 0.78;
    const by = Math.sin(a) * r * 0.78;
    ctx2.fillStyle = rad(ctx2, bx - br * 0.4, by - br * 0.5, 0, br * 1.3, [
      [
        0,
        base2
      ],
      [
        1,
        shade
      ]
    ]);
    ctx2.beginPath();
    ctx2.arc(bx, by, br, 0, Math.PI * 2);
    ctx2.fill();
  }
  ctx2.fillStyle = rad(ctx2, -r * 0.3, -r * 0.35, 0, r * 1.05, [
    [
      0,
      base2
    ],
    [
      0.7,
      base2
    ],
    [
      1,
      shade
    ]
  ]);
  ctx2.beginPath();
  ctx2.arc(0, 0, r * 0.86, 0, Math.PI * 2);
  ctx2.fill();
  ctx2.restore();
}
function fuzzyBand(ctx2, arc, thick, base2 = "#FFFFFF", shade = "#DADDE4") {
  if (arc.length < 2) return;
  ctx2.save();
  ctx2.lineJoin = "round";
  ctx2.lineCap = "round";
  polyline(ctx2, arc);
  ctx2.strokeStyle = shade;
  ctx2.lineWidth = thick;
  ctx2.stroke();
  polyline(ctx2, arc);
  ctx2.strokeStyle = base2;
  ctx2.lineWidth = thick * 0.78;
  ctx2.stroke();
  const step = Math.max(2, Math.floor(arc.length / 16));
  for (let i = 0; i < arc.length; i += step) {
    const q = arc[i];
    const r = thick * (0.32 + 0.1 * Math.sin(i * 1.7));
    ctx2.fillStyle = rad(ctx2, q.x - r * 0.3, q.y - thick * 0.35 - r * 0.3, 0, r * 1.2, [
      [
        0,
        base2
      ],
      [
        1,
        shade
      ]
    ]);
    ctx2.beginPath();
    ctx2.arc(q.x, q.y - thick * 0.32, r, 0, Math.PI * 2);
    ctx2.fill();
  }
  ctx2.restore();
}
function beanie(ctx2, H, body, simple) {
  const s = 1.035;
  const yEdge = 0.42;
  const yCuff = 0.58;
  const head = bodyOutline(H.rx * s, H.ry * s);
  ctx2.save();
  ctx2.clip(body);
  ctx2.clip(capClip(H, yEdge - 0.12, 1));
  ctx2.fillStyle = "rgba(30,40,70,0.10)";
  fillAll(ctx2, H);
  ctx2.restore();
  ctx2.save();
  ctx2.clip(capClip(H, yCuff, s));
  ctx2.fillStyle = lin(ctx2, H.rx * 0.5, -H.ry * 1.1, -H.rx * 0.6, H.ry * 0.2, [
    [
      0,
      "#7DB6FF"
    ],
    [
      1,
      "#2F6FE0"
    ]
  ]);
  ctx2.fill(head);
  if (!simple) {
    ctx2.clip(head);
    ctx2.strokeStyle = "rgba(20,50,140,0.16)";
    ctx2.lineWidth = H.R * 0.045;
    ctx2.lineCap = "round";
    for (let k = -6; k <= 6; k++) {
      const lon = k * 0.24;
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const q = proj(H, surf(yCuff + (1.05 - yCuff) * i / 16, lon, s));
        if (q.z > 0) pts.push(q);
      }
      if (pts.length < 2) continue;
      polyline(ctx2, pts);
      ctx2.stroke();
    }
  }
  ctx2.restore();
  const cuffHead = bodyOutline(H.rx * s * 1.04, H.ry * s * 1.04);
  ctx2.save();
  ctx2.clip(capClip(H, yEdge, s * 1.04));
  ctx2.clip(invert(capClip(H, yCuff, s * 1.04), H), "evenodd");
  ctx2.fillStyle = lin(ctx2, 0, -H.ry * 0.6, 0, -H.ry * 0.2, [
    [
      0,
      "#3C7BEA"
    ],
    [
      1,
      "#2257C4"
    ]
  ]);
  ctx2.fill(cuffHead);
  ctx2.clip(cuffHead);
  ctx2.strokeStyle = "rgba(10,30,100,0.22)";
  ctx2.lineWidth = H.R * 0.035;
  for (let k = -14; k <= 14; k++) {
    const lon = k * 0.115;
    const a = proj(H, surf(yEdge, lon, s * 1.04));
    const b = proj(H, surf(yCuff, lon, s * 1.04));
    if (a.z < 0) continue;
    ctx2.beginPath();
    ctx2.moveTo(a.x, a.y);
    ctx2.lineTo(b.x, b.y);
    ctx2.stroke();
  }
  ctx2.restore();
  ctx2.save();
  ctx2.clip(capClip(H, yCuff, s));
  ctx2.clip(head);
  ctx2.fillStyle = rad(ctx2, H.rx * 0.3, -H.ry * 0.85, 0, H.R * 0.45, [
    [
      0,
      "rgba(255,255,255,0.35)"
    ],
    [
      1,
      "rgba(255,255,255,0)"
    ]
  ]);
  ctx2.fill(head);
  ctx2.restore();
  const top = proj(H, [
    0,
    1.08 * s,
    0
  ]);
  pompom(ctx2, top.x + H.physDx * H.rx * 0.25, top.y - H.R * 0.12 + H.physDy * H.ry * 0.15, H.R * 0.24);
}
function santaHat(ctx2, H, body) {
  const s = 1.05;
  const yEdge = 0.52;
  const arc = frontArc(H, yEdge, s);
  if (arc.length === 0) return;
  const L = arc[0];
  const Rt = arc[arc.length - 1];
  const crown = proj(H, [
    0,
    1.05,
    0
  ]);
  const tip = {
    x: crown.x + H.rx * (0.95 + H.physDx * 0.35),
    y: crown.y + H.ry * (0.05 + H.physDy * 0.2)
  };
  const peak = {
    x: crown.x + H.rx * 0.25,
    y: crown.y - H.ry * 0.62
  };
  const bag = new Path2D();
  bag.moveTo(L.x, L.y);
  bag.bezierCurveTo(L.x - H.rx * 0.05, L.y - H.ry * 0.7, peak.x - H.rx * 0.55, peak.y - H.ry * 0.05, peak.x, peak.y);
  bag.quadraticCurveTo(tip.x - H.rx * 0.05, peak.y - H.ry * 0.02, tip.x, tip.y);
  bag.quadraticCurveTo(tip.x - H.rx * 0.12, tip.y - H.ry * 0.22, peak.x + H.rx * 0.18, peak.y + H.ry * 0.32);
  bag.bezierCurveTo(Rt.x + H.rx * 0.05, peak.y + H.ry * 0.45, Rt.x + H.rx * 0.08, Rt.y - H.ry * 0.35, Rt.x, Rt.y);
  for (let i = arc.length - 1; i >= 0; i--) bag.lineTo(arc[i].x, arc[i].y);
  bag.closePath();
  ctx2.save();
  ctx2.clip(body);
  ctx2.clip(capClip(H, yEdge - 0.14, 1));
  ctx2.fillStyle = "rgba(120,10,10,0.10)";
  fillAll(ctx2, H);
  ctx2.restore();
  ctx2.fillStyle = lin(ctx2, -H.rx * 0.6, -H.ry * 1.6, H.rx * 0.7, -H.ry * 0.3, [
    [
      0,
      "#FF6B6B"
    ],
    [
      0.55,
      "#E53935"
    ],
    [
      1,
      "#B71C1C"
    ]
  ]);
  ctx2.fill(bag);
  ctx2.save();
  ctx2.clip(bag);
  ctx2.lineCap = "round";
  ctx2.strokeStyle = "rgba(90,0,0,0.20)";
  for (const [a, b, w] of [
    [
      0.15,
      0.55,
      0.1
    ],
    [
      0.45,
      0.85,
      0.08
    ]
  ]) {
    ctx2.beginPath();
    ctx2.moveTo(peak.x - H.rx * 0.1 + (Rt.x - L.x) * a * 0.3, peak.y + H.ry * 0.15);
    ctx2.quadraticCurveTo(peak.x + H.rx * 0.35, peak.y + H.ry * (0.05 + a * 0.3), tip.x - H.rx * (0.45 - b * 0.3), tip.y - H.ry * 0.12);
    ctx2.lineWidth = H.R * w;
    ctx2.stroke();
  }
  ctx2.fillStyle = rad(ctx2, peak.x - H.rx * 0.25, peak.y + H.ry * 0.05, 0, H.R * 0.5, [
    [
      0,
      "rgba(255,255,255,0.32)"
    ],
    [
      1,
      "rgba(255,255,255,0)"
    ]
  ]);
  ctx2.fill(bag);
  ctx2.restore();
  fuzzyBand(ctx2, arc, H.R * 0.3);
  pompom(ctx2, tip.x, tip.y + H.R * 0.04, H.R * 0.22);
}
function partyHat(ctx2, H, simple) {
  const baseY = 0.82;
  const baseR = 0.42;
  const lean = -0.24 + H.physDx * 0.12;
  const c = proj(H, [
    0.16,
    baseY + 0.06,
    0
  ]);
  const rim = [];
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * Math.PI * 2;
    rim.push(proj(H, [
      0.16 + baseR * Math.sin(a),
      baseY + 0.06,
      baseR * Math.cos(a)
    ]));
  }
  const left = rim.reduce((m, q) => q.x < m.x ? q : m);
  const right = rim.reduce((m, q) => q.x > m.x ? q : m);
  const h = H.ry * 1.6;
  const apex = {
    x: c.x + Math.sin(lean) * h,
    y: c.y - Math.cos(lean) * h
  };
  const front = frontSilhouette(rim);
  const cone = new Path2D();
  cone.moveTo(left.x, left.y);
  cone.quadraticCurveTo((left.x + apex.x) / 2 - H.rx * 0.06, (left.y + apex.y) / 2, apex.x - H.R * 0.05, apex.y + H.R * 0.06);
  cone.quadraticCurveTo(apex.x, apex.y - H.R * 0.03, apex.x + H.R * 0.05, apex.y + H.R * 0.06);
  cone.quadraticCurveTo((right.x + apex.x) / 2 + H.rx * 0.06, (right.y + apex.y) / 2, right.x, right.y);
  for (let i = front.length - 1; i >= 0; i--) cone.lineTo(front[i].x, front[i].y);
  cone.closePath();
  ctx2.fillStyle = lin(ctx2, left.x, apex.y, right.x, left.y, [
    [
      0,
      "#FF9BD0"
    ],
    [
      0.5,
      "#F15BAE"
    ],
    [
      1,
      "#C2187A"
    ]
  ]);
  ctx2.fill(cone);
  ctx2.save();
  ctx2.clip(cone);
  if (!simple) {
    ctx2.fillStyle = "rgba(255,255,255,0.92)";
    const dots = [
      [
        0.25,
        -0.35
      ],
      [
        0.3,
        0.3
      ],
      [
        0.55,
        -0.05
      ],
      [
        0.72,
        0.28
      ],
      [
        0.8,
        -0.3
      ],
      [
        0.45,
        0.6
      ],
      [
        0.48,
        -0.65
      ]
    ];
    for (const [t, u] of dots) {
      const bx = left.x + (right.x - left.x) * (0.5 + u * 0.5);
      const by = left.y + (right.y - left.y) * (0.5 + u * 0.5);
      const x = bx + (apex.x - bx) * (1 - t);
      const y = by + (apex.y - by) * (1 - t);
      const r = H.R * 0.075 * (0.6 + t * 0.5);
      ctx2.beginPath();
      ctx2.ellipse(x, y, r, r * 0.9, 0, 0, Math.PI * 2);
      ctx2.fill();
    }
  }
  ctx2.fillStyle = lin(ctx2, left.x, 0, right.x, 0, [
    [
      0,
      "rgba(255,255,255,0.28)"
    ],
    [
      0.35,
      "rgba(255,255,255,0)"
    ],
    [
      1,
      "rgba(80,0,40,0.18)"
    ]
  ]);
  ctx2.fill(cone);
  ctx2.restore();
  if (front.length > 1) {
    polyline(ctx2, front);
    ctx2.strokeStyle = "#FFD84D";
    ctx2.lineWidth = H.R * 0.07;
    ctx2.lineCap = "round";
    ctx2.stroke();
  }
  pompom(ctx2, apex.x, apex.y - H.R * 0.04, H.R * 0.16, "#FFE27A", "#F2B705");
}
var CROWN_YB = 0.46;
function crownPart(ctx2, H, side, simple) {
  const s = 1.06;
  const yb = CROWN_YB;
  const yt = 0.66;
  const n = 8;
  const spikeH = 0.42;
  const N = 120;
  const seg = [];
  for (let i = 0; i <= N; i++) {
    const lon = -Math.PI + i / N * 2 * Math.PI;
    const b = proj(H, surf(yb, lon, s));
    const phase = (lon + Math.PI) / (2 * Math.PI) * n;
    const f = phase - Math.floor(phase);
    const spike = Math.pow(Math.max(0, 1 - Math.abs(f - 0.5) * 2), 1.6);
    const sp = surf(yt, lon, s);
    const tt = proj(H, [
      sp[0] * (1 - 0.08 * spike),
      yt + spikeH * spike,
      sp[2] * (1 - 0.08 * spike)
    ]);
    seg.push({
      b,
      tt,
      z: b.z
    });
  }
  const keep = seg.filter((q) => side > 0 ? q.z >= 0 : q.z < 0.02);
  if (keep.length < 2) return;
  keep.sort((a, b) => a.b.x - b.b.x);
  const shape = new Path2D();
  keep.forEach((q, i) => i ? shape.lineTo(q.tt.x, q.tt.y) : shape.moveTo(q.tt.x, q.tt.y));
  for (let i = keep.length - 1; i >= 0; i--) shape.lineTo(keep[i].b.x, keep[i].b.y);
  shape.closePath();
  const dark = side < 0;
  ctx2.fillStyle = lin(ctx2, 0, -H.ry * 1.05, 0, -H.ry * 0.45, dark ? [
    [
      0,
      "#C98A12"
    ],
    [
      1,
      "#8A5A06"
    ]
  ] : [
    [
      0,
      "#FFE58A"
    ],
    [
      0.5,
      "#FBBF24"
    ],
    [
      1,
      "#D08A0B"
    ]
  ]);
  ctx2.fill(shape);
  if (dark) return;
  ctx2.save();
  ctx2.clip(shape);
  ctx2.fillStyle = lin(ctx2, -H.rx, 0, H.rx, 0, [
    [
      0,
      "rgba(120,70,0,0.25)"
    ],
    [
      0.45,
      "rgba(255,255,255,0)"
    ],
    [
      0.62,
      "rgba(255,255,255,0.35)"
    ],
    [
      1,
      "rgba(120,70,0,0.25)"
    ]
  ]);
  ctx2.fill(shape);
  ctx2.restore();
  if (simple) return;
  const gems = [
    "#EF4444",
    "#3B82F6",
    "#22C55E",
    "#A855F7"
  ];
  for (let k = 0; k < n; k++) {
    const lon = -Math.PI + (k + 0.5) / n * 2 * Math.PI;
    const sp = surf(yt, lon, s);
    const tipP = proj(H, [
      sp[0] * 0.92,
      yt + spikeH,
      sp[2] * 0.92
    ]);
    const mid = proj(H, surf((yb + yt) / 2, lon, s * 1.01));
    if (mid.z <= 0.12) continue;
    const r = H.R * 0.055;
    ctx2.beginPath();
    ctx2.arc(tipP.x, tipP.y - r * 0.5, r, 0, Math.PI * 2);
    ctx2.fillStyle = rad(ctx2, tipP.x - r * 0.3, tipP.y - r, 0, r * 1.2, [
      [
        0,
        "#FFF6CC"
      ],
      [
        1,
        "#E0A21A"
      ]
    ]);
    ctx2.fill();
    const gr = H.R * 0.075;
    ctx2.beginPath();
    ctx2.ellipse(mid.x, mid.y, gr * Math.max(0.35, mid.z), gr, 0, 0, Math.PI * 2);
    ctx2.fillStyle = gems[k % gems.length];
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(mid.x - gr * 0.25 * mid.z, mid.y - gr * 0.35, gr * 0.28, 0, Math.PI * 2);
    ctx2.fillStyle = "rgba(255,255,255,0.75)";
    ctx2.fill();
  }
}
function crownFront(ctx2, H, body, simple) {
  ctx2.save();
  ctx2.clip(body);
  ctx2.clip(capClip(H, CROWN_YB - 0.1, 1));
  ctx2.clip(invert(capClip(H, CROWN_YB, 1), H), "evenodd");
  ctx2.fillStyle = "rgba(80,50,0,0.12)";
  fillAll(ctx2, H);
  ctx2.restore();
  crownPart(ctx2, H, 1, simple);
}
function witchBrim(H) {
  const y = 0.7;
  const rr = 1.42;
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const a = -Math.PI + i / 120 * 2 * Math.PI;
    const wob = 1 + 0.035 * Math.sin(a * 3 + 0.6);
    const droop = -0.1 * Math.pow(Math.abs(Math.sin(a)), 2);
    pts.push(proj(H, [
      rr * wob * Math.sin(a),
      y + droop,
      rr * wob * Math.cos(a)
    ]));
  }
  return pts;
}
function closedPath(pts) {
  const p = new Path2D();
  pts.forEach((q, i) => i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y));
  p.closePath();
  return p;
}
function witchHatBack(ctx2, H) {
  ctx2.fillStyle = lin(ctx2, 0, -H.ry, 0, -H.ry * 0.4, [
    [
      0,
      "#2A0A4F"
    ],
    [
      1,
      "#3B0F6B"
    ]
  ]);
  ctx2.fill(closedPath(witchBrim(H)));
}
function witchHatFront(ctx2, H, body) {
  const all = witchBrim(H);
  const brim = closedPath(all);
  const fr = all.filter((p) => p.z >= 0).sort((a, b) => a.x - b.x);
  ctx2.save();
  ctx2.clip(body);
  ctx2.clip(capClip(H, 0.5, 1));
  ctx2.fillStyle = "rgba(40,0,70,0.10)";
  fillAll(ctx2, H);
  ctx2.restore();
  ctx2.fillStyle = lin(ctx2, 0, -H.ry * 0.9, 0, -H.ry * 0.3, [
    [
      0,
      "#5B21B6"
    ],
    [
      1,
      "#3B0764"
    ]
  ]);
  ctx2.fill(brim);
  if (fr.length > 1) {
    polyline(ctx2, fr);
    ctx2.strokeStyle = "rgba(190,150,255,0.35)";
    ctx2.lineWidth = H.R * 0.035;
    ctx2.lineCap = "round";
    ctx2.stroke();
  }
  const baseR = 0.62;
  const by = 0.74;
  const bl = proj(H, [
    -baseR,
    by,
    0
  ]);
  const br = proj(H, [
    baseR,
    by,
    0
  ]);
  const c = proj(H, [
    0,
    by,
    0
  ]);
  const lean = 0.1 + H.physDx * 0.15;
  const top = {
    x: c.x + H.rx * 0.18 + Math.sin(lean) * H.ry * 0.3,
    y: c.y - H.ry * 1.25
  };
  const tip = {
    x: top.x + H.rx * (0.45 + H.physDx * 0.25),
    y: top.y + H.ry * (0.22 + H.physDy * 0.1)
  };
  const capFront = frontArc(H, by, baseR / ringR(by)).filter((q) => q.x >= bl.x - 1 && q.x <= br.x + 1);
  const cone = new Path2D();
  cone.moveTo(bl.x, bl.y);
  cone.bezierCurveTo(bl.x + H.rx * 0.12, bl.y - H.ry * 0.5, top.x - H.rx * 0.28, top.y + H.ry * 0.25, top.x - H.rx * 0.02, top.y - H.ry * 0.02);
  cone.quadraticCurveTo(top.x + H.rx * 0.25, top.y - H.ry * 0.08, tip.x, tip.y);
  cone.quadraticCurveTo(top.x + H.rx * 0.22, top.y + H.ry * 0.08, top.x + H.rx * 0.14, top.y + H.ry * 0.22);
  cone.bezierCurveTo(br.x - H.rx * 0.18, c.y - H.ry * 0.45, br.x - H.rx * 0.02, br.y - H.ry * 0.2, br.x, br.y);
  for (let i = capFront.length - 1; i >= 0; i--) cone.lineTo(capFront[i].x, capFront[i].y);
  cone.closePath();
  ctx2.fillStyle = lin(ctx2, bl.x, top.y, br.x, bl.y, [
    [
      0,
      "#7C3AED"
    ],
    [
      0.55,
      "#4C1D95"
    ],
    [
      1,
      "#2E1065"
    ]
  ]);
  ctx2.fill(cone);
  ctx2.save();
  ctx2.clip(cone);
  ctx2.fillStyle = lin(ctx2, bl.x, 0, br.x, 0, [
    [
      0,
      "rgba(255,255,255,0.22)"
    ],
    [
      0.4,
      "rgba(255,255,255,0)"
    ],
    [
      1,
      "rgba(0,0,0,0.15)"
    ]
  ]);
  ctx2.fill(cone);
  ctx2.beginPath();
  ctx2.moveTo(top.x - H.rx * 0.05, top.y + H.ry * 0.05);
  ctx2.quadraticCurveTo(top.x + H.rx * 0.1, top.y + H.ry * 0.12, top.x + H.rx * 0.2, top.y + H.ry * 0.06);
  ctx2.strokeStyle = "rgba(20,0,40,0.35)";
  ctx2.lineWidth = H.R * 0.05;
  ctx2.lineCap = "round";
  ctx2.stroke();
  const fc = proj(H, [
    0,
    by,
    baseR
  ]);
  const lift = H.ry * 0.11;
  ctx2.beginPath();
  ctx2.moveTo(bl.x - 2, bl.y - lift);
  ctx2.quadraticCurveTo(fc.x, 2 * (fc.y - lift) - (bl.y + br.y) / 2, br.x + 2, br.y - lift);
  ctx2.strokeStyle = "#F97316";
  ctx2.lineWidth = H.ry * 0.17;
  ctx2.lineCap = "butt";
  ctx2.stroke();
  ctx2.restore();
  const bw = H.R * 0.2;
  const bh = H.R * 0.16;
  ctx2.save();
  ctx2.translate(fc.x, fc.y - H.ry * 0.11);
  roundRect(ctx2, -bw / 2, -bh / 2, bw, bh, bh * 0.25);
  ctx2.fillStyle = "#FCD34D";
  ctx2.fill();
  roundRect(ctx2, -bw / 2 + bw * 0.24, -bh / 2 + bh * 0.28, bw * 0.52, bh * 0.44, bh * 0.1);
  ctx2.fillStyle = "#C2410C";
  ctx2.fill();
  ctx2.restore();
}
function sunglasses(ctx2, H, body) {
  const eyes = eyeFrames(H);
  const w = H.R * 0.62;
  const h = H.R * 0.46;
  ctx2.save();
  ctx2.clip(body);
  ctx2.strokeStyle = "#111317";
  ctx2.lineCap = "round";
  const [l, r] = eyes;
  if (l.visible && r.visible) {
    ctx2.beginPath();
    ctx2.moveTo(l.x + w / 2 * l.fx * 0.9, l.y - h * 0.18);
    ctx2.quadraticCurveTo((l.x + r.x) / 2, (l.y + r.y) / 2 - h * 0.42, r.x - w / 2 * r.fx * 0.9, r.y - h * 0.18);
    ctx2.lineWidth = H.R * 0.07;
    ctx2.stroke();
  }
  ctx2.lineWidth = H.R * 0.06;
  for (const e of eyes) {
    if (!e.visible) continue;
    ctx2.beginPath();
    ctx2.moveTo(e.x + e.sd * w / 2 * e.fx, e.y - h * 0.2);
    ctx2.lineTo(e.sd * H.rx * 1.05, e.y - h * 0.35);
    ctx2.stroke();
  }
  for (const e of eyes) {
    if (!e.visible) continue;
    ctx2.save();
    ctx2.translate(e.x, e.y);
    ctx2.scale(e.fx, e.fy);
    roundRect(ctx2, -w / 2, -h / 2, w, h, h * 0.42);
    ctx2.fillStyle = "rgba(17,19,23,0.82)";
    ctx2.fill();
    ctx2.lineWidth = H.R * 0.05;
    ctx2.strokeStyle = "#0B0C0F";
    ctx2.stroke();
    ctx2.beginPath();
    ctx2.moveTo(-w * 0.28, -h * 0.05);
    ctx2.lineTo(-w * 0.05, -h * 0.3);
    ctx2.strokeStyle = "rgba(255,255,255,0.45)";
    ctx2.stroke();
    ctx2.restore();
  }
  ctx2.restore();
}
function roundGlasses(ctx2, H, body) {
  const eyes = eyeFrames(H);
  const d = H.R * 0.56;
  ctx2.save();
  ctx2.clip(body);
  ctx2.strokeStyle = "#8A4B12";
  ctx2.lineCap = "round";
  const [l, r] = eyes;
  if (l.visible && r.visible) {
    ctx2.beginPath();
    ctx2.moveTo(l.x + d / 2 * l.fx, l.y - d * 0.08);
    ctx2.quadraticCurveTo((l.x + r.x) / 2, (l.y + r.y) / 2 - d * 0.3, r.x - d / 2 * r.fx, r.y - d * 0.08);
    ctx2.lineWidth = H.R * 0.055;
    ctx2.stroke();
  }
  ctx2.lineWidth = H.R * 0.05;
  for (const e of eyes) {
    if (!e.visible) continue;
    ctx2.beginPath();
    ctx2.moveTo(e.x + e.sd * d / 2 * e.fx, e.y - d * 0.1);
    ctx2.lineTo(e.sd * H.rx * 1.05, e.y - d * 0.25);
    ctx2.stroke();
  }
  for (const e of eyes) {
    if (!e.visible) continue;
    ctx2.save();
    ctx2.translate(e.x, e.y);
    ctx2.scale(e.fx, e.fy);
    ctx2.beginPath();
    ctx2.arc(0, 0, d / 2, 0, Math.PI * 2);
    ctx2.fillStyle = "rgba(190,225,255,0.18)";
    ctx2.fill();
    ctx2.lineWidth = H.R * 0.065;
    ctx2.strokeStyle = "#9A5A1A";
    ctx2.stroke();
    ctx2.beginPath();
    ctx2.arc(0, 0, d / 2 - H.R * 0.03, Math.PI * 1.1, Math.PI * 1.45);
    ctx2.strokeStyle = "rgba(255,255,255,0.55)";
    ctx2.lineWidth = H.R * 0.03;
    ctx2.stroke();
    ctx2.restore();
  }
  ctx2.restore();
}
function scarf(ctx2, H) {
  const s = 1.05;
  const y0 = -0.34;
  const y1 = -0.66;
  const top = frontArc(H, y0, s);
  const bot = frontArc(H, y1, s);
  if (top.length === 0 || bot.length === 0) return;
  const band = new Path2D();
  top.forEach((q, i) => i ? band.lineTo(q.x, q.y) : band.moveTo(q.x, q.y));
  for (let i = bot.length - 1; i >= 0; i--) band.lineTo(bot[i].x, bot[i].y);
  band.closePath();
  ctx2.save();
  ctx2.clip(bodyOutline(H.rx * s, H.ry * s));
  ctx2.fillStyle = lin(ctx2, 0, -H.ry * 0.2, 0, H.ry * 0.7, [
    [
      0,
      "#F87171"
    ],
    [
      1,
      "#B91C1C"
    ]
  ]);
  ctx2.fill(band);
  ctx2.save();
  ctx2.clip(band);
  ctx2.strokeStyle = "rgba(255,255,255,0.85)";
  ctx2.lineCap = "round";
  for (const lon of [
    -1,
    -0.45,
    0.1,
    0.65,
    1.2
  ]) {
    const a = proj(H, surf(y0, lon, s));
    const b = proj(H, surf(y1, lon, s));
    if (a.z < 0) continue;
    ctx2.beginPath();
    ctx2.moveTo(a.x, a.y - 4);
    ctx2.lineTo(b.x, b.y + 4);
    ctx2.lineWidth = H.R * 0.09 * Math.max(0.3, a.z);
    ctx2.stroke();
  }
  ctx2.restore();
  ctx2.fillStyle = lin(ctx2, 0, -H.ry * 0.5, 0, H.ry * 0.3, [
    [
      0,
      "rgba(255,255,255,0.18)"
    ],
    [
      1,
      "rgba(0,0,0,0.1)"
    ]
  ]);
  ctx2.fill(band);
  ctx2.restore();
  const k = proj(H, surf((y0 + y1) / 2, -0.55, s * 1.03));
  if (k.z <= 0) return;
  const sw = H.physDx * H.rx * 0.12;
  const end = new Path2D();
  end.moveTo(k.x - H.R * 0.16, k.y);
  end.quadraticCurveTo(k.x - H.R * 0.24 + sw, k.y + H.ry * 0.35, k.x - H.R * 0.2 + sw * 1.4, k.y + H.ry * 0.62);
  end.lineTo(k.x + H.R * 0.06 + sw * 1.4, k.y + H.ry * 0.6);
  end.quadraticCurveTo(k.x + H.R * 0.02 + sw, k.y + H.ry * 0.3, k.x + H.R * 0.12, k.y);
  end.closePath();
  ctx2.fillStyle = lin(ctx2, 0, k.y, 0, k.y + H.ry * 0.6, [
    [
      0,
      "#EF4444"
    ],
    [
      1,
      "#B91C1C"
    ]
  ]);
  ctx2.fill(end);
  ctx2.save();
  ctx2.clip(end);
  ctx2.fillStyle = "rgba(255,255,255,0.85)";
  for (const t of [
    0.35,
    0.7
  ]) ctx2.fillRect(k.x - H.R * 0.4 + sw, k.y + H.ry * 0.62 * t, H.R * 0.8, H.R * 0.07);
  ctx2.restore();
  ctx2.strokeStyle = "#DC2626";
  ctx2.lineWidth = H.R * 0.035;
  ctx2.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const fx = k.x - H.R * 0.17 + sw * 1.4 + i * H.R * 0.075;
    ctx2.beginPath();
    ctx2.moveTo(fx, k.y + H.ry * 0.6);
    ctx2.lineTo(fx, k.y + H.ry * 0.72);
    ctx2.stroke();
  }
  ctx2.beginPath();
  ctx2.ellipse(k.x, k.y, H.R * 0.17, H.R * 0.14, 0.2, 0, Math.PI * 2);
  ctx2.fillStyle = rad(ctx2, k.x - H.R * 0.05, k.y - H.R * 0.05, 0, H.R * 0.2, [
    [
      0,
      "#F87171"
    ],
    [
      1,
      "#B91C1C"
    ]
  ]);
  ctx2.fill();
}
var PUMPKIN_BODY = [
  "#FFA94D",
  "#E8590C"
];
function pumpkin(ctx2, H, body, simple) {
  if (!simple) {
    ctx2.save();
    ctx2.clip(body);
    ctx2.lineCap = "round";
    for (const lon of [
      -1.15,
      -0.55,
      0,
      0.55,
      1.15
    ]) {
      const pts = [];
      for (let i = 0; i <= 30; i++) {
        const q = proj(H, surf(-0.98 + 1.96 * i / 30, lon, 1));
        if (q.z > 0) pts.push(q);
      }
      if (pts.length < 2) continue;
      const zz = pts[Math.floor(pts.length / 2)].z;
      polyline(ctx2, pts);
      ctx2.strokeStyle = `rgba(150,50,0,${0.22 * zz})`;
      ctx2.lineWidth = H.R * 0.12;
      ctx2.stroke();
      polyline(ctx2, pts.map((q) => ({
        x: q.x + H.R * 0.07,
        y: q.y
      })));
      ctx2.strokeStyle = `rgba(255,220,170,${0.18 * zz})`;
      ctx2.lineWidth = H.R * 0.04;
      ctx2.stroke();
    }
    ctx2.restore();
  }
  const t = proj(H, [
    0.02,
    1,
    0
  ]);
  ctx2.beginPath();
  ctx2.moveTo(t.x - H.R * 0.09, t.y + H.R * 0.04);
  ctx2.quadraticCurveTo(t.x - H.R * 0.08, t.y - H.R * 0.22, t.x + H.R * 0.08, t.y - H.R * 0.3);
  ctx2.lineTo(t.x + H.R * 0.13, t.y - H.R * 0.22);
  ctx2.quadraticCurveTo(t.x + H.R * 0.04, t.y - H.R * 0.15, t.x + H.R * 0.08, t.y + H.R * 0.04);
  ctx2.closePath();
  ctx2.fillStyle = lin(ctx2, t.x - H.R * 0.1, 0, t.x + H.R * 0.1, 0, [
    [
      0,
      "#65A30D"
    ],
    [
      1,
      "#3F6212"
    ]
  ]);
  ctx2.fill();
  ctx2.save();
  ctx2.translate(t.x - H.R * 0.06, t.y - H.R * 0.02);
  ctx2.rotate(-0.5);
  ctx2.beginPath();
  ctx2.moveTo(0, 0);
  ctx2.quadraticCurveTo(-H.R * 0.18, -H.R * 0.2, -H.R * 0.38, -H.R * 0.02);
  ctx2.quadraticCurveTo(-H.R * 0.18, H.R * 0.1, 0, 0);
  ctx2.fillStyle = lin(ctx2, 0, -H.R * 0.15, -H.R * 0.3, 0, [
    [
      0,
      "#84CC16"
    ],
    [
      1,
      "#4D7C0F"
    ]
  ]);
  ctx2.fill();
  ctx2.beginPath();
  ctx2.moveTo(-H.R * 0.02, -H.R * 0.01);
  ctx2.quadraticCurveTo(-H.R * 0.18, -H.R * 0.08, -H.R * 0.32, -H.R * 0.03);
  ctx2.strokeStyle = "rgba(30,60,0,0.4)";
  ctx2.lineWidth = H.R * 0.02;
  ctx2.lineCap = "round";
  ctx2.stroke();
  ctx2.restore();
  if (simple) return;
  ctx2.beginPath();
  ctx2.moveTo(t.x + H.R * 0.1, t.y - H.R * 0.12);
  ctx2.bezierCurveTo(t.x + H.R * 0.3, t.y - H.R * 0.25, t.x + H.R * 0.35, t.y - H.R * 0.02, t.x + H.R * 0.22, t.y - H.R * 0.06);
  ctx2.strokeStyle = "#4D7C0F";
  ctx2.lineWidth = H.R * 0.03;
  ctx2.lineCap = "round";
  ctx2.stroke();
}
function bow(ctx2, H) {
  const a = proj(H, surf(0.86, 0.55, 1.02));
  if (a.z < -0.2) return;
  const s = H.R * 0.26;
  const sq = Math.max(0.45, Math.cos(0.55 + H.yaw));
  ctx2.save();
  ctx2.translate(a.x, a.y);
  ctx2.rotate(0.35 + H.yaw * 0.3);
  ctx2.scale(sq, 1);
  for (const sd of [
    -1,
    1
  ]) {
    ctx2.beginPath();
    ctx2.moveTo(0, 0);
    ctx2.bezierCurveTo(sd * s * 0.6, -s * 0.85, sd * s * 1.35, -s * 0.55, sd * s * 1.15, 0);
    ctx2.bezierCurveTo(sd * s * 1.35, s * 0.55, sd * s * 0.6, s * 0.85, 0, 0);
    ctx2.fillStyle = lin(ctx2, 0, -s, 0, s, [
      [
        0,
        "#FF8CC6"
      ],
      [
        1,
        "#DB2777"
      ]
    ]);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.moveTo(sd * s * 0.25, -s * 0.05);
    ctx2.quadraticCurveTo(sd * s * 0.7, -s * 0.15, sd * s * 0.95, -s * 0.05);
    ctx2.strokeStyle = "rgba(140,10,70,0.35)";
    ctx2.lineWidth = s * 0.08;
    ctx2.lineCap = "round";
    ctx2.stroke();
  }
  ctx2.beginPath();
  ctx2.ellipse(0, 0, s * 0.24, s * 0.3, 0, 0, Math.PI * 2);
  ctx2.fillStyle = rad(ctx2, -s * 0.06, -s * 0.1, 0, s * 0.35, [
    [
      0,
      "#FFB3D9"
    ],
    [
      1,
      "#C2185B"
    ]
  ]);
  ctx2.fill();
  ctx2.restore();
}
function bunnyEars(ctx2, H) {
  const R = H.R;
  const earH = R * 0.85;
  for (const sd of [
    -1,
    1
  ]) {
    const root = proj(H, [
      sd * 0.45,
      0.92,
      0
    ]);
    const rootL = proj(H, [
      sd * 0.45 - 0.22,
      0.92,
      0
    ]);
    const rootR = proj(H, [
      sd * 0.45 + 0.22,
      0.92,
      0
    ]);
    const hw = Math.max(R * 0.04, Math.abs(rootR.x - rootL.x) / 2);
    ctx2.save();
    ctx2.translate(root.x, root.y - earH * 0.15);
    ctx2.beginPath();
    ctx2.ellipse(0, 0, hw, earH / 2, 0, 0, Math.PI * 2);
    ctx2.fillStyle = "#F9F0F0";
    ctx2.fill();
    ctx2.strokeStyle = "rgba(0,0,0,0.06)";
    ctx2.lineWidth = 0.8;
    ctx2.stroke();
    ctx2.beginPath();
    ctx2.ellipse(0, -earH / 2 + R * 0.1 + earH * 0.325, hw * 0.5, earH * 0.325, 0, 0, Math.PI * 2);
    ctx2.fillStyle = "rgba(252,165,165,0.7)";
    ctx2.fill();
    ctx2.restore();
  }
}
var scratch = null;
function withLayer(ctx2, alpha, fn) {
  if (alpha >= 0.999) {
    ctx2.save();
    fn(ctx2);
    ctx2.restore();
    return;
  }
  const W = ctx2.canvas.width;
  const Hh = ctx2.canvas.height;
  scratch ??= document.createElement("canvas");
  if (scratch.width < W || scratch.height < Hh) {
    scratch.width = Math.max(scratch.width, W);
    scratch.height = Math.max(scratch.height, Hh);
  }
  const s = scratch.getContext("2d");
  if (!s) return;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.clearRect(0, 0, W, Hh);
  s.setTransform(ctx2.getTransform());
  s.save();
  fn(s);
  s.restore();
  ctx2.save();
  ctx2.setTransform(1, 0, 0, 1, 0, 0);
  ctx2.globalAlpha *= alpha;
  ctx2.drawImage(scratch, 0, 0, W, Hh, 0, 0, W, Hh);
  ctx2.restore();
}
var ON_FACE = /* @__PURE__ */ new Set([
  "sunglasses",
  "roundGlasses",
  "bow",
  "scarf",
  "pumpkin"
]);
var HATS = /* @__PURE__ */ new Set([
  "beanie",
  "santaHat",
  "partyHat",
  "crown",
  "witchHat"
]);
function faceTurnedAway(H) {
  return proj(H, [
    0,
    0,
    1
  ]).z < 0;
}
function drawFace(ctx2, outfit, H, body, simple) {
  switch (outfit) {
    case "sunglasses":
      sunglasses(ctx2, H, body);
      break;
    case "roundGlasses":
      roundGlasses(ctx2, H, body);
      break;
    case "scarf":
      scarf(ctx2, H);
      break;
    case "pumpkin":
      pumpkin(ctx2, H, body, simple);
      break;
    case "bow":
      bow(ctx2, H);
      break;
    default:
      break;
  }
}
function layerAlpha(st) {
  const morphFade = 1 - Math.min(1, Math.max(0, (st.morph - 0.3) / 0.2));
  return morphFade * Math.min(1, st.presence * 2.5);
}
function drawOutfitBehind(ctx2, outfit, H, st) {
  if (outfit === "none") return;
  const alpha = layerAlpha(st);
  if (alpha <= 5e-3) return;
  const simple = H.R < SIMPLIFY_BELOW_R;
  const body = bodyOutline(H.rx, H.ry);
  if (ON_FACE.has(outfit)) {
    if (faceTurnedAway(H)) withLayer(ctx2, alpha, (l) => drawFace(l, outfit, H, body, simple));
    return;
  }
  const posP = Ease.back(st.presence);
  const hatScale = 0.85 + 0.15 * posP;
  ctx2.save();
  ctx2.translate(0, -(1 - posP) * H.ry);
  ctx2.scale(hatScale, hatScale);
  withLayer(ctx2, alpha, (l) => {
    if (outfit === "bunnyEars") bunnyEars(l, H);
    else if (outfit === "crown") crownPart(l, H, -1, simple);
    else if (outfit === "witchHat") witchHatBack(l, H);
  });
  ctx2.restore();
}
function drawOutfitFront(ctx2, outfit, H, st) {
  if (outfit === "none" || outfit === "bunnyEars") return;
  if (ON_FACE.has(outfit) && faceTurnedAway(H)) return;
  const alpha = layerAlpha(st);
  if (alpha <= 5e-3) return;
  const simple = H.R < SIMPLIFY_BELOW_R;
  const body = bodyOutline(H.rx, H.ry);
  const p = st.presence;
  const posP = Ease.back(p);
  ctx2.save();
  if (HATS.has(outfit)) {
    const hatScale = 0.85 + 0.15 * posP;
    ctx2.translate(0, -(1 - posP) * H.ry);
    ctx2.scale(hatScale, hatScale);
  } else if (outfit === "sunglasses" || outfit === "roundGlasses") {
    ctx2.translate(0, (1 - p) * 0.25 * H.ry);
  } else if (outfit === "scarf") {
    ctx2.translate(0, (1 - p) * 0.3 * H.ry);
  } else if (outfit === "bow") {
    ctx2.scale(Math.max(1e-3, posP), Math.max(1e-3, posP));
  }
  withLayer(ctx2, alpha, (l) => {
    switch (outfit) {
      case "beanie":
        beanie(l, H, body, simple);
        break;
      case "santaHat":
        santaHat(l, H, body);
        break;
      case "partyHat":
        partyHat(l, H, simple);
        break;
      case "crown":
        crownFront(l, H, body, simple);
        break;
      case "witchHat":
        witchHatFront(l, H, body);
        break;
      default:
        drawFace(l, outfit, H, body, simple);
    }
  });
  ctx2.restore();
}

// src/nami/engine.ts
var EYE_W2 = 0.25;
var EYE_H2 = 0.27;
var EYE_SP2 = 0.37;
var EYE_P2 = -0.12;
var BASE_TOP = [
  0.929,
  0.929,
  0.937
];
var BASE_BOTTOM = [
  0.769,
  0.773,
  0.792
];
var INK = "rgb(26,20,18)";
var MINI_INK = "rgb(16,19,26)";
var ANGER_BODY = [
  0.98,
  0.24,
  0.32
];
var C = {
  idle: [
    0.902,
    0.914,
    0.933
  ],
  working: [
    0.231,
    0.62,
    1
  ],
  thinking: [
    0.545,
    0.361,
    0.965
  ],
  searching: [
    0.388,
    0.396,
    0.949
  ],
  approval: [
    0.961,
    0.647,
    0.141
  ],
  question: [
    0.133,
    0.827,
    0.933
  ],
  error: [
    0.957,
    0.314,
    0.369
  ],
  finished: [
    0.204,
    0.831,
    0.6
  ],
  ratelimit: [
    0.984,
    0.573,
    0.235
  ],
  sleeping: [
    0.58,
    0.635,
    0.722
  ],
  dizzy: [
    0.957,
    0.447,
    0.714
  ]
};
var base = {
  bounces: false,
  scans: false,
  breathes: false,
  zz: false,
  sweat: false,
  look: null,
  tilt: 0
};
var BOT_STATES = {
  idle: {
    ...base,
    color: C.idle,
    tint: 0,
    eye: "pill",
    badge: null
  },
  working: {
    ...base,
    color: C.working,
    tint: 0.72,
    eye: "pill",
    badge: {
      kind: "dots",
      color: C.working
    }
  },
  thinking: {
    ...base,
    color: C.thinking,
    tint: 0.72,
    eye: "pill",
    badge: {
      kind: "dots",
      color: C.thinking
    },
    look: [
      0.55,
      0.55
    ]
  },
  searching: {
    ...base,
    color: C.searching,
    tint: 0.72,
    eye: "pill",
    badge: {
      kind: "dots",
      color: C.searching
    },
    scans: true
  },
  approval: {
    ...base,
    color: C.approval,
    tint: 0.78,
    eye: "wide",
    badge: {
      kind: "bang",
      color: C.approval
    },
    bounces: true
  },
  question: {
    ...base,
    color: C.question,
    tint: 0.75,
    eye: "pill",
    badge: {
      kind: "question",
      color: C.question
    },
    tilt: 0.17
  },
  error: {
    ...base,
    color: C.error,
    tint: 0.78,
    eye: "flat",
    badge: {
      kind: "dot",
      color: C.error
    }
  },
  finished: {
    ...base,
    color: C.finished,
    tint: 0.35,
    eye: "happy",
    badge: {
      kind: "dot",
      color: C.finished
    }
  },
  ratelimit: {
    ...base,
    color: C.ratelimit,
    tint: 0.72,
    eye: "tired",
    badge: {
      kind: "dot",
      color: C.ratelimit
    },
    sweat: true
  },
  sleeping: {
    ...base,
    color: C.sleeping,
    tint: 0.32,
    eye: "closed",
    badge: null,
    breathes: true,
    zz: true
  },
  dizzy: {
    ...base,
    color: C.dizzy,
    tint: 0.7,
    eye: "spiral",
    badge: null
  }
};
var EMOTE_EYE = {
  love: "heart",
  surprised: "dot",
  proud: "star",
  wink: "wink",
  yawn: "tired",
  happy: "happy",
  annoyed: "line",
  cry: "tired"
};
var now = () => performance.now() / 1e3;
function hexToRGB(hex) {
  const h = hex.replace("#", "");
  const v = parseInt(h, 16);
  return [
    (v >> 16 & 255) / 255,
    (v >> 8 & 255) / 255,
    (v & 255) / 255
  ];
}
var rgba = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
var mix3 = (a, b, t) => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t)
];
function roundRectPath(x, X, Y, W, H, R) {
  const r = Math.max(0, Math.min(R, W / 2, H / 2));
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r);
  x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r);
  x.arcTo(X, Y, X + W, Y, r);
  x.closePath();
}
function heartPath(x, s) {
  x.beginPath();
  x.moveTo(0, s * 0.38);
  x.bezierCurveTo(-s * 1.05, -s * 0.15, -s * 0.5, -s * 0.95, 0, -s * 0.38);
  x.bezierCurveTo(s * 0.5, -s * 0.95, s * 1.05, -s * 0.15, 0, s * 0.38);
  x.closePath();
}
function starPath(x, ro, ri) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  x.closePath();
}
var FONT = `system-ui, "Segoe UI Variable Text", "Segoe UI", sans-serif`;
function stepDanceLevel(level, dancing, dt) {
  const target = dancing ? 1 : 0;
  if (level < target) return Math.min(target, level + dt / 0.3);
  if (level > target) return Math.max(target, level - dt / 0.5);
  return level;
}
function danceTransform(seconds, level, R) {
  const beat = seconds * 112 / 60;
  const hop = Math.abs(Math.sin(Math.PI * beat));
  const land = Math.pow(1 - hop, 6);
  return {
    dx: 0.08 * R * Math.sin(Math.PI * beat) * level,
    dy: -0.2 * R * hop * level,
    rotate: 0.1 * Math.sin(Math.PI * beat) * level,
    sx: 1 + 0.045 * land * level,
    sy: 1 - 0.06 * land * level
  };
}
var BotEngine = class {
  isMini = false;
  /** Solid body colour for mini bots / integration pills (null = Nami gradient). */
  bodyColor = null;
  petKind = "nami";
  // Animated state (BotEngine `s`)
  yaw = 0;
  pitch = 0;
  roll = 0;
  tilt = 0;
  open = 1;
  sx = 1;
  sy = 1;
  oy = 0;
  ox = 0;
  tint = 0;
  morph = 0;
  hands = 0;
  blush = 0;
  es = 1;
  badgeS = 0;
  // Outfit (the main Nami only — minis never wear one). `outfit` is what is
  // drawn; it changes only once the previous one has left.
  outfit = "none";
  /** 0 = gone, 1 = fully on. */
  outfitPresence = 0;
  outfitTarget = "none";
  // Spring lag of the soft parts (pompoms, hat tips, scarf end), −1…1.
  physDx = 0;
  physDy = 0;
  physVx = 0;
  physVy = 0;
  prevYaw = 0;
  prevOy = 0;
  prevRoll = 0;
  // Targets
  tgYaw = 0;
  tgPitch = 0;
  tgTilt = 0;
  tgSy = 1;
  tgSx = 1;
  tgEs = 1;
  /** Extra canvas height above the body so hearts can fly out without clipping. */
  particleOverhang = 0;
  /** Dancing to music; `dancingLevel` follows it, 0→1 in 0.3 s, 1→0 in 0.5 s. */
  isDancing = false;
  dancingLevel = 0;
  // Mouth spring (fraction of R)
  slotH = 0;
  slotHTarget = 0;
  slotHVel = 0;
  isChewing = false;
  col = C.idle;
  colT = C.idle;
  state = "idle";
  cfg = BOT_STATES.idle;
  eyeOverride = null;
  eyeOverrideUntil = 0;
  permanentEye = null;
  permanentEmote = null;
  miniNextBehavior = 0;
  angry = false;
  nextAnger = 0;
  badge = null;
  badgeKey = "none";
  badgeToken = 0;
  tweens = /* @__PURE__ */ new Map();
  locks = /* @__PURE__ */ new Set();
  particles = [];
  lookX = 0;
  lookY = 0;
  lastTime = now();
  t0 = now() - Math.random() * 5;
  nextBlink = now() + 1.5 + Math.random() * 2;
  waveUntil = 0;
  waveStart = 0;
  greetToken = 0;
  lastAmbient = 0;
  slapTimes = [];
  miniLookTarget = {
    x: 0,
    y: 0
  };
  miniLookNextTime = 0;
  /** Fired when three slaps land inside 1.7 s (→ dizzy + confused view). */
  onDizzy = null;
  // ── Public API ──────────────────────────────────────────────────────────────
  setState(next, force = false) {
    if (this.state === next && !force) return;
    const prev = this.state;
    this.state = next;
    this.cfg = BOT_STATES[next];
    this.colT = this.cfg.color;
    if (!this.locks.has("tint")) this.tint = this.cfg.tint;
    if (!this.locks.has("tilt")) this.tgTilt = this.cfg.tilt;
    this.setBadge(this.cfg.badge);
    switch (next) {
      case "finished":
        this.doRoll(950, 1);
        setTimeout(() => this.emit("spark", 5), 500);
        break;
      case "error":
        this.anim("ox", [
          [
            0.08,
            50,
            Ease.out
          ],
          [
            -0.08,
            70,
            Ease.inOut
          ],
          [
            0.05,
            70,
            Ease.inOut
          ],
          [
            0,
            90,
            Ease.out
          ]
        ]);
        break;
      case "approval":
        this.anim("oy", [
          [
            -0.2,
            150,
            Ease.out
          ],
          [
            0,
            300,
            Ease.back
          ]
        ]);
        break;
      case "dizzy":
        this.doRoll(1300, 2);
        break;
      case "question":
        this.blink();
        break;
      case "ratelimit":
        this.emit("sweat", 1);
        break;
      default:
        if (prev !== "idle" || next !== "idle") this.blink();
    }
  }
  setBadge(b) {
    const key = b ? `${b.kind}-${b.color.join(",")}` : "none";
    if (key === this.badgeKey) return;
    this.badgeKey = key;
    const tok = ++this.badgeToken;
    this.anim("badgeS", [
      [
        0,
        90,
        Ease.inOut
      ]
    ]);
    setTimeout(() => {
      if (tok !== this.badgeToken) return;
      this.badge = b;
      if (b) this.anim("badgeS", [
        [
          1,
          280,
          Ease.back
        ]
      ]);
    }, 100);
  }
  blink() {
    if (this.locks.has("open")) return;
    this.anim("open", [
      [
        0.06,
        70,
        Ease.inOut
      ],
      [
        1,
        130,
        Ease.out
      ]
    ]);
  }
  squash() {
    this.physVy += 0.6;
    this.anim("sy", [
      [
        0.78,
        70,
        Ease.out
      ],
      [
        1.1,
        130,
        Ease.out
      ],
      [
        1,
        170,
        Ease.inOut
      ]
    ]);
    this.anim("sx", [
      [
        1.16,
        70,
        Ease.out
      ],
      [
        0.95,
        130,
        Ease.out
      ],
      [
        1,
        170,
        Ease.inOut
      ]
    ]);
  }
  /** Mailbox swallow — opens the slot, chews, then closes. */
  gulp() {
    this.slotHTarget = 0.42;
    setTimeout(() => {
      this.slotHTarget = 0;
      this.isChewing = true;
      setTimeout(() => {
        this.isChewing = false;
      }, 800);
    }, 460);
    this.anim("sy", [
      [
        0.78,
        80,
        Ease.out
      ],
      [
        1.18,
        130,
        Ease.out
      ],
      [
        1,
        220,
        Ease.back
      ]
    ]);
    this.anim("sx", [
      [
        1.28,
        80,
        Ease.out
      ],
      [
        0.92,
        130,
        Ease.out
      ],
      [
        1,
        220,
        Ease.back
      ]
    ]);
    this.blink();
  }
  slap() {
    this.interruptGreet();
    if (this.state === "dizzy") return;
    const t = now();
    this.slapTimes = this.slapTimes.filter((s) => t - s < 1.7);
    this.slapTimes.push(t);
    Sound.play("slap");
    this.squash();
    this.physVy -= 1.2;
    this.physVx += Math.random() < 0.5 ? 0.7 : -0.7;
    if (this.slapTimes.length >= 3) {
      this.slapTimes = [];
      this.onDizzy?.();
    } else {
      this.eyeOverride = "line";
      this.eyeOverrideUntil = t + 0.8;
      setTimeout(() => Sound.play("annoyed"), 60);
    }
  }
  doRoll(durationMs, turns) {
    this.roll = 0;
    this.anim("roll", [
      [
        Math.PI * 2 * turns,
        durationMs,
        Ease.inOut
      ]
    ], () => {
      this.roll = 0;
    });
  }
  /** Peek wave. */
  greet() {
    const t = now();
    const tok = ++this.greetToken;
    this.waveStart = t + 0.45;
    this.waveUntil = t + 1.55;
    this.physVx += 0.2;
    this.eyeOverride = "happy";
    this.eyeOverrideUntil = t + 2;
    this.anim("oy", [
      [
        -0.06,
        220,
        Ease.out
      ],
      [
        0,
        220,
        Ease.back
      ]
    ]);
    setTimeout(() => {
      if (this.greetToken !== tok) return;
      this.anim("hands", [
        [
          1,
          280,
          Ease.out
        ]
      ]);
      this.anim("sy", [
        [
          0.95,
          100,
          Ease.out
        ],
        [
          1,
          260,
          Ease.back
        ]
      ]);
      this.anim("sx", [
        [
          1.04,
          100,
          Ease.out
        ],
        [
          1,
          260,
          Ease.back
        ]
      ]);
      Sound.play("greet");
    }, 250);
    setTimeout(() => {
      if (this.greetToken === tok) this.blink();
    }, 550);
    setTimeout(() => {
      if (this.greetToken === tok) this.blink();
    }, 1500);
    setTimeout(() => {
      if (this.greetToken !== tok) return;
      this.waveUntil = 0;
      this.anim("hands", [
        [
          0,
          200,
          Ease.inOut
        ]
      ]);
    }, 1550);
    setTimeout(() => {
      if (this.greetToken !== tok) return;
      this.eyeOverride = "happy";
      this.eyeOverrideUntil = now() + 0.3;
    }, 1750);
  }
  interruptGreet() {
    if (this.hands <= 0.01 && now() >= this.waveUntil) return;
    this.greetToken++;
    this.waveUntil = 0;
    this.waveStart = 0;
    this.anim("hands", [
      [
        0,
        150,
        Ease.inOut
      ]
    ]);
  }
  setPermanentEmote(emote) {
    this.permanentEmote = emote;
    if (emote === "wink") {
      this.miniNextBehavior = now() + 0.8 + Math.random() * 1.7;
      return;
    }
    this.permanentEye = emote ? EMOTE_EYE[emote] : null;
    if (this.permanentEye) {
      this.eyeOverride = this.permanentEye;
      this.eyeOverrideUntil = Number.POSITIVE_INFINITY;
    } else if (this.eyeOverrideUntil === Number.POSITIVE_INFINITY) {
      this.eyeOverride = null;
      this.eyeOverrideUntil = 0;
    }
    this.miniNextBehavior = now() + 0.8 + Math.random() * 1.7;
  }
  setAngry(on) {
    if (this.angry === on) return;
    this.angry = on;
    if (on) {
      this.colT = [
        0.98,
        0.24,
        0.27
      ];
      this.tint = 0.62;
      this.eyeOverride = "angry";
      this.eyeOverrideUntil = Number.POSITIVE_INFINITY;
      this.nextAnger = now() + 0.4;
      this.squash();
      this.emit("anger", 3);
    } else {
      this.colT = this.cfg.color;
      this.tint = this.cfg.tint;
      this.eyeOverride = this.permanentEye;
      this.eyeOverrideUntil = this.permanentEye ? Number.POSITIVE_INFINITY : 0;
    }
  }
  triggerEmote(emote, duration = 1.8) {
    const t = now();
    this.eyeOverride = EMOTE_EYE[emote];
    this.eyeOverrideUntil = t + duration;
    switch (emote) {
      case "love":
        this.anim("blush", [
          [
            1,
            300,
            Ease.out
          ],
          [
            1,
            (duration - 0.6) * 1e3,
            Ease.lin
          ],
          [
            0,
            300,
            Ease.inOut
          ]
        ]);
        this.emit("heart", 4);
        this.anim("oy", [
          [
            -0.1,
            160,
            Ease.out
          ],
          [
            0,
            300,
            Ease.back
          ]
        ]);
        break;
      case "surprised":
        this.anim("oy", [
          [
            -0.3,
            140,
            Ease.out
          ],
          [
            0,
            380,
            Ease.back
          ]
        ]);
        this.anim("es", [
          [
            1.25,
            120,
            Ease.out
          ],
          [
            1,
            500,
            Ease.inOut
          ]
        ]);
        break;
      case "proud":
        this.emit("star", 5);
        this.anim("tilt", [
          [
            -0.14,
            220,
            Ease.out
          ],
          [
            -0.14,
            (duration - 0.5) * 1e3,
            Ease.lin
          ],
          [
            0,
            280,
            Ease.inOut
          ]
        ]);
        this.anim("blush", [
          [
            0.7,
            250,
            Ease.out
          ],
          [
            0.7,
            (duration - 0.5) * 1e3,
            Ease.lin
          ],
          [
            0,
            300,
            Ease.inOut
          ]
        ]);
        break;
      case "wink":
        this.anim("tilt", [
          [
            0.12,
            160,
            Ease.out
          ],
          [
            0.12,
            (duration - 0.4) * 1e3,
            Ease.lin
          ],
          [
            0,
            240,
            Ease.inOut
          ]
        ]);
        break;
      case "yawn":
        this.anim("sy", [
          [
            1.12,
            500,
            Ease.inOut
          ],
          [
            1,
            500,
            Ease.inOut
          ]
        ]);
        this.anim("sx", [
          [
            0.94,
            500,
            Ease.inOut
          ],
          [
            1,
            500,
            Ease.inOut
          ]
        ]);
        setTimeout(() => {
          this.eyeOverride = "closed";
          this.emit("z", 2);
        }, 700);
        break;
      case "happy":
        this.anim("blush", [
          [
            0.6,
            200,
            Ease.out
          ],
          [
            0,
            600,
            Ease.inOut
          ]
        ]);
        break;
      case "annoyed":
        this.eyeOverride = "line";
        this.eyeOverrideUntil = t + 0.8;
        setTimeout(() => Sound.play("annoyed"), 60);
        break;
      case "cry":
        this.emit("sweat", 4);
        this.anim("sy", [
          [
            0.9,
            260,
            Ease.inOut
          ],
          [
            1,
            420,
            Ease.inOut
          ]
        ]);
        this.anim("tilt", [
          [
            -0.05,
            180,
            Ease.out
          ],
          [
            0.05,
            260,
            Ease.inOut
          ],
          [
            0,
            220,
            Ease.inOut
          ]
        ]);
        setTimeout(() => this.emit("sweat", 2), 420);
        setTimeout(() => this.emit("sweat", 2), 900);
        break;
    }
  }
  emit(type, count) {
    for (let i = 0; i < count; i++) {
      const isZ = type === "z";
      this.particles.push({
        type,
        x: (Math.random() - 0.5) * 0.9 + (isZ ? 0.55 : 0),
        y: -0.7 - Math.random() * 0.2,
        vx: (Math.random() - 0.5) * 0.35 + (isZ ? 0.18 : 0),
        vy: -(0.45 + Math.random() * 0.35),
        age: -i * 0.14,
        life: 1.3 + Math.random() * 0.5,
        rot: Math.random() * Math.PI * 2,
        size: 0.15 + Math.random() * 0.08
      });
    }
  }
  animateMorph(target, durationMs) {
    const dur = durationMs ?? (target > 0.5 ? 550 : 650);
    this.anim("morph", [
      [
        target,
        dur,
        Ease.inOut
      ]
    ]);
  }
  resetMorph() {
    this.tweens.delete("morph");
    this.locks.delete("morph");
    this.morph = 0;
  }
  /**
   * Dresses Nami. Animated: the old outfit leaves (180 ms), the new one drops
   * in (350 ms) and Nami does a little squash — BotEngine.setOutfit on macOS.
   */
  setOutfit(next, animated = true) {
    if (next === this.outfitTarget) return;
    this.outfitTarget = next;
    this.tweens.delete("outfitPresence");
    this.locks.delete("outfitPresence");
    const enter = () => {
      this.outfit = next;
      this.anim("outfitPresence", [
        [
          1,
          350,
          Ease.inOut
        ]
      ], () => this.squash());
    };
    if (!animated) {
      this.outfit = next;
      this.outfitPresence = next !== "none" ? 1 : 0;
    } else if (next === "none") {
      this.anim("outfitPresence", [
        [
          0,
          180,
          Ease.inOut
        ]
      ], () => {
        this.outfit = "none";
      });
    } else if (this.outfit === "none") {
      this.outfitPresence = 0;
      enter();
    } else {
      this.anim("outfitPresence", [
        [
          0,
          180,
          Ease.inOut
        ]
      ], enter);
    }
  }
  /** Wearing something visible: the body then turns as one piece when it rolls. */
  get rigidRoll() {
    return !this.isMini && this.outfit !== "none" && this.outfitPresence > 0.05;
  }
  /** True while anything is still moving — lets the island stop its RAF loop. */
  get busy() {
    return this.tweens.size > 0 || this.particles.length > 0 || this.cfg.bounces || this.cfg.scans || this.cfg.breathes || this.cfg.zz || this.cfg.sweat || this.isMini || this.isDancing || this.dancingLevel > 1e-3 || Math.abs(this.tgYaw - this.yaw) > 2e-3 || Math.abs(this.tgPitch - this.pitch) > 2e-3 || Math.abs(this.tgTilt - this.tilt) > 2e-3 || Math.abs(this.tgSy - this.sy) > 2e-3 || Math.abs(this.tgSx - this.sx) > 2e-3 || Math.abs(this.tgEs - this.es) > 2e-3 || this.slotH > 1e-3 || Math.abs(this.slotHVel) > 1e-3 || Math.abs(this.col[0] - this.colT[0]) > 3e-3 || Math.abs(this.col[1] - this.colT[1]) > 3e-3 || Math.abs(this.col[2] - this.colT[2]) > 3e-3 || this.outfit !== "none" && (Math.abs(this.physVx) > 0.01 || Math.abs(this.physVy) > 0.01);
  }
  // ── Tweens ──────────────────────────────────────────────────────────────────
  anim(prop, keys, onComplete) {
    this.tweens.set(prop, {
      prop,
      keys,
      index: 0,
      from: this[prop],
      startMs: performance.now(),
      onComplete
    });
    this.locks.add(prop);
  }
  // ── Update ──────────────────────────────────────────────────────────────────
  update(dt) {
    const n = now();
    const nowMs = performance.now();
    for (const tw of [
      ...this.tweens.values()
    ]) {
      const k = tw.keys[tw.index];
      const p = Math.min(1, Math.max(0, (nowMs - tw.startMs) / k[1]));
      this[tw.prop] = tw.from + (k[0] - tw.from) * k[2](p);
      if (p >= 1) {
        tw.from = k[0];
        tw.index += 1;
        tw.startMs = nowMs;
        if (tw.index >= tw.keys.length) {
          this.tweens.delete(tw.prop);
          this.locks.delete(tw.prop);
          tw.onComplete?.();
        }
      }
    }
    const t = n - this.t0;
    let ty = this.lookX * 0.62;
    let tp = this.lookY * 0.5;
    if (this.cfg.look) {
      ty = ty * 0.35 + this.cfg.look[0] * 0.55;
      tp = tp * 0.3 + this.cfg.look[1] * 0.5;
    }
    if (this.cfg.scans) {
      ty = Math.sin(t * 2.6) * 0.6;
      tp = -0.06;
    }
    if (this.state === "sleeping") {
      ty = 0;
      tp = -0.14;
    }
    if (this.state === "dizzy") {
      ty = Math.sin(t * 9) * 0.25;
    }
    if (this.petKind !== "nami") tp = Math.max(0, tp);
    if (this.isMini && !this.cfg.look && !this.cfg.scans && this.state !== "sleeping" && this.state !== "dizzy") {
      if (n > this.miniLookNextTime) {
        this.miniLookTarget = {
          x: -0.88 + Math.random() * 1.76,
          y: -0.55 + Math.random() * 1
        };
        this.miniLookNextTime = n + 0.5 + Math.random() * 1.5;
      }
      ty = this.miniLookTarget.x * 0.62;
      tp = this.miniLookTarget.y * 0.5;
    }
    this.tgYaw = ty;
    this.tgPitch = tp;
    this.tgTilt = this.cfg.tilt;
    if (n > this.waveStart && n < this.waveUntil) {
      const wt = n - this.waveStart;
      this.tgTilt = -0.06 + Math.sin(2 * Math.PI * 1.2 * wt) * 0.07;
    }
    const bounce = this.cfg.bounces ? -Math.abs(Math.sin(t * 5.2)) * 0.07 : 0;
    const kGen = 1 - Math.pow(8e-4, dt);
    if (!this.locks.has("oy")) this.oy += (bounce - this.oy) * kGen;
    if (this.cfg.breathes) {
      const amp = this.isMini ? 0.07 : 0.035;
      this.tgSy = 1 + Math.sin(t * 1.8) * amp;
      this.tgSx = 1 - Math.sin(t * 1.8) * amp * 0.57;
    } else if (this.isMini) {
      this.tgSy = 1 + Math.sin(t * 2.2) * 0.04;
      this.tgSx = 1 - Math.sin(t * 2.2) * 0.02;
    } else {
      this.tgSy = 1;
      this.tgSx = 1;
    }
    if (this.angry) {
      this.tgTilt = Math.sin(t * 13) * 0.045;
      this.tgSy = 1 + Math.sin(t * 11) * 0.025;
      this.tgSx = 1 - Math.sin(t * 11) * 0.018;
      if (n > this.nextAnger) {
        this.nextAnger = n + 0.85;
        this.emit("anger", 1);
      }
    }
    if (this.isMini && n > this.miniNextBehavior) this.doMiniBehaviorLoop();
    const kLook = 1 - Math.pow(25e-4, dt);
    if (!this.locks.has("yaw")) this.yaw += (this.tgYaw - this.yaw) * kLook;
    if (!this.locks.has("pitch")) this.pitch += (this.tgPitch - this.pitch) * kLook;
    if (!this.locks.has("tilt")) this.tilt += (this.tgTilt - this.tilt) * kGen;
    if (!this.locks.has("sy")) this.sy += (this.tgSy - this.sy) * kGen;
    if (!this.locks.has("sx")) this.sx += (this.tgSx - this.sx) * kGen;
    if (!this.locks.has("es")) this.es += (this.tgEs - this.es) * kGen;
    this.col = mix3(this.col, this.colT, 1 - Math.pow(2e-3, dt));
    if (n > this.nextBlink) {
      if (this.state !== "sleeping" && this.state !== "dizzy") {
        this.blink();
        if (Math.random() < 0.22) setTimeout(() => this.blink(), 230);
      }
      this.nextBlink = n + 2.2 + Math.random() * 3.2;
    }
    if (this.eyeOverride && n > this.eyeOverrideUntil) {
      this.eyeOverride = this.permanentEye;
      if (this.permanentEye) this.eyeOverrideUntil = Number.POSITIVE_INFINITY;
    }
    if (n - this.lastAmbient > 1.3) {
      this.lastAmbient = n;
      if (this.cfg.zz) this.emit("z", 1);
      if (!this.isMini && this.cfg.sweat && Math.random() < 0.5) this.emit("sweat", 1);
    }
    for (const p of this.particles) p.age += dt;
    this.particles = this.particles.filter((p) => p.age < p.life);
    const omega = 2 * Math.PI / 0.25;
    const zeta = 0.6;
    const acc = omega * omega * (this.slotHTarget - this.slotH) - 2 * zeta * omega * this.slotHVel;
    this.slotHVel += acc * dt;
    this.slotH = Math.max(0, this.slotH + this.slotHVel * dt);
    this.dancingLevel = stepDanceLevel(this.dancingLevel, this.isDancing, dt);
    if (dt > 0) {
      const yawVel = (this.yaw - this.prevYaw) / dt;
      const oyVel = (this.oy - this.prevOy) / dt;
      const dRoll = this.roll - this.prevRoll;
      const rollVel = Math.abs(dRoll) > Math.PI ? 0 : dRoll / dt;
      const centrifugal = this.rigidRoll ? rollVel * 0.18 : 0;
      const tDx = Math.max(-1, Math.min(1, -yawVel * 0.35 - this.tilt * 2 + centrifugal));
      const tDy = Math.max(-1, Math.min(1, oyVel * 0.5));
      this.physVx += (60 * (tDx - this.physDx) - 9 * this.physVx) * dt;
      this.physVy += (60 * (tDy - this.physDy) - 9 * this.physVy) * dt;
      this.physDx += this.physVx * dt;
      this.physDy += this.physVy * dt;
    }
    this.prevYaw = this.yaw;
    this.prevOy = this.oy;
    this.prevRoll = this.roll;
    this.lastTime = n;
  }
  doMiniBehaviorLoop() {
    const n = now();
    switch (this.permanentEmote) {
      case "happy":
        if (this.locks.has("oy")) {
          this.miniNextBehavior = n + 0.4;
          return;
        }
        this.anim("oy", [
          [
            -0.3,
            120,
            Ease.out
          ],
          [
            0.03,
            200,
            Ease.inOut
          ],
          [
            0,
            160,
            Ease.back
          ]
        ]);
        this.anim("sy", [
          [
            0.82,
            80,
            Ease.out
          ],
          [
            1.18,
            130,
            Ease.out
          ],
          [
            0.88,
            160,
            Ease.inOut
          ],
          [
            1,
            200,
            Ease.back
          ]
        ]);
        this.anim("sx", [
          [
            1.15,
            80,
            Ease.out
          ],
          [
            0.88,
            130,
            Ease.out
          ],
          [
            1.06,
            160,
            Ease.inOut
          ],
          [
            1,
            200,
            Ease.back
          ]
        ]);
        this.miniNextBehavior = n + 2.2 + Math.random() * 1.2;
        break;
      case "annoyed":
        if (this.locks.has("yaw")) {
          this.miniNextBehavior = n + 0.5;
          return;
        }
        this.anim("yaw", [
          [
            -0.65,
            50,
            Ease.out
          ],
          [
            0.65,
            90,
            Ease.inOut
          ],
          [
            -0.5,
            80,
            Ease.inOut
          ],
          [
            0.4,
            75,
            Ease.inOut
          ],
          [
            -0.2,
            70,
            Ease.inOut
          ],
          [
            0,
            140,
            Ease.out
          ]
        ]);
        this.miniNextBehavior = n + 3 + Math.random() * 2.5;
        break;
      case "wink":
        this.eyeOverride = "wink";
        this.eyeOverrideUntil = n + 0.55;
        this.anim("tilt", [
          [
            0.13,
            100,
            Ease.out
          ],
          [
            0.13,
            320,
            Ease.lin
          ],
          [
            0,
            200,
            Ease.inOut
          ]
        ]);
        this.miniNextBehavior = n + 2.2 + Math.random() * 2;
        break;
      case "love":
        this.emit("heart", 2);
        this.anim("tilt", [
          [
            -0.1,
            180,
            Ease.out
          ],
          [
            0.1,
            340,
            Ease.inOut
          ],
          [
            0,
            220,
            Ease.inOut
          ]
        ]);
        this.miniNextBehavior = n + 2.6 + Math.random() * 1.5;
        break;
      default:
        this.miniNextBehavior = n + 3 + Math.random() * 2;
    }
  }
  // ── Dancing ─────────────────────────────────────────────────────────────────
  setDancing(dancing) {
    if (this.isDancing !== dancing) this.isDancing = dancing;
  }
  /**
   * Applies the dance bounce and sway around the bottom of the body. Call it on
   * a saved context, before draw(), with the same size (BotEngine.applyDance).
   */
  applyDance(x, W, H) {
    if (this.dancingLevel <= 1e-3) return;
    const R = W * 0.3;
    const px = W / 2 + this.ox * R;
    const py = H / 2 + this.particleOverhang / 2 + this.oy * R + R * 0.06 + R * 0.88;
    const d = danceTransform(now(), this.dancingLevel, R);
    x.translate(px + d.dx, py + d.dy);
    x.rotate(d.rotate);
    x.scale(d.sx, d.sy);
    x.translate(-px, -py);
  }
  // ── Draw ────────────────────────────────────────────────────────────────────
  /**
   * Draws hands, body, blush, eyes, mouth, badge and particles into a canvas of
   * `w`×`h` CSS pixels (the caller has already applied the DPR transform).
   */
  draw(x, W, H) {
    const R = W * 0.3;
    const rx = R * 1.14;
    const ry = R * 0.88;
    const cx = W / 2 + this.ox * R;
    const cy = H / 2 + this.particleOverhang / 2 + this.oy * R + R * 0.06;
    x.save();
    if (this.rigidRoll && Math.abs(this.roll) > 1e-3) {
      x.translate(cx, cy);
      x.rotate(this.roll);
      x.translate(-cx, -cy);
    }
    this.drawHandsBehind(x, R, rx, ry, cx, cy);
    x.save();
    x.translate(cx, cy);
    if (this.tilt !== 0) x.rotate(this.tilt);
    x.scale(this.sx, this.sy);
    const dressed = !this.isMini && this.outfit !== "none";
    const head = dressed ? makeHead(R, this.yaw, this.pitch, this.physDx, this.physDy) : null;
    const outfitState = {
      presence: this.outfitPresence,
      morph: this.morph
    };
    if (head) drawOutfitBehind(x, this.outfit, head, outfitState);
    this.drawPetBehind(x, R, rx, ry);
    const body = this.bodyPath(rx, ry, R);
    this.drawBody(x, body, R, rx, ry);
    this.drawPetFace(x, body, R, rx, ry);
    const blushVal = Math.max(this.blush, this.tint * 0.5) * (1 - this.morph);
    if (blushVal > 0.01) {
      x.save();
      x.clip(body);
      const yOffset = Math.sin(this.yaw) * rx * 0.8;
      x.fillStyle = `rgba(255,120,150,${0.5 * blushVal})`;
      for (const sd of [
        -1,
        1
      ]) {
        x.beginPath();
        x.ellipse(sd * rx * 0.55 + yOffset, ry * 0.2, R * 0.17, R * 0.1, 0, 0, Math.PI * 2);
        x.fill();
      }
      x.restore();
    }
    this.drawEyes(x, body, R, rx, ry);
    if (this.morph > 0.05) this.drawMouth(x, body, R);
    this.drawPetFront(x, R, rx, ry);
    if (head) drawOutfitFront(x, this.outfit, head, outfitState);
    x.restore();
    x.restore();
    if (this.badge && this.badgeS > 0.01 && this.morph < 0.25) {
      this.drawBadge(x, this.badge, R, cx, cy);
    }
    this.drawParticles(x, R, cx, cy);
  }
  bodyPath(rx, ry, R) {
    const n = 72;
    const expN = 2 / 2.7;
    const tw = R * 1;
    const th = R * 0.94;
    const tr = R * 0.42;
    const p = new Path2D();
    const m = this.morph;
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const px0 = rx * (ca >= 0 ? Math.pow(ca, expN) : -Math.pow(-ca, expN));
      const py0 = ry * (sa >= 0 ? Math.pow(sa, expN) : -Math.pow(-sa, expN));
      let px = px0;
      let py = py0;
      if (m >= 5e-3) {
        const rr = rrPoint(ca, sa, tw, th, tr);
        px = lerp(px0, rr.x, m);
        py = lerp(py0, rr.y, m);
      }
      if (i === 0) p.moveTo(px, py);
      else p.lineTo(px, py);
    }
    p.closePath();
    return p;
  }
  /** How much of the pumpkin's orange shows on the body (it comes and goes with the outfit). */
  get pumpkinAlpha() {
    if (this.isMini || this.outfit !== "pumpkin") return 0;
    return Math.min(1, this.outfitPresence * 2.5) * (1 - this.morph);
  }
  drawBody(x, body, R, rx, ry) {
    const pumpkin2 = this.pumpkinAlpha;
    const bodyColor = this.angry ? ANGER_BODY : this.bodyColor;
    if (bodyColor) {
      x.fillStyle = rgba(bodyColor, 1);
      x.fill(body);
      if (pumpkin2 <= 1e-3) return;
    } else {
      const g = x.createLinearGradient(rx * 0.7, -ry * 0.85, -rx * 0.8, ry * 0.9);
      g.addColorStop(0, rgba(BASE_TOP));
      g.addColorStop(1, rgba(BASE_BOTTOM));
      x.fillStyle = g;
      x.fill(body);
    }
    x.save();
    if (pumpkin2 > 1e-3) {
      const pg = x.createLinearGradient(rx * 0.7, -ry * 0.85, -rx * 0.8, ry * 0.9);
      pg.addColorStop(0, PUMPKIN_BODY[0]);
      pg.addColorStop(1, PUMPKIN_BODY[1]);
      x.globalAlpha = pumpkin2;
      x.fillStyle = pg;
      x.fill(body);
      x.globalAlpha = this.bodyColor ? pumpkin2 : 1;
    }
    const effectiveTint = this.tint * (1 - this.morph);
    if (effectiveTint > 0.01) {
      const tg = x.createLinearGradient(0, ry, 0, -ry);
      tg.addColorStop(0, rgba(this.col, 0.72 * effectiveTint));
      tg.addColorStop(1, rgba(this.col, 0));
      x.fillStyle = tg;
      x.fill(body);
    }
    const sh = x.createRadialGradient(0, 0, R * 0.15, 0, 0, R * 1.25);
    sh.addColorStop(0, "rgba(0,0,0,0)");
    sh.addColorStop(0.6, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(0,0,0,0.2)");
    x.fillStyle = sh;
    x.fill(body);
    const hl = x.createRadialGradient(rx * 0.34, -ry * 0.46, 0, rx * 0.34, -ry * 0.46, R * 0.42);
    hl.addColorStop(0, "rgba(255,255,255,0.55)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = hl;
    x.fill(body);
    x.restore();
  }
  drawPetBehind(x, R, rx, ry) {
    if (this.isMini || this.petKind === "nami") return;
    const t = now();
    switch (this.petKind) {
      case "puppy": {
        x.save();
        x.strokeStyle = "#B77944";
        x.lineWidth = R * 0.24;
        x.lineCap = "round";
        x.beginPath();
        x.moveTo(rx * 0.72, ry * 0.22);
        x.quadraticCurveTo(rx * 1.22, ry * 0.05, rx * 1.08, -ry * 0.5 + Math.sin(t * 4.2) * R * 0.25);
        x.stroke();
        x.restore();
        for (const sd of [
          -1,
          1
        ]) {
          x.save();
          x.translate(sd * rx * 0.82, -ry * 0.48);
          x.rotate(sd * (0.32 + Math.sin(t * 2.6 + sd) * 0.06));
          x.fillStyle = "#C98B52";
          x.beginPath();
          x.ellipse(0, R * 0.08, R * 0.26, R * 0.48, 0, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = "#A96C3C";
          x.beginPath();
          x.ellipse(0, R * 0.12, R * 0.13, R * 0.3, 0, 0, Math.PI * 2);
          x.fill();
          x.restore();
        }
        break;
      }
      case "kitty": {
        x.save();
        x.strokeStyle = "#9B9BB0";
        x.lineWidth = R * 0.14;
        x.lineCap = "round";
        x.beginPath();
        x.moveTo(rx * 0.7, ry * 0.3);
        x.quadraticCurveTo(rx * 1.18, ry * 0.1, rx * 1.05, -ry * 0.35 + Math.sin(t * 2.4) * R * 0.3);
        x.stroke();
        x.restore();
        for (const sd of [
          -1,
          1
        ]) {
          x.save();
          x.translate(sd * rx * 0.58, -ry * 0.72);
          x.rotate(sd * (0.08 + Math.sin(t * 1.9 + sd) * 0.04));
          x.fillStyle = "#B7B7C8";
          x.beginPath();
          x.moveTo(-R * 0.34, R * 0.18);
          x.lineTo(0, -R * 0.78);
          x.lineTo(R * 0.34, R * 0.18);
          x.closePath();
          x.fill();
          x.fillStyle = "#F1B5C7";
          x.beginPath();
          x.moveTo(-R * 0.18, R * 0.1);
          x.lineTo(0, -R * 0.48);
          x.lineTo(R * 0.18, R * 0.1);
          x.closePath();
          x.fill();
          x.restore();
        }
        break;
      }
      case "panda": {
        for (const sd of [
          -1,
          1
        ]) {
          x.save();
          x.translate(sd * rx * 0.62, -ry * 0.78 + Math.sin(t * 2 + sd) * R * 0.025);
          x.rotate(sd * 0.15);
          x.fillStyle = "#24242A";
          x.beginPath();
          x.ellipse(0, 0, R * 0.34, R * 0.3, 0, 0, Math.PI * 2);
          x.fill();
          x.restore();
        }
        break;
      }
      case "fox": {
        x.save();
        x.strokeStyle = "#D9783B";
        x.lineWidth = R * 0.34;
        x.lineCap = "round";
        x.beginPath();
        x.moveTo(rx * 0.7, ry * 0.24);
        x.quadraticCurveTo(rx * 1.28, ry * 0.12, rx * 1.16, -ry * 0.48 + Math.sin(t * 2.2) * R * 0.18);
        x.stroke();
        x.strokeStyle = "#FFF2E4";
        x.lineWidth = R * 0.2;
        x.beginPath();
        x.moveTo(rx * 1.04, -ry * 0.42);
        x.lineTo(rx * 1.22, -ry * 0.55 + Math.sin(t * 2.2) * R * 0.18);
        x.stroke();
        x.restore();
        for (const sd of [
          -1,
          1
        ]) {
          x.save();
          x.translate(sd * rx * 0.55, -ry * 0.78);
          x.rotate(sd * (0.08 + Math.sin(t * 2.1 + sd) * 0.035));
          x.fillStyle = "#E98243";
          x.beginPath();
          x.moveTo(-R * 0.36, R * 0.2);
          x.lineTo(0, -R * 0.85);
          x.lineTo(R * 0.36, R * 0.2);
          x.closePath();
          x.fill();
          x.fillStyle = "#FFF0E1";
          x.beginPath();
          x.moveTo(-R * 0.18, R * 0.12);
          x.lineTo(0, -R * 0.52);
          x.lineTo(R * 0.18, R * 0.12);
          x.closePath();
          x.fill();
          x.restore();
        }
        break;
      }
      case "penguin": {
        for (const sd of [
          -1,
          1
        ]) {
          x.save();
          x.translate(sd * rx * 0.86, ry * 0.02);
          x.rotate(sd * (0.14 + Math.sin(t * 3.2 + sd) * 0.12));
          x.fillStyle = "#1A202D";
          x.beginPath();
          x.ellipse(0, R * 0.12, R * 0.16, R * 0.44, 0, 0, Math.PI * 2);
          x.fill();
          x.restore();
          x.save();
          x.fillStyle = "#F2A23A";
          x.beginPath();
          x.ellipse(sd * rx * 0.38, ry * 0.92, R * 0.24, R * 0.11, 0, 0, Math.PI * 2);
          x.fill();
          x.restore();
        }
        break;
      }
      case "spider": {
        x.save();
        x.strokeStyle = "#311C2B";
        x.lineWidth = R * 0.075;
        x.lineCap = "round";
        for (const sd of [
          -1,
          1
        ]) {
          for (let i = 0; i < 4; i++) {
            const baseX = sd * rx * 0.55;
            const baseY = ry * (-0.32 + i * 0.18);
            const swing = Math.sin(t * 4.2 + i * 1.1 + (sd > 0 ? 0 : Math.PI)) * R * 0.14;
            const kneeX = baseX + sd * (R * 0.56 + i * R * 0.06);
            const kneeY = baseY - R * 0.3 + swing;
            const footX = baseX + sd * (R * 0.92 + i * R * 0.08);
            const footY = baseY + R * 0.48 + Math.cos(t * 4.2 + i) * R * 0.08;
            x.beginPath();
            x.moveTo(baseX, baseY);
            x.quadraticCurveTo(kneeX, kneeY, footX, footY);
            x.stroke();
          }
        }
        x.restore();
        break;
      }
      case "robo": {
        x.save();
        x.strokeStyle = "#8E8E9A";
        x.lineWidth = R * 0.075;
        x.lineCap = "round";
        x.beginPath();
        x.moveTo(0, -ry * 0.9);
        x.lineTo(Math.sin(t * 2.3) * R * 0.12, -ry * 1.45);
        x.stroke();
        x.fillStyle = "#7FF7F0";
        x.beginPath();
        x.arc(Math.sin(t * 2.3) * R * 0.12, -ry * 1.48, R * 0.13, 0, Math.PI * 2);
        x.fill();
        for (const sd of [
          -1,
          1
        ]) {
          x.fillStyle = "#7B8B96";
          x.beginPath();
          x.arc(sd * rx * 0.9, -ry * 0.12, R * 0.1, 0, Math.PI * 2);
          x.fill();
        }
        x.restore();
        break;
      }
    }
  }
  faceShift(rx, ry) {
    const pitch = this.petKind === "nami" ? this.pitch : Math.max(0, this.pitch);
    const eyePitch = EYE_P2 + pitch + (this.rigidRoll ? 0 : this.roll);
    const eyeX = Math.sin(this.yaw) * Math.cos(eyePitch) * rx * Math.cos(EYE_SP2);
    const baseY = -Math.sin(EYE_P2) * ry;
    const eyeY = -Math.sin(eyePitch) * ry;
    const scale = Math.max(0.82, Math.cos(this.yaw));
    return {
      x: eyeX,
      y: eyeY - baseY,
      scale
    };
  }
  drawPetFace(x, body, R, rx, ry) {
    if (this.isMini || this.petKind === "nami") return;
    const t = now();
    x.save();
    x.clip(body);
    switch (this.petKind) {
      case "puppy": {
        const face = this.faceShift(rx, ry);
        x.save();
        x.translate(face.x, face.y);
        x.scale(face.scale, 1);
        x.fillStyle = "#F7E3C7";
        x.beginPath();
        x.ellipse(0, ry * 0.28, rx * 0.55, ry * 0.36, 0, 0, Math.PI * 2);
        x.fill();
        x.restore();
        break;
      }
      case "kitty": {
        const face = this.faceShift(rx, ry);
        x.save();
        x.translate(face.x, face.y);
        x.scale(face.scale, 1);
        x.fillStyle = "#E7E7EE";
        x.beginPath();
        x.ellipse(0, ry * 0.3, rx * 0.44, ry * 0.28, 0, 0, Math.PI * 2);
        x.fill();
        x.restore();
        break;
      }
      case "panda":
        break;
      case "fox": {
        const face = this.faceShift(rx, ry);
        x.save();
        x.translate(face.x, face.y);
        x.scale(face.scale, 1);
        x.fillStyle = "#FFF2E4";
        x.beginPath();
        x.ellipse(0, ry * 0.32, rx * 0.54, ry * 0.34, 0, 0, Math.PI * 2);
        x.fill();
        x.restore();
        break;
      }
      case "penguin":
        x.fillStyle = "rgba(255,255,255,0.34)";
        x.beginPath();
        x.ellipse(0, ry * 0.38, rx * 0.55, ry * 0.4, 0, 0, Math.PI * 2);
        x.fill();
        break;
      case "spider":
        break;
      case "robo":
        break;
    }
    x.restore();
  }
  drawPetFront(x, R, rx, ry) {
    if (this.isMini || this.petKind === "nami") return;
    const t = now();
    const face = this.faceShift(rx, ry);
    x.save();
    x.translate(face.x, face.y);
    x.scale(face.scale, 1);
    switch (this.petKind) {
      case "puppy":
        x.fillStyle = "#3B2A24";
        x.beginPath();
        x.ellipse(0, ry * 0.16, R * 0.14, R * 0.1, 0, 0, Math.PI * 2);
        x.fill();
        if (this.state !== "sleeping") {
          x.fillStyle = "#FF8FA3";
          x.beginPath();
          x.ellipse(0, ry * 0.48 + Math.abs(Math.sin(t * 5)) * R * 0.025, R * 0.11, R * 0.16, 0, 0, Math.PI * 2);
          x.fill();
        }
        break;
      case "kitty":
        x.fillStyle = "#E78FA6";
        x.beginPath();
        x.moveTo(0, ry * 0.12);
        x.lineTo(-R * 0.1, ry * 0.22);
        x.lineTo(R * 0.1, ry * 0.22);
        x.closePath();
        x.fill();
        x.strokeStyle = "rgba(255,255,255,0.55)";
        x.lineWidth = Math.max(1, R * 0.035);
        x.lineCap = "round";
        for (const sd of [
          -1,
          1
        ]) {
          for (let i = 0; i < 3; i++) {
            x.beginPath();
            x.moveTo(sd * rx * 0.2, ry * (0.18 + i * 0.06));
            x.lineTo(sd * rx * (0.85 + i * 0.05), ry * (0.1 + i * 0.1));
            x.stroke();
          }
        }
        break;
      case "panda":
        x.fillStyle = "#25252B";
        x.beginPath();
        x.ellipse(0, ry * 0.2, R * 0.14, R * 0.09, 0, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = "#25252B";
        x.lineWidth = Math.max(1, R * 0.035);
        x.lineCap = "round";
        x.beginPath();
        x.moveTo(0, ry * 0.28);
        x.quadraticCurveTo(-R * 0.1, ry * 0.42, -R * 0.16, ry * 0.36);
        x.moveTo(0, ry * 0.28);
        x.quadraticCurveTo(R * 0.1, ry * 0.42, R * 0.16, ry * 0.36);
        x.stroke();
        break;
      case "fox":
        x.fillStyle = "#35251F";
        x.beginPath();
        x.ellipse(0, ry * 0.16, R * 0.14, R * 0.1, 0, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = "rgba(255,242,228,0.8)";
        x.lineWidth = Math.max(1, R * 0.035);
        x.beginPath();
        x.moveTo(0, ry * 0.28);
        x.quadraticCurveTo(-R * 0.1, ry * 0.38, -R * 0.16, ry * 0.32);
        x.moveTo(0, ry * 0.28);
        x.quadraticCurveTo(R * 0.1, ry * 0.38, R * 0.16, ry * 0.32);
        x.stroke();
        break;
      case "penguin":
        x.fillStyle = "#F2A23A";
        x.beginPath();
        x.moveTo(-R * 0.14, ry * 0.05);
        x.lineTo(R * 0.14, ry * 0.05);
        x.lineTo(0, ry * 0.24);
        x.closePath();
        x.fill();
        break;
      case "spider":
        x.fillStyle = "#FFF7F2";
        for (const sd of [
          -1,
          1
        ]) {
          x.beginPath();
          x.moveTo(sd * R * 0.04, ry * 0.42);
          x.lineTo(sd * R * 0.17, ry * 0.64);
          x.lineTo(sd * R * 0.2, ry * 0.4);
          x.closePath();
          x.fill();
        }
        break;
      case "robo": {
        const pulse = 0.55 + 0.45 * Math.sin(t * 3);
        x.fillStyle = "#23303A";
        roundRectPath(x, -R * 0.16, ry * 0.22, R * 0.32, R * 0.07, R * 0.035);
        x.fill();
        x.fillStyle = `rgba(99,222,216,${0.45 + 0.35 * pulse})`;
        x.beginPath();
        x.arc(-R * 0.08, ry * 0.255, R * 0.032, 0, Math.PI * 2);
        x.arc(R * 0.08, ry * 0.255, R * 0.032, 0, Math.PI * 2);
        x.fill();
        break;
      }
    }
    x.restore();
    if (this.petKind === "robo") {
      const pulse = 0.55 + 0.45 * Math.sin(t * 3);
      x.fillStyle = "#23303A";
      roundRectPath(x, -rx * 0.42, ry * 0.3, rx * 0.84, ry * 0.36, R * 0.14);
      x.fill();
      x.fillStyle = `rgba(99,222,216,${0.45 + 0.35 * pulse})`;
      x.beginPath();
      x.arc(0, ry * 0.48, R * 0.1, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = "#63DED8";
      x.lineWidth = Math.max(1, R * 0.04);
      x.beginPath();
      x.moveTo(-R * 0.22, ry * 0.48);
      x.lineTo(R * 0.22, ry * 0.48);
      x.stroke();
    }
  }
  drawEyes(x, body, R, rx, ry) {
    let shape = this.eyeOverride ?? this.cfg.eye;
    if (this.isDancing && this.dancingLevel > 0.15 && !this.isMini && (this.state === "idle" || this.state === "finished")) {
      shape = "happy";
    }
    if (this.morph > 0.5) {
      if (this.isChewing) shape = "happy";
      else if (this.slotHTarget > 0.05 || this.slotH > 0.1) shape = "cup";
    }
    x.save();
    x.clip(body);
    const ink = this.isMini ? MINI_INK : INK;
    x.fillStyle = ink;
    x.strokeStyle = ink;
    for (const sd of [
      -1,
      1
    ]) {
      const eyeYaw = sd * EYE_SP2 + this.yaw;
      const pitch = this.petKind === "nami" ? this.pitch : Math.max(0, this.pitch);
      let eyePitch = EYE_P2 + pitch + (this.rigidRoll ? 0 : this.roll);
      eyePitch = ((eyePitch + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      const cp = Math.cos(eyePitch);
      if (Math.cos(eyeYaw) * cp <= 0.04) continue;
      const ex = Math.sin(eyeYaw) * cp * rx;
      const ey = -Math.sin(eyePitch) * ry + (this.morph > 0 ? ry * 0.14 * this.morph : 0);
      const fx = lerp(Math.max(0.18, Math.cos(eyeYaw)), 1, this.morph * 0.7);
      const fy = lerp(Math.max(0.18, cp), 1, this.morph * 0.7);
      const eyeMult = this.isMini ? 1.9 : 1;
      const ew = R * EYE_W2 * this.es * eyeMult;
      const eh = R * EYE_H2 * this.es * eyeMult;
      x.save();
      x.translate(ex, ey);
      x.scale(fx, fy);
      this.drawEyeShape(x, shape, ew, eh, sd, ink);
      x.restore();
    }
    x.restore();
  }
  drawEyeShape(x, shape, w, h, sd, ink) {
    const t = now();
    switch (shape) {
      case "wide":
        this.drawEyeShape(x, "pill", w * 1.16, h * 1.12, sd, ink);
        break;
      case "pill": {
        const hh = Math.max(h * this.open, w * 0.3);
        roundRectPath(x, -w / 2, -hh / 2, w, hh, Math.min(w / 2, hh / 2));
        x.fill();
        break;
      }
      case "dot":
        x.beginPath();
        x.arc(0, 0, w * 0.45, 0, Math.PI * 2);
        x.fill();
        break;
      case "line":
        x.rotate(-sd * 0.2);
        roundRectPath(x, -w * 0.78, -w * 0.21, w * 1.56, w * 0.42, w * 0.21);
        x.fill();
        break;
      case "flat":
        roundRectPath(x, -w * 0.72, -w * 0.2, w * 1.44, w * 0.4, w * 0.2);
        x.fill();
        break;
      case "angry":
        x.rotate(-sd * 0.3);
        roundRectPath(x, -w * 0.76, -w * 0.22, w * 1.52, w * 0.44, w * 0.22);
        x.fill();
        break;
      case "happy":
        x.lineWidth = w * 0.5;
        x.lineCap = "round";
        x.beginPath();
        x.arc(0, h * 0.18, w * 0.82, Math.PI * 1.12, Math.PI * 1.88);
        x.stroke();
        break;
      case "closed":
        x.lineWidth = w * 0.36;
        x.lineCap = "round";
        x.beginPath();
        x.arc(0, -h * 0.08, w * 0.78, Math.PI * 0.15, Math.PI * 0.85);
        x.stroke();
        break;
      case "spiral": {
        x.lineWidth = w * 0.22;
        x.lineCap = "round";
        x.beginPath();
        for (let a = 0; a < 4.4 * Math.PI; a += 0.2) {
          const r = w * 0.06 + a * w * 0.058;
          const aa = a + t * 9 * sd;
          const px = Math.cos(aa) * r;
          const py = Math.sin(aa) * r;
          if (a === 0) x.moveTo(px, py);
          else x.lineTo(px, py);
        }
        x.stroke();
        break;
      }
      case "heart":
        x.fillStyle = "#FF4D6D";
        heartPath(x, w * 1.2);
        x.fill();
        x.fillStyle = ink;
        break;
      case "star":
        x.fillStyle = "#F7B32B";
        x.rotate(t * 1.5 * sd);
        starPath(x, w * 1.05, w * 0.46);
        x.fill();
        x.fillStyle = ink;
        break;
      case "tired":
        roundRectPath(x, -w / 2, -h * 0.02, w, h * 0.38, w / 2);
        x.fill();
        roundRectPath(x, -w * 0.62, -h * 0.1, w * 1.24, w * 0.22, w * 0.11);
        x.fill();
        break;
      case "wink":
        if (sd < 0) {
          const hh = Math.max(h * this.open, w * 0.3);
          roundRectPath(x, -w / 2, -hh / 2, w, hh, Math.min(w / 2, hh / 2));
          x.fill();
        } else {
          x.lineWidth = w * 0.5;
          x.lineCap = "round";
          x.beginPath();
          x.arc(0, h * 0.18, w * 0.82, Math.PI * 1.12, Math.PI * 1.88);
          x.stroke();
        }
        break;
      case "cup": {
        const hh = Math.max(h * this.open, w * 0.3);
        const cr = Math.min(w / 2, hh / 2);
        x.beginPath();
        x.moveTo(-w / 2, -hh / 2);
        x.lineTo(w / 2, -hh / 2);
        x.lineTo(w / 2, hh / 2 - cr);
        x.quadraticCurveTo(w / 2, hh / 2, w / 2 - cr, hh / 2);
        x.lineTo(-w / 2 + cr, hh / 2);
        x.quadraticCurveTo(-w / 2, hh / 2, -w / 2, hh / 2 - cr);
        x.closePath();
        x.fill();
        break;
      }
    }
  }
  /** Mailbox slot: dark pill cut into the box face, with rim and lip highlights. */
  drawMouth(x, body, R) {
    const m = this.morph;
    const hW = R * 1.8 * m;
    const hH = this.slotH * R * m;
    const hX = -hW / 2;
    const boxTop = -R * (0.88 + 0.06 * m);
    const hY = boxTop + R * 0.08 * m;
    x.save();
    x.clip(body);
    x.strokeStyle = `rgba(255,255,255,${0.55 * m})`;
    x.lineWidth = 1;
    x.lineCap = "round";
    x.beginPath();
    x.moveTo(-R * 0.9 * m, boxTop + 1);
    x.lineTo(R * 0.9 * m, boxTop + 1);
    x.stroke();
    if (hH > 0.8) {
      const hR = Math.min(hW / 2, hH / 2);
      const g = x.createLinearGradient(0, hY, 0, hY + hH);
      g.addColorStop(0, "rgb(7,8,10)");
      g.addColorStop(1, "rgb(16,19,26)");
      roundRectPath(x, hX, hY, hW, hH, hR);
      x.fillStyle = g;
      x.fill();
      if (hH > 4) {
        const lipR = Math.min(hR, (hW - 2) / 2);
        x.strokeStyle = `rgba(255,255,255,${0.28 * m})`;
        x.beginPath();
        x.moveTo(hX + lipR, hY + hH - 0.5);
        x.lineTo(hX + hW - lipR, hY + hH - 0.5);
        x.stroke();
      }
    }
    x.restore();
  }
  /** Hands sit behind the body — drawn before it, in world coordinates. */
  drawHandsBehind(x, R, rx, ry, cx, cy) {
    if (this.hands <= 0.01 || this.isMini || this.petKind === "spider") return;
    if (R <= 14) return;
    const n = now();
    const bodyH = 2 * ry;
    const hew = 0.3 * ry * this.hands;
    const heh = 0.26 * ry * this.hands;
    const hwB = rx * this.sx;
    const hhB = ry * this.sy;
    const isWaving = n >= this.waveStart && this.waveStart > 0 && n < this.waveUntil;
    for (const sd of [
      -1,
      1
    ]) {
      let localX;
      let localY;
      let handRot = 0;
      if (sd > 0 && isWaving) {
        const wt = n - this.waveStart;
        const rise = Math.min(1, wt / 0.18);
        const riseEased = 1 - Math.pow(1 - rise, 3);
        const restX = hwB * 1.08;
        const restY = hhB * 0.7;
        const oscX = Math.cos(13 * wt) * 0.06 * bodyH;
        const oscY = -Math.sin(13 * wt) * 0.14 * bodyH;
        const waveX = hwB * 1.1 + oscX;
        const waveY = -hhB * 0.15 + oscY;
        localX = restX + (waveX - restX) * riseEased;
        localY = restY + (waveY - restY) * riseEased;
        handRot = (-0.5 + Math.sin(13 * wt) * 0.35) * riseEased;
      } else if (sd < 0 && isWaving) {
        const wt = n - this.waveStart;
        localX = -hwB * 1.08;
        localY = hhB * 0.7 + Math.sin(6 * wt) * 0.04 * bodyH;
      } else {
        localX = sd * hwB * 1.08;
        localY = hhB * 0.7;
      }
      const cosT = Math.cos(this.tilt);
      const sinT = Math.sin(this.tilt);
      const worldX = cx + cosT * localX - sinT * localY;
      const worldY = cy + sinT * localX + cosT * localY;
      x.save();
      x.translate(worldX, worldY);
      if (handRot !== 0) x.rotate(handRot);
      const g = x.createLinearGradient(hew * 0.7, -heh * 0.85, -hew * 0.8, heh * 0.9);
      if (this.bodyColor) {
        g.addColorStop(0, rgba(mix3(this.bodyColor, [
          1,
          1,
          1
        ], 0.35)));
        g.addColorStop(1, rgba(this.bodyColor));
      } else {
        g.addColorStop(0, rgba(BASE_TOP));
        g.addColorStop(1, rgba(BASE_BOTTOM));
      }
      x.beginPath();
      x.ellipse(0, 0, hew, heh, 0, 0, Math.PI * 2);
      x.fillStyle = g;
      x.fill();
      x.strokeStyle = "rgba(0,0,0,0.08)";
      x.lineWidth = 1;
      x.stroke();
      x.restore();
    }
  }
  drawBadge(x, badge, R, cx, cy) {
    const bs = this.badgeS * (this.isMini ? 1.25 : 1);
    const bx = cx - R * 0.72 * this.sx;
    const by = cy - R * 0.72 * this.sy;
    const t = now();
    x.save();
    x.translate(bx, by);
    x.scale(bs, bs);
    const col = rgba(badge.color);
    if (badge.kind === "dots") {
      if (this.isMini) {
        const phase = t * 2.4 % 1;
        const dotR = R * 0.22 * (1 + 0.25 * Math.sin(phase * Math.PI * 2));
        x.fillStyle = "#000";
        x.beginPath();
        x.arc(0, 0, R * 0.2, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = col;
        x.beginPath();
        x.arc(0, 0, dotR, 0, Math.PI * 2);
        x.fill();
      } else {
        const pw = R * 0.72;
        const ph = R * 0.36;
        roundRectPath(x, -pw / 2, -ph / 2, pw, ph, ph / 2);
        x.fillStyle = col;
        x.fill();
        for (let i = 0; i < 3; i++) {
          const phase = ((t * 2.4 - i * 0.22) % 1 + 1) % 1;
          const dotR = R * 0.055 * (1 + 0.4 * Math.max(0, Math.sin(phase * Math.PI * 2)));
          x.fillStyle = "#fff";
          x.beginPath();
          x.arc((i - 1) * R * 0.18, 0, dotR, 0, Math.PI * 2);
          x.fill();
        }
      }
    } else if (badge.kind === "bang" || badge.kind === "question") {
      x.fillStyle = "#000";
      x.beginPath();
      x.arc(0, 0, R * 0.3, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = col;
      x.beginPath();
      x.arc(0, 0, R * 0.23, 0, Math.PI * 2);
      x.fill();
      if (!this.isMini) {
        x.fillStyle = "#fff";
        x.font = `900 ${R * 0.32}px ${FONT}`;
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillText(badge.kind === "bang" ? "!" : "?", 0, R * 0.02);
      }
    } else {
      x.fillStyle = "#000";
      x.beginPath();
      x.arc(0, 0, R * 0.2, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = col;
      x.beginPath();
      x.arc(0, 0, R * 0.135, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
  }
  drawParticles(x, R, cx, cy) {
    for (const p of this.particles) {
      if (p.age <= 0) continue;
      const k = p.age / p.life;
      const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
      const px = cx + (p.x + p.vx * p.age) * R * 1.3;
      const py = cy + (p.y + p.vy * p.age) * R * 1.3;
      const sz = R * p.size * (1 + k * 0.4);
      x.save();
      x.translate(px, py);
      x.globalAlpha = Math.min(1, Math.max(0, a));
      switch (p.type) {
        case "heart":
          x.rotate(Math.sin(p.age * 6) * 0.3);
          x.fillStyle = "#FF4D6D";
          heartPath(x, sz);
          x.fill();
          break;
        case "star":
          x.rotate(p.rot + p.age * 2);
          x.fillStyle = "#F7B32B";
          starPath(x, sz, sz * 0.45);
          x.fill();
          break;
        case "spark":
          x.rotate(p.rot);
          x.fillStyle = "#fff";
          starPath(x, sz * 0.8, sz * 0.18);
          x.fill();
          break;
        case "sweat":
          x.fillStyle = "#7CC7FF";
          x.beginPath();
          x.moveTo(0, -sz);
          x.quadraticCurveTo(sz * 0.8, sz * 0.2, 0, sz * 0.6);
          x.quadraticCurveTo(-sz * 0.8, sz * 0.2, 0, -sz);
          x.fill();
          break;
        case "anger":
          x.rotate(p.rot + p.age * 3);
          x.strokeStyle = "#FF4D5E";
          x.lineWidth = sz * 0.32;
          x.lineCap = "round";
          x.beginPath();
          x.moveTo(-sz * 0.75, 0);
          x.lineTo(sz * 0.75, 0);
          x.moveTo(0, -sz * 0.75);
          x.lineTo(0, sz * 0.75);
          x.stroke();
          break;
        case "z":
          x.fillStyle = "rgb(209,219,235)";
          x.font = `700 ${sz * 1.9}px ${FONT}`;
          x.textAlign = "center";
          x.textBaseline = "middle";
          x.fillText("z", 0, 0);
          break;
      }
      x.restore();
    }
  }
};
function rrPoint(ca, sa, W, H, cr) {
  const eps = 1e-6;
  const kx = ca >= 0 ? 1 : -1;
  const ky = sa >= 0 ? 1 : -1;
  const cx = kx * (W - cr);
  const cy = ky * (H - cr);
  const dot = ca * cx + sa * cy;
  const disc = dot * dot - (cx * cx + cy * cy - cr * cr);
  if (disc >= 0) {
    const t = dot + Math.sqrt(disc);
    if (t > eps) {
      const px = ca * t;
      const py = sa * t;
      if (Math.abs(px) >= W - cr - eps && Math.abs(py) >= H - cr - eps) return {
        x: px,
        y: py
      };
    }
  }
  if (Math.abs(sa) > eps) {
    const t = ky * H / sa;
    if (t > eps) {
      const px = ca * t;
      if (Math.abs(px) <= W - cr + eps) return {
        x: px,
        y: ky * H
      };
    }
  }
  if (Math.abs(ca) > eps) {
    const t = kx * W / ca;
    if (t > eps) {
      const py = sa * t;
      if (Math.abs(py) <= H - cr + eps) return {
        x: kx * W,
        y: py
      };
    }
  }
  return {
    x: kx * W,
    y: ky * H
  };
}

// src/nami/wardrobe.ts
var OUTFIT_SELECTIONS = [
  "auto",
  "none",
  "partyHat",
  "beanie",
  "crown",
  "sunglasses",
  "roundGlasses",
  "bow",
  "scarf",
  "witchHat",
  "pumpkin",
  "santaHat",
  "bunnyEars"
];
var DEFAULT_OUTFIT = "auto";
var OUTFIT_LABELS = {
  auto: "Auto",
  none: "None",
  partyHat: "Party hat",
  beanie: "Beanie",
  crown: "Crown",
  sunglasses: "Sunglasses",
  roundGlasses: "Round glasses",
  bow: "Bow",
  scarf: "Scarf",
  witchHat: "Witch hat",
  pumpkin: "Pumpkin",
  santaHat: "Santa hat",
  bunnyEars: "Bunny ears"
};
var SELECTION_SET = new Set(OUTFIT_SELECTIONS);
function parseOutfit(raw) {
  return typeof raw === "string" && SELECTION_SET.has(raw) ? raw : DEFAULT_OUTFIT;
}
function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = (h + l - 7 * m + 114) % 31 + 1;
  return [
    month,
    day
  ];
}
var DAY_MS = 864e5;
function seasonalOutfit(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (month === 12 && day === 31 || month === 1 && day <= 2) return "partyHat";
  if (month === 12 && day <= 26) return "santaHat";
  if (month === 10 || month === 11 && day === 1) return "witchHat";
  const [em, ed] = easterDate(year);
  const delta = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, em - 1, ed)) / DAY_MS);
  if (delta >= -2 && delta <= 1) return "bunnyEars";
  if (month === 6 && day >= 21 || month === 7 || month === 8) return "sunglasses";
  return "none";
}
function resolveOutfit(selection, date) {
  return selection === "auto" ? seasonalOutfit(date) : selection;
}

// src/app.ts
var PET_NAME = "Nami";
var MOVES = [
  "smile",
  "dance",
  "run",
  "cry",
  "drain",
  "angry"
];
var MODELS = [
  {
    id: "nami",
    name: "Nami",
    color: null,
    kind: "nami"
  },
  {
    id: "matcha",
    name: "Matcha",
    color: "#BFE6C9",
    kind: "nami"
  },
  {
    id: "sakura",
    name: "Sakura",
    color: "#F7C6D9",
    kind: "nami"
  },
  {
    id: "sky",
    name: "Sky",
    color: "#BFD9FF",
    kind: "nami"
  },
  {
    id: "lemon",
    name: "Lemon",
    color: "#F7E7A6",
    kind: "nami"
  },
  {
    id: "lavender",
    name: "Lavender",
    color: "#D9C8FF",
    kind: "nami"
  },
  {
    id: "puppy",
    name: "Puppy",
    color: "#F0C18A",
    kind: "puppy"
  },
  {
    id: "kitty",
    name: "Kitty",
    color: "#C9C9D6",
    kind: "kitty"
  },
  {
    id: "panda",
    name: "Panda",
    color: "#F2F2F5",
    kind: "panda"
  },
  {
    id: "fox",
    name: "Fox",
    color: "#F09A5B",
    kind: "fox"
  },
  {
    id: "penguin",
    name: "Penguin",
    color: "#AFC9D9",
    kind: "penguin"
  },
  {
    id: "spider",
    name: "Spider",
    color: "#E84B4B",
    kind: "spider"
  },
  {
    id: "robo",
    name: "Robo",
    color: "#9FE8E2",
    kind: "robo"
  }
];
var params = new URLSearchParams(location.search);
var stored = (() => {
  try {
    return JSON.parse(localStorage.getItem("nami-notch") || "{}");
  } catch {
    return {};
  }
})();
var modelId = MODELS.some((m) => m.id === params.get("model")) ? params.get("model") : MODELS.some((m) => m.id === stored.model) ? stored.model : "nami";
var outfitSelection = parseOutfit(params.get("outfit") ?? stored.outfit);
var compactParam = params.get("compact");
var compactMode = compactParam === "clock" || compactParam === "stats" ? compactParam : stored.compact === "clock" ? "clock" : "stats";
var pinned = params.has("pinned") ? params.get("pinned") === "1" : stored.pinned === true;
var statsPeek = false;
var vitals = {
  cpu: null,
  ram: "--G",
  ramPct: null,
  temp: null,
  battery: null,
  charging: false,
  plugged: false
};
var expanded = false;
var visible = false;
var hovered = false;
var forcedOpen = false;
var forceTimer = null;
var disconnectUntil = 0;
var TRIGGER_W = 300;
var TRIGGER_H = 30;
var wasLow = false;
var wasCharging = false;
var wasPlugged = false;
var sawVitals = false;
var petSize = 0;
var currentMove = null;
var moveUntil = 0;
var nextIdleMove = 0;
var runFxUntil = 0;
var moveIndex = -1;
var notch = document.getElementById("notch");
var pet = document.getElementById("pet");
var bigPetSlot = document.getElementById("pet-big");
var clock = document.getElementById("clock");
var dateEl = document.getElementById("date");
var cpuEl = document.getElementById("cpu");
var ramEl = document.getElementById("ram");
var tempEl = document.getElementById("temp");
var batEl = document.getElementById("bat");
var bigCpu = document.getElementById("big-cpu");
var bigRam = document.getElementById("big-ram");
var bigTemp = document.getElementById("big-temp");
var bigBat = document.getElementById("big-bat");
var statusEl = document.getElementById("status");
var modelRow = document.getElementById("models");
var modelLabel = document.getElementById("model-label");
var outfitLabel = document.getElementById("outfit-label");
var outfitPrev = document.getElementById("outfit-prev");
var outfitNext = document.getElementById("outfit-next");
var bolt = document.getElementById("bolt");
var timeToggle = document.getElementById("time-toggle");
var pinToggle = document.getElementById("pin-toggle");
var ctx = pet.getContext("2d");
var engine = new BotEngine();
engine.isMini = false;
engine.particleOverhang = 0;
function currentModel() {
  return MODELS.find((m) => m.id === modelId) ?? MODELS[0];
}
function applyModel() {
  const model = currentModel();
  engine.bodyColor = model.color ? hexToRGB(model.color) : null;
  engine.petKind = model.kind;
  modelLabel.textContent = model.id === "nami" ? PET_NAME : `${PET_NAME} \xB7 ${model.name}`;
  for (const button of modelRow.querySelectorAll(".model")) {
    button.classList.toggle("on", button.dataset.model === model.id);
  }
}
function applyOutfit(animated = true) {
  const outfit = resolveOutfit(outfitSelection, /* @__PURE__ */ new Date());
  engine.setOutfit(outfit, animated);
  outfitLabel.textContent = outfitSelection === "auto" ? `Auto: ${OUTFIT_LABELS[outfit]}` : OUTFIT_LABELS[outfitSelection];
}
function syncNotchWidth() {
  const next = compactMode === "clock" && !expanded && !statsPeek ? `${Math.max(88, Math.ceil(clock.scrollWidth + 24))}px` : "";
  if (notch.style.width === next) return;
  notch.style.width = next;
  publishRegion();
  if (visible) window.setTimeout(publishRegion, 300);
}
function applyCompactMode() {
  const clockOnly = compactMode === "clock";
  notch.classList.toggle("clock-only", clockOnly && !statsPeek);
  syncNotchWidth();
  timeToggle.setAttribute("aria-pressed", String(clockOnly));
  timeToggle.setAttribute("aria-label", clockOnly ? "Switch compact notch to stats" : "Switch compact notch to time only");
  timeToggle.title = clockOnly ? "Compact notch: time only" : "Compact notch: stats";
}
function applyPin() {
  notch.classList.toggle("pinned", pinned);
  pinToggle.setAttribute("aria-pressed", String(pinned));
  pinToggle.setAttribute("aria-label", pinned ? "Allow notch to auto-hide" : "Keep notch visible");
  pinToggle.title = pinned ? "Notch stays visible" : "Notch auto-hides";
}
function save() {
  const data = {
    model: modelId,
    outfit: outfitSelection,
    compact: compactMode,
    pinned
  };
  try {
    localStorage.setItem("nami-notch", JSON.stringify(data));
  } catch {
  }
  window.webkit?.messageHandlers?.nami?.postMessage(JSON.stringify({
    type: "settings",
    ...data
  }));
}
function isLow() {
  return vitals.battery !== null && vitals.battery <= 8 && !vitals.charging;
}
function cancelMove() {
  currentMove = null;
  moveUntil = 0;
  runFxUntil = 0;
  engine.setDancing(false);
  engine.setAngry(false);
  if (!isLow() && !vitals.charging) engine.setState("idle");
}
function playMove(name) {
  if (isLow() || vitals.charging) return;
  cancelMove();
  currentMove = name;
  const started = performance.now();
  let duration = 2400;
  switch (name) {
    case "smile":
      engine.triggerEmote("happy", 2.4);
      engine.emit("heart", 1);
      engine.squash();
      break;
    case "dance":
      engine.setDancing(true);
      engine.triggerEmote("happy", 3);
      engine.emit("star", 2);
      duration = 3e3;
      break;
    case "run":
      engine.triggerEmote("surprised", 2);
      engine.squash();
      runFxUntil = started + 2e3;
      duration = 2200;
      break;
    case "cry":
      engine.triggerEmote("cry", 2.8);
      engine.emit("sweat", 2);
      duration = 2800;
      break;
    case "drain":
      engine.setState("sleeping");
      engine.triggerEmote("yawn", 2.4);
      engine.emit("z", 2);
      duration = 3e3;
      break;
    case "angry":
      engine.setState("idle");
      engine.setAngry(true);
      engine.emit("anger", 3);
      duration = 2400;
      break;
  }
  moveUntil = started + duration;
  nextIdleMove = started + duration + 6e3 + Math.random() * 5e3;
}
function setStateForBattery() {
  const low = isLow();
  if (vitals.charging) {
    engine.setDancing(false);
    engine.setAngry(false);
    engine.setPermanentEmote("love");
    engine.setState("idle");
    return;
  }
  if (disconnectUntil > performance.now()) {
    engine.setDancing(false);
    engine.setPermanentEmote(null);
    engine.setState("idle");
    engine.setAngry(true);
    return;
  }
  if (low) {
    engine.setDancing(false);
    if (!engine.angry) {
      engine.setPermanentEmote(null);
      engine.setState("idle");
      engine.setAngry(true);
    }
    return;
  }
  if (currentMove === "angry") {
    engine.setState("idle");
    return;
  }
  engine.setPermanentEmote(null);
  engine.setAngry(false);
  if (currentMove === "drain") {
    engine.setState("sleeping");
    return;
  }
  engine.setState("idle");
}
function applyVitals() {
  const cpu = vitals.cpu === null ? "---%" : `${Math.round(vitals.cpu)}%`;
  const temp = vitals.temp === null ? "--\xB0C" : `${Math.round(vitals.temp)}\xB0C`;
  const bat = vitals.battery === null ? "--%" : `${vitals.battery}%`;
  const ram = vitals.ram || "--G";
  cpuEl.textContent = cpu;
  ramEl.textContent = ram;
  tempEl.textContent = temp;
  batEl.textContent = bat;
  bigCpu.textContent = cpu;
  bigRam.textContent = ram;
  bigTemp.textContent = temp;
  bigBat.textContent = bat;
  cpuEl.classList.toggle("warn", vitals.cpu !== null && vitals.cpu >= 80);
  cpuEl.classList.toggle("crit", vitals.cpu !== null && vitals.cpu >= 95);
  bigCpu.classList.toggle("warn", vitals.cpu !== null && vitals.cpu >= 80);
  bigCpu.classList.toggle("crit", vitals.cpu !== null && vitals.cpu >= 95);
  ramEl.classList.toggle("warn", vitals.ramPct !== null && vitals.ramPct >= 80);
  ramEl.classList.toggle("crit", vitals.ramPct !== null && vitals.ramPct >= 92);
  bigRam.classList.toggle("warn", vitals.ramPct !== null && vitals.ramPct >= 80);
  bigRam.classList.toggle("crit", vitals.ramPct !== null && vitals.ramPct >= 92);
  tempEl.classList.toggle("warn", vitals.temp !== null && vitals.temp >= 80);
  tempEl.classList.toggle("crit", vitals.temp !== null && vitals.temp >= 90);
  bigTemp.classList.toggle("warn", vitals.temp !== null && vitals.temp >= 80);
  bigTemp.classList.toggle("crit", vitals.temp !== null && vitals.temp >= 90);
  batEl.classList.toggle("warn", vitals.battery !== null && vitals.battery <= 20);
  batEl.classList.toggle("crit", vitals.battery !== null && vitals.battery <= 8);
  bigBat.classList.toggle("warn", vitals.battery !== null && vitals.battery <= 20);
  bigBat.classList.toggle("crit", vitals.battery !== null && vitals.battery <= 8);
  const plugged = vitals.charging || vitals.plugged;
  const low = isLow();
  notch.classList.toggle("charging", plugged && !low);
  bolt.classList.toggle("on", plugged);
  const justCharging = vitals.charging && !wasCharging;
  const justPlugged = sawVitals && plugged && !wasPlugged;
  const justDisconnected = !plugged && wasPlugged;
  if (justCharging) {
    disconnectUntil = 0;
    cancelMove();
    forcedOpen = true;
    if (forceTimer !== null) window.clearTimeout(forceTimer);
    forceTimer = window.setTimeout(() => {
      forceTimer = null;
      forcedOpen = false;
      collapseOrHide();
    }, 3e3);
    setVisible(true);
    engine.triggerEmote("love", 1.2);
  } else if (justPlugged) {
    disconnectUntil = 0;
    cancelMove();
    forcedOpen = true;
    if (forceTimer !== null) window.clearTimeout(forceTimer);
    forceTimer = window.setTimeout(() => {
      forceTimer = null;
      forcedOpen = false;
      collapseOrHide();
    }, 3e3);
    setVisible(true);
    engine.triggerEmote("happy", 1.2);
  }
  if (justDisconnected) triggerDisconnectAlert();
  if (low && !wasLow && !justDisconnected) triggerLowAlert();
  wasLow = low;
  wasCharging = vitals.charging;
  wasPlugged = plugged;
  sawVitals = true;
  notch.classList.toggle("low", low || disconnectUntil > performance.now());
  updateStatus();
  setStateForBattery();
}
function updateStatus() {
  if (disconnectUntil > performance.now()) {
    statusEl.textContent = "Charger disconnected!";
    statusEl.className = "status low";
    return;
  }
  if (vitals.charging) {
    statusEl.textContent = "Charging \u2014 keep me plugged in";
    statusEl.className = "status charging";
  } else if (isLow()) {
    statusEl.textContent = "Charge it now";
    statusEl.className = "status low";
  } else if (vitals.plugged) {
    statusEl.textContent = "Plugged in";
    statusEl.className = "status charging";
  } else {
    statusEl.textContent = "";
    statusEl.className = "status";
  }
}
function triggerDisconnectAlert() {
  cancelMove();
  if (forceTimer !== null) {
    window.clearTimeout(forceTimer);
    forceTimer = null;
  }
  disconnectUntil = performance.now() + 3e3;
  forcedOpen = true;
  setVisible(true);
  engine.interruptGreet();
  engine.setPermanentEmote(null);
  engine.setState("idle");
  engine.setAngry(true);
  engine.emit("anger", 3);
  forceTimer = window.setTimeout(() => {
    forceTimer = null;
    forcedOpen = false;
    disconnectUntil = 0;
    if (isLow()) {
      triggerLowAlert();
    } else {
      notch.classList.remove("low");
      collapseOrHide();
      setStateForBattery();
      updateStatus();
    }
  }, 3e3);
}
function triggerLowAlert() {
  cancelMove();
  disconnectUntil = 0;
  forcedOpen = true;
  if (forceTimer !== null) {
    window.clearTimeout(forceTimer);
    forceTimer = null;
  }
  setVisible(true);
  engine.setPermanentEmote(null);
  engine.setState("idle");
  engine.setAngry(true);
  engine.emit("anger", 2);
  notch.classList.add("low");
  updateStatus();
}
function collapseOrHide() {
  if (pinned) {
    setExpanded(false);
    updateStatus();
  } else {
    setVisible(false);
  }
}
function setVisible(on, expand = true) {
  visible = on;
  notch.classList.toggle("visible", on);
  if (on) {
    if (expand) setExpanded(true);
    else setExpanded(false);
  } else {
    hovered = false;
    engine.lookX = 0;
    engine.lookY = 0;
    setExpanded(false);
  }
  publishRegion();
  if (on && !expand) window.setTimeout(publishRegion, 300);
}
function setHoverState(on) {
  hovered = on;
  if (on) {
    if (pinned && compactMode === "clock" && !expanded) {
      if (!visible) setVisible(true, false);
      statsPeek = true;
      applyCompactMode();
    } else if (!visible) {
      setVisible(true, false);
    }
  } else {
    if (statsPeek) {
      statsPeek = false;
      applyCompactMode();
    }
    if (!forcedOpen) {
      if (pinned) {
        if (expanded) setExpanded(false);
      } else {
        setVisible(false);
      }
    }
  }
}
function setExpanded(on) {
  if (expanded === on) return;
  expanded = on;
  notch.classList.toggle("expanded", on);
  syncNotchWidth();
  const size = 88;
  if (petSize !== size) {
    petSize = size;
    bigPetSlot.appendChild(pet);
    pet.style.width = `${size}px`;
    pet.style.height = `${size}px`;
    pet.width = Math.round(size * Math.min(2, window.devicePixelRatio || 1));
    pet.height = Math.round(size * Math.min(2, window.devicePixelRatio || 1));
  }
  if (on) {
    if (!vitals.charging && !isLow()) engine.greet();
    nextIdleMove = performance.now() + 7e3 + Math.random() * 5e3;
    startPet();
  } else {
    cancelMove();
    stopPet();
  }
  publishRegion();
  window.setTimeout(publishRegion, 300);
}
function publishRegion() {
  const r = visible ? notch.getBoundingClientRect() : {
    left: (window.innerWidth - TRIGGER_W) / 2,
    top: 0,
    width: TRIGGER_W,
    height: TRIGGER_H
  };
  window.webkit?.messageHandlers?.nami?.postMessage(JSON.stringify({
    type: "region",
    x: Math.round(r.left),
    y: Math.round(r.top),
    w: Math.round(r.width),
    h: Math.round(r.height)
  }));
}
function modelButtons() {
  for (const model of MODELS) {
    const button = document.createElement("button");
    button.className = "model";
    button.dataset.model = model.id;
    button.title = model.name;
    button.setAttribute("aria-label", model.name);
    button.style.setProperty("--swatch", model.color ?? "linear-gradient(135deg,#f4f4f6,#b9bbc2)");
    button.addEventListener("click", () => {
      modelId = model.id;
      applyModel();
      engine.squash();
      engine.triggerEmote("proud", 1.1);
      save();
    });
    modelRow.appendChild(button);
  }
}
function cycleOutfit(direction) {
  const index = OUTFIT_SELECTIONS.indexOf(outfitSelection);
  const next = (index + direction + OUTFIT_SELECTIONS.length) % OUTFIT_SELECTIONS.length;
  outfitSelection = OUTFIT_SELECTIONS[next];
  applyOutfit(true);
  engine.triggerEmote("proud", 0.9);
  save();
}
function tickClock() {
  const now2 = /* @__PURE__ */ new Date();
  const hours = now2.getHours();
  const minutes = String(now2.getMinutes()).padStart(2, "0");
  const time = `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
  const date = now2.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  clock.textContent = time;
  dateEl.textContent = `${date} \xB7 ${time}`;
  syncNotchWidth();
  window.setTimeout(tickClock, 1e3);
}
var lastFrame = performance.now();
var running = false;
function drawRunFx(ts, size) {
  if (ts >= runFxUntil) return;
  const life = Ease.out(Math.min(1, (runFxUntil - ts) / 800));
  ctx.save();
  ctx.globalAlpha = 0.18 + 0.4 * life;
  ctx.strokeStyle = "#d7e9ff";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const y = size * 0.46 + i * 7 + Math.sin(ts * 0.025 + i) * 1.5;
    const x = size * 0.06 + (ts * 0.09 + i * 9) % 12;
    const len = 7 + i % 3 * 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.restore();
}
function frame() {
  if (!expanded) {
    running = false;
    return;
  }
  const ts = performance.now();
  const dt = Math.min(0.08, Math.max(0, (ts - lastFrame) / 1e3));
  lastFrame = ts;
  if (currentMove !== null && ts >= moveUntil) {
    cancelMove();
    setStateForBattery();
  }
  if (currentMove === null && !isLow() && !vitals.charging && ts >= nextIdleMove) {
    const idleMoves = [
      "smile",
      "dance",
      "run"
    ];
    playMove(idleMoves[Math.floor(Math.random() * idleMoves.length)]);
  }
  engine.update(dt);
  const size = petSize || 88;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  drawRunFx(ts, size);
  engine.applyDance(ctx, size, size);
  engine.draw(ctx, size, size);
  ctx.restore();
  window.setTimeout(frame, isLow() ? 120 : 50);
}
function startPet() {
  if (running) return;
  running = true;
  lastFrame = performance.now();
  frame();
}
function stopPet() {
  running = false;
}
notch.addEventListener("mouseenter", () => {
  setHoverState(true);
});
notch.addEventListener("mouseleave", () => {
  setHoverState(false);
  engine.lookX = 0;
  engine.lookY = 0;
});
notch.addEventListener("dblclick", (event) => {
  event.stopPropagation();
  if (!visible) {
    setVisible(true, true);
  } else if (!expanded) {
    setExpanded(true);
  }
});
outfitPrev.addEventListener("click", (event) => {
  event.stopPropagation();
  cycleOutfit(-1);
});
outfitNext.addEventListener("click", (event) => {
  event.stopPropagation();
  cycleOutfit(1);
});
timeToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  compactMode = compactMode === "clock" ? "stats" : "clock";
  applyCompactMode();
  save();
  engine.squash();
});
pinToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  pinned = !pinned;
  applyPin();
  save();
  if (!pinned && !hovered && !forcedOpen) setVisible(false);
  engine.squash();
});
pet.title = "Click Nami for a move \u2014 move your cursor to make her follow it";
pet.addEventListener("click", (event) => {
  event.stopPropagation();
  if (isLow() || vitals.charging) return;
  moveIndex = (moveIndex + 1) % MOVES.length;
  playMove(MOVES[moveIndex]);
});
notch.addEventListener("mousemove", (event) => {
  const r = notch.getBoundingClientRect();
  engine.lookX = Math.max(-1, Math.min(1, ((event.clientX - r.left) / r.width - 0.5) * 2));
  engine.lookY = -Math.max(-1, Math.min(1, ((event.clientY - r.top) / r.height - 0.5) * 2));
});
window.setVitals = (next) => {
  vitals = next;
  applyVitals();
};
window.setHover = (on) => {
  setHoverState(on);
};
modelButtons();
applyModel();
applyOutfit(false);
applyCompactMode();
applyPin();
setStateForBattery();
petSize = 88;
pet.style.width = "88px";
pet.style.height = "88px";
pet.width = Math.round(88 * Math.min(2, window.devicePixelRatio || 1));
pet.height = Math.round(88 * Math.min(2, window.devicePixelRatio || 1));
bigPetSlot.appendChild(pet);
tickClock();
if (pinned) setVisible(true, false);
publishRegion();
window.setInterval(() => {
  if (expanded && wasCharging) {
    engine.triggerEmote("love", 1.2);
  }
}, 1600);
