// Pattern Standardization — shared spec inspector
// Drop into any page: <link rel="stylesheet" href="../../inspector.css">
// and <script src="../../inspector.js"></script>, then mark whatever
// elements are worth inspecting with data-spec="Human-readable name".
// Everything shown is read live from getComputedStyle — never hand-typed —
// so it can't drift out of sync as the page's CSS changes.
(function () {
  "use strict";

  // document.currentScript is only valid synchronously during this initial
  // run, so grab it now — used below to find tokens.json next to this
  // script regardless of how deep the page including it is nested.
  var SCRIPT_SRC = document.currentScript && document.currentScript.src;

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var tooltip = document.createElement("div");
    tooltip.className = "psi-tooltip";
    document.body.appendChild(tooltip);

    // Tarmac Design System token dictionary — resolved names are shown
    // in place of (alongside) raw hex/px values once loaded. Hovers
    // before it resolves just show raw values; harmless, self-corrects
    // on the next hover.
    var TOKENS = { surfaceColors: {}, textColors: {}, borderColors: {}, spacing: {}, radius: {}, typography: [] };
    if (SCRIPT_SRC) {
      fetch(new URL("tokens.json", SCRIPT_SRC).href)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) { if (data) TOKENS = data; })
        .catch(function () {});
    }

    // role: "surface" | "text" | "border" — the same hex can be a different
    // named token depending on which CSS property it came from, so each
    // role checks its own map (falling back across the others) rather than
    // one flat map that can only remember a single name per hex.
    function tokenForColor(hex, role) {
      var h = hex.toLowerCase();
      var order =
        role === "text" ? [TOKENS.textColors, TOKENS.surfaceColors, TOKENS.borderColors] :
        role === "border" ? [TOKENS.borderColors, TOKENS.surfaceColors, TOKENS.textColors] :
        [TOKENS.surfaceColors, TOKENS.textColors, TOKENS.borderColors];
      for (var i = 0; i < order.length; i++) {
        if (order[i] && order[i][h]) return order[i][h];
      }
      return null;
    }
    function tokenForSpacing(px) {
      return TOKENS.spacing[String(Math.round(px))] || null;
    }
    function tokenForRadius(px) {
      return TOKENS.radius[String(Math.round(px))] || null;
    }
    function tokenForType(family, weight, size, line) {
      var fam = family.toLowerCase().trim();
      var match = TOKENS.typography.find(function (t) {
        return (
          t.family === fam &&
          String(t.weight) === String(weight) &&
          t.size === Math.round(size) &&
          t.line === Math.round(line)
        );
      });
      return match ? match.name : null;
    }

    var nameEl = document.createElement("p");
    nameEl.className = "psi-tooltip__name";
    var listEl = document.createElement("div");
    tooltip.appendChild(nameEl);
    tooltip.appendChild(listEl);

    // Four padding bands (top/right/bottom/left), reused across hovers and
    // repositioned live to match whatever element is currently hovered —
    // draws the padding directly on the element itself, not just as a
    // number in the tooltip.
    var padSides = ["top", "right", "bottom", "left"];
    var padBands = {};
    padSides.forEach(function (side) {
      var band = document.createElement("div");
      band.className = "psi-pad-band";
      var label = document.createElement("span");
      label.className = "psi-pad-band__label";
      band.appendChild(label);
      document.body.appendChild(band);
      padBands[side] = { el: band, label: label };
    });

    function hidePadBands() {
      padSides.forEach(function (side) {
        padBands[side].el.style.display = "none";
      });
    }

    function updatePadBands(el, cs, rect) {
      var bt = parseFloat(cs.borderTopWidth) || 0;
      var br = parseFloat(cs.borderRightWidth) || 0;
      var bb = parseFloat(cs.borderBottomWidth) || 0;
      var bl = parseFloat(cs.borderLeftWidth) || 0;
      var pt = parseFloat(cs.paddingTop) || 0;
      var pr = parseFloat(cs.paddingRight) || 0;
      var pb = parseFloat(cs.paddingBottom) || 0;
      var pl = parseFloat(cs.paddingLeft) || 0;

      var innerLeft = rect.left + bl;
      var innerTop = rect.top + bt;
      var innerRight = rect.right - br;
      var innerBottom = rect.bottom - bb;
      var innerWidth = Math.max(0, innerRight - innerLeft);

      var bands = {
        top: pt > 0 ? { x: innerLeft, y: innerTop, w: innerWidth, h: pt, value: pt } : null,
        bottom: pb > 0 ? { x: innerLeft, y: innerBottom - pb, w: innerWidth, h: pb, value: pb } : null,
        left: pl > 0 ? { x: innerLeft, y: innerTop + pt, w: pl, h: Math.max(0, innerBottom - pb - (innerTop + pt)), value: pl } : null,
        right: pr > 0 ? { x: innerRight - pr, y: innerTop + pt, w: pr, h: Math.max(0, innerBottom - pb - (innerTop + pt)), value: pr } : null,
      };

      padSides.forEach(function (side) {
        var b = bands[side];
        var band = padBands[side];
        if (!b || b.w <= 0 || b.h <= 0) {
          band.el.style.display = "none";
          return;
        }
        band.el.style.display = "flex";
        band.el.style.left = b.x + "px";
        band.el.style.top = b.y + "px";
        band.el.style.width = b.w + "px";
        band.el.style.height = b.h + "px";
        band.label.textContent = Math.round(b.value * 10) / 10;
      });
    }

    // Gap bands — the space BETWEEN a hovered container's direct children
    // (as opposed to padding bands, which are the space inside one
    // element). Pooled and reused since a container can have any number
    // of children/gaps.
    var gapBandPool = [];
    function getGapBand(i) {
      if (!gapBandPool[i]) {
        var band = document.createElement("div");
        band.className = "psi-gap-band";
        var label = document.createElement("span");
        label.className = "psi-gap-band__label";
        band.appendChild(label);
        document.body.appendChild(band);
        gapBandPool[i] = { el: band, label: label };
      }
      return gapBandPool[i];
    }
    function hideGapBands() {
      gapBandPool.forEach(function (b) { b.el.style.display = "none"; });
    }

    function updateGapBands(el, cs, rect) {
      hideGapBands();
      var display = cs.display;
      var isGrid = display.indexOf("grid") !== -1;
      var isFlex = display.indexOf("flex") !== -1;
      if (!isGrid && !isFlex) return;

      var innerLeft = rect.left + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0);
      var innerRight = rect.right - (parseFloat(cs.borderRightWidth) || 0) - (parseFloat(cs.paddingRight) || 0);
      var innerTop = rect.top + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0);
      var innerBottom = rect.bottom - (parseFloat(cs.borderBottomWidth) || 0) - (parseFloat(cs.paddingBottom) || 0);

      var children = Array.prototype.filter.call(el.children, function (c) {
        var r = c.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (children.length < 2) return;

      // Collect every gap rectangle to draw, from whichever layout mode.
      var bands = [];

      if (isGrid) {
        var colGap = parseFloat(cs.columnGap) || 0;
        var rowGap = parseFloat(cs.rowGap) || 0;
        // Column count from the computed track list ("406px 406px 406px" -> 3).
        var numCols = (cs.gridTemplateColumns || "").trim().split(/\s+/).filter(Boolean).length || 1;
        var numRows = Math.ceil(children.length / numCols);

        if (colGap > 0) {
          for (var row = 0; row < numRows; row++) {
            for (var col = 0; col < numCols - 1; col++) {
              var ia = row * numCols + col;
              var ib = ia + 1;
              if (ib >= children.length) continue;
              var ga = children[ia].getBoundingClientRect();
              var gb = children[ib].getBoundingClientRect();
              var w = gb.left - ga.right;
              if (w <= 0) continue;
              bands.push({ x: ga.right, y: ga.top, w: w, h: ga.height, value: colGap });
            }
          }
        }
        if (rowGap > 0) {
          for (var col2 = 0; col2 < numCols; col2++) {
            for (var row2 = 0; row2 < numRows - 1; row2++) {
              var ja = row2 * numCols + col2;
              var jb = ja + numCols;
              if (jb >= children.length) continue;
              var ra = children[ja].getBoundingClientRect();
              var rb = children[jb].getBoundingClientRect();
              var h2 = rb.top - ra.bottom;
              if (h2 <= 0) continue;
              bands.push({ x: ra.left, y: ra.bottom, w: ra.width, h: h2, value: rowGap });
            }
          }
        }
      } else {
        var direction = cs.flexDirection || "row";
        var isColumn = direction.indexOf("column") !== -1;
        var gapValue = isColumn ? parseFloat(cs.rowGap) || 0 : parseFloat(cs.columnGap) || 0;
        if (gapValue > 0) {
          for (var i = 0; i < children.length - 1; i++) {
            var a = children[i].getBoundingClientRect();
            var b = children[i + 1].getBoundingClientRect();
            if (isColumn) {
              var gapTop = a.bottom, gapBottom = b.top;
              if (gapBottom - gapTop <= 0) continue;
              bands.push({ x: innerLeft, y: gapTop, w: Math.max(0, innerRight - innerLeft), h: gapBottom - gapTop, value: gapValue });
            } else {
              var gapLeft = a.right, gapRight = b.left;
              if (gapRight - gapLeft <= 0) continue;
              bands.push({ x: gapLeft, y: innerTop, w: gapRight - gapLeft, h: Math.max(0, innerBottom - innerTop), value: gapValue });
            }
          }
        }
      }

      bands.forEach(function (b, idx) {
        var band = getGapBand(idx);
        band.el.style.display = "flex";
        band.el.style.left = b.x + "px";
        band.el.style.top = b.y + "px";
        band.el.style.width = b.w + "px";
        band.el.style.height = b.h + "px";
        band.label.textContent = Math.round(b.value * 10) / 10;
      });
    }

    var current = null;

    // ---- formatting helpers ----------------------------------------------

    function round(n) {
      return Math.round(n * 10) / 10;
    }

    function parseColor(str) {
      // "rgba(0, 0, 0, 0.5)" / "rgb(0, 0, 0)" -> {r,g,b,a}
      var m = str.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      var parts = m[1].split(",").map(function (s) { return parseFloat(s); });
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }

    function toHex(c) {
      function h(n) { return Math.round(n).toString(16).padStart(2, "0"); }
      return "#" + h(c.r) + h(c.g) + h(c.b);
    }

    // Wraps a raw value with its Tarmac token name when one resolves, as
    // "TokenName · raw value" — the name is what the ask was for; the raw
    // value stays alongside since engineers still need the literal number.
    function withToken(tokenName, rawText) {
      if (!tokenName) return rawText;
      return '<strong>' + tokenName + '</strong> <span class="psi-row__dim">· ' + rawText + "</span>";
    }

    function colorSwatchRow(label, cssColor, role) {
      var c = parseColor(cssColor);
      if (!c || c.a === 0) return null;
      var hex = toHex(c);
      var alphaSuffix = c.a < 1 ? " · " + Math.round(c.a * 100) + "%" : "";
      var token = tokenForColor(hex, role);
      var swatch = '<span class="psi-swatch" style="background:' + cssColor + '"></span>';
      return {
        label: label,
        html: swatch + withToken(token, hex.toUpperCase() + alphaSuffix),
      };
    }

    function fmtPx(n) {
      return round(n) + "px";
    }

    function paddingSummary(cs) {
      var t = parseFloat(cs.paddingTop),
        r = parseFloat(cs.paddingRight),
        b = parseFloat(cs.paddingBottom),
        l = parseFloat(cs.paddingLeft);
      if (t === 0 && r === 0 && b === 0 && l === 0) return null;
      if (t === r && r === b && b === l) {
        return withToken(tokenForSpacing(t), fmtPx(t) + " all sides");
      }
      if (t === b && r === l) return fmtPx(t) + " / " + fmtPx(r);
      return fmtPx(t) + " " + fmtPx(r) + " " + fmtPx(b) + " " + fmtPx(l);
    }

    function gapSummary(cs) {
      var display = cs.display;
      if (display.indexOf("flex") === -1 && display.indexOf("grid") === -1) return null;
      var rg = parseFloat(cs.rowGap) || 0;
      var cg = parseFloat(cs.columnGap) || 0;
      if (rg === 0 && cg === 0) return null;
      if (rg === cg) return withToken(tokenForSpacing(rg), fmtPx(rg));
      return fmtPx(rg) + " row / " + fmtPx(cg) + " col";
    }

    function hasDirectText(el) {
      for (var i = 0; i < el.childNodes.length; i++) {
        var n = el.childNodes[i];
        if (n.nodeType === 3 && n.textContent.trim().length > 0) return true;
      }
      return false;
    }

    function fontSummary(cs) {
      var family = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      var weightNames = { "400": "Regular", "500": "Medium", "600": "Semibold", "700": "Bold", "300": "Light" };
      var weight = weightNames[cs.fontWeight] || cs.fontWeight;
      var sizePx = parseFloat(cs.fontSize);
      var linePx = cs.lineHeight === "normal" ? sizePx * 1.2 : parseFloat(cs.lineHeight);
      var lhText = cs.lineHeight === "normal" ? "normal" : fmtPx(linePx);
      var ls = parseFloat(cs.letterSpacing);
      var extra = ls && !isNaN(ls) && Math.abs(ls) > 0.05 ? " · " + round(ls) + "px tracking" : "";
      var raw = family + " · " + weight + " · " + fmtPx(sizePx) + "/" + lhText + extra;
      var token = tokenForType(family, cs.fontWeight, sizePx, linePx);
      return withToken(token, raw);
    }

    function borderSummary(cs) {
      var w = parseFloat(cs.borderTopWidth);
      if (!w) return null;
      var c = parseColor(cs.borderTopColor);
      var hex = c ? toHex(c).toUpperCase() : cs.borderTopColor;
      var token = c ? tokenForColor(hex, "border") : null;
      return withToken(token, fmtPx(w) + " · " + cs.borderTopStyle + " · " + hex);
    }

    function radiusSummary(cs) {
      var v = parseFloat(cs.borderTopLeftRadius);
      if (!v) return null;
      var all = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
      var uniform = all.every(function (x) { return x === all[0]; });
      if (!uniform) return all.map(function (x) { return fmtPx(parseFloat(x)); }).join(" / ");
      var token = tokenForRadius(v) || (v >= 999 ? "Radius/Max" : null);
      return withToken(token, v >= 999 ? "full (pill)" : fmtPx(v));
    }

    // ---- build + show tooltip ----------------------------------------------

    function buildRows(el) {
      var cs = getComputedStyle(el);
      var rect = el.getBoundingClientRect();
      var rows = [];

      rows.push({ label: "Size", value: round(rect.width) + " × " + round(rect.height) });

      var pad = paddingSummary(cs);
      if (pad) rows.push({ label: "Padding", html: pad });

      var gap = gapSummary(cs);
      if (gap) rows.push({ label: "Gap", html: gap });

      var radius = radiusSummary(cs);
      if (radius) rows.push({ label: "Radius", html: radius });

      var border = borderSummary(cs);
      if (border) rows.push({ label: "Border", html: border });

      var bg = colorSwatchRow("Background", cs.backgroundColor, "surface");
      if (bg) rows.push({ label: bg.label, html: bg.html });

      if (hasDirectText(el)) {
        var fg = colorSwatchRow("Text color", cs.color, "text");
        if (fg) rows.push({ label: fg.label, html: fg.html });
        rows.push({ label: "Type", html: fontSummary(cs) });
      }

      var shadow = cs.boxShadow;
      if (shadow && shadow !== "none") {
        rows.push({ label: "Shadow", value: "yes" });
      }

      return rows;
    }

    function render(el) {
      var name = el.getAttribute("data-spec") || el.tagName.toLowerCase();
      nameEl.textContent = name;
      listEl.innerHTML = "";
      var cs = getComputedStyle(el);
      var rect = el.getBoundingClientRect();
      updatePadBands(el, cs, rect);
      updateGapBands(el, cs, rect);
      var rows = buildRows(el);
      rows.forEach(function (r) {
        var rowEl = document.createElement("div");
        rowEl.className = "psi-row";
        var labelEl = document.createElement("span");
        labelEl.className = "psi-row__label";
        labelEl.textContent = r.label;
        var valueEl = document.createElement("span");
        valueEl.className = "psi-row__value";
        if (r.html) valueEl.innerHTML = r.html;
        else valueEl.textContent = r.value;
        rowEl.appendChild(labelEl);
        rowEl.appendChild(valueEl);
        listEl.appendChild(rowEl);
      });
    }

    function position(x, y) {
      var pad = 16;
      var rect = tooltip.getBoundingClientRect();
      var left = x + pad;
      var top = y + pad;
      if (left + rect.width > window.innerWidth - 8) left = x - rect.width - pad;
      if (top + rect.height > window.innerHeight - 8) top = y - rect.height - pad;
      tooltip.style.left = Math.max(8, left) + "px";
      tooltip.style.top = Math.max(8, top) + "px";
    }

    function hide() {
      tooltip.classList.remove("is-visible");
      hidePadBands();
      hideGapBands();
      if (current) current.classList.remove("psi-active");
      current = null;
    }

    document.addEventListener("mousemove", function (e) {
      var target = e.target.closest ? e.target.closest("[data-spec]") : null;
      if (!target) {
        if (current) hide();
        return;
      }
      if (target !== current) {
        if (current) current.classList.remove("psi-active");
        current = target;
        // Read computed styles BEFORE applying the highlight outline class,
        // so the inspector's own hover styling can never leak into the
        // values it reports (belt-and-braces on top of outline-only CSS).
        render(target);
        current.classList.add("psi-active");
        tooltip.classList.add("is-visible");
        position(e.clientX, e.clientY);
      } else {
        position(e.clientX, e.clientY);
      }
    });

    document.addEventListener("mouseleave", hide);

    // Let the parent shell (if this page is embedded in an iframe) know
    // this page is ready, so it can fade out any loading state.
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "psi:page-ready" }, "*");
      } catch (e) {}
    }
  });
})();
