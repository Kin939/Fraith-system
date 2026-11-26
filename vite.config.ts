import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function resolveGitShortSha(): string {
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

/**
 * Rewrites production index.html so heavy JS & CSS bundles load from Russia-accessible
 * non-Cloudflare CDN mirrors (G-Core / Fastly jsDelivr) first, with automatic fallback to
 * same-origin ./assets/*. This avoids Roskomnadzor TSPU's 16 KB Cloudflare TCP freeze in RU.
 */
function fraithCdnBootstrapPlugin(): Plugin {
  let entryJs = '';
  let entryCss = '';
  const commitShort = resolveGitShortSha();

  return {
    name: 'fraith-cdn-bootstrap',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const jsMatch = html.match(
          /<script[^>]+type="module"[^>]+src="\.?\/?(assets\/[^"]+\.js)"[^>]*><\/script>/i
        );
        const cssMatch = html.match(
          /<link[^>]+rel="stylesheet"[^>]+href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/i
        );

        if (!jsMatch) return html;
        entryJs = jsMatch[1];
        entryCss = cssMatch ? cssMatch[1] : '';

        let cleaned = html.replace(jsMatch[0], '');
        if (cssMatch) {
          cleaned = cleaned.replace(cssMatch[0], '');
        }

        const bootstrapScript = `<script>
(function () {
  var REPO = "Kin939/Fraith-system";
  var TAG = ${JSON.stringify(commitShort ? `cdn-${commitShort}` : '')};
  var ENTRY_JS = ${JSON.stringify(entryJs)};
  var ENTRY_CSS = ${JSON.stringify(entryCss)};
  var host = window.location.hostname;
  var isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.slice(-8) === ".e2b.app" ||
    host.slice(-6) === ".local";

  function setStatus(msg, showRetry) {
    var el = document.getElementById("fraith-boot-status");
    if (el) el.innerHTML = msg;
    var btn = document.getElementById("fraith-boot-retry");
    if (btn && showRetry) btn.style.display = "inline-block";
  }

  function injectCss(href) {
    if (!href) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.crossOrigin = "anonymous";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadBundle(base, jsPath, cssPath, timeoutMs, onFail) {
    if (window.__FRAITH_MOUNTED__) return;
    var done = false;
    var timer = setTimeout(function () {
      if (!done && !window.__FRAITH_MOUNTED__) {
        done = true;
        onFail();
      }
    }, timeoutMs);

    injectCss(base + cssPath);
    var s = document.createElement("script");
    s.type = "module";
    s.crossOrigin = "anonymous";
    s.src = base + jsPath;
    s.onload = function () {
      clearTimeout(timer);
    };
    s.onerror = function () {
      if (!done && !window.__FRAITH_MOUNTED__) {
        done = true;
        clearTimeout(timer);
        onFail();
      }
    };
    document.head.appendChild(s);
  }

  if (isLocal) {
    loadBundle("./", ENTRY_JS, ENTRY_CSS, 15000, function () {});
    return;
  }

  // Порядок важен: сначала неизменяемый тег текущей сборки, затем origin
  // (там гарантированно лежит именно эта сборка) и только последним —
  // ветка gh-pages, которую jsDelivr кэширует на часы и может отдавать старый бандл.
  var bases = [];
  if (TAG) {
    bases.push("https://gcore.jsdelivr.net/gh/" + REPO + "@" + TAG + "/");
    bases.push("https://fastly.jsdelivr.net/gh/" + REPO + "@" + TAG + "/");
  }
  bases.push("./");
  bases.push("https://gcore.jsdelivr.net/gh/" + REPO + "@gh-pages/");
  bases.push("https://fastly.jsdelivr.net/gh/" + REPO + "@gh-pages/");


  function tryManifestThenOrigin() {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 3500);
    fetch("https://gcore.jsdelivr.net/gh/" + REPO + "@gh-pages/cdn-manifest.json?t=" + Date.now(), ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { clearTimeout(t); return r.ok ? r.json() : Promise.reject(); })
      .then(function (m) {
        // Манифест ветки может быть устаревшим (jsDelivr кэширует gh-pages часами),
        // поэтому он используется только как последний шанс — после origin.
        if (m && m.js) {
          loadBundle("https://gcore.jsdelivr.net/gh/" + REPO + "@gh-pages/", m.js, m.css || "", 6000, tryOrigin);
        } else {
          tryOrigin();
        }
      })
      .catch(function () {
        clearTimeout(t);
        tryOrigin();
      });
  }

  function tryOrigin() {
    loadBundle("./", ENTRY_JS, ENTRY_CSS, 6000, function () {
      if (!window.__FRAITH_MOUNTED__) {
        setStatus(
          "Не удалось загрузить скрипты портала.<br/><br/>" +
          "В РФ провайдеры и мобильные операторы ограничивают Cloudflare (ТСПУ 16 КБ). " +
          "Попробуйте обновить страницу через 20 сек или включить VPN / ByeDPI / Zapret (с ipset Cloudflare).",
          true
        );
      }
    });
  }

  var idx = 0;
  function nextMirror() {
    if (window.__FRAITH_MOUNTED__) return;
    if (idx < bases.length) {
      var b = bases[idx++];
      loadBundle(b, ENTRY_JS, ENTRY_CSS, 4000, nextMirror);
    } else {
      tryManifestThenOrigin();
    }
  }

  nextMirror();
})();
</script>`;

        return cleaned.replace('</body>', `${bootstrapScript}\n  </body>`);
      },
    },
    writeBundle(options) {
      const outDir = options.dir || 'dist';
      writeFileSync(
        resolve(outDir, 'cdn-manifest.json'),
        JSON.stringify(
          {
            commit: commitShort,
            js: entryJs,
            css: entryCss,
            builtAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), fraithCdnBootstrapPlugin()],
  base: './',
  define: {
    __FRAITH_BUILD_SHA__: JSON.stringify(resolveGitShortSha()),
    __FRAITH_BUILD_AT__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    cssCodeSplit: false,
    modulePreload: false,
  },
});
