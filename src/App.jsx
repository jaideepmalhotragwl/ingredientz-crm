import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

// ─── BRAND ───────────────────────────────────────────────────────────────────
const G = {
  forest:"#1B3A2D", forestDk:"#122A20", forestLt:"#2A5240",
  parchment:"#F5EDD6", parchSoft:"#EDE0C4",
  gold:"#C9A84C", goldLt:"#E2C47A",
  mist:"#8FA99A", red:"#C0392B", amber:"#E67E22", sage:"#7DAA8B", blue:"#5B8DB8",
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STAGES = ["New Enquiry","Sourcing Awaited","Quotation Sent","Documents Review","Sample Under Process","Price Negotiation","Awaiting PO","PO Received","Lost","No Response","Out of Scope","On Hold"];
const STAGE_COLORS = [G.mist,G.blue,G.gold,"#8E44AD",G.amber,G.goldLt,"#E67E22",G.sage,G.red,"#7F8C8D","#BDC3C7","#9B59B6"];
const PRIORITIES = ["High","Medium","Low"];
const PRIO_COLORS = { High:G.red, Medium:G.amber, Low:G.sage };
const SOURCES = ["Email","Phone Call","WhatsApp","Trade Show","LinkedIn","Website","Referral","Walk-in","Other"];
const UNITS = ["kg","MT","Litres","Pieces","Boxes","Bags","Other"];
const TASK_STATUSES = ["Not Started","In Progress","On Hold","Done"];
const TASK_STATUS_COLORS = {"Not Started":G.mist,"In Progress":G.blue,"On Hold":"#9B59B6","Done":G.sage};

// ─── GOOGLE SHEETS API ────────────────────────────────────────────────────────
const API = "https://script.google.com/macros/s/AKfycbxWULv8zwTSjHCmicM8e6HzerK-TPcnbaLCSfT8i-RRhhTXny4VdPchiBtXLSOrKPEo/exec";

async function sheetGet(sheet) {
  try {
    const r = await fetch(`${API}?action=get&sheet=${sheet}`);
    const d = await r.json();
    return d.rows || [];
  } catch(e) { return []; }
}

async function sheetAdd(sheet, rows) {
  try {
    await fetch(API, { method:"POST", body: JSON.stringify({ action:"add", sheet, rows }) });
  } catch(e) {}
}

async function sheetUpdate(sheet, id, updates, extra) {
  try {
    await fetch(API, { method:"POST", body: JSON.stringify({ action:"update", sheet, id, updates, ...(extra||{}) }) });
  } catch(e) {}
}

async function sheetDelete(sheet, id) {
  try {
    await fetch(API, { method:"POST", body: JSON.stringify({ action:"delete", sheet, id }) });
  } catch(e) {}
}

// ─── CACHE ────────────────────────────────────────────────────────────────────
const _cache = {};
function saveCache(k, v) { try { _cache[k] = v; } catch(e) {} }
function loadCache(k) { return _cache[k] || null; }

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
}
function reminderDate(amount, unit) {
  if (!amount) return "";
  const d = new Date();
  if (unit === "hours") d.setHours(d.getHours() + +amount);
  else if (unit === "days") d.setDate(d.getDate() + +amount);
  else if (unit === "weeks") d.setDate(d.getDate() + +amount * 7);
  return d.toISOString().split("T")[0];
}
function flattenProducts(products) {
  const o = {};
  products.forEach((p, i) => {
    o[`Product ${i+1}`] = p.name || "";
    o[`Qty ${i+1}`] = p.qty || "";
    o[`Unit ${i+1}`] = p.unit || "kg";
  });
  return o;
}
function inflateProducts(row) {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    const name = row[`Product ${i}`] || row[`product${i}`] || "";
    if (!name) break;
    out.push({ name, qty: row[`Qty ${i}`] || row[`qty${i}`] || "", unit: row[`Unit ${i}`] || row[`unit${i}`] || "kg" });
  }
  return out.length > 0 ? out : [{ name:"", qty:"", unit:"kg" }];
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const SEED_USERS = [
  { ID:1, Name:"Jaideep Malhotra", Email:"jaideep@ingredientz.com", Role:"Admin", Active:"Yes" },
  { ID:2, Name:"Param",  Email:"param@ingredientz.com",  Role:"Sales", Active:"Yes" },
  { ID:3, Name:"Ayushi", Email:"ayushi@ingredientz.com", Role:"Sales", Active:"Yes" },
  { ID:4, Name:"Sidd",   Email:"sidd@ingredientz.com",   Role:"Sales", Active:"Yes" },
  { ID:5, Name:"Shruti", Email:"shruti@ingredientz.com", Role:"Sales", Active:"Yes" },
];
const SEED_CUSTOMERS = [
  { ID:1, Company:"Nexira SAS",        Country:"France",  Contact:"Marie Dubois", Email:"procurement@nexira.com",  Phone:"", Notes:"", "Added At":"2026-01-15" },
  { ID:2, Company:"BASF Nutrition",    Country:"Germany", Contact:"Hans Müller",  Email:"sourcing@basf.com",       Phone:"", Notes:"", "Added At":"2026-01-20" },
  { ID:3, Company:"Sabinsa Corp",      Country:"India",   Contact:"Ramesh Iyer",  Email:"info@sabinsa.com",        Phone:"", Notes:"", "Added At":"2026-02-01" },
  { ID:4, Company:"NOW Health Group",  Country:"USA",     Contact:"David Kim",    Email:"sourcing@nowfoods.com",   Phone:"", Notes:"", "Added At":"2026-02-10" },
];
const SEED_ENQUIRIES = [
  { ID:1, "Customer Name":"Nexira SAS", "Contact Person":"Marie Dubois", Country:"France", "Product 1":"Ashwagandha Extract", "Qty 1":"500", "Unit 1":"kg", "Product 2":"Turmeric 95%", "Qty 2":"200", "Unit 2":"kg", "Expected Value":12000, Currency:"USD", Source:"Email", "Assigned To":"Param", Priority:"High", Stage:"Quotation Sent", "Expected Closure":"2026-04-15", "Reminder Amount":2, "Reminder Unit":"days", "Reminder Date":"2026-03-19", "Quotation Sent":"Yes", Notes:"Client wants COA", "Created At":"2026-03-01", "Created By":"Param" },
  { ID:2, "Customer Name":"BASF Nutrition", "Contact Person":"Hans Müller", Country:"Germany", "Product 1":"Vitamin D3", "Qty 1":"1", "Unit 1":"MT", "Expected Value":28000, Currency:"USD", Source:"Trade Show", "Assigned To":"Ayushi", Priority:"High", Stage:"Price Negotiation", "Expected Closure":"2026-04-30", "Reminder Amount":3, "Reminder Unit":"days", "Reminder Date":"2026-03-20", "Quotation Sent":"Yes", Notes:"Bulk order", "Created At":"2026-03-05", "Created By":"Ayushi" },
  { ID:3, "Customer Name":"Sabinsa Corp", "Contact Person":"Ramesh Iyer", Country:"India", "Product 1":"Boswellia Extract", "Qty 1":"200", "Unit 1":"kg", "Expected Value":8500, Currency:"USD", Source:"WhatsApp", "Assigned To":"Sidd", Priority:"Medium", Stage:"Sourcing Awaited", "Expected Closure":"2026-05-10", "Reminder Amount":1, "Reminder Unit":"weeks", "Reminder Date":"2026-03-24", "Quotation Sent":"No", Notes:"Waiting spec sheet", "Created At":"2026-03-10", "Created By":"Sidd" },
];
const SEED_TASKS = [
  { ID:1, Task:"Follow up with Perfect Health USA on Ashwagandha quote", Owner:"Param",           Priority:"High",   Status:"In Progress",  "Due Date":"2026-03-20", Notes:"" },
  { ID:2, Task:"Send COA documents to BASF Nutrition",                   Owner:"Ayushi",          Priority:"High",   Status:"Not Started",  "Due Date":"2026-03-18", Notes:"" },
  { ID:3, Task:"Prepare Q2 pricing sheet for US customers",              Owner:"Jaideep Malhotra",Priority:"Medium", Status:"In Progress",  "Due Date":"2026-03-25", Notes:"" },
  { ID:4, Task:"Update product catalogue with new certifications",       Owner:"Sidd",            Priority:"Low",    Status:"Not Started",  "Due Date":"2026-03-30", Notes:"" },
  { ID:5, Task:"Confirm sample shipment to Sabinsa",                     Owner:"Shruti",          Priority:"High",   Status:"Done",         "Due Date":"2026-03-16", Notes:"Shipped via DHL" },
];

// ─── REUSABLE UI ──────────────────────────────────────────────────────────────
function Btn({ label, onClick, variant="primary", size="md", disabled=false }) {
  const bg = variant==="primary" ? `linear-gradient(135deg,${G.gold},${G.goldLt})`
           : variant==="danger"  ? G.red
           : "transparent";
  const color = variant==="primary" ? G.forestDk : variant==="danger" ? "white" : G.gold;
  const pad = size==="sm" ? "5px 12px" : size==="lg" ? "13px 28px" : "9px 18px";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:bg, color, border:`1px solid ${variant==="ghost"?G.gold+"44":"transparent"}`,
      borderRadius:9, padding:pad, cursor:disabled?"not-allowed":"pointer",
      fontFamily:"Raleway,sans-serif", fontSize:size==="sm"?11:13, fontWeight:700,
      opacity:disabled?0.5:1, whiteSpace:"nowrap", letterSpacing:0.3
    }}>{label}</button>
  );
}

