var API_URL = 'https://script.google.com/macros/s/AKfycbyDjwN1oYZbLZkdUgDpjkDG67pdliGhpTosgtd-4HvYgy6nImRww1wXYC8kuR4BgrdU/exec';
var registros = [];
var state = { view: 'list', tab: 'panel', selectedId: null, filterText: '', filterEstado: 'todos', filterFechaDesde: '', filterFechaHasta: '', page: 1, perPage: 20 };

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(function () { t.style.display = 'none'; }, 2800);
}

async function apiGet(action, params) {
  var url = API_URL + '?action=' + action;
  if (params) Object.keys(params).forEach(function (k) { url += '&' + k + '=' + encodeURIComponent(params[k]); });
  var res = await fetch(url);
  return res.json();
}

async function apiPost(action, data) {
  var body = Object.assign({ action: action }, data);
  var res = await fetch(API_URL, {
    method: 'POST',
    redirect: 'follow',
    body: JSON.stringify(body)
  });
  return res.json();
}

function cargarUsuario() {
  apiGet('getUsuarioActual').then(function (email) {
    document.getElementById('user-email').textContent = email;
  });
}

document.getElementById('logout-btn').addEventListener('click', function () {
  window.open('https://accounts.google.com/Logout', '_blank');
});

function cargarRegistros() {
  apiGet('getRegistros').then(function (data) {
    registros = data;
    render();
  }).catch(function (err) {
    document.getElementById('view-root').innerHTML = '<div class="empty-state">Error al cargar: ' + err.message + '</div>';
  });
}

function estadoInfo(e) {
  if (e === 'pendiente') return { cls: 'badge-pendiente', label: 'Pendiente' };
  if (e === 'espera') return { cls: 'badge-espera', label: 'Espera resp.' };
  if (e === 'cumplido') return { cls: 'badge-cumplido', label: 'Cumplido' };
  return { cls: 'badge-tomado', label: 'Tom. conoc.' };
}

function filteredRegistros() {
  var t = state.filterText.toLowerCase();
  return registros.filter(function (n) {
    var matchText = !t || (n.numero || '').toLowerCase().indexOf(t) > -1 ||
      (n.referencia || '').toLowerCase().indexOf(t) > -1 ||
      (n.observaciones || '').toLowerCase().indexOf(t) > -1;
    var matchEstado = state.filterEstado === 'todos' || n.estado === state.filterEstado;
    var matchFecha = true;
    if (state.filterFechaDesde && n.fecha) {
      var parts = n.fecha.split('/');
      var fechaReg = parts[2] + '-' + parts[1] + '-' + parts[0];
      matchFecha = matchFecha && fechaReg >= state.filterFechaDesde;
    }
    if (state.filterFechaHasta && n.fecha) {
      var parts = n.fecha.split('/');
      var fechaReg = parts[2] + '-' + parts[1] + '-' + parts[0];
      matchFecha = matchFecha && fechaReg <= state.filterFechaHasta;
    }
    return matchText && matchEstado && matchFecha;
    return matchText && matchEstado;
  });
}

function render() {
  var root = document.getElementById('view-root');
  root.innerHTML = state.view === 'list' ? listHtml() : detailHtml();
  bindEvents();
}

