// ─────────────────────────────────────────────────────────────────
// GENERATED FILE — DO NOT EDIT.
// Species data is owned by plants.json. UI is owned by ui/template.jsx.
// Regenerate with:  python3 scripts/render_jsx.py
// Editing this file directly will be overwritten and will silently
// diverge from the data every other script reads.
// ─────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════
   XERIC PLANT DATABASE v2 — Intermountain West
   
   IGNITABILITY: 0–10 scale (Idaho Firewise methodology, adopted by
   CSU Extension Fact Sheet 6.305, rev. 7/2025). HIGHER = LESS ignitable.
   CSU recommends ONLY plants rated 8+ within 30 ft of a structure
   (Home Ignition Zones 1 and 2).
   
   ignSrc: "CSU"  = value published in FS 6.305 (or genus entry therein)
           "IDFW" = value published in the Idaho Firewise "Fire Resistance of
                    Plants Master Database" — the method CSU adopted — for
                    species FS 6.305 does not list. Published, not estimated.
           "est"  = estimated from FS 6.305 ignitability criteria
                    (resin/oil content, moisture, growth form, stem type)
   
   pf = WUCOLS-style plant factor (ETo multiplier) for water budgeting.

   CULTURAL / EDIBLE FIELDS
   edible     : { part, prep } — objective food use, or null
   caution    : real hazard or regulatory flag, or null
   useTags    : Food, Beverage, Dye, Fiber, Basketry, Soap, Tool, Ceremonial
   culture    : narrative note. Names specific peoples where documented.
   cultureSrc : T = tribe-attributed in standard ethnobotanical literature
                G = general / multi-group, widely documented
                V = commonly repeated — VERIFY in NAEB before publishing

   PUBLISHING NOTE: verify every claim against the Native American
   Ethnobotany Database (naeb.brit.org), which gives tribe-level
   attribution and a source citation for each use. Name the nation, not
   "Native Americans." Use present tense — these are living practices.
   Do not publish medicinal preparation or dosage.
   ═══════════════════════════════════════════════════════════════════ */

/* __PLANTS__ */

/* ═══════════════════════ STYLE TOKENS ═══════════════════════ */
const C = {
  bg:"#f5efe2", sidebar:"#ebe2ce", card:"#fffdf7", border:"#d3c4a6",
  text:"#1c1811", muted:"#6a5f4d", primary:"#3a6a32", accent:"#9d4a1a", deep:"#28461f",
};

const TYPE_STYLE = {
  "Tree":              { bar:"#2b7a8a", badge:"#dcf1f7", text:"#0b4658" },
  "Shrub":             { bar:"#7a4d9c", badge:"#efe6f8", text:"#48186e" },
  "Cactus/Succulent":  { bar:"#b03a5b", badge:"#fbe2e9", text:"#6e0f2c" },
  "Perennial":         { bar:"#c25f2a", badge:"#fce6d9", text:"#782600" },
  "Grass":             { bar:"#57882b", badge:"#e2efd1", text:"#284e00" },
  "Groundcover":       { bar:"#9c7a17", badge:"#f8efd1", text:"#583e00" },
};

const WATER_STYLE = {
  "Very Low":     { bg:"#fef2bc", text:"#684b00", border:"#c2a51d" },
  "Low":          { bg:"#d6efd2", text:"#1c4e16", border:"#589846" },
  "Low-Moderate": { bg:"#cee7f0", text:"#0e4656", border:"#3e86a6" },
};

const USE_STYLE = {
  "Food":       { bg:"#e8f2d8", text:"#31500e", border:"#7ba33e" },
  "Beverage":   { bg:"#dceef2", text:"#134a56", border:"#489aac" },
  "Dye":        { bg:"#f6e2ee", text:"#63114a", border:"#b0508f" },
  "Fiber":      { bg:"#eee7dc", text:"#4d3b23", border:"#a08155" },
  "Basketry":   { bg:"#f5e8d2", text:"#5c3d0d", border:"#b08334" },
  "Soap":       { bg:"#e2ecf7", text:"#1d3a5c", border:"#5e83b3" },
  "Tool":       { bg:"#e6e4e0", text:"#3b382f", border:"#8b8578" },
  "Ceremonial": { bg:"#efe7f3", text:"#43205c", border:"#8b62a8" },
};
const ALL_USES = Object.keys(USE_STYLE);