function StageBadge({ stage }) {
  const i = STAGES.indexOf(stage);
  const c = STAGE_COLORS[i] || G.mist;
  return <span style={{ background:`${c}22`, color:c, border:`1px solid ${c}44`, borderRadius:20, padding:"3px 11px", fontSize:11, fontWeight:700, fontFamily:"Raleway,sans-serif", whiteSpace:"nowrap" }}>{stage}</span>;
}

function PrioBadge({ priority }) {
  const c = PRIO_COLORS[priority] || G.mist;
  return <span style={{ background:`${c}22`, color:c, border:`1px solid ${c}44`, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700, fontFamily:"Raleway,sans-serif" }}>{priority}</span>;
}

function KPI({ label, value, sub, accent, icon }) {
  return (
    <div style={{ background:`linear-gradient(135deg,${G.forestDk},${G.forest})`, border:`1px solid ${accent||G.gold}33`, borderRadius:13, padding:"18px 22px", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:-8, right:-8, fontSize:44, opacity:0.07 }}>{icon}</div>
      <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:2, color:G.mist, textTransform:"uppercase", marginBottom:7 }}>{label}</div>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontWeight:600, color:accent||G.gold, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.mist, marginTop:5 }}>{sub}</div>}
    </div>
  );
}

function Card({ children, style={} }) {
  return <div style={{ background:`linear-gradient(135deg,${G.forestDk},#0F2B1E)`, borderRadius:14, border:`1px solid ${G.gold}22`, ...style }}>{children}</div>;
}

function Modal({ title, sub, onClose, children, width=780 }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:`linear-gradient(160deg,${G.forestDk},#0A1A10)`, borderRadius:18, border:`1px solid ${G.gold}33`, width:"100%", maxWidth:width, maxHeight:"92vh", overflowY:"auto", padding:30, boxShadow:"0 28px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
          <div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, color:G.parchment }}>{title}</div>
            {sub && <div style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.mist, marginTop:3, letterSpacing:0.8 }}>{sub}</div>}
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${G.gold}44`, borderRadius:"50%", width:34, height:34, cursor:"pointer", color:G.gold, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── FORM FIELD COMPONENTS (defined outside forms — prevents focus loss) ──────
function FField({ label, k, value, onChange, type="text", options=null, placeholder="", required=false, span=1 }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4, gridColumn:`span ${span}` }}>
      <label style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:1.5, color:G.mist, textTransform:"uppercase" }}>
        {label}{required && <span style={{ color:G.gold }}> *</span>}
      </label>
      {options ? (
        <select value={value} onChange={e => onChange(k, e.target.value)}
          style={{ background:`${G.forest}90`, border:`1px solid ${G.gold}33`, borderRadius:8, padding:"8px 11px", color:value?G.parchment:G.mist, fontFamily:"Raleway,sans-serif", fontSize:13, outline:"none" }}>
          <option value="">Select…</option>
          {options.map(o => <option key={o.v||o} value={o.v||o} style={{ background:G.forestDk, color:G.parchment }}>{o.l||o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(k, e.target.value)} placeholder={placeholder}
          style={{ background:`${G.forest}90`, border:`1px solid ${G.gold}33`, borderRadius:8, padding:"8px 11px", color:type==="date"&&!value?"transparent":G.parchment, fontFamily:"Raleway,sans-serif", fontSize:13, outline:"none", colorScheme:"dark", cursor:"pointer" }} />
      )}
    </div>
  );
}

function FTextarea({ label, k, value, onChange, placeholder="", rows=3, span=1 }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4, gridColumn:`span ${span}` }}>
      <label style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:1.5, color:G.mist, textTransform:"uppercase" }}>{label}</label>
      <textarea value={value} onChange={e => onChange(k, e.target.value)} placeholder={placeholder} rows={rows}
        style={{ background:`${G.forest}90`, border:`1px solid ${G.gold}33`, borderRadius:8, padding:"8px 11px", color:G.parchment, fontFamily:"Raleway,sans-serif", fontSize:13, outline:"none", resize:"vertical" }} />
    </div>
  );
}

// ─── ENQUIRY FORM ─────────────────────────────────────────────────────────────
const EMPTY_ENQ = {
  customerId:"", "Customer Name":"", "Contact Person":"", Country:"",
  products:[{ name:"", qty:"", unit:"kg" }],
  "Expected Value":"", Currency:"USD",
  Source:"", "Assigned To":"", Priority:"Medium", Stage:"New Enquiry",
  "Expected Closure":"", "Reminder Amount":"2", "Reminder Unit":"days",
  "Quotation Sent":"No", "Customer Response":"", "Purchase Order":"", Notes:"",
};

function EnquiryForm({ onSave, onClose, customers, users, initial=null }) {
  const [form, setForm] = useState(() =>
    initial ? { ...EMPTY_ENQ, ...initial, products: inflateProducts(initial) } : { ...EMPTY_ENQ }
  );
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function set(k, v) {
    setForm(f => {
      const u = { ...f, [k]: v };
      if (k === "customerId") {
        const c = customers.find(x => String(x.ID) === String(v));
        if (c) { u["Customer Name"] = c.Company; u.Country = c.Country; u["Contact Person"] = c.Contact || ""; }
      }
      return u;
    });
  }

  function setProduct(i, field, val) {
    setForm(f => ({ ...f, products: f.products.map((p, idx) => idx === i ? { ...p, [field]: val } : p) }));
  }

  function addProduct() {
    setForm(f => ({ ...f, products: [...f.products, { name:"", qty:"", unit:"kg" }] }));
  }

  function removeProduct(i) {
    setForm(f => ({
      ...f,
      products: f.products.length > 1 ? f.products.filter((_, idx) => idx !== i) : f.products
    }));
  }

  async function save() {
    if (!form["Customer Name"].trim()) { alert("Customer name is required."); return; }
    if (!form.products[0]?.name?.trim()) { alert("At least one product is required."); return; }
    setSaving(true);
    const row = {
      ...form,
      ...flattenProducts(form.products),
      ID: initial?.ID || Date.now(),
      "Reminder Date": reminderDate(form["Reminder Amount"], form["Reminder Unit"]),
      "Created At": initial?.["Created At"] || new Date().toISOString(),
      "Created By": form["Assigned To"] || "Jaideep",
    };
    delete row.products;
    delete row.customerId;
    await onSave(row);
    setDone(true);
    setTimeout(() => { setDone(false); setSaving(false); if (!initial) setForm(EMPTY_ENQ); }, 1200);
    if (initial) onClose();
  }

  const custOpts = customers.map(c => ({ v: String(c.ID), l: c.Company }));
  const userOpts = users.filter(u => u.Active === "Yes").map(u => ({ v: u.Name, l: u.Name }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Customer */}
      <div>
        <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:2, color:G.gold, textTransform:"uppercase", marginBottom:10 }}>Customer Details</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <FField label="Customer" k="customerId" value={form.customerId} onChange={set} options={custOpts} />
          <FField label="Or type company name *" k="Customer Name" value={form["Customer Name"]} onChange={set} placeholder="Company name" />
          <FField label="Contact Person" k="Contact Person" value={form["Contact Person"]} onChange={set} placeholder="Full name" />
          <FField label="Country" k="Country" value={form.Country} onChange={set} placeholder="e.g. Germany" />
          <FField label="Source" k="Source" value={form.Source} onChange={set} options={SOURCES} />
          <FField label="Assigned To" k="Assigned To" value={form["Assigned To"]} onChange={set} options={userOpts} />
        </div>
      </div>

      {/* Products */}
      <div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:2, color:G.gold, textTransform:"uppercase" }}>
            Products Enquired ({form.products.length})
          </div>
          <button onClick={addProduct} style={{ background:`${G.gold}22`, border:`1px solid ${G.gold}44`, borderRadius:7, padding:"4px 12px", cursor:"pointer", color:G.gold, fontFamily:"Raleway,sans-serif", fontSize:11, fontWeight:700 }}>
            + Add Product
          </button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"grid", gridTemplateColumns:"28px 1fr 110px 90px 32px", gap:7, padding:"0 4px" }}>
            {["#","Product Name","Qty","Unit",""].map((h, i) => (
              <div key={i} style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:1.5, color:G.mist, textTransform:"uppercase" }}>{h}</div>
            ))}
          </div>
          {form.products.map((p, idx) => (
            <div key={idx} style={{ display:"grid", gridTemplateColumns:"28px 1fr 110px 90px 32px", gap:7, alignItems:"center", background:`${G.forest}30`, borderRadius:9, padding:"9px", border:`1px solid ${G.gold}22` }}>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:15, color:G.gold, fontWeight:600, textAlign:"center" }}>{idx+1}</div>
              <input value={p.name} onChange={e => setProduct(idx,"name",e.target.value)}
                placeholder={idx===0?"e.g. Ashwagandha Extract KSM-66":"Product name…"}
                style={{ background:`${G.forest}90`, border:`1px solid ${G.gold}33`, borderRadius:7, padding:"7px 10px", color:G.parchment, fontFamily:"Raleway,sans-serif", fontSize:13, outline:"none" }} />
              <input value={p.qty} onChange={e => setProduct(idx,"qty",e.target.value)} placeholder="500"
                style={{ background:`${G.forest}90`, border:`1px solid ${G.gold}33`, borderRadius:7, padding:"7px 10px", color:G.parchment, fontFamily:"Raleway,sans-serif", fontSize:13, outline:"none" }} />
              <select value={p.unit} onChange={e => setProduct(idx,"unit",e.target.value)}
                style={{ background:`${G.forest}90`, border:`1px solid ${G.gold}33`, borderRadius:7, padding:"7px 8px", color:G.parchment, fontFamily:"Raleway,sans-serif", fontSize:13, outline:"none" }}>
                {UNITS.map(u => <option key={u} value={u} style={{ background:G.forestDk }}>{u}</option>)}
              </select>
              <button onClick={() => removeProduct(idx)} disabled={form.products.length===1}
                style={{ background:"transparent", border:`1px solid ${G.red}44`, borderRadius:7, width:30, height:30, cursor:form.products.length===1?"not-allowed":"pointer", color:G.red, fontSize:15, opacity:form.products.length===1?0.3:1, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
          ))}
          <button onClick={addProduct} style={{ border:`1px dashed ${G.gold}33`, borderRadius:9, padding:"9px", cursor:"pointer", color:G.gold, fontFamily:"Raleway,sans-serif", fontSize:12, background:"transparent", width:"100%", textAlign:"center" }}>
            + Add Another Product
          </button>
        </div>
      </div>

      {/* Value + Pipeline */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
        <FField label="Expected Value" k="Expected Value" value={form["Expected Value"]} onChange={set} placeholder="e.g. 12000" />
        <FField label="Currency" k="Currency" value={form.Currency} onChange={set} options={["USD","EUR","GBP","INR","AED"]} />
        <FField label="Stage" k="Stage" value={form.Stage} onChange={set} options={STAGES} />
        <FField label="Priority" k="Priority" value={form.Priority} onChange={set} options={PRIORITIES} />
        <FField label="Expected Closure" k="Expected Closure" value={form["Expected Closure"]} onChange={set} type="date" />
        <FField label="Reminder After" k="Reminder Amount" value={form["Reminder Amount"]} onChange={set} placeholder="e.g. 2" />
        <FField label="Reminder Unit" k="Reminder Unit" value={form["Reminder Unit"]} onChange={set} options={["hours","days","weeks"]} />
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <label style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:1.5, color:G.mist, textTransform:"uppercase" }}>Reminder Date</label>
          <div style={{ background:`${G.forest}90`, border:`1px solid ${G.gold}33`, borderRadius:8, padding:"8px 11px", color:G.gold, fontFamily:"Raleway,sans-serif", fontSize:13 }}>
            {reminderDate(form["Reminder Amount"], form["Reminder Unit"]) || "—"}
          </div>
        </div>
      </div>

      {/* Quotation checkbox */}
      <div style={{ display:"flex", gap:12 }}>
        {[["Quotation Sent","Quotation Sent"]].map(([k, label]) => (
          <div key={k} onClick={() => set(k, form[k]==="Yes"?"No":"Yes")}
            style={{ display:"flex", alignItems:"center", gap:9, background:`${G.forest}40`, borderRadius:9, padding:"10px 14px", border:`1px solid ${form[k]==="Yes"?G.gold+"44":G.gold+"22"}`, cursor:"pointer" }}>
            <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${form[k]==="Yes"?G.gold:G.mist}`, background:form[k]==="Yes"?G.gold:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              {form[k]==="Yes" && <span style={{ color:G.forestDk, fontSize:10, fontWeight:900 }}>✓</span>}
            </div>
            <span style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:form[k]==="Yes"?G.parchment:G.mist }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Notes + Response */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <FTextarea label="Customer Response" k="Customer Response" value={form["Customer Response"]} onChange={set} placeholder="What did the customer say?" />
        <FTextarea label="Notes / Follow-up" k="Notes" value={form.Notes} onChange={set} placeholder="Internal notes…" />
      </div>
      <FField label="Purchase Order #" k="Purchase Order" value={form["Purchase Order"]} onChange={set} placeholder="PO number if received" />

      <div style={{ display:"flex", gap:10, paddingTop:6 }}>
        <Btn label={saving?"Saving…":done?"✓ Saved!":initial?"Update Enquiry":"Save Enquiry"} onClick={save} size="lg" disabled={saving} />
        <Btn label="Cancel" onClick={onClose} variant="ghost" />
      </div>
    </div>
  );
}

