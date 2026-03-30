export const DATA_SEARCH_LOADER_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  
  html, body { 
    margin: 0; 
    padding: 0; 
    width: 100%; 
    height: 100%; 
    background: #ffffff;
    overflow: hidden;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .root {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 320px;
  }

  /* Stage dots */
  .track {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 56px;
  }
  .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #e5e5e5;
    transition: all .5s cubic-bezier(.4,0,.2,1);
  }
  .dot.done { 
    background: #111; 
  }
  .dot.active { 
    background: #111; 
    width: 24px; 
    border-radius: 4px; 
  }
  .track-line {
    width: 20px; height: 2px;
    background: #f0f0f0;
    transition: background .5s ease;
    border-radius: 1px;
  }
  .track-line.done { 
    background: #d4d4d4; 
  }

  /* Icon container */
  .icon-box {
    width: 88px; height: 88px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 40px;
  }

  /* ── STAGE 1: Connecting ── */
  .s1 { width: 100%; height: 100%; position: absolute; display: flex; align-items: center; justify-content: center; }
  .s1-core {
    width: 24px; height: 24px; border-radius: 50%;
    border: 2px solid #111;
    background: transparent;
  }
  .s1-ring1 {
    position: absolute; inset: 4px; border-radius: 50%;
    border: 1.5px solid transparent;
    border-top-color: #111;
    animation: spin 1s linear infinite;
  }
  .s1-ring2 {
    position: absolute; inset: 14px; border-radius: 50%;
    border: 1px solid transparent;
    border-bottom-color: #888;
    animation: spin 1.5s linear infinite reverse;
  }
  .s1-dot {
    position: absolute;
    top: 50%; left: 50%;
    width: 6px; height: 6px; border-radius: 50%; background: #111;
    animation: orbit-dot 1.2s linear infinite;
  }
  .s1-scan-beam {
    position: absolute; left: 50%; top: 50%;
    width: 50%; height: 1px;
    background: linear-gradient(to right, #111, transparent);
    transform-origin: left center;
    animation: spin 2s linear infinite;
  }
  
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes orbit-dot {
    0%   { transform: translate(-50%,-50%) rotate(0deg)   translateX(38px); }
    100% { transform: translate(-50%,-50%) rotate(360deg) translateX(38px); }
  }

  /* ── STAGE 2: Scanning Data ── */
  .s2 { width: 100%; height: 100%; position: absolute; display: flex; align-items: center; justify-content: center; }
  .s2-core {
    width: 22px; height: 22px; border-radius: 50%;
    border: 2px solid #111;
    background: transparent;
    position: relative; z-index: 2;
    animation: s2-pulse 1.2s ease-in-out infinite;
  }
  @keyframes s2-pulse {
    0%,100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }
  .s2-p {
    position: absolute;
    width: 6px; height: 6px; border-radius: 50%; background: #111;
    animation: converge 1.5s cubic-bezier(.4,0,.2,1) infinite;
  }
  .s2-p:nth-child(2)  { --ax:-36px; --ay:-18px; animation-delay:0s; }
  .s2-p:nth-child(3)  { --ax: 36px; --ay:-18px; animation-delay:.2s; }
  .s2-p:nth-child(4)  { --ax: 40px; --ay: 14px; animation-delay:.4s; }
  .s2-p:nth-child(5)  { --ax:  0px; --ay: 40px; animation-delay:.6s; }
  .s2-p:nth-child(6)  { --ax:-40px; --ay: 14px; animation-delay:.8s; }
  
  .s2-expand {
    position: absolute; inset: 0; border-radius: 50%;
    border: 1px solid #e0e0e0;
    animation: ring-expand 1.5s ease-out infinite;
  }
  @keyframes converge {
    0%   { transform: translate(var(--ax),var(--ay)) scale(1); opacity:0; }
    35%  { opacity:1; }
    80%  { transform: translate(0,0) scale(.4); opacity:.5; }
    100% { transform: translate(0,0) scale(0); opacity:0; }
  }
  @keyframes ring-expand {
    0%   { transform:scale(.2); opacity:.8; }
    100% { transform:scale(1.5); opacity:0; }
  }

  /* ── STAGE 3: Decrypting ── */
  .s3 { width: 100%; height: 100%; position: absolute; display: flex; align-items: center; justify-content: center; }
  .s3-center {
    width: 18px; height: 18px; border-radius: 4px;
    background: #111;
    position: relative; z-index: 2;
    animation: lock-beat 1.6s ease-in-out infinite;
  }
  @keyframes lock-beat {
    0%,100% { transform:scale(1) rotate(0deg); border-radius: 4px; }
    50% { transform:scale(1.15) rotate(45deg); border-radius: 8px; background: #444; }
  }
  .s3-node {
    position: absolute;
    width: 8px; height: 8px; border-radius: 50%;
    border: 2px solid #111; background: #fff;
    animation: node-flash 1.6s ease-in-out infinite;
  }
  .s3-node:nth-child(2) { top:12px;  left:12px;  animation-delay:0s; }
  .s3-node:nth-child(3) { top:12px;  right:12px; animation-delay:.4s; }
  .s3-node:nth-child(4) { bottom:12px; left:12px;  animation-delay:.8s; }
  .s3-node:nth-child(5) { bottom:12px; right:12px; animation-delay:.2s; }
  
  .s3-svg {
    position: absolute; inset:0; width:100%; height:100%; overflow:visible;
  }
  .s3-ln {
    stroke: #d4d4d4; stroke-width: 1.5; fill: none;
    stroke-dasharray: 6 4;
    animation: dash-travel 1.2s linear infinite;
  }
  @keyframes dash-travel { 0% { stroke-dashoffset:20; } 100% { stroke-dashoffset:0; } }
  @keyframes node-flash {
    0%, 100% { transform: scale(1); background: #fff; }
    50% { transform: scale(1.3); background: #111; }
  }

  /* ── STAGE 4: Success ── */
  .s4 { width: 100%; height: 100%; position: absolute; display: flex; align-items: center; justify-content: center; }
  .s4-bg {
    position: absolute; inset:4px; border-radius:50%;
    background: #f8f8f8;
    animation: scale-in .4s cubic-bezier(.4,0,.2,1) both;
    transform: scale(0);
  }
  @keyframes scale-in { to { transform:scale(1); } }
  .s4-border {
    position: absolute; inset:4px; border-radius:50%;
    border: 2.5px solid #111;
    animation: scale-in .45s .05s cubic-bezier(.4,0,.2,1) both;
    transform: scale(0);
  }
  .s4-ripple {
    position: absolute; inset:-12px; border-radius:50%;
    border: 1.5px solid #eaeaea;
    animation: ripple-out 2s ease-out .5s infinite;
  }
  @keyframes ripple-out {
    0%   { transform:scale(.6); opacity:1; }
    100% { transform:scale(1.5); opacity:0; }
  }
  .s4-check {
    position: relative; z-index:3;
    animation: scale-in .35s .25s cubic-bezier(.34,1.56,.64,1) both;
    transform: scale(0);
  }
  .s4-path {
    stroke: #111; stroke-width: 3;
    stroke-linecap: round; stroke-linejoin: round;
    fill: none;
    stroke-dasharray: 24; stroke-dashoffset: 24;
    animation: draw .4s .45s cubic-bezier(.4,0,.2,1) forwards;
  }
  @keyframes draw { to { stroke-dashoffset:0; } }

  /* Stage transitions */
  .stage-layer {
    position: absolute;
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    opacity: 0;
    transform: scale(0.8);
    transition: opacity 0.4s ease, transform 0.4s cubic-bezier(.4,0,.2,1);
    pointer-events: none;
  }
  .stage-layer.visible {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
  }
  .stage-layer.exiting {
    opacity: 0;
    transform: scale(1.1);
  }

  /* Typography */
  .lbl-title {
    font-size: 18px; font-weight: 600;
    color: #111;
    text-align: center;
    letter-spacing: -0.02em;
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.35s ease, transform 0.35s ease;
  }
  .lbl-title.visible {
    opacity: 1;
    transform: translateY(0);
  }
  .lbl-sub {
    font-size: 13px; font-weight: 400;
    color: #666;
    text-align: center;
    margin-top: 8px;
    letter-spacing: 0.01em;
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.35s .08s ease, transform 0.35s .08s ease;
  }
  .lbl-sub.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Progress Bar */
  .bar-wrap {
    width: 100%; height: 3px;
    background: #f0f0f0;
    border-radius: 2px;
    margin-top: 36px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%; background: #111; border-radius: 2px;
    width: 0%; transition: width 0.9s cubic-bezier(.4,0,.2,1);
  }

  /* Step list beneath the bar */
  .steps {
    margin-top: 28px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .step-row {
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0.3;
    transition: opacity 0.4s ease;
  }
  .step-row.active { opacity: 1; }
  .step-row.done   { opacity: 0.6; }

  .step-icon {
    width: 18px; height: 18px;
    border-radius: 50%;
    border: 1.5px solid #ccc;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: border-color 0.3s, background 0.3s;
    font-size: 10px;
  }
  .step-row.active .step-icon {
    border-color: #111;
    background: transparent;
  }
  .step-row.active .step-icon::after {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #111;
    display: block;
    animation: dot-pulse 1s ease-in-out infinite;
  }
  @keyframes dot-pulse {
    0%,100% { transform: scale(1); opacity:1; }
    50% { transform: scale(1.4); opacity: 0.6; }
  }
  .step-row.done .step-icon {
    border-color: #111;
    background: #111;
  }
  .step-row.done .step-icon::after {
    content: '✓';
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    animation: none;
  }
  .step-label {
    font-size: 12px;
    color: #444;
    font-weight: 500;
  }
  .step-row.done .step-label { color: #999; text-decoration: line-through; }
  .step-row.active .step-label { color: #111; }

  .hidden { opacity: 0 !important; pointer-events: none; }
</style>
</head>
<body>

<div class="root">
  <div class="card">

    <div class="track">
      <div class="dot active" id="d0"></div>
      <div class="track-line" id="l0"></div>
      <div class="dot" id="d1"></div>
      <div class="track-line" id="l1"></div>
      <div class="dot" id="d2"></div>
      <div class="track-line" id="l2"></div>
      <div class="dot" id="d3"></div>
    </div>

    <div class="icon-box">

      <div id="s1" class="stage-layer s1 visible">
        <div class="s1-core"></div>
        <div class="s1-ring1"></div>
        <div class="s1-ring2"></div>
        <div class="s1-scan-beam"></div>
        <div class="s1-dot"></div>
      </div>

      <div id="s2" class="stage-layer s2">
        <div class="s2-expand"></div>
        <div class="s2-core"></div>
        <div class="s2-p"></div>
        <div class="s2-p"></div>
        <div class="s2-p"></div>
        <div class="s2-p"></div>
        <div class="s2-p"></div>
      </div>

      <div id="s3" class="stage-layer s3">
        <svg class="s3-svg" viewBox="0 0 88 88">
          <line class="s3-ln" x1="16" y1="16" x2="44" y2="44"/>
          <line class="s3-ln" x1="72" y1="16" x2="44" y2="44" style="animation-delay:.3s"/>
          <line class="s3-ln" x1="16" y1="72" x2="44" y2="44" style="animation-delay:.6s"/>
          <line class="s3-ln" x1="72" y1="72" x2="44" y2="44" style="animation-delay:.9s"/>
        </svg>
        <div class="s3-node"></div>
        <div class="s3-node"></div>
        <div class="s3-node"></div>
        <div class="s3-node"></div>
        <div class="s3-center"></div>
      </div>

      <div id="s4" class="stage-layer s4">
        <div class="s4-ripple"></div>
        <div class="s4-bg"></div>
        <div class="s4-border"></div>
        <div class="s4-check">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <path class="s4-path" d="M10 18.5 L15.5 24 L26 12"/>
          </svg>
        </div>
      </div>
    </div>

    <div class="lbl-title visible" id="t">Authenticating...</div>
    <div class="lbl-sub visible"   id="s">Securing your connection</div>

    <div class="bar-wrap"><div class="bar-fill" id="bar"></div></div>

    <div class="steps">
      <div class="step-row active" id="row0">
        <div class="step-icon"></div>
        <span class="step-label">Authenticating session</span>
      </div>
      <div class="step-row" id="row1">
        <div class="step-icon"></div>
        <span class="step-label">Searching for Store</span>
      </div>
      <div class="step-row" id="row2">
        <div class="step-icon"></div>
        <span class="step-label">Decrypting settings</span>
      </div>
      <div class="step-row" id="row3">
        <div class="step-icon"></div>
        <span class="step-label">Store Ready</span>
      </div>
    </div>

  </div>
</div>

<script>
  var stages = [
    { id:'s1', t:'Authenticating...',       s:'Securing your connection',       p:18 },
    { id:'s2', t:'Searching for Store...',  s:'Checking cloud records',         p:45 },
    { id:'s3', t:'Loading Settings...',     s:'Decrypting secure profile',      p:78 },
    { id:'s4', t:'Store Ready',             s:'Opening Kwiq Bill',              p:100 },
  ];

  var currentStage = 0; // 0-indexed internally (maps to stage 1–4 from RN)

  // ── Core transition function ──────────────────────────────────────
  function showStage(idx) {
    if (idx < 0 || idx >= stages.length) return;
    if (idx <= currentStage && idx !== 0) return; // only advance, never go back (unless first init)

    var c = stages[idx];

    // 1. Transition icon layers
    stages.forEach(function(x, j) {
      var el = document.getElementById(x.id);
      if (j === currentStage && j !== idx) {
        // Exit current
        el.classList.add('exiting');
        setTimeout(function() {
          el.classList.remove('visible', 'exiting');
        }, 400);
      }
    });

    setTimeout(function() {
      var nextEl = document.getElementById(c.id);
      // Restart animations inside the next stage by cloning
      var clone = nextEl.cloneNode(true);
      nextEl.parentNode.replaceChild(clone, nextEl);
      clone.classList.add('visible');

      // If this is the success stage, fire the done callback after tick finishes
      if (idx === 3) {
        // s4-path draw animation takes 0.4s + 0.45s delay = ~900ms, add 1s grace
        setTimeout(function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage('STAGE_DONE');
          }
        }, 1900);
      }
    }, currentStage === idx ? 0 : 300);

    // 2. Update text with fade
    var titleEl = document.getElementById('t');
    var subEl   = document.getElementById('s');
    titleEl.classList.remove('visible');
    subEl.classList.remove('visible');
    setTimeout(function() {
      titleEl.textContent = c.t;
      subEl.textContent   = c.s;
      titleEl.classList.add('visible');
      subEl.classList.add('visible');
    }, 200);

    // 3. Progress bar
    document.getElementById('bar').style.width = c.p + '%';

    // 4. Dot track
    for (var k = 0; k < 4; k++) {
      var d = document.getElementById('d' + k);
      d.className = 'dot' + (k < idx ? ' done' : k === idx ? ' active' : '');
      if (k < 3) {
        document.getElementById('l' + k).className = 'track-line' + (k < idx ? ' done' : '');
      }
    }

    // 5. Step rows
    for (var r = 0; r < 4; r++) {
      var row = document.getElementById('row' + r);
      if (r < idx)      { row.className = 'step-row done'; }
      else if (r === idx) { row.className = 'step-row active'; }
      else               { row.className = 'step-row'; }
    }

    currentStage = idx;
  }

  // ── Public API called by React Native via injectJavaScript ─────────
  // stage is 1-indexed (1=Authenticating, 2=Searching, 3=Decrypting, 4=Ready)
  function goToStage(stage) {
    showStage(stage - 1);
  }

  // Start at stage 1 immediately
  showStage(0);
</script>

</body>
</html>
`;
