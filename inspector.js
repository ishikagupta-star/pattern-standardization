// Pattern Standardization — shared spec inspector
// Drop into any page: <link rel="stylesheet" href="../../inspector.css">
// and <script src="../../inspector.js"></script>, then mark whatever
// elements are worth inspecting with data-spec="Human-readable name".
// Everything shown is read live from getComputedStyle — never hand-typed —
// so it can't drift out of sync as the page's CSS changes.
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var tooltip = document.createElement("div");
    tooltip.className = "psi-tooltip";
    document.body.appendChild(tooltip);

    var nameEl = document.createElement("p");
    nameEl.className = "psi-tooltip__name";
    var listEl = document.createElement("div");
    tooltip.appendChild(nameEl);
    tooltip.appendChild(listEl);

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

    function colorSwatchRow(label, cssColor) {
      var c = parseColor(cssColor);
      if (!c || c.a === 0) return null;
      var hex = toHex(c);
      var alphaSuffix = c.a < 1 ? " · " + Math.round(c.a * 100) + "%" : "";
      return {
        label: label,
        html:
          '<span class="psi-swatch" style="background:' +
          cssColor +
          '"></span>' +
          hex.toUpperCase() +
          alphaSuffix,
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
      if (t === r && r === b && b === l) return fmtPx(t) + " all sides";
      if (t === b && r === l) return fmtPx(t) + " / " + fmtPx(r);
      return fmtPx(t) + " " + fmtPx(r) + " " + fmtPx(b) + " " + fmtPx(l);
    }

    function gapSummary(cs) {
      var display = cs.display;
      if (display.indexOf("flex") === -1 && display.indexOf("grid") === -1) return null;
      var rg = parseFloat(cs.rowGap) || 0;
      var cg = parseFloat(cs.columnGap) || 0;
      if (rg === 0 && cg === 0) return null;
      if (rg === cg) return fmtPx(rg);
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
      var size = fmtPx(parseFloat(cs.fontSize));
      var lh = cs.lineHeight === "normal" ? "normal" : fmtPx(parseFloat(cs.lineHeight));
      var ls = parseFloat(cs.letterSpacing);
      var extra = ls && !isNaN(ls) && Math.abs(ls) > 0.05 ? " · " + round(ls) + "px tracking" : "";
      return family + " · " + weight + " · " + size + "/" + lh + extra;
    }

    function borderSummary(cs) {
      var w = parseFloat(cs.borderTopWidth);
      if (!w) return null;
      var c = parseColor(cs.borderTopColor);
      var hex = c ? toHex(c).toUpperCase() : cs.borderTopColor;
      return fmtPx(w) + " · " + cs.borderTopStyle + " · " + hex;
    }

    function radiusSummary(cs) {
      var v = parseFloat(cs.borderTopLeftRadius);
      if (!v) return null;
      var all = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
      var uniform = all.every(function (x) { return x === all[0]; });
      if (v >= 999) return "full (pill)";
      return uniform ? fmtPx(v) : all.map(function (x) { return fmtPx(parseFloat(x)); }).join(" / ");
    }

    // ---- build + show tooltip ----------------------------------------------

    function buildRows(el) {
      var cs = getComputedStyle(el);
      var rect = el.getBoundingClientRect();
      var rows = [];

      rows.push({ label: "Size", value: round(rect.width) + " × " + round(rect.height) });

      var pad = paddingSummary(cs);
      if (pad) rows.push({ label: "Padding", value: pad });

      var gap = gapSummary(cs);
      if (gap) rows.push({ label: "Gap", value: gap });

      var radius = radiusSummary(cs);
      if (radius) rows.push({ label: "Radius", value: radius });

      var border = borderSummary(cs);
      if (border) rows.push({ label: "Border", value: border });

      var bg = colorSwatchRow("Background", cs.backgroundColor);
      if (bg) rows.push({ label: bg.label, html: bg.html });

      if (hasDirectText(el)) {
        var fg = colorSwatchRow("Text color", cs.color);
        if (fg) rows.push({ label: fg.label, html: fg.html });
        rows.push({ label: "Type", value: fontSummary(cs) });
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