// ─── CUSTOMER FORM ────────────────────────────────────────────────────────────
const EMPTY_CUST = { Company:"", Country:"", Contact:"", Email:"", Phone:"", Notes:"" };

function CustomerForm({ onSave, onClose, initial=null }) {
  const [form, setForm] = useState(initial ? { ...initial } : EMPTY_CUST);
  const [done, setDone] = useState(false);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  async function save() {
    if (!form.Company.trim()) { alert("Company name required."); return; }
    await onSave({ ...form, ID: initial?.ID || Date.now(), "Added At": initial?.["Added At"] || new Date().toISOString().split("T")[0] });
    setDone(true);
    setTimeout(() => { setDone(false); if (!initial) setForm(EMPTY_CUST); }, 1200);
    if (initial) onClose();
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <FField label="Company Name *" k="Company" value={form.Company} onChange={set} placeholder="e.g. Nexira SAS" />
        <FField label="Country" k="Country" value={form.Country} onChange={set} placeholder="e.g. France" />
        <FField label="Primary Contact" k="Contact" value={form.Contact} onChange={set} placeholder="Full name" />
        <FField label="Email (for auto-notification)" k="Email" value={form.Email} onChange={set} type="email" placeholder="procurement@company.com" />
        <FField label="Phone" k="Phone" value={form.Phone} onChange={set} placeholder="+33 1 23 45 67" />
      </div>
      <FTextarea label="Notes" k="Notes" value={form.Notes} onChange={set} placeholder="Any relevant info…" />
      <div style={{ display:"flex", gap:10 }}>
        <Btn label={done?"✓ Saved!":initial?"Update":"Add Customer"} onClick={save} />
        <Btn label="Cancel" onClick={onClose} variant="ghost" />
      </div>
    </div>
  );
}

// ─── USER FORM ────────────────────────────────────────────────────────────────
const EMPTY_USER = { Name:"", Email:"", Role:"Sales", Active:"Yes" };

function UserForm({ onSave, onClose, initial=null }) {
  const [form, setForm] = useState(initial ? { ...initial } : EMPTY_USER);
  const [done, setDone] = useState(false);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  async function save() {
    if (!form.Name.trim() || !form.Email.trim()) { alert("Name and email required."); return; }
    await onSave({ ...form, ID: initial?.ID || Date.now() });
    setDone(true);
    setTimeout(() => { setDone(false); if (!initial) setForm(EMPTY_USER); }, 1200);
    if (initial) onClose();
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <FField label="Full Name *" k="Name" value={form.Name} onChange={set} placeholder="e.g. Param Sharma" />
        <FField label="Email *" k="Email" value={form.Email} onChange={set} type="email" placeholder="param@ingredientz.com" />
        <FField label="Role" k="Role" value={form.Role} onChange={set} options={["Admin","Sales","Manager","Support"]} />
        <FField label="Active" k="Active" value={form.Active} onChange={set} options={["Yes","No"]} />
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <Btn label={done?"✓ Saved!":initial?"Update":"Add User"} onClick={save} />
        <Btn label="Cancel" onClick={onClose} variant="ghost" />
      </div>
    </div>
  );
}

// ─── TASK FORM FIELDS (outside TaskBoard — prevents remount) ──────────────────
function TField({ label, k, value, onChange, type="text", options=null, placeholder="" }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <label style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:1.5, color:G.mist, textTransform:"uppercase" }}>{label}</label>
      {options ? (
        <select value={value} onChange={e => onChange(k, e.target.value)}
          style={{ background:`${G.forest}90`, border:`1px solid ${G.gold}33`, borderRadius:8, padding:"8px 11px", color:value?G.parchment:G.mist, fontFamily:"Raleway,sans-serif", fontSize:13, outline:"none" }}>
          <option value="">Select…</option>
          {options.map(o => <option key={o.v||o} value={o.v||o} style={{ background:G.forestDk }}>{o.l||o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(k, e.target.value)} placeholder={placeholder}
          style={{ background:`${G.forest}90`, border:`1px solid ${G.gold}33`, borderRadius:8, padding:"8px 11px", color:type==="date"&&!value?"transparent":G.parchment, fontFamily:"Raleway,sans-serif", fontSize:13, outline:"none", colorScheme:"dark", cursor:"pointer" }} />
      )}
    </div>
  );
}

const EMPTY_TASK = { Task:"", Owner:"", Priority:"Medium", Status:"Not Started", "Due Date":"", Notes:"" };