const SRC_LABEL = {
  T: "Tribe-attributed in standard literature",
  G: "General / multi-group, widely documented",
  V: "Commonly repeated — verify in NAEB before publishing",
};

/* HIZ classification derived from ignitability score.
   A NULL rating means no rating is known, which is not the same as a bad one.
   Without the first branch, null falls past both comparisons and lands on
   "avoid" — turning missing data into a fabricated safety warning. Consumers
   that withhold unpublished estimates (the public site does) pass null here. */
function hiz(ign) {
  if (ign == null) return { key:"unrated", label:"Not established", short:"—", bg:"#e8e4da", text:"#5a5344", border:"#a89f8c" };
  if (ign >= 8)  return { key:"z12",   label:"HIZ 1–2 OK",     short:"1–2", bg:"#c6efbe", text:"#0c4806", border:"#46a82e" };
  if (ign >= 5)  return { key:"z3",    label:"HIZ 3 only",     short:"3",   bg:"#f5edbe", text:"#583e00", border:"#b6961e" };
  return              { key:"avoid", label:"Avoid near structures", short:"—", bg:"#f7d6c6", text:"#581606", border:"#c6461e" };
}

const ft = v => v < 1 ? `${Math.round(v * 12)}"` : `${v}′`;

/* ═══════════════════════ SMALL PARTS ═══════════════════════ */
const Chip = ({ label, s, title }) => (
  <span title={title} style={{
    display:"inline-block", padding:"2px 7px", borderRadius:3, fontSize:11, fontWeight:600,
    background:s.bg || s.badge, color:s.text, border:`1px solid ${s.border || s.bar}`, lineHeight:1.6,
  }}>{label}</span>
);

const IgnDot = ({ ign, src }) => {
  const h = hiz(ign);
  const unrated = h.key === "unrated";
  const title = unrated
    ? "No published ignitability rating for this species — treat as unrated and confirm placement with your local fire authority"
    : `Ignitability ${ign}/10 (${src === "CSU" ? "CSU FS 6.305" : src === "IDFW" ? "Idaho Firewise master database" : "estimated"}) — higher is less ignitable`;
  return (
    <span title={title} style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
      <span style={{
        width:22, height:22, borderRadius:"50%", background:h.bg,
        border:`1.5px ${unrated ? "dashed" : "solid"} ${h.border}`,
        color:h.text, fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center",
        fontVariantNumeric:"tabular-nums",
      }}>{unrated ? "—" : ign}</span>
      <span style={{ fontSize:10, color:h.text, fontWeight:600 }}>
        {unrated ? "unrated" : h.key === "avoid" ? "avoid" : `HIZ ${h.short}`}
        {!unrated && src === "est" && <span style={{opacity:0.5}}>*</span>}
      </span>
    </span>
  );
};

const SortArrow = ({ active, dir }) =>
  active ? <span style={{marginLeft:4}}>{dir === "asc" ? "↑" : "↓"}</span>
         : <span style={{marginLeft:4, opacity:0.22}}>↕</span>;

