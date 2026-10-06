/**
 * Widget embebible de Moverix — tabla de posiciones y goleadores.
 *
 * Uso en la web del organizador:
 *   <div id="moverix"></div>
 *   <script src="https://futbol.moverix.co/embed.js" data-key="LA_CLAVE"></script>
 *
 * Se pinta dentro de un Shadow DOM para que los estilos de la web anfitriona
 * no lo rompan (ni los nuestros rompan la suya).
 */
(function () {
  'use strict'

  var script = document.currentScript
  if (!script) return

  var key = script.getAttribute('data-key')
  if (!key) {
    console.error('[Moverix] Falta data-key en la etiqueta <script>.')
    return
  }

  var api = script.getAttribute('data-api') || 'https://api-ftb.moverix.co/ftb/v1'
  // Qué secciones mostrar. 'all' las muestra todas; también se pueden pedir
  // varias separadas por coma: data-view="grupos,goleadores"
  var view = (script.getAttribute('data-view') || 'all').toLowerCase()
  var wants = function (name) {
    if (view === 'all') return true
    return view.split(',').some(function (v) { return v.trim() === name })
  }
  var theme = (script.getAttribute('data-theme') || 'light').toLowerCase()
  var scorers = script.getAttribute('data-scorers') || '10'

  // Contenedor: el que indique data-target, o uno creado junto al script.
  var mount = script.getAttribute('data-target')
    ? document.querySelector(script.getAttribute('data-target'))
    : null
  if (!mount) {
    mount = document.createElement('div')
    script.parentNode.insertBefore(mount, script)
  }

  var root = mount.attachShadow ? mount.attachShadow({ mode: 'open' }) : mount

  var dark = theme === 'dark'
  var css =
    ':host{all:initial}' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    '.mvx{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
    'color:' + (dark ? '#E8EEF2' : '#0F1F2B') + ';' +
    'background:' + (dark ? '#0A1620' : '#fff') + ';' +
    'border:1px solid ' + (dark ? '#1E3A46' : '#E5EAEE') + ';border-radius:14px;overflow:hidden}' +
    '.hd{display:flex;align-items:center;gap:10px;padding:14px 16px;' +
    'border-bottom:1px solid ' + (dark ? '#1E3A46' : '#E5EAEE') + '}' +
    '.hd img{width:30px;height:30px;border-radius:8px;object-fit:cover}' +
    '.hd h3{font-size:15px;font-weight:700;line-height:1.2}' +
    '.hd span{font-size:11px;opacity:.6;display:block;margin-top:2px}' +
    '.tabs{display:flex;gap:2px;padding:8px 10px 0;overflow-x:auto;' +
    'border-bottom:1px solid ' + (dark ? '#1E3A46' : '#E5EAEE') + '}' +
    '.tabs button{font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;' +
    'background:none;border:0;border-bottom:2px solid transparent;padding:8px 12px;' +
    'color:inherit;opacity:.55;border-radius:6px 6px 0 0}' +
    '.tabs button:hover{opacity:.85}' +
    '.tabs button[aria-selected="true"]{opacity:1;border-bottom-color:#7BFF00}' +
    '.sec{padding:6px 0 12px}' +
    '.sec h4{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.55;' +
    'padding:12px 16px 8px;font-weight:700}' +
    'table{width:100%;border-collapse:collapse;font-size:13px}' +
    'th{font-size:10px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;' +
    'text-align:right;padding:6px 8px;font-weight:700}' +
    'th:nth-child(1),th:nth-child(2){text-align:left}' +
    'td{padding:7px 8px;text-align:right;border-top:1px solid ' + (dark ? '#152B36' : '#F1F4F6') + '}' +
    'td:nth-child(1),td:nth-child(2){text-align:left}' +
    'td:nth-child(1){width:26px;opacity:.5;padding-left:16px}' +
    'td:nth-child(2){font-weight:600}' +
    'td:last-child,th:last-child{padding-right:16px;font-weight:700}' +
    '.tm{display:flex;align-items:center;gap:7px}' +
    '.tm img{width:18px;height:18px;border-radius:50%;object-fit:cover;flex:none}' +
    '.ft{padding:9px 16px;font-size:10px;opacity:.5;text-align:right;' +
    'border-top:1px solid ' + (dark ? '#1E3A46' : '#E5EAEE') + '}' +
    '.ft a{color:inherit;text-decoration:none;font-weight:700}' +
    '.msg{padding:18px 16px;font-size:13px;opacity:.7}'

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  function render(html) {
    root.innerHTML = '<style>' + css + '</style><div class="mvx">' + html + '</div>'
  }

  function teamCell(r) {
    var logo = r.teamLogoUrl ? '<img src="' + esc(r.teamLogoUrl) + '" alt="">' : ''
    return '<div class="tm">' + logo + '<span>' + esc(r.teamName || r.teamShortName || '—') + '</span></div>'
  }

  function standingsTable(group) {
    var rows = (group.rows || [])
      .map(function (r, i) {
        return (
          '<tr><td>' + (r.position || i + 1) + '</td><td>' + teamCell(r) + '</td>' +
          '<td>' + (r.played || 0) + '</td>' +
          '<td>' + (r.wins || 0) + '</td>' +
          '<td>' + (r.draws || 0) + '</td>' +
          '<td>' + (r.losses || 0) + '</td>' +
          '<td>' + (r.goalDiff || 0) + '</td>' +
          '<td>' + (r.points || 0) + '</td></tr>'
        )
      })
      .join('')
    if (!rows) return ''
    var title = group.groupName ? '<h4>' + esc(group.groupName) + '</h4>' : ''
    return (
      title +
      '<table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>DG</th><th>Pts</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>'
    )
  }

  /** Reclasificación: todos los equipos en una sola tabla. */
  function reclassTable(rows) {
    var body = (rows || [])
      .map(function (r) {
        return (
          '<tr><td>' + r.position + '</td><td>' + teamCell(r) + '</td>' +
          '<td>' + (r.played || 0) + '</td>' +
          '<td>' + (r.goalDiff || 0) + '</td>' +
          '<td>' + (r.points || 0) + '</td></tr>'
        )
      })
      .join('')
    if (!body) return ''
    return (
      '<h4>Reclasificación</h4><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>DG</th><th>Pts</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table>'
    )
  }

  /** Valla menos vencida: equipos con menos goles en contra. */
  function keeperTable(rows) {
    var body = (rows || [])
      .map(function (r) {
        return (
          '<tr><td>' + r.position + '</td><td>' + teamCell(r) + '</td>' +
          '<td>' + (r.played || 0) + '</td>' +
          '<td>' + (r.goalsAgainst || 0) + '</td></tr>'
        )
      })
      .join('')
    if (!body) return ''
    return (
      '<h4>Valla menos vencida</h4><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>GC</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table>'
    )
  }

  function scorersTable(list) {
    var rows = list
      .map(function (p, i) {
        return (
          '<tr><td>' + (i + 1) + '</td><td>' + esc(p.playerName || 'Jugador') + '</td>' +
          '<td>' + esc(p.teamName || '') + '</td>' +
          '<td>' + (p.goals != null ? p.goals : 0) + '</td></tr>'
        )
      })
      .join('')
    if (!rows) return ''
    return (
      '<h4>Goleadores</h4><table><thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Goles</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>'
    )
  }

  render('<div class="msg">Cargando…</div>')

  fetch(api + '/public/embed/' + encodeURIComponent(key) + '?scorers=' + encodeURIComponent(scorers))
    .then(function (r) {
      if (!r.ok) throw new Error(r.status === 404 ? 'Torneo no disponible' : 'Error ' + r.status)
      return r.json()
    })
    .then(function (d) {
      var e = d.edition || {}
      var head =
        '<div class="hd">' +
        (e.logoUrl ? '<img src="' + esc(e.logoUrl) + '" alt="">' : '') +
        '<div><h3>' + esc(e.name || 'Torneo') + '</h3>' +
        '<span>' + esc([e.organization, e.season].filter(Boolean).join(' · ')) + '</span></div></div>'

      // Cada sección es una pestaña; solo se arman las que tengan contenido.
      var sections = []
      function add(id, label, html) {
        if (html) sections.push({ id: id, label: label, html: html })
      }
      if (wants('tabla') || wants('grupos')) {
        add('grupos', 'Grupos', (d.standings || []).map(standingsTable).join(''))
      }
      if (wants('reclasificacion') || wants('reclasificación')) {
        add('reclas', 'Reclasificación', reclassTable(d.reclassification))
      }
      if (wants('valla')) {
        add('valla', 'Valla', keeperTable(d.leastConceded))
      }
      if (wants('goleadores')) {
        add('goleadores', 'Goleadores', scorersTable(d.topScorers || []))
      }

      if (!sections.length) {
        render(head + '<div class="msg">Aún no hay estadísticas para mostrar.</div>')
        return
      }

      var foot =
        '<div class="ft">Datos de <a href="https://futbol.moverix.co" target="_blank" rel="noopener">Moverix</a></div>'

      // Con una sola sección no tiene sentido pintar la barra de pestañas.
      if (sections.length === 1) {
        render(head + '<div class="sec">' + sections[0].html + '</div>' + foot)
        return
      }

      var tabs =
        '<div class="tabs" role="tablist">' +
        sections
          .map(function (s, i) {
            return (
              '<button role="tab" data-i="' + i + '" aria-selected="' + (i === 0) + '">' +
              esc(s.label) + '</button>'
            )
          })
          .join('') +
        '</div>'

      function paint(i) {
        render(tabs + '<div class="sec">' + sections[i].html + '</div>' + foot)
        // El header va fuera de las pestañas; se reinserta arriba.
        var box = root.querySelector('.mvx')
        box.insertAdjacentHTML('afterbegin', head)
        box.querySelectorAll('.tabs button').forEach(function (b) {
          b.setAttribute('aria-selected', String(Number(b.dataset.i) === i))
          b.addEventListener('click', function () {
            paint(Number(b.dataset.i))
          })
        })
      }

      paint(0)
    })
    .catch(function (err) {
      render('<div class="msg">No se pudieron cargar las estadísticas. ' + esc(err.message) + '</div>')
    })
})()