// ─── TASK BOARD ───────────────────────────────────────────────────────────────
function TaskBoard({ tasks, users, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_TASK);
  const [done, setDone] = useState(false);
  const [filterOwner, setFilterOwner] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function openAdd() { setEditing(null); setForm(EMPTY_TASK); setShowForm(true); }
  function openEdit(t) { setEditing(t); setForm({ ...t }); setShowForm(true); }
  function cancelForm() { setShowForm(false); setEditing(null); setForm(EMPTY_TASK); }

  function save() {
    if (!form.Task.trim()) { alert("Task description required."); return; }
    if (!form.Owner) { alert("Owner required."); return; }
    const t = { ...form, ID: editing?.ID || Date.now(), "Created At": editing?.["Created At"] || new Date().toISOString() };
    editing ? onUpdate(t) : onAdd(t);
    setDone(true);
    setTimeout(() => { setDone(false); cancelForm(); }, 900);
  }

  function cycleStatus(t) {
    const next = TASK_STATUSES[(TASK_STATUSES.indexOf(t.Status) + 1) % TASK_STATUSES.length];
    onUpdate({ ...t, Status: next });
  }

  const userOpts = users.filter(u => u.Active === "Yes").map(u => ({ v: u.Name, l: u.Name }));

  const filtered = tasks
    .filter(t => !filterOwner || t.Owner === filterOwner)
    .filter(t => !filterStatus || t.Status === filterStatus)
    .sort((a, b) => {
      if (a.Status === "Done" && b.Status !== "Done") return 1;
      if (b.Status === "Done" && a.Status !== "Done") return -1;
      return ({"High":0,"Medium":1,"Low":2}[a.Priority]||1) - ({"High":0,"Medium":1,"Low":2}[b.Priority]||1);
    });

  const overdue = tasks.filter(t => t.Status !== "Done" && t["Due Date"] && daysUntil(t["Due Date"]) < 0);
  const dueToday = tasks.filter(t => t.Status !== "Done" && t["Due Date"] && daysUntil(t["Due Date"]) === 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Add/Edit form */}
      {showForm && (
        <Card style={{ padding:20, border:`1px solid ${G.gold}44` }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:G.parchment, marginBottom:16 }}>
            {editing ? "Edit Task" : "New Task"}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:14 }}>
            <div style={{ gridColumn:"span 4" }}>
              <TField label="Task Description *" k="Task" value={form.Task} onChange={setF} placeholder="e.g. Send quotation to BASF Nutrition" />
            </div>
            <TField label="Owner *" k="Owner" value={form.Owner} onChange={setF} options={userOpts} />
            <TField label="Priority" k="Priority" value={form.Priority} onChange={setF} options={PRIORITIES} />
            <TField label="Due Date" k="Due Date" value={form["Due Date"]} onChange={setF} type="date" />
            <TField label="Status" k="Status" value={form.Status} onChange={setF} options={TASK_STATUSES} />
            <div style={{ gridColumn:"span 4" }}>
              <TField label="Notes" k="Notes" value={form.Notes} onChange={setF} placeholder="Optional notes…" />
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn label={done ? "✓ Saved!" : editing ? "Update Task" : "Add Task"} onClick={save} disabled={done} />
            <Btn label="Cancel" onClick={cancelForm} variant="ghost" />
          </div>
        </Card>
      )}

      {/* Table */}
      <Card style={{ overflow:"hidden" }}>
        {/* Header */}
        <div style={{ padding:"13px 18px", display:"flex", gap:10, alignItems:"center", borderBottom:`1px solid ${G.gold}22`, flexWrap:"wrap" }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:19, fontWeight:600, color:G.parchment }}>
            Tasks
            <span style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.gold, fontWeight:400, marginLeft:8 }}>
              {tasks.filter(t => t.Status !== "Done").length} open
            </span>
          </div>
          {!showForm && <Btn label="+ New Task" onClick={openAdd} size="sm" />}
          <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)}
            style={{ marginLeft:"auto", background:G.forestDk, border:`1px solid ${G.gold}33`, borderRadius:7, padding:"6px 10px", color:G.parchment, fontFamily:"Raleway,sans-serif", fontSize:11 }}>
            <option value="">All Team</option>
            {users.filter(u => u.Active === "Yes").map(u => <option key={u.ID} value={u.Name} style={{ background:G.forestDk }}>{u.Name.split(" ")[0]}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ background:G.forestDk, border:`1px solid ${G.gold}33`, borderRadius:7, padding:"6px 10px", color:G.parchment, fontFamily:"Raleway,sans-serif", fontSize:11 }}>
            <option value="">All Status</option>
            {TASK_STATUSES.map(s => <option key={s} value={s} style={{ background:G.forestDk }}>{s}</option>)}
          </select>
        </div>

        {/* Alerts */}
        {(overdue.length > 0 || dueToday.length > 0) && (
          <div style={{ padding:"8px 18px", background:`${G.red}08`, borderBottom:`1px solid ${G.red}22`, display:"flex", gap:14 }}>
            {overdue.length > 0 && <span style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.red, fontWeight:700 }}>⚠ {overdue.length} task{overdue.length>1?"s":""} overdue</span>}
            {dueToday.length > 0 && <span style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.amber, fontWeight:700 }}>⚡ {dueToday.length} due today</span>}
          </div>
        )}

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding:30, textAlign:"center", color:G.mist, fontFamily:"Raleway,sans-serif", fontSize:12 }}>No tasks — click + New Task to add one</div>
        ) : (
          filtered.map((t, i) => {
            const d = daysUntil(t["Due Date"]);
            const isOver = t.Status !== "Done" && t["Due Date"] && d < 0;
            const isToday = t.Status !== "Done" && t["Due Date"] && d === 0;
            const isDone = t.Status === "Done";
            const sc = TASK_STATUS_COLORS[t.Status] || G.mist;
            const pc = PRIO_COLORS[t.Priority] || G.mist;
            return (
              <div key={t.ID} style={{ display:"flex", alignItems:"center", gap:11, padding:"10px 18px", background:i%2===0?`${G.forest}15`:"transparent", borderBottom:`1px solid ${G.gold}08` }}>
                {/* Status dot */}
                <div onClick={() => cycleStatus(t)} title="Click to cycle status"
                  style={{ width:13, height:13, borderRadius:"50%", background:sc, flexShrink:0, cursor:"pointer", boxShadow:`0 0 5px ${sc}77` }} />
                {/* Task */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:isDone?G.mist:G.parchment, fontWeight:isDone?400:600, textDecoration:isDone?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.Task}</div>
                  {t.Notes && <div style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.mist, marginTop:1 }}>{t.Notes}</div>}
                </div>
                {/* Owner */}
                <span style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.mist, minWidth:50, textAlign:"right" }}>{(t.Owner||"").split(" ")[0]}</span>
                {/* Priority */}
                <span style={{ background:`${pc}22`, color:pc, border:`1px solid ${pc}44`, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700, fontFamily:"Raleway,sans-serif" }}>{t.Priority}</span>
                {/* Status */}
                <span style={{ background:`${sc}22`, color:sc, border:`1px solid ${sc}44`, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700, fontFamily:"Raleway,sans-serif", minWidth:88, textAlign:"center" }}>{t.Status}</span>
                {/* Due date */}
                <span style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:isOver?G.red:isToday?G.amber:G.mist, fontWeight:isOver||isToday?700:400, minWidth:86, textAlign:"right" }}>
                  {t["Due Date"] ? (isOver ? `⚠ ${Math.abs(d)}d ago` : isToday ? "⚡ Today" : fmtDate(t["Due Date"])) : "—"}
                </span>
                {/* Actions */}
                <button onClick={() => openEdit(t)} style={{ background:"transparent", border:`1px solid ${G.gold}44`, borderRadius:6, padding:"3px 9px", cursor:"pointer", color:G.gold, fontSize:10, fontFamily:"Raleway,sans-serif" }}>Edit</button>
                <button onClick={() => onDelete(t.ID)} style={{ background:"transparent", border:`1px solid ${G.red}44`, borderRadius:6, padding:"3px 7px", cursor:"pointer", color:G.red, fontSize:10 }}>✕</button>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

