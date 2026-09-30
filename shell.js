(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var pageTitle = document.getElementById("pageTitle");
  var panelList = document.getElementById("panelList");
  var panel = document.getElementById("panel");
  var fab = document.getElementById("fabToggle");

  var pages = [];
  var activeId = null;

  function qs(name) {
    var m = new URLSearchParams(window.location.search).get(name);
    return m;
  }

  function loadPage(page) {
    if (!page) return;
    activeId = page.id;
    stage.classList.remove("is-loaded");
    stage.src = page.path;
    pageTitle.textContent = page.title;
    renderList();
    var url = new URL(window.location.href);
    url.searchParams.set("page", page.id);
    history.replaceState(null, "", url);
  }

  function renderList() {
    panelList.innerHTML = "";
    pages.forEach(function (p) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.className = "shell-panel__item" + (p.id === activeId ? " is-active" : "");
      btn.innerHTML =
        '<span class="shell-panel__item-dot"></span>' +
        '<span class="shell-panel__item-text">' +
        '<span class="shell-panel__item-title">' + p.title + "</span>" +
        '<span class="shell-panel__item-subtitle">' + (p.subtitle || "") + "</span>" +
        "</span>";
      btn.addEventListener("click", function () {
        loadPage(p);
        setPanelOpen(false);
      });
      li.appendChild(btn);
      panelList.appendChild(li);
    });
  }

  function setPanelOpen(open) {
    panel.classList.toggle("is-open", open);
    fab.setAttribute("aria-expanded", String(open));
  }

  fab.addEventListener("click", function () {
    setPanelOpen(!panel.classList.contains("is-open"));
  });
  document.addEventListener("click", function (e) {
    if (!panel.contains(e.target) && !fab.contains(e.target)) setPanelOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setPanelOpen(false);
  });

  stage.addEventListener("load", function () {
    stage.classList.add("is-loaded");
  });

  fetch("pages.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      pages = data;
      var requested = qs("page");
      var initial = pages.find(function (p) { return p.id === requested; }) || pages[0];
      loadPage(initial);
    })
    .catch(function (err) {
      pageTitle.textContent = "Error loading pages.json";
      console.error(err);
    });
})();