function listHtml() {
  var alertasRoja = registros.filter(function (n) { return n.estado === 'espera' && n.diasVence !== null && n.diasVence <= 3 && n.diasVence >= 0; });
  var alertasAmarilla = registros.filter(function (n) { return n.estado === 'espera' && n.diasVence !== null && n.diasVence <= 5 && n.diasVence > 3; });
  var counts = { pendiente: 0, espera: 0, cumplido: 0, tomado: 0 };
  registros.forEach(function (n) { if (counts[n.estado] !== undefined) counts[n.estado]++; });

  var html = '';
  if (state.tab === 'panel') {
    if (alertasRoja.length > 0) {
      var textoRoja = state.filterEstado === 'espera'
        ? 'Mostrando ' + alertasRoja.length + ' registro(s) que vencen pronto. Hacé clic para ver todos.'
        : 'URGENTE: ' + alertasRoja.length + ' registro' + (alertasRoja.length > 1 ? 's' : '') + ' vence' + (alertasRoja.length > 1 ? 'n' : '') + ' en 3 días o menos. Hacé clic para ver.';
      html += '<div class="alert-banner alert-roja" style="display:flex; cursor:pointer;" id="alerta-vencimiento">';
      html += '<span>' + textoRoja + '</span>';
      html += '</div>';
    } else if (alertasAmarilla.length > 0) {
      var textoAmarilla = state.filterEstado === 'espera'
        ? 'Mostrando ' + alertasAmarilla.length + ' registro(s) que vencen. Hacé clic para ver todos.'
        : alertasAmarilla.length + ' registro' + (alertasAmarilla.length > 1 ? 's' : '') + ' vence' + (alertasAmarilla.length > 1 ? 'n' : '') + ' en los próximos 5 días. Hacé clic para ver.';
      html += '<div class="alert-banner" style="display:flex; cursor:pointer;" id="alerta-vencimiento">';
      html += '<span>' + textoAmarilla + '</span>';
      html += '</div>';
    }
    html += '<div class="kpi-grid">';
    html += kpiCard('Pendientes', counts.pendiente, 'pendiente');
    html += kpiCard('Espera de respuesta', counts.espera, 'espera');
    html += kpiCard('Cumplidos', counts.cumplido, 'cumplido');
    html += kpiCard('Tomado conocimiento', counts.tomado, 'tomado');
    html += '</div>';
  }
  html += '<div class="toolbar">';
  html += '<input type="text" id="search-input" placeholder="Buscar por número, asunto u observaciones" value="' + state.filterText + '">';
  html += '<select id="estado-filter">';
  ['todos', 'pendiente', 'espera', 'cumplido', 'tomado'].forEach(function (e) {
    var label = e === 'todos' ? 'Todos los estados' : estadoInfo(e).label;
    html += '<option value="' + e + '"' + (state.filterEstado === e ? ' selected' : '') + '>' + label + '</option>';
  });
  html += '</select>';
  if (state.tab === 'registros') {
    html += '<input type="date" id="fecha-desde" value="' + state.filterFechaDesde + '" style="width:140px;" title="Fecha desde">';
    html += '<input type="date" id="fecha-hasta" value="' + state.filterFechaHasta + '" style="width:140px;" title="Fecha hasta">';
    html += '<button class="btn-primary" id="btn-buscar-fecha" style="padding:0 14px;">Buscar</button>';
    html += '<button class="btn-secondary" id="btn-limpiar-fecha" style="padding:0 14px;">Limpiar</button>';
  }
  html += '<button class="btn-primary" id="new-btn">+ Nuevo registro</button>';
  html += '</div>';
  if (state.tab === 'panel') {
    html += '<div class="dropzone" id="dropzone"><div class="icon">&#8593;</div><p>Arrastrá una o varias notas/oficios (PDF, Word) para crear registros automáticamente, o hacé clic para seleccionar</p><input type="file" id="quick-file-input" multiple style="display:none;"></div>';
  }
  html += tableHtml();
  return html;
}

function kpiCard(label, value, estado) {
  var isActive = state.filterEstado === estado;
  var colors = {
    pendiente: { bg: 'var(--amber-bg)', border: 'var(--amber)', icon: '&#9888;' },
    espera: { bg: 'var(--coral-bg)', border: 'var(--coral)', icon: '&#8987;' },
    cumplido: { bg: 'var(--green-bg)', border: 'var(--green)', icon: '&#10003;' },
    tomado: { bg: 'var(--indigo-bg)', border: 'var(--indigo)', icon: '&#128203;' }
  };
  var c = colors[estado] || { bg: 'var(--surface)', border: 'var(--border)', icon: '' };
  var activeStyle = isActive ? 'border:2px solid ' + c.border + ';' : 'border:2px solid transparent;';
  return '<div class="kpi-card" data-estado="' + estado + '" style="cursor:pointer;' + activeStyle + ' background:' + c.bg + ';"><p class="kpi-label">' + c.icon + ' ' + label + '</p><p class="kpi-value" style="color:' + c.border + ';">' + value + '</p></div>';
}

