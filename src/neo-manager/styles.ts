export const LEDGER_FONTS = ["IBMPlexMono-Regular.ttf", "IMFellEnglishSC-Regular.ttf"] as const;

export const ledgerStyles = `
.na-manager {
  --ledger-bg:#0b0b0b; --ledger-panel:#101010; --ledger-text:#cfcfcf; --ledger-muted:#9a9a9a;
  --ledger-border:#6a6a6a; --ledger-rule:#3a3a3a; --ledger-accent:#d4a24c; --ledger-on:#6fcf6f;
  --ledger-update:#e8d24a; --ledger-harm:#ee6a5a; --ledger-focus:#fff; --ledger-size:15px;
  position:absolute; inset:0; z-index:30; display:flex; flex-direction:column; overflow:hidden;
  background:var(--ledger-bg); color:var(--ledger-text); font:var(--ledger-size)/1.5 "IBMPlexMono-Regular.ttf","IBM Plex Mono",monospace;
  container-type:inline-size;
}
.na-manager[hidden], .na-manager [hidden] { display:none !important; }
.na-manager[data-contrast="high"] { --ledger-bg:#000; --ledger-panel:#000; --ledger-text:#fff; --ledger-muted:#ddd; --ledger-border:#fff; --ledger-rule:#aaa; --ledger-accent:#ffce70; }
.na-manager[data-theme="light"] { --ledger-bg:#f3eedf; --ledger-panel:#fffaf0; --ledger-text:#171717; --ledger-muted:#454545; --ledger-border:#555; --ledger-rule:#888; --ledger-accent:#754600; --ledger-on:#176025; --ledger-update:#704400; --ledger-harm:#a52215; }
@media (prefers-color-scheme:light) { .na-manager[data-theme="system"][data-contrast="normal"] { --ledger-bg:#f3eedf; --ledger-panel:#fffaf0; --ledger-text:#171717; --ledger-muted:#454545; --ledger-border:#555; --ledger-rule:#888; --ledger-accent:#754600; --ledger-on:#176025; --ledger-update:#704400; --ledger-harm:#a52215; } }
.na-manager[data-colorblind="red-green"] { --ledger-on:#6aa8ff; --ledger-harm:#ffb65c; }
.na-manager[data-colorblind="blue-yellow"] { --ledger-on:#8edf9f; --ledger-update:#f7a8d0; }
.na-manager * { box-sizing:border-box; border-radius:0; }
.na-manager button,.na-manager input,.na-manager select,.na-manager textarea { font:inherit; color:inherit; min-height:44px; min-width:44px; }
.na-manager button,.na-manager select,.na-manager summary { cursor:pointer; }
.na-manager button { padding:0 16px; background:var(--ledger-bg); border:1px solid var(--ledger-border); }
.na-manager input,.na-manager select,.na-manager textarea { background:var(--ledger-bg); border:1px solid var(--ledger-border); padding:0 10px; max-width:100%; }
.na-manager :focus-visible { outline:2px solid var(--ledger-focus); outline-offset:2px; box-shadow:0 0 0 5px #000; }
.na-manager h1,.na-manager h2 { font-family:"IMFellEnglishSC-Regular.ttf","IM Fell English SC",serif; font-weight:400; letter-spacing:.08em; color:var(--ledger-accent); margin:0; }
.na-manager h1 { font-size:32px; } .na-manager h2 { font-size:22px; }
.na-manager header,.na-manager footer { display:flex; flex-wrap:wrap; align-items:center; gap:10px 24px; padding:14px 36px; border-bottom:3px double var(--ledger-border); }
.na-manager footer { border-bottom:0; border-top:3px double var(--ledger-border); font-size:14px; }
.na-manager nav { display:flex; gap:4px; flex-wrap:wrap; }
.na-manager nav button { border:0; color:var(--ledger-muted); }
.na-manager nav [aria-current="page"],.na-manager [aria-pressed="true"] { background:var(--ledger-text); color:var(--ledger-bg); }
.na-manager main { width:100%; max-width:1112px; min-height:0; overflow:auto; padding:22px 36px; margin:auto; display:flex; flex:1; flex-direction:column; gap:24px; }
.na-manager .frame { position:relative; border:3px double var(--ledger-border); background:var(--ledger-panel); padding:26px 18px 18px; margin:12px 0; }
.na-manager .frame > h2 { position:absolute; top:-18px; left:18px; padding:0 10px; background:var(--ledger-panel); }
.na-manager .tools,.na-manager .actions { display:flex; align-items:center; flex-wrap:wrap; gap:10px; }
.na-manager .tools { padding-bottom:14px; } .na-manager .tools input { flex:1; width:180px; }
.na-manager .line { display:flex; align-items:center; gap:14px; min-height:48px; padding:0 12px; border-top:1px dashed var(--ledger-rule); white-space:nowrap; }
.na-manager .name { flex:1; min-width:0; text-align:left; font-weight:600; padding:0; border:0; background:transparent; overflow:hidden; text-overflow:ellipsis; }
.na-manager .selected { background:var(--ledger-accent); color:var(--ledger-bg); }
.na-manager .selected .update { color:inherit; }
.na-manager .updates-banner { display:flex; align-items:center; flex-wrap:wrap; gap:10px 18px; padding:10px 16px; border:1px solid var(--ledger-accent); }
.na-manager .updates-banner > span { flex:1 1 260px; }
.na-manager [role="switch"] { min-width:64px; padding:0 8px; font-weight:600; color:var(--ledger-muted); }
.na-manager [role="switch"][aria-checked="true"] { border-color:var(--ledger-on); color:var(--ledger-on); background:var(--ledger-bg); }
.na-manager .question { width:44px; padding:0; color:var(--ledger-accent); }
.na-manager .expanded { border-top:1px dashed var(--ledger-border); padding:14px 18px 20px 40px; }
.na-manager .muted { color:var(--ledger-muted); } .na-manager .update { color:var(--ledger-update); } .na-manager .harm { color:var(--ledger-harm); }
.na-manager .primary { background:var(--ledger-accent); color:var(--ledger-bg); border-color:var(--ledger-accent); font-weight:600; }
.na-manager na-detail-card { display:block; padding:12px 14px; margin:8px 0; background:var(--ledger-bg); border:1px solid var(--ledger-accent); box-shadow:4px 4px 0 #000; font-size:14px; line-height:1.45; overflow-wrap:anywhere; }
.na-manager na-detail-card .actions { padding-top:10px; }
.na-manager na-settings-page,.na-manager na-look-picker,.na-manager na-manager-notices { display:block; }
.na-manager details { border:1px solid var(--ledger-border); background:var(--ledger-panel); margin:14px 0; }
.na-manager summary { display:flex; align-items:center; gap:10px; min-height:52px; padding:10px 18px; font-weight:600; list-style:none; }
.na-manager summary::-webkit-details-marker { display:none; }
.na-manager summary::before { content:">"; color:var(--ledger-accent); }
.na-manager details[open] > summary::before { content:"v"; }
.na-manager summary > span:first-child { flex:none; }
.na-manager summary .muted { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:400; font-size:13px; }
.na-manager .setting { display:flex; flex-wrap:wrap; align-items:center; gap:8px 14px; min-height:56px; padding:6px 20px; border-top:1px dashed var(--ledger-rule); }
.na-manager .setting > label { flex:1; } .na-manager .segments { display:flex; margin-left:auto; }
.na-manager input[type="range"] { width:180px; accent-color:var(--ledger-accent); }
.na-manager textarea { width:100%; min-height:130px; }
.na-manager .choices { display:flex; flex-wrap:wrap; gap:24px; } .na-manager .choices section { flex:1 1 280px; }
.na-manager pre { padding:12px; background:var(--ledger-bg); border:1px solid var(--ledger-rule); font:inherit; }
.na-manager .modal { position:fixed; inset:0; z-index:40; background:rgba(0,0,0,.72); display:flex; padding:32px; overflow:auto; }
.na-manager na-consent-dialog { display:block; width:100%; max-width:700px; margin:auto; }
.na-manager .permission { display:flex; align-items:center; gap:12px; min-height:54px; border-top:1px dashed var(--ledger-rule); }
.na-manager .permission label { display:flex; flex:1; align-items:center; gap:14px; min-height:54px; }
.na-manager input[type="checkbox"] { width:44px; height:44px; accent-color:var(--ledger-accent); }
.na-manager[data-rows="tight"] .line { min-height:44px; }
.na-manager[data-motion="reduce"] * { animation:none !important; transition:none !important; scroll-behavior:auto !important; }
@media (prefers-reduced-motion:reduce) { .na-manager * { animation:none !important; transition:none !important; scroll-behavior:auto !important; } }
@container (width < 600px) {
  .na-manager header { padding:10px 14px; } .na-manager main { padding:12px 14px; margin:0; padding-bottom:76px; }
  .na-manager nav { position:absolute; bottom:0; left:0; right:0; z-index:20; background:var(--ledger-bg); border-top:3px double var(--ledger-border); gap:0; flex-wrap:nowrap; }
  .na-manager nav button { flex:1; min-height:60px; padding:0 6px; font-size:13px; }
  .na-manager footer { display:none; } .na-manager .line { gap:6px; padding:0 6px; }
  .na-manager .version { display:none; } .na-manager .frame { padding:24px 8px 8px; }
  .na-manager .setting { padding:6px 12px; gap:6px; } .na-manager .segments button { padding:0 8px; font-size:13px; }
  .na-manager .expanded { padding:10px 12px; } .na-manager .modal { padding:14px; }
}
`;