// ─── ENQUIRY DRAWER ───────────────────────────────────────────────────────────
function EnquiryDrawer({ enq, onClose, onStageChange, onUpdate, customers, users }) {
  const [editing, setEditing] = useState(false);
  if (!enq) return null;
  const dClose = daysUntil(enq["Expected Closure"]);
  const dRemind = daysUntil(enq["Reminder Date"]);
  const products = inflateProducts(enq);

  return (
    <div style={{ position:"fixed", top:0, right:0, bottom:0, width:480, background:`linear-gradient(180deg,${G.forestDk},#0A1A10)`, boxShadow:"-8px 0 40px rgba(0,0,0,0.6)", zIndex:200, overflowY:"auto", borderLeft:`1px solid ${G.gold}33` }}>
      {editing ? (
        <div style={{ padding:24 }}>
          <EnquiryForm onSave={async e => { await onUpdate(e); setEditing(false); }} onClose={() => setEditing(false)} customers={customers} users={users} initial={enq} />
        </div>
      ) : (
        <div style={{ padding:26 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
            <div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:600, color:G.parchment }}>{enq["Customer Name"]}</div>
              <div style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.mist, marginTop:3 }}>{enq["Contact Person"]}{enq.Country ? ` · ${enq.Country}` : ""}</div>
              <div style={{ display:"flex", gap:7, marginTop:9, flexWrap:"wrap" }}>
                <StageBadge stage={enq.Stage} />
                <PrioBadge priority={enq.Priority} />
              </div>
            </div>
            <div style={{ display:"flex", gap:7 }}>
              <Btn label="Edit" onClick={() => setEditing(true)} size="sm" variant="ghost" />
              <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${G.gold}44`, borderRadius:"50%", width:32, height:32, cursor:"pointer", color:G.gold, fontSize:17, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
          </div>

          {/* Alerts */}
          {dRemind !== null && dRemind <= 0 && (
            <div style={{ background:`${G.red}22`, border:`1px solid ${G.red}44`, borderRadius:9, padding:"9px 14px", marginBottom:10, fontFamily:"Raleway,sans-serif", fontSize:12, color:G.red, fontWeight:600 }}>
              🔔 Reminder overdue by {Math.abs(dRemind)} day{Math.abs(dRemind)!==1?"s":""}
            </div>
          )}
          {dClose !== null && dClose <= 7 && dClose > 0 && (
            <div style={{ background:`${G.amber}22`, border:`1px solid ${G.amber}44`, borderRadius:9, padding:"9px 14px", marginBottom:10, fontFamily:"Raleway,sans-serif", fontSize:12, color:G.amber, fontWeight:600 }}>
              ⚡ Closes in {dClose} day{dClose!==1?"s":""}
            </div>
          )}

          {/* Products */}
          <div style={{ background:`${G.forest}40`, borderRadius:11, padding:14, border:`1px solid ${G.gold}22`, marginBottom:12 }}>
            <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, color:G.gold, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:9 }}>Products ({products.length})</div>
            {products.map((p, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:i<products.length-1?`1px solid ${G.gold}11`:"none" }}>
                <div style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.parchment }}>
                  <span style={{ color:G.gold, fontSize:10, marginRight:7, fontWeight:700 }}>#{i+1}</span>{p.name}
                </div>
                {p.qty && <span style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.mist, background:`${G.forest}60`, borderRadius:6, padding:"2px 9px" }}>{p.qty} {p.unit}</span>}
              </div>
            ))}
            {enq["Expected Value"] && (
              <div style={{ marginTop:9, paddingTop:9, borderTop:`1px solid ${G.gold}22`, fontFamily:"Raleway,sans-serif", fontSize:12 }}>
                <span style={{ color:G.mist }}>Value: </span>
                <span style={{ color:G.gold, fontWeight:700 }}>{enq.Currency} {Number(enq["Expected Value"]).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:12 }}>
            {[["Assigned To",enq["Assigned To"]],["Source",enq.Source],["Expected Closure",fmtDate(enq["Expected Closure"])],["Reminder Date",fmtDate(enq["Reminder Date"])],["Quotation Sent",enq["Quotation Sent"]||"No"],["Created By",enq["Created By"]]].map(([k,v])=>(
              <div key={k} style={{ background:`${G.forest}40`, borderRadius:9, padding:"9px 12px", border:`1px solid ${G.gold}22` }}>
                <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, color:G.mist, fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:3 }}>{k}</div>
                <div style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.parchment }}>{v||"—"}</div>
              </div>
            ))}
          </div>

          {enq["Customer Response"] && (
            <div style={{ background:`${G.forest}40`, borderRadius:11, padding:12, border:`1px solid ${G.gold}22`, marginBottom:10 }}>
              <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, color:G.mist, fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:5 }}>Customer Response</div>
              <div style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.parchSoft, lineHeight:1.6 }}>{enq["Customer Response"]}</div>
            </div>
          )}
          {enq.Notes && (
            <div style={{ background:`${G.forest}40`, borderRadius:11, padding:12, border:`1px solid ${G.gold}22`, marginBottom:14 }}>
              <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, color:G.mist, fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:5 }}>Notes</div>
              <div style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.parchSoft, lineHeight:1.6 }}>{enq.Notes}</div>
            </div>
          )}

          {/* Stage updater */}
          <div style={{ borderTop:`1px solid ${G.gold}22`, paddingTop:14 }}>
            <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, color:G.mist, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:9 }}>Update Stage</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {STAGES.map((s, i) => (
                <button key={s} onClick={() => onStageChange(enq.ID, s)} style={{
                  background: enq.Stage===s ? `${STAGE_COLORS[i]}33` : "transparent",
                  color: enq.Stage===s ? STAGE_COLORS[i] : G.mist,
                  border: `1px solid ${enq.Stage===s ? STAGE_COLORS[i]+"66" : G.mist+"33"}`,
                  borderRadius:20, padding:"4px 12px", cursor:"pointer", fontFamily:"Raleway,sans-serif", fontSize:11, fontWeight:enq.Stage===s?700:400
                }}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ enquiries, users, tasks, onTaskAdd, onTaskUpdate, onTaskDelete }) {
  const active = enquiries.filter(e => !["PO Received","Lost","No Response","Out of Scope"].includes(e.Stage));
  const totalVal = enquiries.filter(e => e.Stage!=="Lost").reduce((s,e) => s+(+e["Expected Value"]||0), 0);
  const poReceived = enquiries.filter(e => e.Stage==="PO Received").length;
  const overdueEnq = enquiries.filter(e => { const d=daysUntil(e["Reminder Date"]); return d!==null&&d<=0&&!["PO Received","Lost"].includes(e.Stage); });
  const closingSoon = enquiries.filter(e => { const d=daysUntil(e["Expected Closure"]); return d!==null&&d<=7&&d>=0&&!["PO Received","Lost"].includes(e.Stage); });

  const stageCounts = STAGES.map((s,i) => ({ stage:s.split(" ")[0], count:enquiries.filter(e=>e.Stage===s).length, color:STAGE_COLORS[i] })).filter(s => s.count>0);
  const assigneeCounts = users.filter(u=>u.Active==="Yes").map(u => ({ name:u.Name.split(" ")[0], count:enquiries.filter(e=>e["Assigned To"]===u.Name).length })).filter(u=>u.count>0);

  const CT = ({ active:a, payload }) => a&&payload?.length ? (
    <div style={{ background:G.forestDk, border:`1px solid ${G.gold}44`, borderRadius:7, padding:"7px 12px", fontFamily:"Raleway,sans-serif", fontSize:11, color:G.parchment }}>
      {payload[0].name||payload[0].dataKey}: <b style={{ color:G.gold }}>{payload[0].value}</b>
    </div>
  ) : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <KPI label="Total Enquiries" value={enquiries.length} sub={`${active.length} active`} icon="📋" />
        <KPI label="Pipeline Value" value={`$${Math.round(totalVal/1000)}K`} sub="Excl. lost" accent={G.gold} icon="💰" />
        <KPI label="PO Received" value={poReceived} sub="Orders confirmed" accent={G.sage} icon="✓" />
        <KPI label="Overdue Follow-ups" value={overdueEnq.length} sub={`${closingSoon.length} closing this week`} accent={overdueEnq.length>0?G.red:G.sage} icon="🔔" />
      </div>

      {/* Charts */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:14 }}>
        <Card style={{ padding:18 }}>
          <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:2, color:G.gold, textTransform:"uppercase", marginBottom:14 }}>Pipeline by Stage</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={stageCounts} margin={{ top:4, right:8, bottom:4, left:-22 }}>
              <CartesianGrid stroke={`${G.forest}80`} strokeDasharray="3 3" />
              <XAxis dataKey="stage" tick={{ fill:G.mist, fontSize:9, fontFamily:"Raleway,sans-serif" }} />
              <YAxis tick={{ fill:G.mist, fontSize:9 }} />
              <Tooltip content={<CT />} />
              <Bar dataKey="count" radius={[4,4,0,0]}>{stageCounts.map((s,i) => <Cell key={i} fill={s.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card style={{ padding:18 }}>
          <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:2, color:G.gold, textTransform:"uppercase", marginBottom:12 }}>By Assignee</div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={assigneeCounts} cx="50%" cy="50%" outerRadius={58} dataKey="count" nameKey="name" paddingAngle={3}>
                {assigneeCounts.map((_, i) => <Cell key={i} fill={[G.gold,G.sage,G.goldLt,G.amber,G.blue,G.mist][i%6]} />)}
              </Pie>
              <Tooltip content={<CT />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            {assigneeCounts.map((a, i) => (
              <div key={a.name} style={{ display:"flex", justifyContent:"space-between", fontFamily:"Raleway,sans-serif", fontSize:10 }}>
                <span style={{ color:[G.gold,G.sage,G.goldLt,G.amber,G.blue,G.mist][i%6] }}>● {a.name}</span>
                <span style={{ color:G.parchment, fontWeight:700 }}>{a.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Overdue enquiries */}
      {overdueEnq.length > 0 && (
        <Card style={{ padding:18, border:`1px solid ${G.red}33` }}>
          <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:2, color:G.red, textTransform:"uppercase", marginBottom:12 }}>🔔 Overdue Follow-ups ({overdueEnq.length})</div>
          {overdueEnq.map(e => (
            <div key={e.ID} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:`${G.red}0A`, borderRadius:9, padding:"9px 14px", border:`1px solid ${G.red}22`, marginBottom:7 }}>
              <div>
                <div style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.parchment, fontWeight:600 }}>{e["Customer Name"]}</div>
                <div style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.mist }}>{e["Product 1"]} · {e["Assigned To"]}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.red, fontWeight:700 }}>Overdue {Math.abs(daysUntil(e["Reminder Date"]))}d</div>
                <StageBadge stage={e.Stage} />
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Closing soon */}
      {closingSoon.length > 0 && (
        <Card style={{ padding:18, border:`1px solid ${G.amber}33` }}>
          <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:2, color:G.amber, textTransform:"uppercase", marginBottom:12 }}>⚡ Closing This Week ({closingSoon.length})</div>
          {closingSoon.map(e => (
            <div key={e.ID} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:`${G.amber}0A`, borderRadius:9, padding:"9px 14px", border:`1px solid ${G.amber}22`, marginBottom:7 }}>
              <div>
                <div style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.parchment, fontWeight:600 }}>{e["Customer Name"]}</div>
                <div style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.mist }}>{e["Product 1"]} · {e["Assigned To"]}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.amber, fontWeight:700 }}>{daysUntil(e["Expected Closure"])}d left</div>
                <div style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.gold, fontWeight:700 }}>{e.Currency} {Number(e["Expected Value"]||0).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Tasks */}
      <TaskBoard tasks={tasks} users={users} onAdd={onTaskAdd} onUpdate={onTaskUpdate} onDelete={onTaskDelete} />
    </div>
  );
}

// ─── ENQUIRIES TAB ────────────────────────────────────────────────────────────
function EnquiriesTab({ enquiries, customers, users, onSelect, onStageChange, onDelete, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [sort, setSort] = useState({ k:"Created At", d:-1 });

  const filtered = enquiries
    .filter(e => !filterStage || e.Stage === filterStage)
    .filter(e => !filterAssignee || e["Assigned To"] === filterAssignee)
    .filter(e => !search || [e["Customer Name"],e["Product 1"],e["Assigned To"],e.Country].join(" ").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = a[sort.k] ?? "", vb = b[sort.k] ?? "";
      return typeof va === "number" ? (va-vb)*sort.d : String(va).localeCompare(String(vb))*sort.d;
    });

  function toggleSort(k) { setSort(s => s.k===k ? { k, d:s.d*-1 } : { k, d:-1 }); }

  return (
    <div>
      {showForm && (
        <Modal title="New Enquiry" sub="Auto-saves to Google Sheets · Products are unlimited" onClose={() => setShowForm(false)} width={880}>
          <EnquiryForm onSave={async e => { await onAdd(e); setShowForm(false); }} onClose={() => setShowForm(false)} customers={customers} users={users} />
        </Modal>
      )}

      <Card style={{ overflow:"hidden" }}>
        {/* Toolbar */}
        <div style={{ padding:"14px 18px", display:"flex", gap:10, alignItems:"center", borderBottom:`1px solid ${G.gold}22`, flexWrap:"wrap" }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:19, fontWeight:600, color:G.parchment }}>
            Enquiries <span style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.gold, fontWeight:400 }}>{filtered.length} records</span>
          </div>
          <Btn label="+ New Enquiry" onClick={() => setShowForm(true)} size="sm" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            style={{ marginLeft:"auto", background:`${G.forest}60`, border:`1px solid ${G.gold}33`, borderRadius:7, padding:"6px 12px", color:G.parchment, fontFamily:"Raleway,sans-serif", fontSize:12, outline:"none", width:170 }} />
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
            style={{ background:G.forestDk, border:`1px solid ${G.gold}33`, borderRadius:7, padding:"6px 10px", color:G.parchment, fontFamily:"Raleway,sans-serif", fontSize:11 }}>
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s} value={s} style={{ background:G.forestDk }}>{s}</option>)}
          </select>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
            style={{ background:G.forestDk, border:`1px solid ${G.gold}33`, borderRadius:7, padding:"6px 10px", color:G.parchment, fontFamily:"Raleway,sans-serif", fontSize:11 }}>
            <option value="">All Team</option>
            {users.filter(u=>u.Active==="Yes").map(u => <option key={u.ID} value={u.Name} style={{ background:G.forestDk }}>{u.Name.split(" ")[0]}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={{ overflowX:"auto", maxHeight:500, overflowY:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"Raleway,sans-serif", fontSize:12 }}>
            <thead style={{ position:"sticky", top:0, background:G.forestDk, zIndex:2 }}>
              <tr>
                {[["Customer Name","Customer"],["Product 1","Product"],["Country","Country"],["Assigned To","Assigned"],["Priority","Priority"],["Stage","Stage"],["Expected Value","Value"],["Expected Closure","Closure"],["Reminder Date","Reminder"]].map(([k,l]) => (
                  <th key={k} onClick={() => toggleSort(k)} style={{ padding:"9px 13px", textAlign:"left", cursor:"pointer", color:sort.k===k?G.gold:G.mist, borderBottom:`1px solid ${G.gold}22`, fontWeight:700, letterSpacing:1, fontSize:9, textTransform:"uppercase", userSelect:"none", whiteSpace:"nowrap" }}>
                    {l}{sort.k===k?(sort.d===1?" ↑":" ↓"):""}
                  </th>
                ))}
                <th style={{ padding:"9px 13px", borderBottom:`1px solid ${G.gold}22` }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const dR = daysUntil(e["Reminder Date"]);
                const dC = daysUntil(e["Expected Closure"]);
                const overR = dR!==null&&dR<=0&&!["PO Received","Lost"].includes(e.Stage);
                const closeS = dC!==null&&dC<=7&&dC>=0&&!["PO Received","Lost"].includes(e.Stage);
                return (
                  <tr key={e.ID} onClick={() => onSelect(e)}
                    style={{ background:overR?`${G.red}08`:closeS?`${G.amber}08`:i%2===0?`${G.forest}18`:"transparent", cursor:"pointer", transition:"background 0.12s" }}
                    onMouseEnter={ev => ev.currentTarget.style.background=`${G.gold}0D`}
                    onMouseLeave={ev => ev.currentTarget.style.background=overR?`${G.red}08`:closeS?`${G.amber}08`:i%2===0?`${G.forest}18`:"transparent"}>
                    <td style={{ padding:"9px 13px", color:G.parchment, fontWeight:600, maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e["Customer Name"]}</td>
                    <td style={{ padding:"9px 13px", color:G.parchSoft, maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e["Product 1"]}{e["Product 2"]?`, ${e["Product 2"]}`:""}</td>
                    <td style={{ padding:"9px 13px", color:G.mist }}>{e.Country||"—"}</td>
                    <td style={{ padding:"9px 13px", color:G.mist }}>{(e["Assigned To"]||"").split(" ")[0]||"—"}</td>
                    <td style={{ padding:"9px 13px" }}><PrioBadge priority={e.Priority} /></td>
                    <td style={{ padding:"9px 13px" }} onClick={ev => ev.stopPropagation()}>
                      <select value={e.Stage} onChange={ev => onStageChange(e.ID, ev.target.value)}
                        style={{ background:"transparent", border:"none", cursor:"pointer", fontFamily:"Raleway,sans-serif", fontSize:11, color:STAGE_COLORS[STAGES.indexOf(e.Stage)]||G.mist, padding:0 }}>
                        {STAGES.map(s => <option key={s} value={s} style={{ background:G.forestDk, color:G.parchment }}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:"9px 13px", color:G.gold, fontWeight:700 }}>{e["Expected Value"]?`${e.Currency||"$"}${Number(e["Expected Value"]).toLocaleString()}`:"—"}</td>
                    <td style={{ padding:"9px 13px", color:closeS?G.amber:G.mist, fontWeight:closeS?700:400 }}>{fmtDate(e["Expected Closure"])}</td>
                    <td style={{ padding:"9px 13px", color:overR?G.red:G.mist, fontWeight:overR?700:400 }}>{overR?`⚠ ${Math.abs(dR)}d overdue`:fmtDate(e["Reminder Date"])}</td>
                    <td style={{ padding:"9px 13px" }} onClick={ev => ev.stopPropagation()}>
                      <button onClick={() => onDelete(e.ID)} style={{ background:"transparent", border:`1px solid ${G.red}44`, borderRadius:5, padding:"3px 7px", cursor:"pointer", color:G.red, fontSize:10 }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding:36, textAlign:"center", color:G.mist, fontFamily:"Raleway,sans-serif", fontSize:12 }}>No enquiries match your filters</div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── REMINDERS TAB ────────────────────────────────────────────────────────────
function RemindersTab({ enquiries, onSelect }) {
  const active = enquiries.filter(e => !["PO Received","Lost","No Response","Out of Scope"].includes(e.Stage) && e["Reminder Date"]);
  const sorted = [...active].sort((a, b) => new Date(a["Reminder Date"]) - new Date(b["Reminder Date"]));
  const overdue = sorted.filter(e => daysUntil(e["Reminder Date"]) <= 0);
  const upcoming = sorted.filter(e => daysUntil(e["Reminder Date"]) > 0);

  function Row({ e, over }) {
    const d = daysUntil(e["Reminder Date"]);
    return (
      <div onClick={() => onSelect(e)}
        style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:over?`${G.red}0A`:`${G.forest}28`, borderRadius:10, padding:"12px 16px", border:`1px solid ${over?G.red+"33":G.gold+"22"}`, cursor:"pointer", marginBottom:7, transition:"background 0.12s" }}
        onMouseEnter={ev => ev.currentTarget.style.background=`${G.gold}0D`}
        onMouseLeave={ev => ev.currentTarget.style.background=over?`${G.red}0A`:`${G.forest}28`}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:"50%", background:over?`${G.red}22`:`${G.gold}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{over?"⚠":"🔔"}</div>
          <div>
            <div style={{ fontFamily:"Raleway,sans-serif", fontSize:13, color:G.parchment, fontWeight:600 }}>{e["Customer Name"]}</div>
            <div style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.mist }}>{e["Product 1"]} · {e["Assigned To"]}</div>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:over?G.red:G.amber, fontWeight:700 }}>
            {over ? `${Math.abs(d)}d overdue` : `In ${d} day${d!==1?"s":""}`}
          </div>
          <div style={{ marginTop:4 }}><StageBadge stage={e.Stage} /></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {overdue.length > 0 && (
        <Card style={{ padding:18, border:`1px solid ${G.red}33` }}>
          <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:2, color:G.red, textTransform:"uppercase", marginBottom:12 }}>⚠ Overdue ({overdue.length})</div>
          {overdue.map(e => <Row key={e.ID} e={e} over={true} />)}
        </Card>
      )}
      <Card style={{ padding:18 }}>
        <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, fontWeight:700, letterSpacing:2, color:G.gold, textTransform:"uppercase", marginBottom:12 }}>Upcoming ({upcoming.length})</div>
        {upcoming.length > 0 ? upcoming.map(e => <Row key={e.ID} e={e} over={false} />) : (
          <div style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.mist, textAlign:"center", padding:20 }}>No upcoming reminders</div>
        )}
      </Card>
    </div>
  );
}