function tableHtml() {
  var allRows = filteredRegistros();
  var totalRows = allRows.length;
  var totalPages = Math.ceil(totalRows / state.perPage);
  if (state.page > totalPages) state.page = totalPages || 1;
  var start = (state.page - 1) * state.perPage;
  var rows = allRows.slice(start, start + state.perPage);

  var html = '<table><thead><tr><th>Nº ref.</th><th>Fecha</th><th>Entrada/Salida</th><th>Asunto</th><th>Estado</th><th>Vence</th><th>Observaciones</th></tr></thead><tbody>';
  if (rows.length === 0) {
    html += '<tr><td colspan="7" class="empty-state">No hay registros para este filtro.</td></tr>';
  }
  rows.forEach(function (n) {
    var st = estadoInfo(n.estado);
    var vence = n.fechaLimite ? '<span class="' + (n.diasVence !== null && n.diasVence <= 5 ? 'vence-danger' : 'vence-normal') + '">' + n.fechaLimite + '</span>' : '<span class="vence-normal">—</span>';
    var dirBg = n.direccion === 'Salida' ? 'var(--surface-alt)' : 'var(--accent-bg)';
    var dirColor = n.direccion === 'Salida' ? 'var(--ink-soft)' : 'var(--accent-dark)';
    var rowBg = n.estado === 'cumplido' ? 'var(--green-bg)' : (n.estado === 'espera' ? 'var(--coral-bg)' : '');
    var rowStyle = rowBg ? ' style="background:' + rowBg + ';"' : '';
    html += '<tr class="note-row" data-id="' + n.id + '"' + rowStyle + '>';
    html += '<td>' + n.numero + '</td>';
    html += '<td style="color:var(--ink-soft);">' + n.fecha + '</td>';
    html += '<td><select class="direccion-rapido" data-id="' + n.id + '" style="height:26px; border:1px solid var(--border); border-radius:5px; padding:2px 4px; font-size:11.5px; font-family:inherit; background:' + dirBg + '; color:' + dirColor + ';"><option value="Entrada"' + (n.direccion === 'Entrada' ? ' selected' : '') + '>Entrada</option><option value="Salida"' + (n.direccion === 'Salida' ? ' selected' : '') + '>Salida</option></select></td>';
    html += '<td>' + (n.referencia || '') + '</td>';
    html += '<td><select class="estado-rapido" data-id="' + n.id + '" style="height:26px; border:1px solid var(--border); border-radius:5px; padding:2px 4px; font-size:11.5px; font-family:inherit; background:' + (st.cls === 'badge-pendiente' ? 'var(--amber-bg)' : st.cls === 'badge-espera' ? 'var(--coral-bg)' : st.cls === 'badge-cumplido' ? 'var(--green-bg)' : 'var(--indigo-bg)') + '; color:' + (st.cls === 'badge-pendiente' ? 'var(--amber)' : st.cls === 'badge-espera' ? 'var(--coral)' : st.cls === 'badge-cumplido' ? 'var(--green)' : 'var(--indigo)') + ';"><option value="pendiente"' + (n.estado === 'pendiente' ? ' selected' : '') + '>Pendiente</option><option value="espera"' + (n.estado === 'espera' ? ' selected' : '') + '>Espera</option><option value="tomado"' + (n.estado === 'tomado' ? ' selected' : '') + '>Tomado</option><option value="cumplido"' + (n.estado === 'cumplido' ? ' selected' : '') + '>Cumplido</option></select></td>';
    html += '<td>' + vence + '</td>';
    html += '<td style="color:var(--ink-soft);">' + (n.observaciones || '—') + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';

  if (totalRows > 0) {
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; font-size:13px; color:var(--ink-soft);">';
    html += '<div>Mostrando ' + (start + 1) + '-' + Math.min(start + state.perPage, totalRows) + ' de ' + totalRows + ' registros</div>';
    html += '<div style="display:flex; gap:6px; align-items:center;">';
    html += '<select id="per-page-select" style="height:30px; border:1px solid var(--border); border-radius:6px; padding:2px 6px; font-size:12px; font-family:inherit;">';
    [10, 20, 50, 100].forEach(function (v) {
      html += '<option value="' + v + '"' + (state.perPage === v ? ' selected' : '') + '>' + v + '</option>';
    });
    html += '</select>';
    html += '<button class="btn-secondary page-btn" data-page="1" style="height:30px; padding:0 8px; font-size:12px; min-width:30px;">&#171;</button>';
    html += '<button class="btn-secondary page-btn" data-page="' + (state.page - 1) + '" style="height:30px; padding:0 8px; font-size:12px; min-width:30px;">&#8249;</button>';
    html += '<span style="padding:0 8px;">Página ' + state.page + ' de ' + totalPages + '</span>';
    html += '<button class="btn-secondary page-btn" data-page="' + (state.page + 1) + '" style="height:30px; padding:0 8px; font-size:12px; min-width:30px;">&#8250;</button>';
    html += '<button class="btn-secondary page-btn" data-page="' + totalPages + '" style="height:30px; padding:0 8px; font-size:12px; min-width:30px;">&#187;</button>';
    html += '</div></div>';
  }
  return html;
}

function detailHtml() {
  var n = registros.find(function (x) { return x.id === state.selectedId; });
  if (!n) return listHtml();
  var st = estadoInfo(n.estado);
  var contestaron = n.destinatarios.filter(function (d) { return d.estado === 'cumplido'; }).length;

  var dirBg = n.direccion === 'Salida' ? 'var(--surface-alt)' : 'var(--accent-bg)';
  var dirColor = n.direccion === 'Salida' ? 'var(--ink-soft)' : 'var(--accent-dark)';
  var html = '<div style="display:flex; justify-content:space-between; align-items:center;">';
  html += '<div class="back-link" id="back-btn">&#8592; Volver al listado</div>';
  html += '<button class="btn-danger" id="delete-btn">Eliminar registro</button>';
  html += '</div>';
  html += '<div class="card">';
  html += '<div class="detail-header"><div><p class="detail-label">Nota Nº</p><input type="text" id="det-numero" value="' + (n.numero || '') + '" style="border:1px solid var(--border); border-radius:6px; padding:6px 10px; font-family:inherit; font-size:17px; font-weight:700; width:320px;"></div><div style="display:flex; gap:8px; align-items:center;"><select id="det-direccion" style="height:30px; border:1px solid var(--border); border-radius:6px; padding:4px 8px; font-family:inherit; font-size:13px; font-weight:600; background:' + dirBg + '; color:' + dirColor + ';"><option value="Entrada"' + (n.direccion === 'Entrada' ? ' selected' : '') + '>Entrada</option><option value="Salida"' + (n.direccion === 'Salida' ? ' selected' : '') + '>Salida</option></select><select id="det-estado" style="height:30px; border:1px solid var(--border); border-radius:6px; padding:4px 8px; font-family:inherit; font-size:13px; font-weight:600; background:' + (st.cls === 'badge-pendiente' ? 'var(--amber-bg)' : st.cls === 'badge-espera' ? 'var(--coral-bg)' : st.cls === 'badge-cumplido' ? 'var(--green-bg)' : 'var(--indigo-bg)') + '; color:' + (st.cls === 'badge-pendiente' ? 'var(--amber)' : st.cls === 'badge-espera' ? 'var(--coral)' : st.cls === 'badge-cumplido' ? 'var(--green)' : 'var(--indigo)') + ';"><option value="pendiente"' + (n.estado === 'pendiente' ? ' selected' : '') + '>Pendiente</option><option value="espera"' + (n.estado === 'espera' ? ' selected' : '') + '>Espera resp.</option><option value="tomado"' + (n.estado === 'tomado' ? ' selected' : '') + '>Tom. conoc.</option><option value="cumplido"' + (n.estado === 'cumplido' ? ' selected' : '') + '>Cumplido</option></select></div></div>';
  html += '<table class="detail-table">';
  html += '<tr><td>Referencia</td><td><input type="text" id="det-referencia" value="' + (n.referencia || '').replace(/"/g, '&quot;') + '" style="border:1px solid var(--border); border-radius:6px; padding:6px 10px; font-family:inherit; font-size:13.5px; width:100%;"></td></tr>';
  html += '<tr><td>Fecha</td><td><input type="date" id="det-fecha" value="' + dmyToIso(n.fecha) + '" style="border:1px solid var(--border); border-radius:6px; padding:4px 8px; font-family:inherit; font-size:13px;"></td></tr>';
  html += '<tr><td>Vence respuesta</td><td><input type="date" id="det-fechalimite" value="' + dmyToIso(n.fechaLimite) + '" style="border:1px solid var(--border); border-radius:6px; padding:4px 8px; font-family:inherit; font-size:13px;">' + (n.diasVence !== null && n.fechaLimite ? ' <span class="vence-danger">(' + n.diasVence + ' días)</span>' : '') + '</td></tr>';
  if (n.archivoUrl) {
    html += '<tr><td>Archivo original</td><td><a class="file-link" href="' + n.archivoUrl + '" target="_blank">Ver archivo</a></td></tr>';
  }
  html += '</table></div>';

  html += '<p style="font-size:14px; font-weight:700; margin:0 0 10px;">Destinatarios (' + contestaron + ' de ' + n.destinatarios.length + ' contestaron)</p>';
  n.destinatarios.forEach(function (d) {
    var ds = estadoInfo(d.estado);
    html += '<div class="dest-row">';
    html += '<div style="display:flex; gap:8px; align-items:center;">';
    html += '<input type="text" class="dest-nombre-input" data-id="' + d.id + '" value="' + (d.nombre || '').replace(/"/g, '&quot;') + '" style="border:1px solid var(--border); border-radius:4px; padding:4px 8px; font-family:inherit; font-size:13px; font-weight:600; width:220px;">';
    html += '<input type="text" class="dest-dep-input" data-id="' + d.id + '" value="' + (d.dependencia || '').replace(/"/g, '&quot;') + '" style="border:1px solid var(--border); border-radius:4px; padding:4px 8px; font-family:inherit; font-size:12px; width:120px;">';
    html += '</div>';
    html += '<div style="display:flex; align-items:center; gap:10px;">';
    if (d.estado === 'cumplido') {
      html += '<input type="date" class="dest-fecha-resp-input" data-id="' + d.id + '" value="' + dmyToIso(d.fechaRespuesta) + '" style="border:1px solid var(--border); border-radius:4px; padding:3px 6px; font-family:inherit; font-size:12px; width:130px;">';
      html += '<a class="file-link" href="' + (d.archivoUrl || '#') + '" target="_blank">Ver respuesta</a>';
    } else {
      html += '<input type="file" style="display:none;" class="dest-file-input" data-id="' + d.id + '">';
      html += '<button class="btn-secondary attach-btn" data-id="' + d.id + '">Adjuntar respuesta</button>';
    }
    html += '<span class="badge ' + ds.cls + '">' + ds.label + '</span>';
    html += '<button class="btn-danger delete-dest-btn" data-id="' + d.id + '" style="padding:4px 8px; font-size:11px;">X</button>';
    html += '</div></div>';
  });
  html += '<div id="add-dest-form" style="display:none; margin-top:10px; padding:12px; background:var(--bg); border-radius:8px; border:1px solid var(--border);">';
  html += '<p style="font-size:13px; font-weight:600; margin:0 0 8px;">Nuevo destinatario</p>';
  html += '<div style="display:flex; gap:8px; align-items:center;">';
  html += '<input type="text" id="new-dest-nombre" placeholder="Nombre y apellido" style="flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-family:inherit; font-size:13px;">';
  html += '<input type="text" id="new-dest-dep" placeholder="Dependencia (ej: DTRA#PNA)" style="width:150px; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-family:inherit; font-size:13px;">';
  html += '<button class="btn-primary" id="save-dest-btn" style="padding:6px 12px;">Agregar</button>';
  html += '<button class="btn-secondary" id="cancel-dest-btn" style="padding:6px 12px;">Cancelar</button>';
  html += '</div></div>';
  html += '<button class="btn-secondary" id="add-dest-detail-btn" style="margin-top:10px;">+ Agregar destinatario</button>';
  html += '<div class="card"><label style="font-size:12.5px; color:var(--ink-soft); font-weight:500; display:block; margin-bottom:6px;">Observaciones generales (se guarda automáticamente)</label><textarea id="obs-input">' + (n.observaciones || '') + '</textarea></div>';
  return html;
}

function fileToBase64(file, cb) {
  var reader = new FileReader();
  reader.onload = function () {
    var base64 = reader.result.split(',')[1];
    cb({ base64: base64, nombre: file.name, tipo: file.type || 'application/octet-stream' });
  };
  reader.readAsDataURL(file);
}

function bindEvents() {
  if (state.view === 'list') {
    document.querySelectorAll('.note-row').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.classList.contains('estado-rapido') || e.target.classList.contains('direccion-rapido')) return;
        state.selectedId = row.getAttribute('data-id');
        state.view = 'detail';
        render();
      });
    });
    var search = document.getElementById('search-input');
    search.addEventListener('input', function () {
      state.filterText = search.value;
      state.page = 1;
      render();
    });
    document.querySelectorAll('.kpi-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var estado = card.getAttribute('data-estado');
        state.filterEstado = estado;
        state.page = 1;
        document.getElementById('estado-filter').value = estado;
        render();
      });
    });
    document.getElementById('estado-filter').addEventListener('change', function (e) {
      state.filterEstado = e.target.value;
      state.page = 1;
      render();
    });
    document.getElementById('new-btn').addEventListener('click', openModal);
    var dz = document.getElementById('dropzone');
    if (dz) {
      var qfi = document.getElementById('quick-file-input');
      dz.addEventListener('click', function () { qfi.click(); });
      dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('drag'); });
      dz.addEventListener('dragleave', function () { dz.classList.remove('drag'); });
      dz.addEventListener('drop', function (e) {
        e.preventDefault();
        dz.classList.remove('drag');
        if (e.dataTransfer.files.length) handleQuickFiles(e.dataTransfer.files);
      });
      qfi.addEventListener('change', function () {
        if (qfi.files.length) handleQuickFiles(qfi.files);
      });
    }
    var alertaEl = document.getElementById('alerta-vencimiento');
    if (alertaEl) {
      alertaEl.addEventListener('click', function () {
        if (state.filterEstado === 'espera') {
          state.filterEstado = 'todos';
          document.getElementById('estado-filter').value = 'todos';
          showToast('Mostrando todos los registros');
        } else {
          state.filterEstado = 'espera';
          document.getElementById('estado-filter').value = 'espera';
          showToast('Mostrando registros en espera de respuesta');
        }
        render();
      });
    }
    bindTableClicks();
    document.querySelectorAll('.page-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = parseInt(btn.getAttribute('data-page'));
        if (p >= 1) { state.page = p; render(); }
      });
    });
    var pps = document.getElementById('per-page-select');
    if (pps) {
      pps.addEventListener('change', function () {
        state.perPage = parseInt(pps.value);
        state.page = 1;
        render();
      });
    }
    var fd = document.getElementById('fecha-desde');
    if (fd) {
      fd.addEventListener('change', function () {
        state.filterFechaDesde = fd.value;
      });
    }
    var fh = document.getElementById('fecha-hasta');
    if (fh) {
      fh.addEventListener('change', function () {
        state.filterFechaHasta = fh.value;
      });
    }
    var btnBuscar = document.getElementById('btn-buscar-fecha');
    if (btnBuscar) {
      btnBuscar.addEventListener('click', function () {
        state.page = 1;
        render();
      });
    }
    var btnLimpiar = document.getElementById('btn-limpiar-fecha');
    if (btnLimpiar) {
      btnLimpiar.addEventListener('click', function () {
        state.filterFechaDesde = '';
        state.filterFechaHasta = '';
        state.page = 1;
        render();
      });
    }
  } else {
    document.getElementById('back-btn').addEventListener('click', function () {
      state.view = 'list';
      render();
    });
    document.querySelectorAll('.attach-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.querySelector('.dest-file-input[data-id="' + btn.getAttribute('data-id') + '"]');
        input.click();
      });
    });
    document.querySelectorAll('.dest-file-input').forEach(function (input) {
      input.addEventListener('change', function () {
        if (!input.files.length) return;
        var destId = input.getAttribute('data-id');
        fileToBase64(input.files[0], function (archivoData) {
          showToast('Subiendo respuesta...');
          apiPost('marcarRespuestaDestinatario', { destinatarioId: destId, archivo: archivoData }).then(function () {
            showToast('Respuesta registrada');
            cargarRegistros();
          });
        });
      });
    });
    document.getElementById('obs-input').addEventListener('blur', function (e) {
      var n = registros.find(function (x) { return x.id === state.selectedId; });
      var nuevo = e.target.value;
      if (nuevo !== (n.observaciones || '')) {
        n.observaciones = nuevo;
        apiPost('actualizarRegistro', { id: n.id, cambios: { observaciones: nuevo } });
      }
    });
    document.getElementById('det-direccion').addEventListener('change', function (e) {
      var n = registros.find(function (x) { return x.id === state.selectedId; });
      var nueva = e.target.value;
      n.direccion = nueva;
      apiPost('actualizarRegistro', { id: n.id, cambios: { Direccion: nueva } });
      showToast('Dirección actualizada');
      render();
    });
    document.getElementById('det-estado').addEventListener('change', function (e) {
      var n = registros.find(function (x) { return x.id === state.selectedId; });
      var nuevoEstado = e.target.value;
      n.estado = nuevoEstado;
      apiPost('actualizarRegistro', { id: n.id, cambios: { Estado: nuevoEstado } });
      showToast('Estado actualizado');
      render();
    });
    document.getElementById('det-numero').addEventListener('blur', function (e) {
      var n = registros.find(function (x) { return x.id === state.selectedId; });
      var nuevo = e.target.value.trim();
      if (nuevo !== n.numero) {
        n.numero = nuevo;
        apiPost('actualizarRegistro', { id: n.id, cambios: { Numero: nuevo } });
        showToast('Número actualizado');
      }
    });
    document.getElementById('det-referencia').addEventListener('blur', function (e) {
      var n = registros.find(function (x) { return x.id === state.selectedId; });
      var nueva = e.target.value.trim();
      if (nueva !== n.referencia) {
        n.referencia = nueva;
        apiPost('actualizarRegistro', { id: n.id, cambios: { Referencia: nueva } });
        showToast('Referencia actualizada');
      }
    });
    document.getElementById('det-fecha').addEventListener('change', function (e) {
      var n = registros.find(function (x) { return x.id === state.selectedId; });
      var nueva = isoToDmy(e.target.value);
      n.fecha = nueva;
      apiPost('actualizarRegistro', { id: n.id, cambios: { fecha: nueva } });
      showToast('Fecha actualizada');
    });
    document.getElementById('det-fechalimite').addEventListener('change', async function (e) {
      var n = registros.find(function (x) { return x.id === state.selectedId; });
      var nueva = isoToDmy(e.target.value);
      n.fechaLimite = nueva;
      await apiPost('actualizarRegistro', { id: n.id, cambios: { fechaLimite: nueva } });
      showToast('Fecha de vencimiento actualizada');
      await cargarRegistros();
    });
    document.getElementById('delete-btn').addEventListener('click', async function () {
      var n = registros.find(function (x) { return x.id === state.selectedId; });
      if (!confirm('¿Eliminar el registro ' + n.numero + '? Esta acción no se puede deshacer.')) return;
      showToast('Eliminando registro...');
      await apiPost('eliminarRegistro', { id: n.id });
      showToast('Registro eliminado');
      state.view = 'list';
      await cargarRegistros();
    });
    document.getElementById('add-dest-detail-btn').addEventListener('click', function () {
      document.getElementById('add-dest-form').style.display = 'block';
      document.getElementById('add-dest-detail-btn').style.display = 'none';
      document.getElementById('new-dest-nombre').focus();
    });
    document.getElementById('cancel-dest-btn').addEventListener('click', function () {
      document.getElementById('add-dest-form').style.display = 'none';
      document.getElementById('add-dest-detail-btn').style.display = 'block';
      document.getElementById('new-dest-nombre').value = '';
      document.getElementById('new-dest-dep').value = '';
    });
    document.getElementById('save-dest-btn').addEventListener('click', async function () {
      var nombre = document.getElementById('new-dest-nombre').value.trim();
      var dep = document.getElementById('new-dest-dep').value.trim();
      if (!nombre) { showToast('Ingresá el nombre'); return; }
      var n = registros.find(function (x) { return x.id === state.selectedId; });
      showToast('Agregando destinatario...');
      await apiPost('agregarDestinatario', { notaId: n.id, nombre: nombre, dependencia: dep });
      showToast('Destinatario agregado');
      await cargarRegistros();
      state.view = 'detail';
      render();
    });
    document.querySelectorAll('.delete-dest-btn').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        if (!confirm('¿Eliminar este destinatario?')) return;
        var destId = btn.getAttribute('data-id');
        showToast('Eliminando destinatario...');
        await apiPost('eliminarDestinatario', { destinatarioId: destId });
        showToast('Destinatario eliminado');
        await cargarRegistros();
        state.view = 'detail';
        render();
      });
    });
    document.querySelectorAll('.dest-nombre-input').forEach(function (input) {
      input.addEventListener('blur', function () {
        var destId = input.getAttribute('data-id');
        var nuevo = input.value.trim();
        if (nuevo) apiPost('actualizarDestinatario', { destinatarioId: destId, campo: 'Nombre', valor: nuevo });
      });
    });
    document.querySelectorAll('.dest-dep-input').forEach(function (input) {
      input.addEventListener('blur', function () {
        var destId = input.getAttribute('data-id');
        var nuevo = input.value.trim();
        apiPost('actualizarDestinatario', { destinatarioId: destId, campo: 'Dependencia', valor: nuevo });
      });
    });
    document.querySelectorAll('.dest-fecha-resp-input').forEach(function (input) {
      input.addEventListener('change', function () {
        var destId = input.getAttribute('data-id');
        var nueva = isoToDmy(input.value);
        apiPost('actualizarDestinatario', { destinatarioId: destId, campo: 'FechaRespuesta', valor: nueva });
        showToast('Fecha de respuesta actualizada');
      });
    });
  }
}