/* ═══════════════════════ MAIN APP ═══════════════════════ */
export default function XericPlantDB() {
  const [search, setSearch]       = useState("");
  const [typeF, setTypeF]         = useState([]);
  const [waterF, setWaterF]       = useState([]);
  const [hizF, setHizF]           = useState([]);
  const [zoneF, setZoneF]         = useState(0);
  const [elevF, setElevF]         = useState(0);
  const [nativeOnly, setNative]   = useState(false);
  const [deerOnly, setDeer]       = useState(false);
  const [psOnly, setPs]           = useState(false);
  const [useF, setUseF]           = useState([]);
  const [edibleOnly, setEdible]   = useState(false);
  const [view, setView]           = useState("cards");
  const [sortBy, setSortBy]       = useState("common");
  const [sortDir, setSortDir]     = useState("asc");
  const [open, setOpen]           = useState(null);

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const clearAll = () => {
    setSearch(""); setTypeF([]); setWaterF([]); setHizF([]);
    setZoneF(0); setElevF(0); setNative(false); setDeer(false); setPs(false);
    setUseF([]); setEdible(false);
  };

  const nActive = typeF.length + waterF.length + hizF.length +
    (zoneF ? 1 : 0) + (elevF ? 1 : 0) + (nativeOnly ? 1 : 0) + (deerOnly ? 1 : 0) + (psOnly ? 1 : 0) +
    useF.length + (edibleOnly ? 1 : 0) + (search ? 1 : 0);

  const plants = useMemo(() => {
    const q = search.toLowerCase().trim();
    return PLANTS.filter(p => {
      if (q) {
        const hay = `${p.common} ${p.sci} ${p.syn} ${p.family} ${p.culture || ""} ${p.useTags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (typeF.length  && !typeF.includes(p.type))   return false;
      if (waterF.length && !waterF.includes(p.water)) return false;
      if (hizF.length   && !hizF.includes(hiz(p.ign).key)) return false;
      if (zoneF && p.zoneMin > zoneF) return false;
      if (elevF && (p.elevMin > elevF || p.elevMax < elevF)) return false;
      if (nativeOnly && !p.native) return false;
      if (deerOnly && p.deer !== "Resistant") return false;
      if (psOnly && !p.ps) return false;
      if (edibleOnly && !p.edible) return false;
      if (useF.length && !useF.some(u => p.useTags.includes(u))) return false;
      return true;
    }).sort((a, b) => {
      const k = { common:"common", sci:"sci", type:"type", zone:"zoneMin", ign:"ign", height:"htMax", elev:"elevMax" }[sortBy] || "common";
      const av = a[k], bv = b[k];
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      // Unrated species have a null value. Subtracting yields NaN, which leaves
      // the comparator inconsistent and the order arbitrary — so park nulls at
      // the end in both directions instead of letting them scatter.
      if (av == null || bv == null) {
        if (av == null && bv == null) return 0;
        return av == null ? 1 : -1;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [search, typeF, waterF, hizF, zoneF, elevF, nativeOnly, deerOnly, psOnly, useF, edibleOnly, sortBy, sortDir]);

  const doSort = c => { if (sortBy === c) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(c); setSortDir("asc"); } };

  const exportCSV = () => {
    const cols = ["sci","syn","common","family","type","water","pf","zoneMin","zoneMax","ign","ignSrc","elevMin","elevMax","htMin","htMax","spMin","spMax","sun","soil","bloom","deer","native","ps","ediblePart","ediblePrep","caution","useTags","culture","cultureSrc","notes"];
    const esc = v => `"${String(v).replace(/"/g, '""')}"`;
    const val = (p, c) =>
      c === "ediblePart" ? (p.edible?.part ?? "") :
      c === "ediblePrep" ? (p.edible?.prep ?? "") :
      c === "useTags"    ? p.useTags.join("; ") :
      (p[c] ?? "");
    const rows = [cols.join(","), ...plants.map(p => cols.map(c => esc(val(p, c))).join(","))];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type:"text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "xeric-plants-imw.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const secLabel = { fontSize:10.5, fontWeight:700, color:C.muted, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:7 };
  const selStyle = { width:"100%", padding:"6px 8px", border:`1px solid ${C.border}`, borderRadius:4, fontSize:12, background:"#fff", color:C.text, fontFamily:"inherit" };
  const cbRow = { display:"flex", alignItems:"center", gap:7, marginBottom:5, cursor:"pointer" };

  /* ── Sidebar ── */
  const Sidebar = () => (
    <aside style={{ width:238, flexShrink:0, background:C.sidebar, borderRight:`1px solid ${C.border}`,
      padding:"18px 15px", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>

      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
        <span style={{fontFamily:"'Fraunces',Georgia,serif", fontSize:13, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase"}}>Filters</span>
        {nActive > 0 && <button onClick={clearAll} style={{fontSize:11, color:C.accent, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:700, padding:0}}>Clear {nActive}</button>}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, synonym, family…"
        style={{ width:"100%", padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:4, fontSize:12,
          background:"#fff", color:C.text, fontFamily:"inherit", boxSizing:"border-box", marginBottom:18, outline:"none" }} />

      {/* Defensible space */}
      <div style={{marginBottom:18}}>
        <div style={secLabel}>Defensible Space</div>
        <div style={{fontSize:10, color:C.muted, marginBottom:7, lineHeight:1.45}}>
          CSU FS 6.305 · only plants scoring 8+ belong within 30 ft of a structure
        </div>
        {[
          { k:"z12",     l:"HIZ 1–2 OK  (8–10)" },
          { k:"z3",      l:"HIZ 3 only  (5–7.9)" },
          { k:"avoid",   l:"Avoid near structures (<5)" },
          { k:"unrated", l:"Not established" },
        ].map(o => (
          <label key={o.k} style={cbRow}>
            <input type="checkbox" checked={hizF.includes(o.k)} onChange={() => toggle(hizF, setHizF, o.k)} style={{accentColor:C.primary, width:13, height:13}} />
            <span style={{fontSize:11.5}}>{o.l}</span>
          </label>
        ))}
      </div>

      {/* Elevation */}
      <div style={{marginBottom:18}}>
        <div style={secLabel}>Elevation</div>
        <div style={{fontSize:10, color:C.muted, marginBottom:7, lineHeight:1.45}}>Show species whose range includes this elevation</div>
        <select value={elevF} onChange={e => setElevF(Number(e.target.value))} style={selStyle}>
          <option value={0}>Any elevation</option>
          {[4000,5000,6000,7000,7500,8000,8500,9000,10000,11000].map(v =>
            <option key={v} value={v}>{v.toLocaleString()} ft{v === 8000 ? "  (Vail Valley)" : ""}</option>)}
        </select>
      </div>

      {/* Type */}
      <div style={{marginBottom:18}}>
        <div style={secLabel}>Plant Type</div>
        {Object.keys(TYPE_STYLE).map(t => (
          <label key={t} style={cbRow}>
            <input type="checkbox" checked={typeF.includes(t)} onChange={() => toggle(typeF, setTypeF, t)} style={{accentColor:C.primary, width:13, height:13}} />
            <span style={{fontSize:11.5}}>{t}</span>
            <span style={{width:8, height:8, borderRadius:2, background:TYPE_STYLE[t].bar, marginLeft:"auto", flexShrink:0}} />
          </label>
        ))}
      </div>

      {/* Water */}
      <div style={{marginBottom:18}}>
        <div style={secLabel}>Water Use</div>
        {["Very Low","Low","Low-Moderate"].map(w => (
          <label key={w} style={cbRow}>
            <input type="checkbox" checked={waterF.includes(w)} onChange={() => toggle(waterF, setWaterF, w)} style={{accentColor:C.primary, width:13, height:13}} />
            <span style={{fontSize:11.5}}>{w}</span>
          </label>
        ))}
      </div>

      {/* Zone */}
      <div style={{marginBottom:18}}>
        <div style={secLabel}>Hardy To Zone</div>
        <select value={zoneF} onChange={e => setZoneF(Number(e.target.value))} style={selStyle}>
          <option value={0}>Any zone</option>
          {[2,3,4,5,6,7,8,9].map(z => <option key={z} value={z}>Zone {z} or colder</option>)}
        </select>
      </div>

      {/* Human use */}
      <div style={{marginBottom:18}}>
        <div style={secLabel}>Human Use</div>
        <div style={{fontSize:10, color:C.muted, marginBottom:7, lineHeight:1.45}}>
          Documented food, craft, and material traditions
        </div>
        <div style={{display:"flex", flexWrap:"wrap", gap:4, marginBottom:8}}>
          {ALL_USES.map(u => {
            const on = useF.includes(u), st = USE_STYLE[u];
            return (
              <button key={u} onClick={() => toggle(useF, setUseF, u)} style={{
                padding:"3px 7px", borderRadius:3, fontSize:10.5, fontWeight:600, cursor:"pointer",
                fontFamily:"inherit", background: on ? st.border : st.bg,
                color: on ? "#fff" : st.text, border:`1px solid ${st.border}`,
              }}>{u}</button>
            );
          })}
        </div>
        <label style={cbRow}>
          <input type="checkbox" checked={edibleOnly} onChange={e => setEdible(e.target.checked)} style={{accentColor:C.primary, width:13, height:13}} />
          <span style={{fontSize:11.5, fontWeight:500}}>Has documented food use</span>
        </label>
      </div>

      {/* Toggles */}
      <div style={{marginBottom:18}}>
        <div style={secLabel}>Attributes</div>
        {[
          { c:nativeOnly, s:setNative, l:"Native species only" },
          { c:deerOnly,   s:setDeer,   l:"Deer resistant only" },
          { c:psOnly,     s:setPs,     l:"Plant Select® only" },
        ].map(o => (
          <label key={o.l} style={cbRow}>
            <input type="checkbox" checked={o.c} onChange={e => o.s(e.target.checked)} style={{accentColor:C.primary, width:13, height:13}} />
            <span style={{fontSize:11.5, fontWeight:500}}>{o.l}</span>
          </label>
        ))}
      </div>

      <button onClick={exportCSV} style={{ width:"100%", padding:"8px", background:C.primary, color:"#fff",
        border:"none", borderRadius:4, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600 }}>
        ↓ Export {plants.length} to CSV
      </button>

      <div style={{marginTop:20, padding:11, background:"rgba(0,0,0,0.05)", borderRadius:4, fontSize:10, color:C.muted, lineHeight:1.6}}>
        <strong style={{color:C.text}}>Ignitability 0–10.</strong> Higher = less ignitable.
        Idaho Firewise method via CSU Ext. FS 6.305 (rev. 7/2025).
        <span style={{display:"block", marginTop:5}}><strong style={{color:C.text}}>*</strong> = estimated from FS 6.305 criteria, not a published value.</span>
        <span style={{display:"block", marginTop:7}}>
          <strong style={{color:C.text}}>Cultural sources.</strong> <b>T</b> tribe-attributed · <b>G</b> general · <b>V</b> verify in NAEB before publishing.
        </span>
      </div>
    </aside>
  );

  /* ── Card ── */
  const Card = ({ p }) => {
    const ts = TYPE_STYLE[p.type], isOpen = open === p.id;
    return (
      <div onClick={() => setOpen(isOpen ? null : p.id)}
        style={{ background:C.card, borderRadius:5, border:`1px solid ${C.border}`, cursor:"pointer",
          overflow:"hidden", boxShadow: isOpen ? "0 5px 20px rgba(0,0,0,0.13)" : "0 1px 4px rgba(0,0,0,0.06)",
          transition:"box-shadow .15s" }}>
        <div style={{height:4, background:ts.bar}} />
        <div style={{padding:"12px 14px"}}>
          <div style={{display:"flex", justifyContent:"space-between", gap:6}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13.5, fontWeight:700, lineHeight:1.3}}>{p.common}</div>
              <div style={{fontSize:11, color:C.muted, fontStyle:"italic", fontFamily:"Georgia,serif", marginTop:1}}>{p.sci}</div>
              {p.syn && <div style={{fontSize:9.5, color:C.muted, marginTop:2, opacity:0.8}}>syn. {p.syn}</div>}
            </div>
            <div style={{flexShrink:0, textAlign:"right"}}>
              {p.ps && <div style={{fontSize:9, color:C.primary, fontWeight:700, marginBottom:2}}>PLANT SELECT®</div>}
              {!p.native && <div style={{fontSize:9.5, color:C.muted, background:"#eee", padding:"1px 5px", borderRadius:3, display:"inline-block"}}>non-native</div>}
            </div>
          </div>
          <div style={{fontSize:10, color:C.muted, margin:"6px 0 9px"}}>{p.family}</div>

          <div style={{display:"flex", flexWrap:"wrap", gap:5, alignItems:"center", marginBottom:10}}>
            <Chip label={p.type} s={ts} />
            <Chip label={`${p.water} · pf ${p.pf}`} s={WATER_STYLE[p.water]} title="WUCOLS-style plant factor for water budgeting" />
            <IgnDot ign={p.ign} src={p.ignSrc} />
          </div>

          {p.useTags.length > 0 && (
            <div style={{display:"flex", flexWrap:"wrap", gap:4, marginBottom:10}}>
              {p.useTags.map(u => <Chip key={u} label={u} s={USE_STYLE[u]} />)}
              {p.edible && <span style={{fontSize:10.5, color:C.primary, fontWeight:700, alignSelf:"center"}}>· edible: {p.edible.part}</span>}
            </div>
          )}

          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px 8px", fontSize:11, color:C.muted}}>
            <div><b style={{color:C.text}}>Zone</b> {p.zoneMin}–{p.zoneMax}</div>
            <div><b style={{color:C.text}}>Elev</b> {(p.elevMin/1000).toFixed(1)}–{(p.elevMax/1000).toFixed(1)}k ft</div>
            <div><b style={{color:C.text}}>H×W</b> {ft(p.htMin)}–{ft(p.htMax)} × {ft(p.spMax)}</div>
            <div><b style={{color:C.text}}>Bloom</b> {p.bloom}</div>
          </div>
          <div style={{marginTop:7, fontSize:11, color:C.muted}}>{p.sun} · Deer: {p.deer}</div>

          {isOpen && (
            <div style={{marginTop:11, paddingTop:11, borderTop:`1px solid ${C.border}`, fontSize:12, lineHeight:1.62}}>
              <div style={{marginBottom:7}}><b style={{fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em"}}>Soil</b><br/>{p.soil}</div>
              <div style={{marginBottom:7}}><b style={{fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em"}}>Wildlife</b><br/>{p.wildlife.join(" · ")}</div>
              <div style={{marginBottom:9}}>{p.notes}</div>

              {p.edible && (
                <div style={{marginBottom:7, padding:"7px 9px", background:"#eef5e4", borderLeft:`3px solid ${C.primary}`, borderRadius:2}}>
                  <b style={{fontSize:10, color:C.primary, textTransform:"uppercase", letterSpacing:"0.05em"}}>Edible · {p.edible.part}</b>
                  {p.edible.prep && <div style={{marginTop:3}}>{p.edible.prep}</div>}
                </div>
              )}

              {p.caution && (
                <div style={{marginBottom:7, padding:"7px 9px", background:"#fbeade", borderLeft:`3px solid ${C.accent}`, borderRadius:2}}>
                  <b style={{fontSize:10, color:C.accent, textTransform:"uppercase", letterSpacing:"0.05em"}}>⚠ Caution</b>
                  <div style={{marginTop:3}}>{p.caution}</div>
                </div>
              )}

              {p.culture && (
                <div style={{padding:"8px 10px", background:"#f2ece0", borderRadius:3, border:`1px solid ${C.border}`}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4}}>
                    <b style={{fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em"}}>Cultural &amp; material history</b>
                    <span title={SRC_LABEL[p.cultureSrc]} style={{
                      fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:2,
                      background: p.cultureSrc === "T" ? "#d7ecc9" : p.cultureSrc === "G" ? "#e6e3d8" : "#fbe0cd",
                      color: p.cultureSrc === "T" ? "#2c5216" : p.cultureSrc === "G" ? "#4d4636" : "#7d3208",
                      border:`1px solid ${p.cultureSrc === "T" ? "#7ba33e" : p.cultureSrc === "G" ? "#a49b83" : "#cc7a3b"}`,
                    }}>{p.cultureSrc}{p.cultureSrc === "V" ? " · verify" : ""}</span>
                  </div>
                  <div style={{fontStyle:"italic"}}>{p.culture}</div>
                </div>
              )}
            </div>
          )}
          <div style={{marginTop:8, fontSize:10, color:C.accent, fontWeight:700}}>{isOpen ? "▲ less" : "▼ notes, soil, wildlife"}</div>
        </div>
      </div>
    );
  };

  /* ── Table row ── */
  const Row = ({ p, i }) => {
    const ts = TYPE_STYLE[p.type], isOpen = open === p.id;
    const bgFor = () => isOpen ? "#f0e7d5" : i % 2 ? "#faf5ea" : C.card;
    return (
      <>
        <tr onClick={() => setOpen(isOpen ? null : p.id)}
          style={{background:bgFor(), cursor:"pointer", borderLeft:`3px solid ${ts.bar}`}}
          onMouseEnter={e => e.currentTarget.style.background = "#ebdfc9"}
          onMouseLeave={e => e.currentTarget.style.background = bgFor()}>
          <td style={{padding:"8px 11px"}}>
            <div style={{fontWeight:600, fontSize:12.5}}>{p.common}{p.ps && <span style={{color:C.primary, fontSize:9, fontWeight:700, marginLeft:5}}>PS®</span>}</div>
            <div style={{fontSize:10.5, color:C.muted, fontStyle:"italic", fontFamily:"Georgia,serif"}}>{p.sci}</div>
          </td>
          <td style={{padding:"8px 6px"}}><Chip label={p.type} s={ts} /></td>
          <td style={{padding:"8px 6px"}}><Chip label={p.water} s={WATER_STYLE[p.water]} /></td>
          <td style={{padding:"8px 6px"}}><IgnDot ign={p.ign} src={p.ignSrc} /></td>
          <td style={{padding:"8px 6px", fontSize:11.5, textAlign:"center", color:C.muted, fontVariantNumeric:"tabular-nums"}}>{p.zoneMin}–{p.zoneMax}</td>
          <td style={{padding:"8px 6px", fontSize:11.5, textAlign:"center", color:C.muted, fontVariantNumeric:"tabular-nums"}}>{(p.elevMin/1000).toFixed(1)}–{(p.elevMax/1000).toFixed(1)}k</td>
          <td style={{padding:"8px 6px", fontSize:11.5, textAlign:"center", color:C.muted}}>{ft(p.htMax)}</td>
          <td style={{padding:"8px 6px", fontSize:11.5, textAlign:"center"}}>{p.native ? <b style={{color:C.primary}}>✓</b> : <span style={{color:"#c0c0c0"}}>—</span>}</td>
        </tr>
        {isOpen && (
          <tr style={{background:"#f7efe1"}}>
            <td colSpan={8} style={{padding:"9px 14px 13px 15px", fontSize:12, lineHeight:1.62, borderLeft:`3px solid ${ts.bar}`}}>
              {p.syn && <div style={{fontSize:11, color:C.muted, marginBottom:5}}><b>Synonyms:</b> {p.syn}</div>}
              <div style={{marginBottom:5}}>{p.notes}</div>
              {p.edible && <div style={{marginBottom:4}}><b style={{color:C.primary}}>Edible ({p.edible.part}):</b> {p.edible.prep}</div>}
              {p.caution && <div style={{marginBottom:4, color:"#7d3208"}}><b>⚠ Caution:</b> {p.caution}</div>}
              {p.culture && <div style={{marginBottom:5, fontStyle:"italic"}}><b style={{fontStyle:"normal", color:C.muted}}>[{p.cultureSrc}]</b> {p.culture}</div>}
              <div style={{fontSize:11, color:C.muted}}>
                <b>Soil:</b> {p.soil} &nbsp;·&nbsp; <b>Sun:</b> {p.sun} &nbsp;·&nbsp; <b>Bloom:</b> {p.bloom} &nbsp;·&nbsp;
                <b>Spread:</b> {ft(p.spMin)}–{ft(p.spMax)} &nbsp;·&nbsp; <b>Deer:</b> {p.deer} &nbsp;·&nbsp; <b>Wildlife:</b> {p.wildlife.join(", ")}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  };

  const th = { padding:"9px 6px", fontSize:10, fontWeight:700, color:C.muted, textAlign:"left",
    letterSpacing:"0.05em", textTransform:"uppercase", borderBottom:`2px solid ${C.border}`,
    cursor:"pointer", userSelect:"none", background:C.sidebar, whiteSpace:"nowrap" };

  return (
    <div style={{fontFamily:"'Jost',system-ui,sans-serif", background:C.bg, color:C.text, height:"100vh", display:"flex", flexDirection:"column"}}>
      {/* dangerouslySetInnerHTML, not a text child: as a child, the apostrophes and
          ampersands in the @import get HTML-escaped during server rendering but not
          on the client, so React sees a text mismatch, discards the server HTML and
          re-renders the whole tree on the client. Raw CSS has to bypass escaping. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;1,400&family=Jost:wght@300;400;500;600;700&display=swap');
        * { box-sizing:border-box; } body { margin:0; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-thumb { background:#bfae8c; border-radius:3px; }
      ` }} />

      <header style={{ background:C.deep, color:"#f1ebd9", padding:"15px 26px", display:"flex",
        alignItems:"center", justifyContent:"space-between", borderBottom:`3px solid ${C.accent}`, flexShrink:0 }}>
        <div>
          <h1 style={{margin:0, fontFamily:"'Fraunces',Georgia,serif", fontWeight:700, fontSize:21, lineHeight:1.1}}>
            Xeric Plant Database <span style={{fontSize:12, color:C.accent, fontWeight:400}}>v3</span>
          </h1>
          <div style={{fontSize:10.5, color:"#a5c096", marginTop:3, letterSpacing:"0.06em", textTransform:"uppercase"}}>
            Intermountain West · CSU FS 6.305 ignitability · Ute (Nuche) homeland · Plant Select® trials
          </div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <span style={{fontSize:12.5, color:"#a5c096"}}>{plants.length} / {PLANTS.length} species</span>
          <div style={{background:"rgba(255,255,255,0.09)", borderRadius:4, display:"flex", overflow:"hidden", border:"1px solid rgba(255,255,255,0.14)"}}>
            {["cards","table"].map(m => (
              <button key={m} onClick={() => setView(m)} style={{ padding:"6px 13px", fontSize:11.5, fontWeight:600,
                fontFamily:"inherit", border:"none", cursor:"pointer",
                background: view === m ? C.accent : "transparent", color: view === m ? "#fff" : "#a5c096" }}>
                {m === "cards" ? "⊞ Cards" : "≡ Table"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{display:"flex", flex:1, minHeight:0}}>
        <Sidebar />
        <main style={{flex:1, overflowY:"auto", padding:"18px 22px"}}>
          <div style={{display:"flex", alignItems:"center", gap:14, marginBottom:15, paddingBottom:11, borderBottom:`1px solid ${C.border}`, flexWrap:"wrap"}}>
            <span style={{fontSize:11.5, color:C.muted, fontWeight:500}}>Sort</span>
            {[["common","Name"],["sci","Scientific"],["type","Type"],["ign","Ignitability"],["zone","Zone"],["elev","Max elev"],["height","Height"]].map(([k,l]) => (
              <button key={k} onClick={() => doSort(k)} style={{ fontSize:11.5, fontWeight: sortBy === k ? 700 : 400,
                color: sortBy === k ? C.primary : C.muted, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:"2px 3px" }}>
                {l}<SortArrow active={sortBy === k} dir={sortDir} />
              </button>
            ))}
          </div>

          {plants.length === 0 ? (
            <div style={{textAlign:"center", padding:70, color:C.muted}}>
              <div style={{fontSize:30, marginBottom:10}}>🌾</div>
              <div style={{fontFamily:"'Fraunces',Georgia,serif", fontSize:17}}>No species match those filters</div>
              <button onClick={clearAll} style={{marginTop:14, padding:"8px 20px", background:C.primary, color:"#fff", border:"none", borderRadius:4, cursor:"pointer", fontFamily:"inherit", fontSize:12.5}}>Clear filters</button>
            </div>
          ) : view === "cards" ? (
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(268px, 1fr))", gap:13}}>
              {plants.map(p => <Card key={p.id} p={p} />)}
            </div>
          ) : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%", borderCollapse:"collapse"}}>
                <thead><tr>
                  {[["common","Name"],["type","Type"],["water","Water"],["ign","Ignitability"],["zone","Zone"],["elev","Elev (k ft)"],["height","Max H"],["native","Native"]].map(([k,l]) =>
                    <th key={k} style={th} onClick={() => doSort(k)}>{l}<SortArrow active={sortBy === k} dir={sortDir} /></th>)}
                </tr></thead>
                <tbody>{plants.map((p,i) => <Row key={p.id} p={p} i={i} />)}</tbody>
              </table>
            </div>
          )}

          <div style={{marginTop:28, paddingTop:14, borderTop:`1px solid ${C.border}`, fontSize:10.5, color:C.muted, lineHeight:1.75}}>
            <strong style={{color:C.text}}>Sources.</strong> Ignitability ratings and elevation ranges: Colorado State University Extension &amp; Colorado State Forest Service,
            <em> Ignition-Resistant Landscape Plants</em>, Fact Sheet 6.305 (rev. July 2025), applying the Idaho Firewise 0–10 methodology.
            High-altitude performance: Plant Select® mountain trials, tested to 8,150 ft near Steamboat Springs.
            Nomenclature follows POWO where it diverges from USDA PLANTS; synonyms are listed because nursery availability tracks the older names.
            Cultural and material uses draw on the standard ethnobotanical literature, principally Moerman, D. E., <em>Native American Ethnobotany</em> (Timber Press, 1998)
            and the associated Native American Ethnobotany Database (naeb.brit.org), which supplies group-level attribution and a source citation for each recorded use.
            <span style={{display:"block", marginTop:6}}>
              <strong style={{color:C.text}}>Verify before specifying.</strong> Ratings marked <strong>*</strong> are estimated from the FS 6.305 criteria rather than published for that species,
              and elevation ceilings are approximate. Confirm defensible-space requirements with your local fire authority — jurisdictions vary.
            </span>
            <span style={{display:"block", marginTop:8, padding:"9px 11px", background:"rgba(157,74,26,0.07)", borderLeft:`3px solid ${C.accent}`, borderRadius:2}}>
              <strong style={{color:C.text}}>Before publishing cultural material.</strong> Entries flagged <strong>V</strong> are widely repeated but not well sourced — check them in NAEB first.
              Name the specific nation rather than "Native Americans": this database covers the homeland of the Nuche (Ute), and Eagle County in particular was summered by the
              Yampa and Parianuche bands. Three federally recognized tribes carry that continuity today — the Southern Ute Indian Tribe, the Ute Mountain Ute Tribe, and the
              Ute Indian Tribe of the Uintah and Ouray Reservation. Write in present tense; these are living practices, not extinct ones. Do not publish medicinal preparation
              or dosage. Older references carry common names that are slurs — do not carry them forward. Edible entries record that a plant <em>has</em> a food history;
              they are not a recommendation that anyone eat it, and foraging guidance is outside a design deliverable.
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
