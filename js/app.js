(function () {
        var $ = function (id) { return document.getElementById(id); };
        var usd = function (v, d) {
          if (!isFinite(v)) return "—";
          if (d === undefined) d = Math.abs(v) >= 1000 ? 0 : 2;
          return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
        };
        var num = function (v, d) { return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); };
        var val = function (id, lo, hi, def) {
          var v = parseFloat($(id).value);
          if (!isFinite(v)) v = def;
          return Math.min(hi, Math.max(lo, v));
        };

        function rng(seed) {
          return function () {
            seed = (seed + 0x6d2b79f5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
          };
        }

        var seed = 1;

        function params() {
          var B = Math.round(val("blocks", 20, 200, 100));
          return {
            B: B,
            supply: val("supply", 1, 1e7, 3333),
            floor: val("floor", 0.01, 1e6, 50),
            crowd: Math.round(val("crowd", 50, 5000, 1000)),
            style: $("style").value,
            budget: val("budget", 0, 1e9, 300),
            max: val("maxp", 0, 1e9, 120),
            entry: Math.round(val("entry", 0, B - 1, 0)),
          };
        }

        function simulate(P) {
          var r = rng(seed * 9973 + 17), B = P.B, F = P.floor, bids = [];
          for (var i = 0; i < P.crowd; i++) {
            var budget, max;
            if (P.style === "calm") { budget = 50 + r() * 250; max = F * (1 + r()); }
            else if (P.style === "hyped") { budget = 100 + r() * 900; max = F * (1 + r() * 4); }
            else if (r() < 0.03) { budget = 10000 + r() * 90000; max = F * (1.5 + r() * 2.5); }
            else { budget = 20 + r() * 130; max = F * (1 + r() * 0.5); }
            bids.push({ budget: budget, max: max, entry: Math.floor(r() * r() * B * 0.8) });
          }
          bids.push({ budget: P.budget, max: P.max, entry: P.entry, you: true });
          bids.sort(function (a, b) { return a.entry - b.entry; });

          var per = P.supply / B, n = bids.length;
          var am = new Float64Array(n), ap = new Float64Array(n), na = 0, ptr = 0, you = -1, maxMax = 0;
          var price = [], cT = [0], cS = [0], cR = [0], cSold = [0], out = -1, prev = F;
          function D(p) {
            var s = 0;
            for (var i = 0; i < na; i++) if (am[i] >= p) s += ap[i];
            return s / p;
          }
          for (var b = 0; b < B; b++) {
            while (ptr < n && bids[ptr].entry <= b) {
              var x = bids[ptr];
              am[na] = x.max; ap[na] = x.budget / (B - x.entry);
              if (x.you) you = na;
              if (x.max > maxMax) maxMax = x.max;
              na++; ptr++;
            }
            var lo = Math.max(F, prev), p;
            if (D(lo) <= per) p = lo;
            else {
              var hi = Math.max(lo, maxMax) * 1.000001 + 1e-9;
              for (var k = 0; k < 50; k++) {
                var mid = (lo + hi) / 2;
                if (D(mid) <= per) hi = mid; else lo = mid;
              }
              p = hi;
            }
            prev = p;
            price.push(p);
            var t = 0, s = 0, rf = 0;
            if (you >= 0) {
              if (am[you] >= p) { t = ap[you] / p; s = ap[you]; }
              else { rf = ap[you]; if (out < 0) out = b; }
            }
            cT.push(cT[b] + t); cS.push(cS[b] + s); cR.push(cR[b] + rf);
            cSold.push(cSold[b] + Math.min(D(p), per));
          }
          return { P: P, price: price, cT: cT, cS: cS, cR: cR, cSold: cSold, out: out, top: Math.max.apply(null, price) };
        }

        // chart
        var chart = new Chart($("price-chart"), {
          type: "line",
          data: {
            labels: [],
            datasets: [
              { label: "Clearing price", data: [], fill: true, pointRadius: [], pointHoverRadius: 4 },
              { label: "Your max", data: [], borderColor: "var(--chart-reference)", borderDash: [3, 4], borderWidth: 1, pointRadius: 0 },
            ],
          },
          options: {
            animation: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: function (items) { return "Block " + items[0].label; },
                  label: function (ctx) { return (ctx.datasetIndex ? "Your max " : "Clearing ") + usd(ctx.raw, 2); },
                },
              },
            },
            scales: {
              x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
              y: { ticks: { callback: function (v) { return "$" + v; } } },
            },
          },
        });

        var R = null, k = 0, playing = false, last = 0, acc = 0;

        function setupChart() {
          var P = R.P, labels = [];
          for (var i = 1; i <= P.B; i++) labels.push(String(i));
          chart.data.labels = labels;
          chart.data.datasets[1].label = "Your max " + usd(P.max, 0);
          chart.data.datasets[1].data = labels.map(function () { return P.max; });
          var hi = Math.max(R.top, P.max, P.floor) * 1.12;
          var lo = Math.min(P.floor, P.max > 0 ? P.max : P.floor) * 0.85;
          chart.options.scales.y.min = Math.floor(lo);
          chart.options.scales.y.max = Math.ceil(hi);
        }

        function render() {
          var P = R.P, B = P.B, ds = chart.data.datasets[0];
          ds.data = R.price.map(function (p, i) { return i < k ? p : null; });
          ds.pointRadius = R.price.map(function (p, i) { return i === R.out && i < k ? 5 : 0; });
          ds.pointBackgroundColor = R.price.map(function (p, i) { return i === R.out ? "var(--chart-accent)" : "var(--chart-ink)"; });
          ds.pointBorderColor = ds.pointBackgroundColor;
          chart.update("none");

          var tok = R.cT[k], spent = R.cS[k];
          $("blockno").textContent = k + " / " + B;
          $("scrub").max = B; $("scrub").value = k;
          $("s-price").textContent = usd(k ? R.price[k - 1] : P.floor, 2);
          $("s-filled").textContent = num(tok, 2);
          $("s-whole").textContent = Math.floor(tok + 1e-9);
          $("s-avg").textContent = tok > 0 ? usd(spent / tok, 2) : "—";
          $("s-spent").textContent = usd(spent, 0);
          $("s-ref").textContent = usd(R.cR[k], 0);
          $("s-sold").textContent = num((R.cSold[k] / P.supply) * 100, 1) + "%";
          $("play").textContent = playing ? "Pause" : k >= B ? "Replay" : "Play";
          summary();
        }

        function summary() {
          var P = R.P, B = P.B, box = $("summary");
          if (k < B) { box.hidden = true; return; }
          box.hidden = false;
          var tok = R.cT[B], spent = R.cS[B], fin = R.price[B - 1], avg = tok > 0 ? spent / tok : 0;
          var soldPct = (R.cSold[B] / P.supply) * 100;
          $("sum-lead").innerHTML =
            "<strong>You'd get " + num(tok, 2) + " Thinkers" + (tok > 0 ? " at an average " + usd(avg, 2) : "") + ".</strong> " +
            "Final clearing price " + usd(fin, 2) + ". Pool seeded at ~" + usd(fin, 2) + ".";
          var tips = [];
          if (P.budget <= 0) tips.push("Your budget is $0, so there is nothing to fill. Set a budget to bid.");
          else if (R.out >= 0) tips.push("Your max was below the clearing price from block " + (R.out + 1) + ". Raise your max or join earlier.");
          if (P.entry > 0 && P.entry >= B * 0.15) tips.push("Late bids get fewer blocks, so they're spread thinner. You joined at block " + (P.entry + 1) + " of " + B + ".");
          if (!tips.length) {
            if (fin <= P.floor * 1.0001) tips.push("Demand never beat supply, so every block cleared at the floor. " + num(100 - soldPct, 1) + "% of supply went unsold.");
            else tips.push("Your max stayed above every clearing price, so your whole budget filled. Everyone paid the same price as you in each block.");
          }
          $("sum-tip").textContent = tips.join(" ");
          var dTok = tok >= 10 ? num(tok, 1) : num(tok, 2);
          var dAvg = avg >= 100 ? Math.round(avg).toLocaleString("en-US") : avg.toFixed(2);
          var text = "Ran the @ThinkersClub_ CCA auction sim: got " + dTok + " Thinkers at avg $" + dAvg +
            ". Learn how the @NFTX_ Uniswap V4 auction works before Nov 24 👇";
          $("share").href = "https://x.com/intent/tweet?text=" + encodeURIComponent(text);
        }

        function stop() { playing = false; }
        function tick(t) {
          if (!playing) return;
          var dt = last ? Math.min(t - last, 100) : 0;
          last = t;
          acc += (dt / 1000) * 15 * parseFloat($("speed").value) * Math.max(1, R.P.B / 100);
          var moved = false;
          while (acc >= 1 && k < R.P.B) { k++; acc -= 1; moved = true; }
          if (k >= R.P.B) playing = false;
          if (moved || !playing) render();
          if (playing) requestAnimationFrame(tick);
        }

        $("play").addEventListener("click", function () {
          if (playing) { stop(); render(); return; }
          if (k >= R.P.B) k = 0;
          playing = true; last = 0; acc = 1;
          render();
          requestAnimationFrame(tick);
        });
        $("step").addEventListener("click", function () { stop(); if (k < R.P.B) k++; render(); });
        $("reset").addEventListener("click", function () { stop(); k = 0; render(); });
        $("scrub").addEventListener("input", function () { stop(); k = +this.value; render(); });

        var pending = false;
        function recompute() {
          if (pending) return;
          pending = true;
          requestAnimationFrame(function () {
            pending = false;
            var P = params();
            $("entry").max = P.B - 1;
            if (+$("entry").value > P.B - 1) $("entry").value = P.B - 1;
            P.entry = Math.min(P.entry, P.B - 1);
            $("entry-out").textContent = P.entry;
            $("blocks-out").textContent = P.B + " blocks";
            $("crowd-out").textContent = P.crowd.toLocaleString("en-US");
            $("seed-out").textContent = "#" + seed;
            var wasPlaying = playing;
            R = simulate(P);
            setupChart();
            if (!wasPlaying) k = P.B; else k = Math.min(k, P.B);
            render();
          });
        }
        ["budget", "maxp", "entry", "blocks", "supply", "floor", "crowd", "style"].forEach(function (id) {
          $(id).addEventListener("input", recompute);
          $(id).addEventListener("change", recompute);
        });
        $("reroll").addEventListener("click", function () { seed++; recompute(); });
        recompute();

        // art and token
        var flip = $("flip");
        function setFace(tok) {
          flip.classList.toggle("is-flipped", tok);
          $("t-nft").setAttribute("aria-pressed", String(!tok));
          $("t-tok").setAttribute("aria-pressed", String(tok));
          $("face-front").setAttribute("aria-hidden", String(tok));
          $("face-back").setAttribute("aria-hidden", String(!tok));
        }
        $("t-nft").addEventListener("click", function () { setFace(false); });
        $("t-tok").addEventListener("click", function () { setFace(true); });
        flip.addEventListener("click", function () { setFace(!flip.classList.contains("is-flipped")); });
        function conv() {
          var h = Math.max(0, parseFloat($("hold").value) || 0), tp = Math.max(0, parseFloat($("tprice").value) || 0);
          var f = Math.max(0, parseFloat($("frac").value) || 0);
          var hs = num(h, h % 1 ? 2 : 0);
          $("conv-out").innerHTML = '<span class="x-num">' + hs + "</span> NFT" + (h === 1 ? "" : "s") + ' = <span class="x-num">' + hs +
            "</span> token" + (h === 1 ? "" : "s") + ' = <span class="x-num">' + usd(h * tp) + "</span>";
          var whole = Math.floor(f + 1e-9), rest = Math.round((f - whole) * 1e6) / 1e6;
          $("frac-out").innerHTML = 'Hold <span class="x-num">' + f + "</span> tokens? That's <span class=\"x-num\">" + whole +
            "</span> NFT" + (whole === 1 ? "" : "s") + ' you can unwrap + <span class="x-num">' + rest + "</span> token.";
        }
        ["hold", "tprice", "frac"].forEach(function (id) { $(id).addEventListener("input", conv); });
        conv();

        // stock what-if
        function whatif() {
          var s = Math.max(0, parseFloat($("stock").value) || 0), r = Math.max(0, parseFloat($("ratio").value) || 0);
          var m = parseFloat($("move").value) || 0, before = s * r, after = before * (1 + m / 100);
          $("move-out").textContent = (m > 0 ? "+" : "") + m + "%";
          $("w-before").textContent = usd(before);
          $("w-change").textContent = (after - before >= 0 ? "+" : "") + usd(after - before);
          $("w-after").textContent = usd(after);
        }
        ["stock", "ratio", "move"].forEach(function (id) { $(id).addEventListener("input", whatif); });
        whatif();
      })();