function bindTableClicks() {
  document.querySelectorAll('.note-row').forEach(function (row) {
    row.addEventListener('click', function (e) {
      if (e.target.classList.contains('estado-rapido') || e.target.classList.contains('direccion-rapido')) return;
      state.selectedId = row.getAttribute('data-id');
      state.view = 'detail';
      render();
    });
  });
  document.querySelectorAll('.direccion-rapido').forEach(function (sel) {
    sel.addEventListener('change', function (e) {
      e.stopPropagation();
      var id = sel.getAttribute('data-id');
      var nueva = sel.value;
      var n = registros.find(function (x) { return x.id === id; });
      if (n) n.direccion = nueva;
      apiPost('actualizarRegistro', { id: id, cambios: { Direccion: nueva } });
      showToast('Dirección actualizada');
      render();
    });
  });
  document.querySelectorAll('.estado-rapido').forEach(function (sel) {
    sel.addEventListener('change', function (e) {
      e.stopPropagation();
      var id = sel.getAttribute('data-id');
      var nuevoEstado = sel.value;
      var n = registros.find(function (x) { return x.id === id; });
      if (n) n.estado = nuevoEstado;
      apiPost('actualizarRegistro', { id: id, cambios: { Estado: nuevoEstado } });
      showToast('Estado actualizado');
      render();
    });
  });
}