// ─── CUSTOMERS TAB ────────────────────────────────────────────────────────────
function CustomersTab({ customers, onAdd, onUpdate, onDelete }) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const filtered = customers.filter(c => !search || [c.Company,c.Country,c.Contact,c.Email].join(" ").toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      {modal && (
        <Modal title={modal.type==="edit"?"Edit Customer":"Add Customer"} sub="Email is used for auto-confirmation when enquiry is logged" onClose={() => setModal(null)}>
          <CustomerForm onSave={async c => { modal.type==="edit" ? onUpdate(c) : onAdd(c); setModal(null); }} onClose={() => setModal(null)} initial={modal.type==="edit"?modal.data:null} />
        </Modal>
      )}
      <Card style={{ overflow:"hidden" }}>
        <div style={{ padding:"14px 18px", display:"flex", gap:10, alignItems:"center", borderBottom:`1px solid ${G.gold}22` }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:19, fontWeight:600, color:G.parchment }}>Customers <span style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.gold, fontWeight:400 }}>{customers.length} companies</span></div>
          <Btn label="+ Add Customer" onClick={() => setModal({ type:"add" })} size="sm" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ marginLeft:"auto", background:`${G.forest}60`, border:`1px solid ${G.gold}33`, borderRadius:7, padding:"6px 12px", color:G.parchment, fontFamily:"Raleway,sans-serif", fontSize:12, outline:"none", width:200 }} />
        </div>
        <div style={{ overflowX:"auto", maxHeight:500, overflowY:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"Raleway,sans-serif", fontSize:12 }}>
            <thead style={{ position:"sticky", top:0, background:G.forestDk, zIndex:2 }}>
              <tr>{["Company","Country","Contact","Email","Phone","Added",""].map(h => (
                <th key={h} style={{ padding:"9px 14px", textAlign:"left", color:G.mist, borderBottom:`1px solid ${G.gold}22`, fontWeight:700, letterSpacing:1, fontSize:9, textTransform:"uppercase" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.ID} style={{ background:i%2===0?`${G.forest}18`:"transparent" }}>
                  <td style={{ padding:"9px 14px", color:G.parchment, fontWeight:600 }}>{c.Company}</td>
                  <td style={{ padding:"9px 14px", color:G.mist }}>{c.Country||"—"}</td>
                  <td style={{ padding:"9px 14px", color:G.parchSoft }}>{c.Contact||"—"}</td>
                  <td style={{ padding:"9px 14px", color:G.mist }}>{c.Email||"—"}</td>
                  <td style={{ padding:"9px 14px", color:G.mist }}>{c.Phone||"—"}</td>
                  <td style={{ padding:"9px 14px", color:G.mist }}>{fmtDate(c["Added At"])}</td>
                  <td style={{ padding:"9px 14px", display:"flex", gap:6 }}>
                    <Btn label="Edit" onClick={() => setModal({ type:"edit", data:c })} size="sm" variant="ghost" />
                    <Btn label="✕" onClick={() => onDelete(c.ID)} size="sm" variant="danger" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{ padding:30, textAlign:"center", color:G.mist, fontFamily:"Raleway,sans-serif", fontSize:12 }}>No customers yet</div>}
        </div>
      </Card>
    </div>
  );
}

