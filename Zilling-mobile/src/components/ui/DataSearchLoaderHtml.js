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
  }

  /* ─── Premium Dashboard Reveal Animation ─── */
  .reveal-overlay {
    position: fixed;
    inset: 0;
    background: #fff;
    z-index: 1000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .reveal-overlay.active { opacity: 1; pointer-events: auto; }
  .reveal-beam {
    position: absolute;
    width: 2px; height: 100%;
    background: #111;
    opacity: 0;
    transform: scaleY(0);
    transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
  }
  .reveal-overlay.active .reveal-beam { opacity: 1; transform: scaleY(1); }

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

  /* Stage 1: Auth */
  .s1-core { width: 64px; height: 64px; border-radius: 50%; border: 6px solid #111; position: relative; }
  .s1-scanner { position: absolute; inset: -20px; border-radius: 50%; border: 2px solid transparent; border-top-color: #111; animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
  .s1-ring-2 { position: absolute; inset: -35px; border-radius: 50%; border: 1.5px solid transparent; border-bottom-color: #eee; animation: spin 2.5s linear infinite reverse; }
  .s1-dot { position: absolute; top: -50px; left: calc(50% - 10px); width: 20px; height: 20px; background: #111; border-radius: 50%; animation: spin 3s linear infinite; transform-origin: 50% 150px; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  /* Stage 2: Searching */
  .s2-core { width: 60px; height: 60px; border-radius: 50%; background: #111; box-shadow: 0 0 40px rgba(0,0,0,0.05); }
  .s2-pulse { position: absolute; inset: 0; border: 4px solid #111; border-radius: 50%; animation: pulse-out-heavy 2s cubic-bezier(0.19, 1, 0.22, 1) infinite; }
  .s2-node { position: absolute; width: 14px; height: 14px; background: #111; border-radius: 50%; animation: gather-in 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
  @keyframes pulse-out-heavy { from { transform: scale(0.2); opacity: 1; } to { transform: scale(1.8); opacity: 0; } }
  @keyframes gather-in { from { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; } to { transform: translate(0, 0) scale(1); opacity: 0.8; } }

  /* Stage 3: Decrypting (Deep Cypher) */
  .s3-hex { width: 90px; height: 90px; border: 7px solid #111; border-radius: 20px; animation: hex-morph 3s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
  .s3-scanner { position: absolute; width: 160px; height: 4px; background: linear-gradient(90deg, transparent, #111, transparent); animation: scan-v-heavy 2s ease-in-out infinite; }
  .s3-bit { position: absolute; width: 16px; height: 16px; background: #fff; border: 4px solid #111; border-radius: 6px; }
  @keyframes hex-morph { 0%, 100% { border-radius: 20px; transform: rotate(0) scale(1); } 50% { border-radius: 50%; transform: rotate(180deg) scale(1.2); } }
  @keyframes scan-v-heavy { 0%, 100% { transform: translateY(-100px); opacity: 0; } 50% { transform: translateY(100px); opacity: 1; } }

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

<div class="reveal-overlay" id="ro">
    <div class="reveal-beam" style="left: 49.8%"></div>
</div>

<div class="root">
  
  <div class="header">
    <div class="lbl-title visible" id="t">Authenticating...</div>
    <div class="lbl-sub visible"   id="s">Securing your connection</div>
  </div>

  <div class="animation-container">
      <div class="icon-box">
        <!-- Stage 1 -->
        <div id="s1" class="stage-layer visible">
          <div class="s1-ring-2"></div>
          <div class="s1-scanner"></div>
          <div class="s1-core"></div>
          <div class="s1-dot"></div>
        </div>

        <!-- Stage 2 -->
        <div id="s2" class="stage-layer">
          <div class="s2-pulse"></div>
          <div class="s2-pulse" style="animation-delay: 0.6s"></div>
          <div class="s2-core"></div>
          <div class="s2-node" style="--dx:-120px; --dy:-60px;"></div>
          <div class="s2-node" style="--dx:120px; --dy:-60px; animation-delay: 0.4s"></div>
          <div class="s2-node" style="--dx:0px; --dy:120px; animation-delay: 0.8s"></div>
        </div>

        <!-- Stage 3 -->
        <div id="s3" class="stage-layer">
          <div class="s3-hex"></div>
          <div class="s3-scanner"></div>
          <div class="s3-bit" style="top: 20px; left: 20px;"></div>
          <div class="s3-bit" style="top: 20px; right: 20px; animation-delay: 0.5s"></div>
          <div class="s3-bit" style="bottom: 20px; left: 20px; animation-delay: 0.9s"></div>
          <div class="s3-bit" style="bottom: 20px; right: 20px; animation-delay: 0.3s"></div>
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
            // Dashboard Reveal Animation Sequence
            setTimeout(function() {
                var ro = document.getElementById('ro');
                ro.classList.add('active');
                
                // Final postMessage to RN
                setTimeout(function() {
                    if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage('STAGE_DONE');
                }, 1200);
            }, 3800);
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