async function handleQuickFiles(fileList) {
  var files = Array.prototype.slice.call(fileList);
  var total = files.length;
  for (var i = 0; i < total; i++) {
    var file = files[i];
    showToast('Procesando ' + (i + 1) + ' de ' + total + ': ' + file.name);
    await new Promise(function (resolve) {
      fileToBase64(file, async function (archivoData) {
        var res = await apiPost('crearRegistroDesdeArchivo', { archivo: archivoData, direccion: 'Entrada' });
        if (res.duplicado) {
          if (confirm('Ya existe un registro con el número ' + res.numero + '. ¿Desea reemplazarlo?')) {
            await apiPost('eliminarRegistroPorNumero', { numero: res.numero });
            showToast('Registro anterior eliminado, creando nuevo...');
            await apiPost('crearRegistroDesdeArchivo', { archivo: archivoData, direccion: 'Entrada' });
          } else {
            showToast('Se omitió: ' + res.numero);
          }
        }
        resolve();
      });
    });
  }
  showToast(total + ' archivos procesados.');
  await cargarRegistros();
}

function dmyToIso(dmy) {
  if (!dmy) return '';
  var p = dmy.split('/');
  return p[2] + '-' + p[1] + '-' + p[0];
}
function isoToDmy(iso) {
  if (!iso) return '';
  var p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}
