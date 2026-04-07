export const DATA_SEARCH_LOADER_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
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
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 80px 24px 100px 24px;
    box-sizing: border-box;
    position: relative;
    background: #fff;
    background-image: 
      radial-gradient(#f0f0f0 1.5px, transparent 0);
    background-size: 32px 32px;
    background-position: -16px -16px;
  }

  /* ─── Header ─── */
  .header {
    width: 100%;
    text-align: center;
    z-index: 10;
  }
  .lbl-title {
    font-size: 34px; font-weight: 700;
    color: #111;
    letter-spacing: -0.06em;
    opacity: 0;
    transform: translateY(15px);
    transition: all 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
    margin-bottom: 8px;
  }
  .lbl-title.visible { opacity: 1; transform: translateY(0); }
  .lbl-sub {
    font-size: 17px; font-weight: 500;
    color: #999;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.7s .2s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .lbl-sub.visible { opacity: 1; transform: translateY(0); }

  /* ─── Central Animation ─── */
  .animation-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    z-index: 5;
  }
  .icon-box {
    width: 260px;
    height: 260px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ─── NEW: Premium Step Boxes ─── */
  .stepper-bottom {
    width: 100%;
    max-width: 340px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    padding: 0;
    box-sizing: border-box;
    z-index: 10;
  }

  .stepper-line-bg {
    position: absolute;
    top: 28px;
    left: 28px;
    right: 28px;
    height: 1.5px;
    background: #f4f4f4;
    z-index: 0;
  }
  .stepper-line-fill {
    position: absolute;
    top: 28px;
    left: 28px;
    width: 0%;
    height: 1.5px;
    background: #111;
    z-index: 1;
    transition: width 0.9s cubic-bezier(1, 0, 0, 1);
    max-width: calc(100% - 56px);
  }

  .step-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    z-index: 2;
    transition: all 0.5s ease;
  }

  .step-box-circle {
    width: 56px;
    height: 56px;
    border-radius: 20px;
    background: #fff;
    border: 1.5px solid #eee;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1.2);
    position: relative;
    overflow: hidden;
  }

  /* Improved Active Look */
  .step-box.active .step-box-circle {
    border-color: #111;
    background: #111;
    transform: scale(1.15) translateY(-10px);
    box-shadow: 0 15px 35px rgba(0,0,0,0.22);
  }

  .step-box.done .step-box-circle {
    border-color: #111;
    background: #111;
    transform: scale(1);
    box-shadow: none;
  }

  .step-box-num {
    font-size: 18px;
    font-weight: 700;
    color: #ccc;
    z-index: 5;
    transition: all 0.3s ease;
  }
  .step-box.active .step-box-num { color: #fff; }
  .step-box.done .step-box-num { display: none; }

  /* Premium Liquid/Glass Shimmer inside Box */
  .box-shimmer {
    position: absolute;
    top: -100%;
    left: -100%;
    width: 300%;
    height: 300%;
    background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%);
    opacity: 0;
    pointer-events: none;
  }
  .step-box.active .box-shimmer {
    opacity: 1;
    animation: glassy-shimmer 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }
  @keyframes glassy-shimmer { from { transform: translate(-30%, -30%); } to { transform: translate(30%, 30%); } }

  .box-bloom {
    position: absolute;
    inset: 4px;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 80%);
    opacity: 0;
    animation: box-pulse 2s ease-in-out infinite;
  }
  .step-box.active .box-bloom { opacity: 1; }
  @keyframes box-pulse { 0%, 100% { transform: scale(0.8); opacity: 0.4; } 50% { transform: scale(1.2); opacity: 0.8; } }

  .tick-mark {
    display: none;
    width: 24px; height: 24px;
    stroke: white; stroke-width: 5;
    z-index: 6;
  }
  .step-box.done .tick-mark {
    display: block;
    animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  @keyframes pop-in { from { transform: scale(0) rotate(-45deg); opacity: 0; } to { transform: scale(1) rotate(0deg); opacity: 1; } }

  .step-box-label {
    font-size: 11px;
    font-weight: 700;
    color: #bbb;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .step-box.active .step-box-label { color: #111; }
  .step-box.done .step-box-label { color: #888; }

  /* ───── STAGE ANIMATIONS ───── */
  .stage-layer {
    position: absolute;
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    opacity: 0;
    transform: scale(0.92);
    transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1.1);
    pointer-events: none;
  }
  .stage-layer.visible { opacity: 1; transform: scale(1); pointer-events: auto; }
  .stage-layer.exiting { opacity: 0; transform: scale(1.15); }

  /* Stage 1: Auth (Biometric Remaster) */
  .s1-core { 
    width: 84px; height: 84px; 
    border-radius: 28px; 
    border: 2px solid #111; 
    position: relative; 
    display: flex; align-items: center; justify-content: center;
    background: #fff;
    box-shadow: 0 15px 45px rgba(0,0,0,0.08);
    animation: breathing 4s ease-in-out infinite;
    z-index: 5;
  }
  .s1-icon { width: 34px; height: 34px; color: #111; z-index: 10; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); }
  
  .s1-radar {
    position: absolute;
    inset: -30px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, rgba(0,0,0,0.15) 0deg, transparent 90deg);
    animation: radar-sweep 2.5s linear infinite;
    pointer-events: none;
    z-index: 2;
  }
  .s1-radar::after {
    content: '';
    position: absolute;
    top: 0; left: 50%;
    width: 2px; height: 50%;
    background: #111;
    filter: blur(1px);
    box-shadow: 0 0 15px #111;
  }

  .s1-orb-1 { position: absolute; inset: -45px; border-radius: 50%; border: 1.5px solid #eee; animation: spin-rev 10s linear infinite; }
  .s1-bit-v { position: absolute; top: -2px; left: calc(50% - 4px); width: 8px; height: 8px; background: #111; border-radius: 2px; }
  .s1-orb-2 { position: absolute; inset: -65px; border-radius: 50%; border: 0.8px dashed #ddd; animation: spin 30s linear infinite; }
  
  @keyframes radar-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes breathing { 0%, 100% { transform: scale(1) rotate(-8deg); } 50% { transform: scale(1.08) rotate(4deg); border-radius: 45%; } }
  @keyframes spin-rev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  /* Stage 2: Store Searching (Neural Remaster) */
  .s2-core { 
    width: 72px; height: 72px; 
    border-radius: 20px; 
    background: #111; 
    display: flex; align-items: center; justify-content: center; 
    transform: rotate(45deg); 
    animation: pulsar 2s ease-in-out infinite;
    position: relative;
    z-index: 5;
  }
  .s2-icon { width: 30px; height: 30px; color: #fff; transform: rotate(-45deg); z-index: 10; }
  
  .s2-signal {
    position: absolute;
    inset: -20px;
    border: 1px solid #111;
    border-radius: 50%;
    animation: signal-out 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    opacity: 0;
  }
  .s2-signal-2 { animation-delay: 0.5s; }
  .s2-signal-3 { animation-delay: 1s; }

  .s2-crosshair-h { position: absolute; width: 140px; height: 1px; background: rgba(0,0,0,0.1); animation: cross-h 2.5s ease-in-out infinite; }
  .s2-crosshair-v { position: absolute; height: 140px; width: 1px; background: rgba(0,0,0,0.1); animation: cross-v 2.5s ease-in-out infinite; }

  @keyframes pulsar { 
    0%, 100% { transform: rotate(45deg) scale(1); box-shadow: 0 0 0 rgba(0,0,0,0); } 
    50% { transform: rotate(55deg) scale(1.15); box-shadow: 0 10px 40px rgba(0,0,0,0.2); } 
  }
  @keyframes signal-out { from { transform: scale(0.3); opacity: 1; } to { transform: scale(2.5); opacity: 0; } }
  @keyframes cross-h { 0%, 100% { transform: scaleX(0.8); opacity: 0.2; } 50% { transform: scaleX(1.2); opacity: 1; } }
  @keyframes cross-v { 0%, 100% { transform: scaleY(0.8); opacity: 0.2; } 50% { transform: scaleY(1.2); opacity: 1; } }

  .s2-dot-frag {
    position: absolute; width: 6px; height: 6px; background: #111; border-radius: 1px;
    animation: scatter 2s cubic-bezier(0.19, 1, 0.22, 1) infinite;
  }

  @keyframes scatter { 
    0% { transform: rotate(var(--r)) translate(0, 0) scale(1); opacity: 1; } 
    100% { transform: rotate(var(--r)) translate(0, 100px) scale(0); opacity: 0; } 
  }

  /* Stage 3: Decrypting (Deep Cypher) */
  .s3-hex { width: 80px; height: 80px; border: 3px solid #111; border-radius: 20px; animation: hex-morph 3s cubic-bezier(0.4, 0, 0.2, 1) infinite; background: #fff; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
  .s3-hex-inner { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.03) 4px, rgba(0,0,0,0.03) 8px); animation: shift-bg 0.2s linear infinite; }
  .s3-icon { width: 32px; height: 32px; color: #111; z-index: 2; }
  .s3-scanner { position: absolute; width: 160px; height: 60px; background: linear-gradient(180deg, transparent, rgba(0,0,0,0.05), transparent); animation: scan-v-heavy 2s ease-in-out infinite; pointer-events: none; }
  .s3-bit { position: absolute; width: 12px; height: 12px; background: #111; border-radius: 3px; }
  @keyframes hex-morph { 0%, 100% { border-radius: 24px; transform: rotate(0) scale(1); } 50% { border-radius: 50%; transform: rotate(90deg) scale(1.1); } }
  @keyframes scan-v-heavy { 0%, 100% { transform: translateY(-120px) scaleX(0.5); opacity: 0; } 50% { transform: translateY(120px) scaleX(1); opacity: 1; } }
  @keyframes shift-bg { from { transform: translateY(0); } to { transform: translateY(8px); } }

  /* Stage 4: Success (Super Orbit + Shockwave) */
  .s4-con { position: relative; display: flex; align-items: center; justify-content: center; }
  .s4-shockwave { position: absolute; inset: -60px; border: 2px solid #111; border-radius: 50%; opacity: 0; animation: shockwave 1s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
  .s4-ring { position: absolute; inset: -15px; border: 5px solid #111; border-radius: 50%; animation: pop-ring-p 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
  .s4-tick { width: 70px; height: 70px; stroke: #111; stroke-width: 6; fill: none; stroke-linecap: round; stroke-dasharray: 50; stroke-dashoffset: 50; animation: draw-tick-p 0.7s 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
  .s4-orbit-glow { position: absolute; inset: -40px; border: 1.5px dashed #ccc; border-radius: 50%; animation: spin 15s linear infinite; }
  
  @keyframes shockwave { 0% { transform: scale(0.2); opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
  @keyframes pop-ring-p { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes draw-tick-p { to { stroke-dashoffset: 0; } }

  /* Progress at bottom */
  .p-bar-fixed { position: fixed; bottom: 35px; width: 100%; display: flex; justify-content: center; }
  .p-bar-bg { width: 120px; height: 5px; background: #f0f0f0; border-radius: 3px; }
  .p-bar-fill { height: 100%; background: #111; width: 0%; transition: width 1s linear; }

</style>
</head>
<body>

<div class="root">
  
  <div class="header">
    <div class="lbl-title visible" id="t">Authenticating...</div>
    <div class="lbl-sub visible"   id="s">Securing your connection</div>
  </div>

  <div class="animation-container">
      <div class="icon-box">
        <!-- Stage 1 (Biometric Remaster) -->
        <div id="s1" class="stage-layer visible">
          <div class="s1-orb-2"></div>
          <div class="s1-orb-1"><div class="s1-bit-v"></div></div>
          <div class="s1-radar"></div>
          <div class="s1-core">
            <svg class="s1-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>

        <!-- Stage 2 (Neural Remaster) -->
        <div id="s2" class="stage-layer">
          <div class="s2-crosshair-h"></div>
          <div class="s2-crosshair-v"></div>
          <div class="s2-signal s2-signal-1"></div>
          <div class="s2-signal s2-signal-2"></div>
          <div class="s2-signal s2-signal-3"></div>
          <div class="s2-core">
            <svg class="s2-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div class="s2-dot-frag" style="--r: 0deg"></div>
          <div class="s2-dot-frag" style="--r: 72deg; animation-delay: 0.3s"></div>
          <div class="s2-dot-frag" style="--r: 144deg; animation-delay: 0.6s"></div>
          <div class="s2-dot-frag" style="--r: 216deg; animation-delay: 0.9s"></div>
          <div class="s2-dot-frag" style="--r: 288deg; animation-delay: 1.2s"></div>
        </div>

        <!-- Stage 3 -->
        <div id="s3" class="stage-layer">
          <div class="s3-hex">
             <svg class="s3-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div class="s3-scanner"></div>
          <div class="s3-bit" style="top: 0px; left: 0px;"></div>
          <div class="s3-bit" style="top: 0px; right: 0px; animation-delay: 0.5s"></div>
          <div class="s3-bit" style="bottom: 0px; left: 0px; animation-delay: 0.9s"></div>
          <div class="s3-bit" style="bottom: 0px; right: 0px; animation-delay: 0.3s"></div>
        </div>

        <!-- Stage 4 -->
        <div id="s4" class="stage-layer">
            <div class="s4-con">
                <div class="s4-shockwave"></div>
                <div class="s4-orbit-glow"></div>
                <div class="s4-ring"></div>
                <svg class="s4-tick" viewBox="0 0 24 24">
                  <path d="M5 12l5 5L20 7" />
                </svg>
            </div>
        </div>
      </div>
  </div>

  <!-- Stepper Boxes -->
  <div class="stepper-bottom">
    <div class="stepper-line-bg"></div>
    <div class="stepper-line-fill" id="step-line"></div>
    
    <div class="step-box active" id="b0">
      <div class="step-box-circle">
        <div class="box-shimmer"></div>
        <div class="box-bloom"></div>
        <span class="step-box-num">1</span>
        <svg class="tick-mark" viewBox="0 0 24 24" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="step-box-label">Auth</div>
    </div>

    <div class="step-box" id="b1">
      <div class="step-box-circle">
        <div class="box-shimmer"></div>
        <div class="box-bloom"></div>
        <span class="step-box-num">2</span>
        <svg class="tick-mark" viewBox="0 0 24 24" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="step-box-label">Store</div>
    </div>

    <div class="step-box" id="b2">
      <div class="step-box-circle">
        <div class="box-shimmer"></div>
        <div class="box-bloom"></div>
        <span class="step-box-num">3</span>
        <svg class="tick-mark" viewBox="0 0 24 24" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="step-box-label">Decrypt</div>
    </div>

    <div class="step-box" id="b3">
      <div class="step-box-circle">
        <div class="box-shimmer"></div>
        <div class="box-bloom"></div>
        <span class="step-box-num">4</span>
        <svg class="tick-mark" viewBox="0 0 24 24" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="step-box-label">Ready</div>
    </div>
  </div>

</div>

<div class="p-bar-fixed">
    <div class="p-bar-bg"><div class="p-bar-fill" id="pbar"></div></div>
</div>

<script>
  var stages = [
    { t:'Authenticating...',       s:'Securing your connection',       p:25 },
    { t:'Searching for Store...',  s:'Checking cloud records',         p:50 },
    { t:'Loading Settings...',     s:'Decrypting secure profile',      p:75 },
    { t:'Store Ready',             s:'Opening Kwiq Bill',              p:100 },
  ];

  var currentIdx = 0;
  var isT = false;
  var queue = [];

  function show(idx) {
    if (idx < 0 || idx >= stages.length) return;
    if (idx < currentIdx) return;
    
    if (isT) {
        if (!queue.includes(idx)) queue.push(idx);
        return;
    }

    isT = true;
    var c = stages[idx];

    // Transitions
    for (var i=0; i<4; i++) {
        var el = document.getElementById('s' + (i+1));
        if (i === currentIdx && i !== idx) {
            el.classList.add('exiting');
            (function(e){ setTimeout(function(){ e.classList.remove('visible', 'exiting'); }, 600); })(el);
        }
    }

    setTimeout(function() {
        var next = document.getElementById('s' + (idx+1));
        var clone = next.cloneNode(true);
        next.parentNode.replaceChild(clone, next);
        clone.classList.add('visible');
        
        if (idx === 3) {
            // Final postMessage to RN after a short delay
            setTimeout(function() {
                if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage('STAGE_DONE');
            }, 800);
        }
    }, idx === 0 ? 0 : 450);

    // Text Update
    var t = document.getElementById('t');
    var s = document.getElementById('s');
    t.classList.remove('visible'); 
    s.classList.remove('visible');
    setTimeout(function() {
      t.textContent = c.t; 
      s.textContent = c.s;
      t.classList.add('visible'); 
      s.classList.add('visible');
    }, 500);

    // Progress
    document.getElementById('pbar').style.width = c.p + '%';

    // Stepper & Line
    var fillWidth = (idx / 3) * 100;
    document.getElementById('step-line').style.width = fillWidth + '%';

    for (var k=0; k<4; k++) {
        var b = document.getElementById('b' + k);
        b.className = 'step-box' + (k < idx ? ' done' : k === idx ? ' active' : '');
    }

    currentIdx = idx;

    // 3s Showcase Delay
    setTimeout(function() {
        isT = false;
        if (queue.length > 0) show(queue.shift());
    }, 3000);
  }

  function goToStage(n) { show(n - 1); }
  show(0);
</script>

</body>
</html>
`;