// ─── USERS TAB ────────────────────────────────────────────────────────────────
function UsersTab({ users, onAdd, onUpdate, onDelete }) {
  const [modal, setModal] = useState(null);
  return (
    <div>
      {modal && (
        <Modal title={modal.type==="edit"?"Edit User":"Add Team Member"} sub="Users appear in Assigned To dropdown for all enquiries and tasks" onClose={() => setModal(null)}>
          <UserForm onSave={async u => { modal.type==="edit" ? onUpdate(u) : onAdd(u); setModal(null); }} onClose={() => setModal(null)} initial={modal.type==="edit"?modal.data:null} />
        </Modal>
      )}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:19, fontWeight:600, color:G.parchment }}>
          Team Members <span style={{ fontFamily:"Raleway,sans-serif", fontSize:12, color:G.gold, fontWeight:400 }}>{users.length} users</span>
        </div>
        <Btn label="+ Add User" onClick={() => setModal({ type:"add" })} size="sm" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12 }}>
        {users.map(u => (
          <Card key={u.ID} style={{ padding:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <div style={{ width:42, height:42, borderRadius:"50%", background:`linear-gradient(135deg,${G.gold},${G.goldLt})`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cormorant Garamond',serif", fontSize:19, fontWeight:700, color:G.forestDk }}>
                {u.Name.charAt(0)}
              </div>
              <span style={{ background:u.Active==="Yes"?`${G.sage}22`:`${G.mist}22`, color:u.Active==="Yes"?G.sage:G.mist, border:`1px solid ${u.Active==="Yes"?G.sage:G.mist}44`, borderRadius:20, padding:"2px 10px", fontSize:10, fontFamily:"Raleway,sans-serif", fontWeight:700 }}>
                {u.Active==="Yes"?"Active":"Inactive"}
              </span>
            </div>
            <div style={{ fontFamily:"Raleway,sans-serif", fontSize:14, fontWeight:700, color:G.parchment, marginBottom:3 }}>{u.Name}</div>
            <div style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.mist, marginBottom:2 }}>{u.Email}</div>
            <div style={{ fontFamily:"Raleway,sans-serif", fontSize:10, color:G.gold, letterSpacing:1, textTransform:"uppercase", marginBottom:13 }}>{u.Role}</div>
            <div style={{ display:"flex", gap:7 }}>
              <Btn label="Edit" onClick={() => setModal({ type:"edit", data:u })} size="sm" variant="ghost" />
              <Btn label="Remove" onClick={() => onDelete(u.ID)} size="sm" variant="danger" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  const [enquiries, setEnquiries] = useState(SEED_ENQUIRIES);
  const [customers, setCustomers] = useState(SEED_CUSTOMERS);
  const [users,     setUsers]     = useState(SEED_USERS);
  const [tasks,     setTasks]     = useState(SEED_TASKS);

  const [activeTab,   setActiveTab]   = useState("dashboard");
  const [selectedEnq, setSelectedEnq] = useState(null);

  function showToast(msg, err=false) {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  }

  // Load from Google Sheets on mount
  useEffect(() => {
    Promise.all([sheetGet("Enquiries"), sheetGet("Customers"), sheetGet("Users"), sheetGet("Tasks")])
      .then(([enqs, custs, usrs, tsks]) => {
        if (enqs.length  > 0) setEnquiries(enqs);
        if (custs.length > 0) setCustomers(custs);
        if (usrs.length  > 0) setUsers(usrs);
        if (tsks.length  > 0) setTasks(tsks);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Enquiry ops ──
  async function addEnquiry(row) {
    setEnquiries(p => [...p, row]);
    showToast(`✓ Enquiry saved — ${row["Customer Name"]}`);
    await sheetAdd("Enquiries", [row]);
  }
  async function updateEnquiry(row) {
    setEnquiries(p => p.map(e => e.ID===row.ID ? row : e));
    if (selectedEnq?.ID === row.ID) setSelectedEnq(row);
    showToast("✓ Enquiry updated");
    await sheetUpdate("Enquiries", row.ID, row);
  }
  async function deleteEnquiry(id) {
    setEnquiries(p => p.filter(e => e.ID !== id));
    if (selectedEnq?.ID === id) setSelectedEnq(null);
    await sheetDelete("Enquiries", id);
  }
  async function stageChange(id, stage) {
    setEnquiries(p => p.map(e => e.ID===id ? { ...e, Stage:stage } : e));
    if (selectedEnq?.ID === id) setSelectedEnq(s => s ? { ...s, Stage:stage } : s);
    await sheetUpdate("Enquiries", id, { Stage: stage }, { assignedTo: enquiries.find(e => e.ID===id)?.["Assigned To"] || "" });
  }

  // ── Task ops ──
  async function addTask(row)    { setTasks(p => [...p, row]);                       await sheetAdd("Tasks", [row]); }
  async function updateTask(row) { setTasks(p => p.map(t => t.ID===row.ID?row:t));   await sheetUpdate("Tasks", row.ID, row, { owner: row.Owner || "" }); }
  async function deleteTask(id)  { setTasks(p => p.filter(t => t.ID !== id));         await sheetDelete("Tasks", id); }

  // ── Customer ops ──
  async function addCustomer(row)    { setCustomers(p => [...p, row]);                       showToast(`✓ ${row.Company} added`); await sheetAdd("Customers", [row]); }
  async function updateCustomer(row) { setCustomers(p => p.map(c => c.ID===row.ID?row:c));   await sheetUpdate("Customers", row.ID, row); }
  async function deleteCustomer(id)  { setCustomers(p => p.filter(c => c.ID !== id));         await sheetDelete("Customers", id); }

  // ── User ops ──
  async function addUser(row)    { setUsers(p => [...p, row]);                       showToast(`✓ ${row.Name} added`); await sheetAdd("Users", [row]); }
  async function updateUser(row) { setUsers(p => p.map(u => u.ID===row.ID?row:u));   await sheetUpdate("Users", row.ID, row); }
  async function deleteUser(id)  { setUsers(p => p.filter(u => u.ID !== id));         await sheetDelete("Users", id); }

  async function handleRefresh() {
    setLoading(true);
    const [enqs, custs, usrs, tsks] = await Promise.all([sheetGet("Enquiries"),sheetGet("Customers"),sheetGet("Users"),sheetGet("Tasks")]);
    if (enqs.length  > 0) setEnquiries(enqs);
    if (custs.length > 0) setCustomers(custs);
    if (usrs.length  > 0) setUsers(usrs);
    if (tsks.length  > 0) setTasks(tsks);
    setLoading(false);
    showToast("✓ Synced from Google Sheets");
  }

  const overdueTaskCount = tasks.filter(t => t.Status!=="Done" && t["Due Date"] && daysUntil(t["Due Date"]) < 0).length;
  const overdueReminderCount = enquiries.filter(e => { const d=daysUntil(e["Reminder Date"]); return d!==null&&d<=0&&!["PO Received","Lost"].includes(e.Stage); }).length;

  const TABS = [
    { id:"dashboard", label:"Dashboard",  icon:"◈",  badge: overdueTaskCount > 0 ? overdueTaskCount : 0 },
    { id:"enquiries", label:"Enquiries",  icon:"📋", badge: 0 },
    { id:"reminders", label:"Reminders",  icon:"🔔", badge: overdueReminderCount },
    { id:"customers", label:"Customers",  icon:"🏢", badge: 0 },
    { id:"users",     label:"Team",       icon:"👥", badge: 0 },
  ];

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(160deg,#0A1A10,#0D2219,#0A1A10)`, fontFamily:"Raleway,sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:18, right:18, zIndex:999, background:toast.err?G.red:G.sage, color:"white", borderRadius:9, padding:"9px 18px", fontFamily:"Raleway,sans-serif", fontSize:12, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>
          {toast.msg}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div style={{ position:"fixed", inset:0, background:"rgba(10,26,16,0.88)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, color:G.gold }}>Ingredientz</div>
          <div style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.mist, letterSpacing:3, textTransform:"uppercase" }}>Loading from Google Sheets…</div>
          <div style={{ width:180, height:2, background:G.forest, borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", background:G.gold, borderRadius:2, animation:"loadBar 1.4s ease-in-out infinite" }} />
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div style={{ position:"fixed", left:0, top:0, bottom:0, width:215, background:`linear-gradient(180deg,${G.forestDk},#0A1A10)`, borderRight:`1px solid ${G.gold}22`, zIndex:10, display:"flex", flexDirection:"column" }}>

        {/* Logo */}
        <div style={{ padding:"26px 22px 18px", borderBottom:`1px solid ${G.gold}22` }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:21, fontWeight:700, color:G.gold, letterSpacing:0.8 }}>Ingredientz</div>
          <div style={{ fontFamily:"Raleway,sans-serif", fontSize:9, color:G.mist, letterSpacing:3, textTransform:"uppercase", marginTop:2 }}>Enquiry CRM</div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:loading?G.amber:G.sage, boxShadow:`0 0 5px ${loading?G.amber:G.sage}` }} />
              <span style={{ fontFamily:"Raleway,sans-serif", fontSize:10, color:G.mist }}>{loading?"Loading…":"Sheets Live"}</span>
            </div>
            <button onClick={handleRefresh} title="Refresh from Sheets" style={{ background:"transparent", border:`1px solid ${G.gold}33`, borderRadius:6, padding:"2px 8px", cursor:"pointer", color:G.gold, fontSize:11, fontFamily:"Raleway,sans-serif" }}>↻</button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding:"14px 10px", flex:1 }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ width:"100%", textAlign:"left", background:activeTab===tab.id?`linear-gradient(90deg,${G.gold}22,transparent)`:"transparent", border:activeTab===tab.id?`1px solid ${G.gold}33`:"1px solid transparent", borderRadius:9, padding:"10px 14px", cursor:"pointer", color:activeTab===tab.id?G.gold:G.mist, fontFamily:"Raleway,sans-serif", fontSize:12, fontWeight:activeTab===tab.id?700:500, marginBottom:3, transition:"all 0.13s", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span>{tab.icon} {tab.label}</span>
              {tab.badge > 0 && <span style={{ background:G.red, color:"white", borderRadius:20, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{tab.badge}</span>}
            </button>
          ))}
        </nav>

        {/* Quick stats */}
        <div style={{ padding:"12px 15px", borderTop:`1px solid ${G.gold}22` }}>
          {[
            ["Enquiries", enquiries.length, G.gold],
            ["Active", enquiries.filter(e => !["PO Received","Lost","No Response","Out of Scope"].includes(e.Stage)).length, G.sage],
            ["Overdue", overdueReminderCount, overdueReminderCount>0?G.red:G.mist],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
              <span style={{ fontFamily:"Raleway,sans-serif", fontSize:10, color:G.mist }}>{l}</span>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:600, color:c }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ marginLeft:215, padding:"26px 30px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div>
            <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:30, fontWeight:600, color:G.parchment, margin:0, lineHeight:1 }}>
              {TABS.find(t => t.id === activeTab)?.label}
            </h1>
            <div style={{ fontFamily:"Raleway,sans-serif", fontSize:11, color:G.mist, marginTop:4, letterSpacing:0.8 }}>
              {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
            </div>
          </div>
        </div>

        {activeTab==="dashboard" && <Dashboard enquiries={enquiries} users={users} tasks={tasks} onTaskAdd={addTask} onTaskUpdate={updateTask} onTaskDelete={deleteTask} />}
        {activeTab==="enquiries" && <EnquiriesTab enquiries={enquiries} customers={customers} users={users} onSelect={setSelectedEnq} onStageChange={stageChange} onDelete={deleteEnquiry} onAdd={addEnquiry} />}
        {activeTab==="reminders" && <RemindersTab enquiries={enquiries} onSelect={e => { setSelectedEnq(e); setActiveTab("enquiries"); }} />}
        {activeTab==="customers" && <CustomersTab customers={customers} onAdd={addCustomer} onUpdate={updateCustomer} onDelete={deleteCustomer} />}
        {activeTab==="users"     && <UsersTab users={users} onAdd={addUser} onUpdate={updateUser} onDelete={deleteUser} />}
      </div>

      {/* Enquiry Drawer */}
      <EnquiryDrawer enq={selectedEnq} onClose={() => setSelectedEnq(null)} onStageChange={stageChange} onUpdate={updateEnquiry} customers={customers} users={users} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0A1A10; }
        ::-webkit-scrollbar-thumb { background: ${G.gold}44; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${G.gold}88; }
        select option { background: #0D2219 !important; color: #F5EDD6 !important; }
        input[type="date"] { cursor: pointer; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.8) sepia(1) saturate(2) hue-rotate(5deg); cursor: pointer; opacity: 0.8; }
        input[type="date"]::-webkit-inner-spin-button { display: none; }
        input[type="date"]::-webkit-datetime-edit { color: #F5EDD6; }
        input[type="date"]::-webkit-datetime-edit-fields-wrapper { color: #F5EDD6; }
        @keyframes loadBar { 0% { width:0%; margin-left:0 } 50% { width:60%; margin-left:20% } 100% { width:0%; margin-left:100% } }
      `}</style>
    </div>
  );
}