function hoyIso() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('dest-inputs').innerHTML = '';
  document.getElementById('f-fecha').value = hoyIso();
  addDestRow();
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('f-numero').value = '';
  document.getElementById('f-referencia').value = '';
  document.getElementById('f-obs').value = '';
  document.getElementById('f-archivo').value = '';
}
function addDestRow() {
  var wrap = document.getElementById('dest-inputs');
  var row = document.createElement('div');
  row.className = 'dest-input-row';
  row.innerHTML = '<input type="text" placeholder="Nombre" class="dest-nombre"><input type="text" placeholder="Dependencia" class="dest-dep">';
  wrap.appendChild(row);
}

document.getElementById('add-dest-btn').addEventListener('click', addDestRow);
document.getElementById('cancel-modal-btn').addEventListener('click', closeModal);
document.getElementById('f-estado').addEventListener('change', function (e) {
  document.getElementById('f-fechalimite-wrap').style.display = e.target.value === 'espera' ? 'block' : 'none';
});

document.getElementById('save-modal-btn').addEventListener('click', async function () {
  var numero = document.getElementById('f-numero').value.trim();
  if (!numero) { showToast('Ingresá un número de referencia'); return; }

  var destinatarios = [];
  document.querySelectorAll('.dest-input-row').forEach(function (row) {
    var nombre = row.querySelector('.dest-nombre').value.trim();
    var dep = row.querySelector('.dest-dep').value.trim();
    if (nombre) destinatarios.push({ nombre: nombre, dependencia: dep });
  });

  var fechaLimiteRaw = document.getElementById('f-fechalimite').value;
  var fechaLimite = fechaLimiteRaw ? isoToDmy(fechaLimiteRaw) : '';
  var fechaRaw = document.getElementById('f-fecha').value;
  var fecha = fechaRaw ? isoToDmy(fechaRaw) : '';

  var fileInput = document.getElementById('f-archivo');
  function procesarGuardado(archData) {
    apiGet('existeNumero', { numero: numero }).then(function (existe) {
      if (existe) {
        if (confirm('Ya existe un registro con el número ' + numero + '. ¿Desea reemplazarlo?')) {
          apiPost('eliminarRegistroPorNumero', { numero: numero }).then(function () {
            showToast('Registro anterior eliminado, creando nuevo...');
            guardarLayout(archData);
          });
        } else {
          showToast('Se canceló el guardado');
        }
      } else {
        guardarLayout(archData);
      }
    });
  }
  async function guardarLayout(archData) {
    var data = {
      numero: numero,
      referencia: document.getElementById('f-referencia').value.trim(),
      direccion: document.getElementById('f-direccion').value,
      estado: document.getElementById('f-estado').value,
      fecha: fecha,
      fechaLimite: fechaLimite,
      observaciones: document.getElementById('f-obs').value.trim(),
      destinatarios: destinatarios,
      archivo: archData
    };
    showToast('Guardando registro...');
    await apiPost('crearRegistro', { data: data });
    showToast('Registro guardado');
    closeModal();
    await cargarRegistros();
  }
  if (fileInput.files.length) {
    fileToBase64(fileInput.files[0], procesarGuardado);
  } else {
    procesarGuardado(null);
  }
});

function bindTabs() {
  document.querySelectorAll('.tab-link').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab-link').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      state.tab = tab.getAttribute('data-tab');
      state.view = 'list';
      render();
    });
  });
}

cargarUsuario();
bindTabs();
cargarRegistros();
